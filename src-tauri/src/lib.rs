mod bupt;
mod db;
mod secrets;
mod ucloud;


use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Manager, State};
use tauri_plugin_notification::NotificationExt;

struct DbState {
    conn: Mutex<Connection>,
    path: String,
}

#[derive(Default)]

struct FocusRuntime(Mutex<FocusInner>);

#[derive(Default)]
struct FocusInner {
    mode: String,
    planned_seconds: u64,
    running: bool,
    accumulated: Duration,
    last_started: Option<Instant>,
    task_id: Option<String>,
    started_at_ms: Option<u64>,
}

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    stage: &'static str,
}

#[derive(Serialize)]
struct DbInfo {
    engine: &'static str,
    path: String,
    schema_version: i64,
    kv_count: i64,
    task_count: i64,
    event_count: i64,
    focus_count: i64,
    note_count: i64,
}

#[derive(Serialize, Deserialize)]
struct KvRow {
    key: String,
    value: serde_json::Value,
    updated_at: String,
}

#[derive(Serialize)]
struct FocusSnapshot {
    mode: String,
    running: bool,
    planned_seconds: u64,
    elapsed_seconds: u64,
    remaining_seconds: u64,
    task_id: Option<String>,
    started_at_ms: Option<u64>,
}

#[derive(Serialize)]
struct FocusResult {
    mode: String,
    planned_seconds: u64,
    actual_seconds: u64,
    task_id: Option<String>,
    started_at_ms: Option<u64>,
    completed: bool,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn focus_snapshot(inner: &FocusInner) -> FocusSnapshot {
    let mut elapsed = inner.accumulated;
    if inner.running {
        if let Some(started) = inner.last_started {
            elapsed += started.elapsed();
        }
    }

    let elapsed_seconds = elapsed.as_secs();
    FocusSnapshot {
        mode: inner.mode.clone(),
        running: inner.running,
        planned_seconds: inner.planned_seconds,
        elapsed_seconds,
        remaining_seconds: inner.planned_seconds.saturating_sub(elapsed_seconds),
        task_id: inner.task_id.clone(),
        started_at_ms: inner.started_at_ms,
    }
}

fn open_db(app: &tauri::AppHandle) -> Result<(Connection, String), String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join("studydesk.db");
    let conn = Connection::open(&path).map_err(|error| error.to_string())?;
    db::init_schema(&conn)?;
    db::migrate_kv(&conn)?;
    Ok((conn, path.to_string_lossy().to_string()))
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "StudyDesk",
        version: env!("CARGO_PKG_VERSION"),
        stage: "M1.5",
    }
}

#[tauri::command]
fn kv_get(key: String, db: State<'_, DbState>) -> Result<Option<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::read_value(&conn, &key)
}

#[tauri::command]
fn kv_set(key: String, value: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::write_value(&conn, &key, &value)
}

#[tauri::command]
fn kv_remove(key: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::delete_value(&conn, &key)
}

#[tauri::command]
fn kv_list(db: State<'_, DbState>) -> Result<Vec<KvRow>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    let mut statement = conn
        .prepare("SELECT key, value, updated_at FROM kv_store ORDER BY updated_at DESC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let raw: String = row.get(1)?;
            let updated_at: String = row.get(2)?;
            let value = serde_json::from_str(&raw).unwrap_or(Value::Null);
            Ok(KvRow {
                key,
                value,
                updated_at,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn db_info(db: State<'_, DbState>) -> Result<DbInfo, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    Ok(DbInfo {
        engine: "sqlite",
        path: db.path.clone(),
        schema_version: db::schema_version(&conn)?,
        kv_count: db::kv_count(&conn)?,
        task_count: db::entity_count(&conn, "tasks")?,
        event_count: db::entity_count(&conn, "events")?,
        focus_count: db::entity_count(&conn, "focus_sessions")?,
        note_count: db::entity_count(&conn, "notes")?,
    })
}

#[tauri::command]
fn task_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_tasks(&conn)
}

#[tauri::command]
fn task_save(task: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_task(&conn, &task)
}

#[tauri::command]
fn task_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "tasks", &id)
}

#[tauri::command]
fn task_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "tasks")
}

#[tauri::command]
fn event_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_events(&conn)
}

#[tauri::command]
fn event_save(event: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_event(&conn, &event)
}

#[tauri::command]
fn event_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "events", &id)
}

