use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

const IMAGE_LIMIT: usize = 2 * 1024 * 1024;
struct Session {
    client_id: String,
    token: String,
    expires: Instant,
}
pub struct Catalog {
    client: Result<Client, String>,
    session: Mutex<Option<Session>>,
    last_request: Mutex<Option<Instant>>,
    token_url: String,
    games_url: String,
    image_root: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: i64,
    pub name: String,
    pub cover_image_id: Option<String>,
    pub released_at: Option<i64>,
    pub platforms: Vec<String>,
    pub community_rating: Option<f64>,
    pub rating_count: u64,
}
#[derive(Deserialize)]
struct Token {
    access_token: String,
    expires_in: u64,
    token_type: String,
}
#[derive(Deserialize)]
struct Image {
    image_id: String,
}
#[derive(Deserialize)]
struct Platform {
    name: String,
}
#[derive(Deserialize)]
struct ApiGame {
    id: i64,
    name: String,
    cover: Option<Image>,
    first_release_date: Option<i64>,
    #[serde(default)]
    platforms: Vec<Platform>,
    rating: Option<f64>,
    #[serde(default)]
    rating_count: u64,
}
impl Catalog {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(12))
                .connect_timeout(Duration::from_secs(5))
                .user_agent("GameTracker/0.1 (optional personal IGDB lookup)")
                .build()
                .map_err(|_| {
                    "Online lookup is unavailable. Your local library still works.".into()
                }),
            session: Mutex::new(None),
            last_request: Mutex::new(None),
            token_url: "https://id.twitch.tv/oauth2/token".into(),
            games_url: "https://api.igdb.com/v4/games".into(),
            image_root: "https://images.igdb.com/igdb/image/upload/t_cover_big".into(),
        }
    }
    fn client(&self) -> Result<&Client, String> {
        self.client.as_ref().map_err(Clone::clone)
    }
    pub async fn connect(&self, client_id: String, client_secret: String) -> Result<(), String> {
        if !credential(&client_id) || !credential(&client_secret) {
            return Err("Enter your Twitch application's Client ID and Client Secret.".into());
        }
        let mut session = self.session.lock().await;
        *session = None;
        let response = self
            .client()?
            .post(&self.token_url)
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .map_err(|_| "Could not reach Twitch. Check your connection and try again.")?;
        if !response.status().is_success() {
            return Err("Twitch did not accept the connection. Check your application credentials and try again.".into());
        }
        let token: Token = serde_json::from_slice(&bounded(response, 8192).await?)
            .map_err(|_| "Twitch returned an unexpected response.")?;
        if !credential(&token.access_token) || token.token_type != "bearer" || token.expires_in == 0
        {
            return Err("Twitch returned an invalid session.".into());
        }
        *session = Some(Session {
            client_id,
            token: token.access_token,
            expires: Instant::now()
                + Duration::from_secs(token.expires_in.saturating_sub(60).clamp(1, 90 * 86400)),
        });
        // The client secret is deliberately not retained or written to disk.
        Ok(())
    }
    pub async fn connected(&self) -> bool {
        self.session
            .lock()
            .await
            .as_ref()
            .is_some_and(|s| s.expires > Instant::now())
    }
    pub async fn disconnect(&self) {
        *self.session.lock().await = None;
    }
    pub async fn search(&self, title: &str) -> Result<Vec<Candidate>, String> {
        let query = search_query(title)?;
        let mut session = self.session.lock().await;
        let Some(auth) = session.as_ref().filter(|s| s.expires > Instant::now()) else {
            *session = None;
            return Err("Connect to IGDB first. Your previous session may have expired.".into());
        };
        let mut last = self.last_request.lock().await;
        if let Some(previous) = *last {
            tokio::time::sleep(Duration::from_millis(350).saturating_sub(previous.elapsed())).await;
        }
        *last = Some(Instant::now());
        let response = self
            .client()?
            .post(&self.games_url)
            .header("Client-ID", &auth.client_id)
            .bearer_auth(&auth.token)
            .header("Accept", "application/json")
            .header("Content-Type", "text/plain")
            .body(query)
            .send()
            .await
            .map_err(|_| "Could not reach IGDB. Your local library is still available.")?;
        match response.status() {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                *session = None;
                return Err("Your IGDB session was rejected. Connect again.".into());
            }
            StatusCode::TOO_MANY_REQUESTS => {
                return Err("IGDB is busy. Wait a moment before searching again.".into());
            }
            status if !status.is_success() => {
                return Err("IGDB lookup is unavailable. Try again later.".into());
            }
            _ => {}
        }
        let games: Vec<ApiGame> = serde_json::from_slice(&bounded(response, 256 * 1024).await?)
            .map_err(|_| "IGDB returned an unexpected response.")?;
        Ok(games
            .into_iter()
            .filter(|g| g.id > 0 && !g.name.trim().is_empty() && g.name.chars().count() <= 300)
            .take(8)
            .map(|g| Candidate {
                id: g.id,
                name: g.name,
                cover_image_id: g.cover.map(|c| c.image_id).filter(|id| valid_image_id(id)),
                released_at: g.first_release_date,
                platforms: g
                    .platforms
                    .into_iter()
                    .take(20)
                    .map(|p| p.name.chars().take(100).collect())
                    .collect(),
                community_rating: g
                    .rating
                    .filter(|r| r.is_finite() && (0.0..=100.0).contains(r)),
                rating_count: g.rating_count,
            })
            .collect())
    }
    pub async fn cache_cover(&self, directory: &Path, image_id: &str) -> Result<(), String> {
        if !valid_image_id(image_id) {
            return Err("Invalid cover identifier.".into());
        }
        let path = directory.join(format!("{image_id}.jpg"));
        if matches!(read_cover(directory, image_id).await, Ok(Some(_))) {
            return Ok(());
        }
        let response = self
            .client()?
            .get(format!("{}/{image_id}.jpg", self.image_root))
            .send()
            .await
            .map_err(|_| "Could not download this cover. Try again when online.")?;
        if !response.status().is_success() {
            return Err("This cover is currently unavailable.".into());
        }
        let bytes = bounded(response, IMAGE_LIMIT).await?;
        if !jpeg(&bytes) {
            return Err("The cover was not a supported JPEG image.".into());
        }
        tokio::fs::create_dir_all(directory)
            .await
            .map_err(|_| "Could not create the local cover folder.")?;
        let temporary = directory.join(format!("{image_id}-{}.tmp", uuid::Uuid::new_v4()));
        tokio::fs::write(&temporary, bytes)
            .await
            .map_err(|_| "Could not save the cover on this computer.")?;
        if tokio::fs::rename(&temporary, &path).await.is_err() {
            let _ = tokio::fs::remove_file(&temporary).await;
            return Err("Could not finish saving the cover. Try again.".into());
        }
        Ok(())
    }
}
pub fn valid_image_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn credential(value: &str) -> bool {
    !value.is_empty() && value.len() <= 256 && value.bytes().all(|c| c.is_ascii_alphanumeric())
}
fn jpeg(bytes: &[u8]) -> bool {
    bytes.starts_with(&[0xff, 0xd8, 0xff]) && bytes.ends_with(&[0xff, 0xd9])
}
fn search_query(value: &str) -> Result<String, String> {
    let value = value.trim();
    if !(2..=120).contains(&value.chars().count()) || value.chars().any(char::is_control) {
        return Err("Search with 2–120 characters.".into());
    }
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    Ok(format!(
        "search \"{escaped}\"; fields name,cover.image_id,first_release_date,platforms.name,rating,rating_count; limit 8;"
    ))
}
async fn bounded(mut response: Response, maximum: usize) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|n| n > maximum as u64)
    {
        return Err("The online response was too large.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The download was interrupted. Try again.")?
    {
        if bytes.len() + chunk.len() > maximum {
            return Err("The online response was too large.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
pub async fn read_cover(directory: &Path, image_id: &str) -> Result<Option<String>, String> {
    if !valid_image_id(image_id) {
        return Err("Invalid cover identifier.".into());
    }
    let path = directory.join(format!("{image_id}.jpg"));
    match tokio::fs::metadata(&path).await {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Could not read the local cover.".into()),
        Ok(info) if info.len() > IMAGE_LIMIT as u64 => {
            return Err("The local cover is too large.".into());
        }
        _ => {}
    }
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| "Could not read the local cover.")?;
    if bytes.len() > IMAGE_LIMIT || !jpeg(&bytes) {
        return Err("The local cover is damaged. Download it again.".into());
    }
    Ok(Some(format!(
        "data:image/jpeg;base64,{}",
        STANDARD.encode(bytes)
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;

    fn mock_server(
        responses: Vec<(u16, Vec<u8>)>,
    ) -> (Catalog, mpsc::Receiver<String>, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        listener.set_nonblocking(true).unwrap();
        let (send, receive) = mpsc::channel();
        let handle = std::thread::spawn(move || {
            for (status, body) in responses {
                let deadline = Instant::now() + Duration::from_secs(8);
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(e)
                            if e.kind() == std::io::ErrorKind::WouldBlock
                                && Instant::now() < deadline =>
                        {
                            std::thread::sleep(Duration::from_millis(10))
                        }
                        Err(e) => panic!("test server did not receive expected request: {e}"),
                    }
                };
                // Windows can inherit the listener's nonblocking mode on accepted sockets.
                // Keep accept bounded above, but wait for complete request chunks below.
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                stream
                    .set_write_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut request = Vec::new();
                loop {
                    let mut buffer = [0_u8; 2048];
                    let size = stream.read(&mut buffer).unwrap();
                    if size == 0 {
                        break;
                    }
                    request.extend_from_slice(&buffer[..size]);
                    assert!(request.len() < 16384);
                    if let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&request[..header_end]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .map(|n| n.trim().parse::<usize>().unwrap())
                            })
                            .unwrap_or(0);
                        if request.len() >= header_end + 4 + length {
                            break;
                        }
                    }
                }
                let _ = send.send(String::from_utf8(request).unwrap());
                let header = format!(
                    "HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                stream.write_all(header.as_bytes()).unwrap();
                stream.write_all(&body).unwrap();
            }
        });
        let mut catalog = Catalog::new();
        catalog.token_url = format!("{base}/token");
        catalog.games_url = format!("{base}/games");
        catalog.image_root = format!("{base}/covers");
        (catalog, receive, handle)
    }
    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }
    fn token() -> Vec<u8> {
        br#"{"access_token":"syntheticToken","expires_in":3600,"token_type":"bearer"}"#.to_vec()
    }

    #[test]
    fn mock_server_waits_for_fragmented_request_body() {
        let (catalog, requests, server) = mock_server(vec![(200, b"ok".to_vec())]);
        let address = catalog
            .token_url
            .strip_prefix("http://")
            .unwrap()
            .split('/')
            .next()
            .unwrap();
        let mut client = std::net::TcpStream::connect(address).unwrap();
        client
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        client
            .write_all(b"POST /token HTTP/1.1\r\nHost: localhost\r\nContent-Length: 6\r\n\r\nabc")
            .unwrap();
        // Let the server accept and read the first chunk before the rest arrives.
        std::thread::sleep(Duration::from_millis(100));
        client.write_all(b"def").unwrap();
        let mut response = String::new();
        client.read_to_string(&mut response).unwrap();
        server.join().unwrap();
        assert!(
            requests
                .recv_timeout(Duration::from_secs(1))
                .unwrap()
                .ends_with("abcdef")
        );
        assert!(response.ends_with("ok"));
    }

    #[test]
    fn escapes_search_and_rejects_paths_and_control_characters() {
        assert!(search_query("x").is_err());
        assert!(search_query("game\nname").is_err());
        let query = search_query("name\"; limit 500; \\ end").unwrap();
        assert!(query.starts_with("search \"name\\\"; limit 500; \\\\ end\";"));
        assert!(query.ends_with("limit 8;"));
        for id in ["../secret", "a/b", "https:bad", "", "name.jpg", "a%2fb"] {
            assert!(!valid_image_id(id));
        }
        assert!(valid_image_id("co_test123"));
    }
    #[test]
    fn authenticates_searches_and_reads_disk_cached_cover_offline() {
        let body = br#"[{"id":42,"name":"Example Adventure","cover":{"image_id":"co_test"},"first_release_date":1700000000,"platforms":[{"name":"PC"}],"rating":88.2,"rating_count":7},{"id":43,"name":"No cover","cover":{"image_id":"../bad"}}]"#.to_vec();
        let jpeg = vec![0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9];
        let (catalog, requests, server) =
            mock_server(vec![(200, token()), (200, body), (200, jpeg)]);
        let directory = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            catalog
                .connect("syntheticClient".into(), "syntheticSecret".into())
                .await
                .unwrap();
            assert!(catalog.connected().await);
            let candidates = catalog.search("Adventure").await.unwrap();
            assert_eq!(candidates[0].name, "Example Adventure");
            assert_eq!(candidates[0].community_rating, Some(88.2));
            assert_eq!(candidates[1].cover_image_id, None);
            catalog
                .cache_cover(directory.path(), "co_test")
                .await
                .unwrap();
            assert!(
                read_cover(directory.path(), "co_test")
                    .await
                    .unwrap()
                    .unwrap()
                    .starts_with("data:image/jpeg;base64,")
            );
            catalog.disconnect().await;
            assert!(!catalog.connected().await);
            assert!(catalog.search("Adventure").await.is_err());
            // The cache hit must not make an HTTP request; the server has no responses left.
            catalog
                .cache_cover(directory.path(), "co_test")
                .await
                .unwrap();
        });
        server.join().unwrap();
        let requests: Vec<_> = requests.into_iter().collect();
        assert!(requests[0].starts_with("POST /token HTTP/1.1"));
        assert!(
            !requests[0]
                .lines()
                .next()
                .unwrap()
                .contains("syntheticSecret")
        );
        assert!(requests[0].contains("grant_type=client_credentials"));
        assert!(
            requests[1]
                .to_ascii_lowercase()
                .contains("authorization: bearer synthetictoken")
        );
        assert!(!requests[1].contains("syntheticSecret"));
        assert!(requests[2].starts_with("GET /covers/co_test.jpg"));
        assert!(!requests[2].to_ascii_lowercase().contains("authorization:"));
    }
    #[test]
    fn redacts_auth_errors_and_rejects_oversized_response() {
        let (catalog, _, server) = mock_server(vec![(401, b"do not echo this secret".to_vec())]);
        let error = runtime()
            .block_on(catalog.connect("syntheticClient".into(), "syntheticSecret".into()))
            .unwrap_err();
        assert!(!error.contains("secret"));
        server.join().unwrap();
        let (catalog, _, server) = mock_server(vec![(200, vec![b'a'; 8193])]);
        assert!(
            runtime()
                .block_on(catalog.connect("syntheticClient".into(), "syntheticSecret".into()))
                .unwrap_err()
                .contains("too large")
        );
        server.join().unwrap();
    }
    #[test]
    fn rejected_session_is_cleared_and_missing_artwork_is_not_cached() {
        let (catalog, _, server) = mock_server(vec![
            (200, token()),
            (401, vec![]),
            (200, b"<svg>not a jpeg</svg>".to_vec()),
        ]);
        let directory = tempfile::tempdir().unwrap();
        runtime().block_on(async {
            catalog
                .connect("syntheticClient".into(), "syntheticSecret".into())
                .await
                .unwrap();
            assert!(catalog.search("Adventure").await.is_err());
            assert!(!catalog.connected().await);
            assert!(
                catalog
                    .cache_cover(directory.path(), "co_test")
                    .await
                    .is_err()
            );
            assert!(
                read_cover(directory.path(), "co_test")
                    .await
                    .unwrap()
                    .is_none()
            );
        });
        server.join().unwrap();
    }
}
