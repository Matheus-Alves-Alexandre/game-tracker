mod store;
use std::sync::Mutex;
use store::{Dashboard, Game, GameInput, Store};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;
struct AppState(Mutex<Store>);

#[tauri::command]
fn list_games(
    state: tauri::State<AppState>,
    search: String,
    status: String,
    offset: u32,
) -> Result<Vec<Game>, String> {
    state
        .0
        .lock()
        .map_err(|_| "Restart the app to reconnect to your library.".to_string())?
        .list(&search, &status, offset)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.manage(AppState(Mutex::new(Store::open(
                &directory.join("library.sqlite3"),
            )?)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_games,
            save_game,
            set_archived,
            get_dashboard,
            open_support
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Game Tracker");
}
