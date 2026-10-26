use super::*;
use std::collections::BTreeMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SagaGroup {
    pub id: i64,
    pub name: String,
    pub kind: String,
}
#[derive(Deserialize)]
struct Group {
    id: i64,
    name: String,
}
#[derive(Deserialize)]
struct Seed {
    #[serde(default)]
    collections: Vec<Group>,
    #[serde(default)]
    franchises: Vec<Group>,
    franchise: Option<Group>,
}
#[derive(Deserialize)]
struct GameType {
    #[serde(rename = "type")]
    name: String,
}
#[derive(Deserialize)]
struct Row {
    #[serde(flatten)]
    game: ApiGame,
    game_type: Option<GameType>,
    version_parent: Option<i64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SagaCandidate {
    #[serde(flatten)]
    pub game: Candidate,
    pub kind: String,
    pub edition: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SagaPage {
    pub games: Vec<SagaCandidate>,
    pub next_offset: Option<u32>,
}

impl Catalog {
    pub async fn search_sagas(&self, title: &str) -> Result<Vec<SagaGroup>, String> {
        search_query(title)?;
        let escaped = title.trim().replace('\\', "\\\\").replace('"', "\\\"");
        let seeds:Vec<Seed>=self.request(format!("search \"{escaped}\"; fields collections.name,franchises.name,franchise.name; limit 20;")).await?;
        let mut groups = BTreeMap::new();
        for seed in seeds {
            for (kind, items) in [
                ("collection", seed.collections),
                (
                    "franchise",
                    seed.franchises.into_iter().chain(seed.franchise).collect(),
                ),
            ] {
                for g in items.into_iter().take(40) {
                    if g.id > 0 && !g.name.trim().is_empty() && g.name.chars().count() <= 200 {
                        groups.entry((kind.to_string(), g.id)).or_insert(SagaGroup {
                            id: g.id,
                            name: g.name,
                            kind: kind.into(),
                        });
                    }
                }
            }
        }
        let mut groups: Vec<_> = groups.into_values().collect();
        groups.sort_by_key(|g| {
            (
                !g.name.eq_ignore_ascii_case(title.trim()),
                g.name.to_lowercase(),
                g.kind.clone(),
                g.id,
            )
        });
        groups.truncate(40);
        Ok(groups)
    }
    pub async fn saga_games(&self, kind: &str, id: i64, offset: u32) -> Result<SagaPage, String> {
        if id <= 0
            || !["collection", "franchise"].contains(&kind)
            || offset > 1900
            || !offset.is_multiple_of(100)
        {
            return Err("Invalid saga or page. Load at most 2,000 catalog games.".into());
        }
        let condition = if kind == "collection" {
            format!("collections = ({id})")
        } else {
            format!("(franchises = ({id}) | franchise = {id})")
        };
        let rows:Vec<Row>=self.request(format!("fields name,cover.image_id,first_release_date,platforms.name,rating,rating_count,game_type.type,version_parent; where {condition}; sort id asc; limit 100; offset {offset};")).await?;
        let next_offset = (rows.len() >= 100).then_some(offset + 100);
        let games = rows
            .into_iter()
            .take(100)
            .filter(|r| valid_game(&r.game))
            .map(|r| SagaCandidate {
                game: to_candidate(r.game),
                kind: r
                    .game_type
                    .map(|t| t.name.chars().take(60).collect())
                    .unwrap_or_else(|| "Unknown".into()),
                edition: r.version_parent.is_some(),
            })
            .collect();
        Ok(SagaPage { games, next_offset })
    }
}
