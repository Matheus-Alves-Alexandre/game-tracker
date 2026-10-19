use super::*;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameList {
    pub id: String,
    pub name: String,
    pub total: u32,
    pub completed: u32,
}

impl Store {
    pub fn game_lists(&self) -> Result<Vec<GameList>, String> {
        let mut statement = self
            .0
            .prepare(
                "SELECT l.id,l.name,COUNT(e.id),COALESCE(SUM(e.status='completed'),0)
            FROM game_lists l LEFT JOIN game_list_entries m ON m.list_id=l.id
            LEFT JOIN library_entries e ON e.id=m.entry_id
            GROUP BY l.id ORDER BY l.name COLLATE NOCASE,l.id LIMIT 100",
            )
            .map_err(|e| e.to_string())?;
        statement
            .query_map([], |r| {
                Ok(GameList {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    total: r.get(2)?,
                    completed: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    pub fn save_game_list(&self, id: Option<String>, name: &str) -> Result<String, String> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 120 || name.chars().any(char::is_control) {
            return Err("Use a list name between 1 and 120 characters.".into());
        }
        if let Some(id) = id {
            if self
                .0
                .execute(
                    "UPDATE game_lists SET name=?1 WHERE id=?2",
                    params![name, id],
                )
                .map_err(|e| e.to_string())?
                == 0
            {
                return Err("List not found.".into());
            }
            Ok(id)
        } else {
            let count: i64 = self
                .0
                .query_row("SELECT COUNT(*) FROM game_lists", [], |r| r.get(0))
                .map_err(|e| e.to_string())?;
            if count >= 100 {
                return Err("You can have up to 100 lists.".into());
            }
            let id = Uuid::new_v4().to_string();
            self.0
                .execute(
                    "INSERT INTO game_lists(id,name) VALUES(?1,?2)",
                    params![id, name],
                )
                .map_err(|e| e.to_string())?;
            Ok(id)
        }
    }
    pub fn delete_game_list(&self, id: &str) -> Result<(), String> {
        self.0
            .execute("DELETE FROM game_lists WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn list_members(&self, id: &str, offset: u32) -> Result<Vec<Game>, String> {
        let mut statement = self
            .0
            .prepare(&format!(
                "SELECT {GAME_COLUMNS} FROM game_list_entries m
            JOIN library_entries e ON e.id=m.entry_id JOIN games g ON g.id=e.game_id
            WHERE m.list_id=?1 ORDER BY m.position,e.id LIMIT 100 OFFSET ?2"
            ))
            .map_err(|e| e.to_string())?;
        statement
            .query_map(params![id, offset], read_game)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }
    pub fn add_list_game(
        &mut self,
        list_id: &str,
        entry_id: Option<String>,
        title: &str,
        platform: &str,
    ) -> Result<(), String> {
        if entry_id.is_none()
            && (title.trim().is_empty()
                || title.chars().count() > 200
                || platform.chars().count() > 100
                || title.chars().any(char::is_control))
        {
            return Err(
                "Enter a game title (up to 200 characters) and platform (up to 100).".into(),
            );
        }
        let tx = self.0.transaction().map_err(|e| e.to_string())?;
        let exists: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM game_lists WHERE id=?1)",
                [list_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err("List not found.".into());
        }
        let entry_id = if let Some(id) = entry_id {
            id
        } else {
            // Reuse an existing title/platform pair, including archived records.
            let existing:Option<String>=tx.query_row("SELECT e.id FROM library_entries e JOIN games g ON g.id=e.game_id WHERE g.title=?1 COLLATE NOCASE AND e.platform=?2 COLLATE NOCASE ORDER BY e.archived,e.id LIMIT 1",params![title.trim(),platform.trim()],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
            if let Some(id) = existing {
                id
            } else {
                let game_id = Uuid::new_v4().to_string();
                let id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO games(id,title) VALUES(?1,?2)",
                    params![game_id, title.trim()],
                )
                .map_err(|e| e.to_string())?;
                tx.execute("INSERT INTO library_entries(id,game_id,platform,status,platinum_status) VALUES(?1,?2,?3,'planned','not_achieved')",params![id,game_id,platform.trim()]).map_err(|e|e.to_string())?;
                id
            }
        };
        tx.execute("INSERT INTO game_list_entries(list_id,entry_id,position) VALUES(?1,?2,COALESCE((SELECT MAX(position)+1 FROM game_list_entries WHERE list_id=?1),0)) ON CONFLICT(list_id,entry_id) DO NOTHING",params![list_id,entry_id]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }
    pub fn remove_list_game(&self, list_id: &str, entry_id: &str) -> Result<(), String> {
        self.0
            .execute(
                "DELETE FROM game_list_entries WHERE list_id=?1 AND entry_id=?2",
                params![list_id, entry_id],
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    pub fn complete_list_game(
        &self,
        list_id: &str,
        entry_id: &str,
        completed: bool,
    ) -> Result<(), String> {
        let changed=self.0.execute("UPDATE library_entries SET status=CASE WHEN ?3 THEN 'completed' ELSE 'planned' END,
            completed_on=CASE WHEN ?3 THEN completed_on ELSE NULL END,
            archived=CASE WHEN ?3 THEN 0 ELSE archived END
            WHERE id=?2 AND EXISTS(SELECT 1 FROM game_list_entries WHERE list_id=?1 AND entry_id=?2)",params![list_id,entry_id,completed]).map_err(|e|e.to_string())?;
        if changed == 0 {
            return Err("Game not found in this list.".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_is_shared_persisted_and_removal_keeps_library_records() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("lists.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let saga = store.save_game_list(None, "Devil May Cry").unwrap();
        let favorites = store.save_game_list(None, "Next adventures").unwrap();
        store
            .add_list_game(&saga, None, "Devil May Cry", "PC")
            .unwrap();
        store
            .add_list_game(&saga, None, "Devil May Cry 2", "PC")
            .unwrap();
        let id = store.list_members(&saga, 0).unwrap()[0].id.clone();
        store
            .add_list_game(&favorites, Some(id.clone()), "", "")
            .unwrap();
        store
            .add_list_game(&saga, None, "devil may cry", "pc")
            .unwrap();
        assert_eq!(store.dashboard().unwrap().total, 2);
        store.set_archived(&id, true).unwrap();
        store.complete_list_game(&saga, &id, true).unwrap();
        assert_eq!(store.dashboard().unwrap().completed, 1);
        assert_eq!(
            store.list_members(&favorites, 0).unwrap()[0].status,
            "completed"
        );
        assert_eq!(store.list_members(&saga, 0).unwrap()[0].completed_on, None);
        drop(store);
        let store = Store::open(&path).unwrap();
        let lists = store.game_lists().unwrap();
        let progress = lists.iter().find(|l| l.id == saga).unwrap();
        assert_eq!((progress.total, progress.completed), (2, 1));
        assert!(
            store
                .complete_list_game(&favorites, "missing", true)
                .is_err()
        );
        store.complete_list_game(&favorites, &id, false).unwrap();
        assert_eq!(store.dashboard().unwrap().completed, 0);
        store.remove_list_game(&saga, &id).unwrap();
        store.delete_game_list(&favorites).unwrap();
        assert_eq!(store.dashboard().unwrap().total, 2);
        assert_eq!(store.list_members(&saga, 0).unwrap().len(), 1);
    }

    #[test]
    fn library_edits_drive_progress_and_failed_adds_leave_no_orphans() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        assert!(store.save_game_list(None, "   ").is_err());
        assert!(
            store
                .add_list_game("missing", None, "Orphan", "PC")
                .is_err()
        );
        assert_eq!(store.dashboard().unwrap().total, 0);
        let list = store.save_game_list(None, "Saga").unwrap();
        assert!(
            store
                .add_list_game(&list, Some("missing".into()), "", "")
                .is_err()
        );
        store.add_list_game(&list, None, "First", "PC").unwrap();
        let game = store.list_members(&list, 0).unwrap().remove(0);
        let mut input: GameInput =
            serde_json::from_value(serde_json::to_value(game).unwrap()).unwrap();
        input.status = "completed".into();
        input.completed_on = Some("2026-10-19".into());
        input.notes = "Keep my review".into();
        input.rating = Some(5);
        let game = store.save(input).unwrap();
        assert_eq!(store.game_lists().unwrap()[0].completed, 1);
        store.complete_list_game(&list, &game.id, false).unwrap();
        let game = store.list_members(&list, 0).unwrap().remove(0);
        assert_eq!(game.completed_on, None);
        assert_eq!(game.rating, Some(5));
        assert_eq!(game.notes, "Keep my review");
    }

    #[test]
    fn version_two_migration_backs_up_and_preserves_library() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let list = store.save_game_list(None, "Before upgrade").unwrap();
        store
            .add_list_game(&list, None, "Keep this game", "PC")
            .unwrap();
        store
            .0
            .execute_batch(
                "DROP TABLE game_list_entries; DROP TABLE game_lists; PRAGMA user_version=2;",
            )
            .unwrap();
        drop(store);
        let store = Store::open(&path).unwrap();
        assert!(store.game_lists().unwrap().is_empty());
        assert_eq!(
            store
                .list("Keep this game", "planned", 0, false)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            store
                .0
                .pragma_query_value(None, "user_version", |r| r.get::<_, u32>(0))
                .unwrap(),
            3
        );
        let backup = std::fs::read_dir(directory.path())
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("library-before-v3-")
            })
            .unwrap();
        let backup = Connection::open(backup).unwrap();
        assert_eq!(
            backup
                .pragma_query_value(None, "user_version", |r| r.get::<_, u32>(0))
                .unwrap(),
            2
        );
    }
}
