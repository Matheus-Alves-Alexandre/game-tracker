mod catalog;
mod store;
use std::sync::Mutex;
use store::{Dashboard, Game, GameInput, GameList, Home, Store};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
struct AppState(Mutex<Store>);
struct CoverDirectory(std::path::PathBuf);

#[tauri::command]
async fn connect_igdb(
    state: tauri::State<'_, catalog::Catalog>,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    state.connect(client_id, client_secret).await
}
#[tauri::command]
async fn igdb_connected(state: tauri::State<'_, catalog::Catalog>) -> Result<bool, String> {
    Ok(state.connected().await)
}
#[tauri::command]
async fn disconnect_igdb(state: tauri::State<'_, catalog::Catalog>) -> Result<(), String> {
    state.disconnect().await;
    Ok(())
}
#[tauri::command]
async fn search_igdb(
    state: tauri::State<'_, catalog::Catalog>,
    title: String,
) -> Result<Vec<catalog::Candidate>, String> {
    state.search(&title).await
}
#[tauri::command]
async fn cache_igdb_cover(
    state: tauri::State<'_, catalog::Catalog>,
    directory: tauri::State<'_, CoverDirectory>,
    image_id: String,
) -> Result<(), String> {
    state.cache_cover(&directory.0, &image_id).await
}
#[tauri::command]
async fn read_cached_cover(
    directory: tauri::State<'_, CoverDirectory>,
    image_id: String,
) -> Result<Option<String>, String> {
    catalog::read_cover(&directory.0, &image_id).await
}
#[tauri::command]
fn get_home(state: tauri::State<AppState>) -> Result<Home, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .home()
}

#[tauri::command]
fn list_games(
    state: tauri::State<AppState>,
    search: String,
    status: String,
    offset: u32,
    archived: bool,
) -> Result<Vec<Game>, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .list(&search, &status, offset, archived)
}
#[tauri::command]
fn save_game(state: tauri::State<AppState>, input: GameInput) -> Result<Game, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .save(input)
}
#[tauri::command]
fn set_archived(state: tauri::State<AppState>, id: String, archived: bool) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .set_archived(&id, archived)
}
#[tauri::command]
fn get_dashboard(state: tauri::State<AppState>) -> Result<Dashboard, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .dashboard()
}
#[tauri::command]
fn open_support(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url("https://buymeacoffee.com/xxlozerxd", None::<&str>)
        .map_err(|error| error.to_string())
}
#[tauri::command]
fn open_igdb_setup(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url("https://dev.twitch.tv/console/apps", None::<&str>)
        .map_err(|_| "Could not open the browser. Visit dev.twitch.tv/console/apps.".into())
}

#[tauri::command]
fn get_game_lists(state: tauri::State<AppState>) -> Result<Vec<GameList>, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .game_lists()
}
#[tauri::command]
fn save_game_list(
    state: tauri::State<AppState>,
    id: Option<String>,
    name: String,
) -> Result<String, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .save_game_list(id, &name)
}
#[tauri::command]
fn delete_game_list(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .delete_game_list(&id)
}
#[tauri::command]
fn get_list_members(
    state: tauri::State<AppState>,
    id: String,
    offset: u32,
) -> Result<Vec<Game>, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .list_members(&id, offset)
}
#[tauri::command]
fn add_list_game(
    state: tauri::State<AppState>,
    list_id: String,
    entry_id: Option<String>,
    title: String,
    platform: String,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .add_list_game(&list_id, entry_id, &title, &platform)
}
#[tauri::command]
fn remove_list_game(
    state: tauri::State<AppState>,
    list_id: String,
    entry_id: String,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .remove_list_game(&list_id, &entry_id)
}
#[tauri::command]
fn complete_list_game(
    state: tauri::State<AppState>,
    list_id: String,
    entry_id: String,
    completed: bool,
) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app.".to_string())?
        .complete_list_game(&list_id, &entry_id, completed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.manage(CoverDirectory(directory.join("covers")));
            app.manage(catalog::Catalog::new());
            app.manage(AppState(Mutex::new(Store::open(
                &directory.join("library.sqlite3"),
            )?)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_game_lists,
            save_game_list,
            delete_game_list,
            get_list_members,
            add_list_game,
            remove_list_game,
            complete_list_game,
            list_games,
            save_game,
            set_archived,
            get_dashboard,
            open_support,
            open_igdb_setup,
            get_home,
            connect_igdb,
            igdb_connected,
            disconnect_igdb,
            search_igdb,
            cache_igdb_cover,
            read_cached_cover
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Game Tracker");
}
