use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

const STATUSES: &[&str] = &["planned", "playing", "paused", "completed", "dropped"];
const PLATINUM: &[&str] = &["not_achieved", "planned", "achieved", "not_applicable"];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInput {
    pub id: Option<String>,
    pub title: String,
    pub platform: String,
    pub status: String,
    pub rating: Option<u8>,
    pub playtime_seconds: Option<i64>,
    pub completed_on: Option<String>,
    pub platinum_status: String,
    pub notes: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub title: String,
    pub platform: String,
    pub status: String,
    pub rating: Option<u8>,
    pub playtime_seconds: Option<i64>,
    pub completed_on: Option<String>,
    pub platinum_status: String,
    pub notes: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub total: u32,
    pub completed: u32,
    pub playing: u32,
    pub platinum: u32,
    pub average_rating: Option<f64>,
}
pub struct Store(Connection);
impl Store {
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let connection = Connection::open(path)?;
        let version: u32 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version > 1 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                Some("This library was created by a newer version. Update Game Tracker.".into()),
            ));
        }
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.execute_batch("PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, title TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS library_entries (
                id TEXT PRIMARY KEY, game_id TEXT NOT NULL UNIQUE REFERENCES games(id),
                platform TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL CHECK(status IN ('planned','playing','paused','completed','dropped')),
                rating INTEGER CHECK(rating BETWEEN 1 AND 5),
                playtime_seconds INTEGER CHECK(playtime_seconds >= 0), completed_on TEXT,
                platinum_status TEXT NOT NULL CHECK(platinum_status IN ('not_achieved','planned','achieved','not_applicable')),
                notes TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)));
            CREATE INDEX IF NOT EXISTS entries_status ON library_entries(archived, status);
            PRAGMA user_version = 1;")?;
        Ok(Self(connection))
    }
    pub fn list(
        &self,
        search: &str,
        status: &str,
        offset: u32,
        archived: bool,
    ) -> Result<Vec<Game>, String> {
        if !status.is_empty() && !STATUSES.contains(&status) {
            return Err("Invalid status filter.".into());
        }
        let query = format!("%{}%", search.trim());
        let mut statement = self.0.prepare("SELECT e.id, g.title, e.platform, e.status, e.rating,
            e.playtime_seconds, e.completed_on, e.platinum_status, e.notes
            FROM library_entries e JOIN games g ON g.id = e.game_id
            WHERE e.archived = ?4 AND (g.title LIKE ?1 OR e.platform LIKE ?1)
            AND (?2 = '' OR e.status = ?2) ORDER BY g.title COLLATE NOCASE, e.id LIMIT 100 OFFSET ?3")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![query, status, offset, archived], read_game)
            .map_err(|error| error.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())
    }
    pub fn save(&mut self, input: GameInput) -> Result<Game, String> {
        validate(&input)?;
        let title = input.title.trim();
        let id = input
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let transaction = self.0.transaction().map_err(|error| error.to_string())?;
        if input.id.is_some() {
            let game_id: String = transaction
                .query_row(
                    "SELECT game_id FROM library_entries WHERE id = ?1 AND archived = 0",
                    [&id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| error.to_string())?
                .ok_or("Game not found. Refresh the library.")?;
            transaction
                .execute(
                    "UPDATE games SET title = ?1 WHERE id = ?2",
                    params![title, game_id],
                )
                .map_err(|error| error.to_string())?;
            transaction.execute("UPDATE library_entries SET platform=?1, status=?2, rating=?3, playtime_seconds=?4, completed_on=?5, platinum_status=?6, notes=?7 WHERE id=?8",
                params![input.platform.trim(), input.status, input.rating, input.playtime_seconds, input.completed_on, input.platinum_status, input.notes, id]).map_err(|error| error.to_string())?;
        } else {
            let game_id = Uuid::new_v4().to_string();
            transaction
                .execute(
                    "INSERT INTO games(id,title) VALUES(?1,?2)",
                    params![game_id, title],
                )
                .map_err(|error| error.to_string())?;
            transaction.execute("INSERT INTO library_entries(id,game_id,platform,status,rating,playtime_seconds,completed_on,platinum_status,notes) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                params![id, game_id, input.platform.trim(), input.status, input.rating, input.playtime_seconds, input.completed_on, input.platinum_status, input.notes]).map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())?;
        Ok(Game {
            id,
            title: title.into(),
            platform: input.platform.trim().into(),
            status: input.status,
            rating: input.rating,
            playtime_seconds: input.playtime_seconds,
            completed_on: input.completed_on,
            platinum_status: input.platinum_status,
            notes: input.notes,
        })
    }
    pub fn set_archived(&self, id: &str, archived: bool) -> Result<(), String> {
        let changed = self
            .0
            .execute(
                "UPDATE library_entries SET archived = ?1 WHERE id = ?2",
                params![archived, id],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("Game not found.".into());
        }
        Ok(())
    }
    pub fn dashboard(&self) -> Result<Dashboard, String> {
        self.0.query_row("SELECT COUNT(*), COALESCE(SUM(status='completed'),0), COALESCE(SUM(status='playing'),0), COALESCE(SUM(platinum_status='achieved'),0), AVG(rating) FROM library_entries WHERE archived=0", [], |row| Ok(Dashboard {
            total: row.get(0)?, completed: row.get(1)?, playing: row.get(2)?, platinum: row.get(3)?, average_rating: row.get(4)?,
        })).map_err(|error| error.to_string())
    }
}
fn read_game(row: &rusqlite::Row<'_>) -> Result<Game, rusqlite::Error> {
    Ok(Game {
        id: row.get(0)?,
        title: row.get(1)?,
        platform: row.get(2)?,
        status: row.get(3)?,
        rating: row.get(4)?,
        playtime_seconds: row.get(5)?,
        completed_on: row.get(6)?,
        platinum_status: row.get(7)?,
        notes: row.get(8)?,
    })
}
fn validate(input: &GameInput) -> Result<(), String> {
    if input.title.trim().is_empty() || input.title.chars().count() > 300 {
        return Err("Enter a game title (up to 300 characters).".into());
    }
    if input.platform.chars().count() > 100 || input.notes.chars().count() > 10_000 {
        return Err("Platform or notes are too long.".into());
    }
    if !STATUSES.contains(&input.status.as_str())
        || !PLATINUM.contains(&input.platinum_status.as_str())
    {
        return Err("Choose a valid status and platinum goal.".into());
    }
    if input
        .rating
        .is_some_and(|rating| !(1..=5).contains(&rating))
    {
        return Err("Rating must be between 1 and 5, or empty.".into());
    }
    if input
        .playtime_seconds
        .is_some_and(|seconds| !(0..=3_600_000_000).contains(&seconds))
    {
        return Err("Enter a valid non-negative playtime.".into());
    }
    if let Some(date) = &input.completed_on {
        let parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|_| "Enter a valid completion date.")?;
        if parsed.format("%Y-%m-%d").to_string() != *date {
            return Err("Use a YYYY-MM-DD completion date.".into());
        }
        if input.status != "completed" {
            return Err("A completion date requires Completed status.".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn input(title: &str) -> GameInput {
        GameInput {
            id: None,
            title: title.into(),
            platform: "PC".into(),
            status: "playing".into(),
            rating: None,
            playtime_seconds: None,
            completed_on: None,
            platinum_status: "not_achieved".into(),
            notes: String::new(),
        }
    }
    #[test]
    fn persists_edits_and_preserves_unknown_vs_zero() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("test.sqlite3");
        let id;
        {
            let mut store = Store::open(&path).unwrap();
            let game = store.save(input("Hollow Knight")).unwrap();
            id = game.id;
            let mut changed = input("Hollow Knight: updated");
            changed.id = Some(id.clone());
            changed.playtime_seconds = Some(0);
            changed.rating = Some(4);
            store.save(changed).unwrap();
        }
        let store = Store::open(&path).unwrap();
        let games = store.list("updated", "playing", 0, false).unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, id);
        assert_eq!(games[0].playtime_seconds, Some(0));
        assert_eq!(games[0].rating, Some(4));
    }
    #[test]
    fn rejects_invalid_values_without_partial_writes() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        for rating in [0, 6] {
            let mut game = input("Bad rating");
            game.rating = Some(rating);
            assert!(store.save(game).is_err());
        }
        let mut game = input("Bad date");
        game.status = "completed".into();
        game.completed_on = Some("2026-02-30".into());
        assert!(store.save(game).is_err());
        let mut game = input("Negative time");
        game.playtime_seconds = Some(-1);
        assert!(store.save(game).is_err());
        let mut game = input("Missing entry");
        game.id = Some("unknown".into());
        assert!(store.save(game).is_err());
        assert_eq!(store.dashboard().unwrap().total, 0);
    }
    #[test]
    fn filters_and_archive_restore_keep_metrics_consistent() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        let first = store.save(input("A game")).unwrap();
        let mut second = input("B game");
        second.status = "completed".into();
        second.rating = Some(5);
        second.platinum_status = "achieved".into();
        store.save(second).unwrap();
        assert_eq!(store.list("", "completed", 0, false).unwrap().len(), 1);
        assert_eq!(store.dashboard().unwrap().average_rating, Some(5.0));
        store.set_archived(&first.id, true).unwrap();
        assert_eq!(store.dashboard().unwrap().total, 1);
        store.set_archived(&first.id, false).unwrap();
        assert_eq!(store.dashboard().unwrap().total, 2);
        assert_eq!(store.dashboard().unwrap().platinum, 1);
    }
    #[test]
    fn pagination_is_bounded() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        for number in 0..105 {
            store.save(input(&format!("Game {number:03}"))).unwrap();
        }
        assert_eq!(store.list("", "", 0, false).unwrap().len(), 100);
        assert_eq!(store.list("", "", 100, false).unwrap().len(), 5);
    }

    #[test]
    fn refuses_newer_databases_without_downgrading_them() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("future.sqlite3");
        let connection = Connection::open(&path).unwrap();
        connection.pragma_update(None, "user_version", 99).unwrap();
        drop(connection);
        assert!(Store::open(&path).is_err());
        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 99);
    }

    #[test]
    fn archive_is_searchable_after_reopening_and_restore_preserves_fields() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("library.sqlite3");
        let mut store = Store::open(&path).unwrap();
        let mut original = input("Archived adventure");
        original.notes = "Keep this history".into();
        original.rating = Some(4);
        let game = store.save(original).unwrap();
        store.set_archived(&game.id, true).unwrap();
        drop(store);
        let store = Store::open(&path).unwrap();
        assert!(store.list("", "", 0, false).unwrap().is_empty());
        assert_eq!(store.dashboard().unwrap().total, 0);
        assert!(store.list("missing", "", 0, true).unwrap().is_empty());
        assert!(store.list("", "completed", 0, true).unwrap().is_empty());
        let archived = store.list("adventure", "playing", 0, true).unwrap();
        assert_eq!(archived.len(), 1);
        assert_eq!(archived[0].id, game.id);
        store.set_archived(&game.id, false).unwrap();
        let restored = store.list("", "", 0, false).unwrap();
        assert_eq!(restored[0].notes, "Keep this history");
        assert_eq!(restored[0].rating, Some(4));
        assert!(store.list("", "", 0, true).unwrap().is_empty());
        assert_eq!(store.dashboard().unwrap().total, 1);
    }
}