#[tauri::command]
fn event_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "events")
}

#[tauri::command]
fn focus_session_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_focus(&conn)
}

#[tauri::command]
fn focus_session_save(session: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_focus(&conn, &session)
}

#[tauri::command]
fn focus_session_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "focus_sessions", &id)
}

#[tauri::command]
fn focus_session_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "focus_sessions")
}

#[tauri::command]
fn note_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_notes(&conn)
}

#[tauri::command]
fn note_save(note: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_note(&conn, &note)
}

#[tauri::command]
fn note_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "notes", &id)
}

#[tauri::command]
fn note_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "notes")
}

#[tauri::command]
fn habit_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_habits(&conn)
}

#[tauri::command]
fn habit_save(habit: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_habit(&conn, &habit)
}

#[tauri::command]
fn habit_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "habits", &id)
}

#[tauri::command]
fn habit_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "habits")
}

#[tauri::command]
fn habit_log_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_habit_logs(&conn)
}

#[tauri::command]
fn habit_log_save(log: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_habit_log(&conn, &log)
}

#[tauri::command]
fn habit_log_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "habit_logs", &id)
}

#[tauri::command]
fn habit_log_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "habit_logs")
}

#[tauri::command]
fn review_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_reviews(&conn)
}

#[tauri::command]
fn review_save(review: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_review(&conn, &review)
}

#[tauri::command]
fn review_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "reviews", &id)
}

#[tauri::command]
fn review_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "reviews")
}

#[tauri::command]
fn category_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_categories(&conn)
}

#[tauri::command]
fn category_save(category: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_category(&conn, &category)
}

#[tauri::command]
fn category_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "categories", &id)
}

#[tauri::command]
fn category_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "categories")
}

#[tauri::command]
fn goal_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_goals(&conn)
}

#[tauri::command]
fn goal_save(goal: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_goal(&conn, &goal)
}

#[tauri::command]
fn goal_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "goals", &id)
}

#[tauri::command]
fn goal_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "goals")
}

#[tauri::command]
fn countdown_list(db: State<'_, DbState>) -> Result<Vec<Value>, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::list_countdowns(&conn)
}

#[tauri::command]
fn countdown_save(countdown: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_countdown(&conn, &countdown)
}

#[tauri::command]
fn countdown_remove(id: String, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::remove_entity(&conn, "countdowns", &id)
}

#[tauri::command]
fn countdown_clear(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::clear_entity(&conn, "countdowns")
}

#[tauri::command]
fn deadline_save(event: Value, task: Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    db::save_deadline_pair(&conn, &event, &task)
}

#[tauri::command]
async fn bupt_fetch_academic(
    account: String,
    password: String,
    cloud_password: Option<String>,
) -> Result<Value, String> {
    bupt::fetch_academic(&account, &password, cloud_password.as_deref()).await
}

#[tauri::command]
async fn bupt_fetch_assignment_detail(assignment_id: String) -> Result<Value, String> {
    let account = secrets::load("bupt.account")
        .ok_or_else(|| "请先在设置页保存学号".to_string())?;
    let password = secrets::load("bupt.cloudPassword")
        .or_else(|| secrets::load("bupt.password"))
        .ok_or_else(|| "请先在设置页保存教学云密码".to_string())?;
    ucloud::fetch_assignment_detail(&account, &password, &assignment_id).await
}

#[tauri::command]
fn focus_start(
    mode: String,
    planned_seconds: u64,
    task_id: Option<String>,
    state: State<'_, FocusRuntime>,
) -> Result<FocusSnapshot, String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "focus lock poisoned".to_string())?;

    *inner = FocusInner {
        mode,
        planned_seconds: planned_seconds.max(1),
        running: true,
        accumulated: Duration::ZERO,
        last_started: Some(Instant::now()),
        task_id,
        started_at_ms: Some(now_ms()),
    };

    Ok(focus_snapshot(&inner))
}

#[tauri::command]
fn focus_pause(state: State<'_, FocusRuntime>) -> Result<FocusSnapshot, String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "focus lock poisoned".to_string())?;

    if inner.running {
        if let Some(started) = inner.last_started.take() {
            inner.accumulated += started.elapsed();
        }
        inner.running = false;
    }

    Ok(focus_snapshot(&inner))
}

#[tauri::command]
fn focus_resume(state: State<'_, FocusRuntime>) -> Result<FocusSnapshot, String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "focus lock poisoned".to_string())?;

    if !inner.running && inner.planned_seconds > 0 {
        inner.last_started = Some(Instant::now());
        inner.running = true;
    }

    Ok(focus_snapshot(&inner))
}

#[tauri::command]
fn focus_status(state: State<'_, FocusRuntime>) -> Result<FocusSnapshot, String> {
    let inner = state
        .0
        .lock()
        .map_err(|_| "focus lock poisoned".to_string())?;
    Ok(focus_snapshot(&inner))
}

#[tauri::command]
fn focus_stop(state: State<'_, FocusRuntime>) -> Result<FocusResult, String> {
    let mut inner = state
        .0
        .lock()
        .map_err(|_| "focus lock poisoned".to_string())?;

    let snapshot = focus_snapshot(&inner);
    let result = FocusResult {
        mode: snapshot.mode,
        planned_seconds: snapshot.planned_seconds,
        actual_seconds: snapshot.elapsed_seconds,
        task_id: snapshot.task_id,
        started_at_ms: snapshot.started_at_ms,
        completed: snapshot.elapsed_seconds >= snapshot.planned_seconds,
    };

    *inner = FocusInner::default();
    Ok(result)
}

#[tauri::command]
fn clipboard_read() -> String {
    String::new()
}

#[tauri::command]
fn clipboard_write(_text: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn floating_set_always_on_top(_value: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn floating_set_visible(_value: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn shortcut_register(_accelerator: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn shortcut_unregister(_accelerator: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn secret_set(account: String, secret: String) -> Result<(), String> {
    secrets::save(&account, &secret)
}

#[tauri::command]
fn secret_get(account: String) -> Option<String> {
    secrets::load(&account)
}

#[tauri::command]
fn secret_delete(account: String) -> Result<(), String> {
    secrets::delete(&account)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let (conn, path) = open_db(&app.handle())?;
            app.manage(DbState {
                conn: Mutex::new(conn),
                path,
            });
            Ok(())
        })

        .manage(FocusRuntime::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            kv_get,
            kv_set,
            kv_remove,
            kv_list,
            db_info,
            task_list,
            task_save,
            task_remove,
            task_clear,
            event_list,
            event_save,
            event_remove,
            event_clear,
            focus_session_list,
            focus_session_save,
            focus_session_remove,
            focus_session_clear,
            note_list,
            note_save,
            note_remove,
            note_clear,
            habit_list,
            habit_save,
            habit_remove,
            habit_clear,
            habit_log_list,
            habit_log_save,
            habit_log_remove,
            habit_log_clear,
            review_list,
            review_save,
            review_remove,
            review_clear,
            category_list,
            category_save,
            category_remove,
            category_clear,
            goal_list,
            goal_save,
            goal_remove,
            goal_clear,
            countdown_list,
            countdown_save,
            countdown_remove,
            countdown_clear,
            deadline_save,
            bupt_fetch_academic,
            bupt_fetch_assignment_detail,
            focus_start,
            focus_pause,
            focus_resume,
            focus_status,
            focus_stop,
            clipboard_read,
            clipboard_write,
            notify,
            floating_set_always_on_top,
            floating_set_visible,
            shortcut_register,
            shortcut_unregister,
            secret_set,
            secret_get,
            secret_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn focus_snapshot_counts_running_time() {
        let mut inner = FocusInner {
            mode: "focus".to_string(),
            planned_seconds: 60,
            ..Default::default()
        };
        assert_eq!(focus_snapshot(&inner).remaining_seconds, 60);

        inner.running = true;
        inner.last_started = Some(Instant::now() - Duration::from_secs(20));
        let running = focus_snapshot(&inner);
        assert_eq!(running.elapsed_seconds, 20);
        assert_eq!(running.remaining_seconds, 40);

        inner.accumulated += inner.last_started.take().unwrap().elapsed();
        inner.running = false;
        let paused = focus_snapshot(&inner);
        assert_eq!(paused.elapsed_seconds, 20);
        assert_eq!(paused.remaining_seconds, 40);
        assert!(!paused.running);
    }

    #[test]
    fn focus_snapshot_never_underflows() {
        let inner = FocusInner {
            mode: "focus".to_string(),
            planned_seconds: 10,
            accumulated: Duration::from_secs(30),
            ..Default::default()
        };
        assert_eq!(focus_snapshot(&inner).remaining_seconds, 0);
    }
}