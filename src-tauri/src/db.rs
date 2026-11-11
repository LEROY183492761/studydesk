use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

const KV_TASKS: &str = "studydesk.v1.tasks";
const KV_EVENTS: &str = "studydesk.v1.events";
const KV_FOCUS: &str = "studydesk.v1.focus";
const KV_NOTES: &str = "studydesk.v1.notes";
const KV_HABITS: &str = "studydesk.v1.habits";
const KV_HABIT_LOGS: &str = "studydesk.v1.habit-logs";
const KV_REVIEWS: &str = "studydesk.v1.reviews";

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;

         CREATE TABLE IF NOT EXISTS schema_migrations (
             version INTEGER PRIMARY KEY,
             applied_at TEXT NOT NULL DEFAULT (datetime('now'))
         );

         CREATE TABLE IF NOT EXISTS kv_store (
             key TEXT PRIMARY KEY,
             value TEXT NOT NULL,
             updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         );

         CREATE TABLE IF NOT EXISTS tasks (
             id TEXT PRIMARY KEY,
             title TEXT NOT NULL,
             status TEXT NOT NULL,
             priority TEXT NOT NULL,
             source TEXT NOT NULL,
             due_at TEXT,
             scheduled_start TEXT,
             scheduled_end TEXT,
             estimate_minutes INTEGER,
             completed_at TEXT,
created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              timer_mode TEXT,
              focus_minutes INTEGER,
              break_minutes INTEGER,
              cycles_planned INTEGER,
              cycles_completed INTEGER,
              importance TEXT,
              category_id TEXT,
              linked_event_id TEXT,
              payload TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
         CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_start);

         CREATE TABLE IF NOT EXISTS events (
             id TEXT PRIMARY KEY,
             title TEXT NOT NULL,
             start_at TEXT NOT NULL,
             end_at TEXT NOT NULL,
             all_day INTEGER NOT NULL,
category TEXT,
              location TEXT,
              source TEXT NOT NULL,
              kind TEXT NOT NULL DEFAULT 'event',
              repeat_json TEXT,
              exdates_json TEXT,
              linked_task_id TEXT,
              payload TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);


         CREATE TABLE IF NOT EXISTS focus_sessions (
             id TEXT PRIMARY KEY,
             task_id TEXT,
             started_at TEXT NOT NULL,
             planned_seconds INTEGER NOT NULL,
             actual_seconds INTEGER NOT NULL,
mode TEXT NOT NULL,
              completed INTEGER NOT NULL,
              note TEXT,
              cycle_index INTEGER,
              abandoned INTEGER NOT NULL DEFAULT 0,
              payload TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_focus_started ON focus_sessions(started_at);

         CREATE TABLE IF NOT EXISTS notes (
             id TEXT PRIMARY KEY,
             content TEXT NOT NULL,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL,
             payload TEXT NOT NULL
         );

         CREATE TABLE IF NOT EXISTS categories (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             color TEXT,
             kind TEXT,
             archived INTEGER NOT NULL,
             payload TEXT NOT NULL
         );

         CREATE TABLE IF NOT EXISTS habits (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             color TEXT,
             frequency_type TEXT NOT NULL,
             target_per_week INTEGER,
             remind_at TEXT,
             archived INTEGER NOT NULL,
             created_at TEXT NOT NULL,
             payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_habits_archived ON habits(archived);

         CREATE TABLE IF NOT EXISTS habit_logs (
             id TEXT PRIMARY KEY,
             habit_id TEXT NOT NULL,
             date TEXT NOT NULL,
             value INTEGER NOT NULL,
             note TEXT,
             payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
         CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);

         CREATE TABLE IF NOT EXISTS reviews (
             id TEXT PRIMARY KEY,
             type TEXT NOT NULL,
             period_start TEXT NOT NULL,
             period_end TEXT NOT NULL,
             created_at TEXT NOT NULL,
             payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_reviews_period ON reviews(period_start, period_end);

         CREATE TABLE IF NOT EXISTS goals (
             id TEXT PRIMARY KEY,
             title TEXT NOT NULL,
             target_date TEXT,
             progress INTEGER NOT NULL,
             status TEXT NOT NULL,
             category_id TEXT,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL,
             payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

         CREATE TABLE IF NOT EXISTS countdowns (
             id TEXT PRIMARY KEY,
             title TEXT NOT NULL,
             target_date TEXT NOT NULL,
             yearly INTEGER NOT NULL,
             created_at TEXT NOT NULL,
             payload TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_countdowns_date ON countdowns(target_date);

         INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);",
    )
    .map_err(|error| error.to_string())
}

pub fn read_value(conn: &Connection, key: &str) -> Result<Option<Value>, String> {
    let mut statement = conn
        .prepare("SELECT value FROM kv_store WHERE key = ?1")
        .map_err(|error| error.to_string())?;
    let raw: Option<String> = statement
        .query_row(params![key], |row| row.get(0))
        .optional()
        .map_err(|error| error.to_string())?;

    match raw {
        Some(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|error| error.to_string()),
        None => Ok(None),
    }
}

pub fn write_value(conn: &Connection, key: &str, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string(value).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO kv_store(key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, text],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn delete_value(conn: &Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM kv_store WHERE key = ?1", params![key])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(|item| item.as_str()).map(str::to_owned)
}

fn int_field(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(|item| item.as_i64())
}

fn bool_field(value: &Value, key: &str) -> bool {
    value.get(key).and_then(|item| item.as_bool()).unwrap_or(false)
}

pub fn save_task(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "task.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO tasks(id, title, status, priority, source, due_at, scheduled_start,
             scheduled_end, estimate_minutes, completed_at, created_at, updated_at,
             timer_mode, focus_minutes, break_minutes, cycles_planned, cycles_completed,
             importance, category_id, linked_event_id, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                 ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             status = excluded.status,
             priority = excluded.priority,
             source = excluded.source,
             due_at = excluded.due_at,
             scheduled_start = excluded.scheduled_start,
             scheduled_end = excluded.scheduled_end,
             estimate_minutes = excluded.estimate_minutes,
             completed_at = excluded.completed_at,
             updated_at = excluded.updated_at,
             timer_mode = excluded.timer_mode,
             focus_minutes = excluded.focus_minutes,
             break_minutes = excluded.break_minutes,
             cycles_planned = excluded.cycles_planned,
             cycles_completed = excluded.cycles_completed,
             importance = excluded.importance,
             category_id = excluded.category_id,
             linked_event_id = excluded.linked_event_id,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "title").unwrap_or_default(),
            text_field(value, "status").unwrap_or_else(|| "inbox".to_string()),
            text_field(value, "priority").unwrap_or_else(|| "normal".to_string()),
            text_field(value, "source").unwrap_or_else(|| "manual".to_string()),
            text_field(value, "dueAt"),
            text_field(value, "scheduledStart"),
            text_field(value, "scheduledEnd"),
            int_field(value, "estimateMinutes"),
            text_field(value, "completedAt"),
            text_field(value, "createdAt").unwrap_or_default(),
            text_field(value, "updatedAt").unwrap_or_default(),
            text_field(value, "timerMode"),
            int_field(value, "focusMinutes"),
            int_field(value, "breakMinutes"),
            int_field(value, "cyclesPlanned"),
            int_field(value, "cyclesCompleted"),
            text_field(value, "importance"),
            text_field(value, "categoryId"),
            text_field(value, "linkedEventId"),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_tasks(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(
        conn,
        "SELECT payload FROM tasks
         ORDER BY COALESCE(scheduled_start, due_at, created_at) DESC",
    )
}

pub fn save_event(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "event.id missing".to_string())?;
    let payload = value.to_string();
    let repeat_json = value.get("repeat").map(|item| item.to_string());
    let exdates_json = value.get("exdates").map(|item| item.to_string());
    conn.execute(
        "INSERT INTO events(id, title, start_at, end_at, all_day, category, location, source,
             kind, repeat_json, exdates_json, linked_task_id, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             start_at = excluded.start_at,
             end_at = excluded.end_at,
             all_day = excluded.all_day,
             category = excluded.category,
             location = excluded.location,
             source = excluded.source,
             kind = excluded.kind,
             repeat_json = excluded.repeat_json,
             exdates_json = excluded.exdates_json,
             linked_task_id = excluded.linked_task_id,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "title").unwrap_or_default(),
            text_field(value, "start").unwrap_or_default(),
            text_field(value, "end").unwrap_or_default(),
            if bool_field(value, "allDay") { 1 } else { 0 },
            text_field(value, "category"),
            text_field(value, "location"),
            text_field(value, "source").unwrap_or_else(|| "manual".to_string()),
            text_field(value, "kind").unwrap_or_else(|| "event".to_string()),
            repeat_json,
            exdates_json,
            text_field(value, "linkedTaskId"),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_events(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM events ORDER BY start_at")
}

/// DDL 事件与待办在同一事务内写入，避免只成功一半
pub fn save_deadline_pair(conn: &Connection, event: &Value, task: &Value) -> Result<(), String> {
    let transaction = conn
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;
    save_task(&transaction, task)?;
    save_event(&transaction, event)?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn save_focus(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "focus.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO focus_sessions(id, task_id, started_at, planned_seconds, actual_seconds,
             mode, completed, note, cycle_index, abandoned, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
             task_id = excluded.task_id,
             started_at = excluded.started_at,
             planned_seconds = excluded.planned_seconds,
             actual_seconds = excluded.actual_seconds,
             mode = excluded.mode,
             completed = excluded.completed,
             note = excluded.note,
             cycle_index = excluded.cycle_index,
             abandoned = excluded.abandoned,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "taskId"),
            text_field(value, "startedAt").unwrap_or_default(),
            int_field(value, "plannedSeconds").unwrap_or(0),
            int_field(value, "actualSeconds").unwrap_or(0),
            text_field(value, "mode").unwrap_or_else(|| "focus".to_string()),
            if bool_field(value, "completed") { 1 } else { 0 },
            text_field(value, "note"),
            int_field(value, "cycleIndex"),
            if bool_field(value, "abandoned") { 1 } else { 0 },
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_focus(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM focus_sessions ORDER BY started_at")
}

pub fn save_note(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "note.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO notes(id, content, created_at, updated_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
             content = excluded.content,
             updated_at = excluded.updated_at,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "content").unwrap_or_default(),
            text_field(value, "createdAt").unwrap_or_default(),
            text_field(value, "updatedAt").unwrap_or_default(),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_notes(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM notes ORDER BY created_at DESC")
}

pub fn save_category(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "category.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO categories(id, name, color, kind, archived, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             color = excluded.color,
             kind = excluded.kind,
             archived = excluded.archived,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "name").unwrap_or_default(),
            text_field(value, "color"),
            text_field(value, "kind"),
            if bool_field(value, "archived") { 1 } else { 0 },
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_categories(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM categories ORDER BY name")
}

pub fn save_habit(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "habit.id missing".to_string())?;
    let payload = value.to_string();
    let frequency = value.get("frequency");
    let frequency_type = frequency
        .and_then(|item| item.get("type"))
        .and_then(|item| item.as_str())
        .unwrap_or("daily");
    let target_per_week = frequency
        .and_then(|item| item.get("timesPerWeek"))
        .and_then(|item| item.as_i64());

    conn.execute(
        "INSERT INTO habits(id, name, color, frequency_type, target_per_week, remind_at,
             archived, created_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             color = excluded.color,
             frequency_type = excluded.frequency_type,
             target_per_week = excluded.target_per_week,
             remind_at = excluded.remind_at,
             archived = excluded.archived,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "name").unwrap_or_default(),
            text_field(value, "color"),
            frequency_type,
            target_per_week,
            text_field(value, "remindAt"),
            if bool_field(value, "archived") { 1 } else { 0 },
            text_field(value, "createdAt").unwrap_or_default(),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_habits(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM habits ORDER BY created_at")
}

pub fn save_habit_log(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "habitLog.id missing".to_string())?;
    let habit_id =
        text_field(value, "habitId").ok_or_else(|| "habitLog.habitId missing".to_string())?;
    let date = text_field(value, "date").ok_or_else(|| "habitLog.date missing".to_string())?;
    let payload = value.to_string();

    conn.execute(
        "INSERT INTO habit_logs(id, habit_id, date, value, note, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             habit_id = excluded.habit_id,
             date = excluded.date,
             value = excluded.value,
             note = excluded.note,
             payload = excluded.payload",
        params![
            id,
            habit_id,
            date,
            int_field(value, "value").unwrap_or(1),
            text_field(value, "note"),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_habit_logs(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM habit_logs ORDER BY date")
}

pub fn save_review(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "review.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO reviews(id, type, period_start, period_end, created_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             period_start = excluded.period_start,
             period_end = excluded.period_end,
             created_at = excluded.created_at,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "type").unwrap_or_else(|| "daily".to_string()),
            text_field(value, "periodStart").unwrap_or_default(),
            text_field(value, "periodEnd").unwrap_or_default(),
            text_field(value, "createdAt").unwrap_or_default(),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_reviews(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM reviews ORDER BY period_start DESC")
}

pub fn save_goal(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "goal.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO goals(id, title, target_date, progress, status, category_id,
             created_at, updated_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             target_date = excluded.target_date,
             progress = excluded.progress,
             status = excluded.status,
             category_id = excluded.category_id,
             updated_at = excluded.updated_at,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "title").unwrap_or_default(),
            text_field(value, "targetDate"),
            int_field(value, "progress").unwrap_or(0),
            text_field(value, "status").unwrap_or_else(|| "active".to_string()),
            text_field(value, "categoryId"),
            text_field(value, "createdAt").unwrap_or_default(),
            text_field(value, "updatedAt").unwrap_or_default(),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_goals(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM goals ORDER BY status, target_date")
}

pub fn save_countdown(conn: &Connection, value: &Value) -> Result<(), String> {
    let id = text_field(value, "id").ok_or_else(|| "countdown.id missing".to_string())?;
    let payload = value.to_string();
    conn.execute(
        "INSERT INTO countdowns(id, title, target_date, yearly, created_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             target_date = excluded.target_date,
             yearly = excluded.yearly,
             payload = excluded.payload",
        params![
            id,
            text_field(value, "title").unwrap_or_default(),
            text_field(value, "date").unwrap_or_default(),
            if bool_field(value, "yearly") { 1 } else { 0 },
            text_field(value, "createdAt").unwrap_or_default(),
            payload
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn list_countdowns(conn: &Connection) -> Result<Vec<Value>, String> {
    query_payloads(conn, "SELECT payload FROM countdowns ORDER BY target_date")
}

fn query_payloads(conn: &Connection, sql: &str) -> Result<Vec<Value>, String> {
    let mut statement = conn.prepare(sql).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let raw: String = row.get(0)?;
            Ok(serde_json::from_str(&raw).unwrap_or(Value::Null))
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn known_table(table: &str) -> Result<&'static str, String> {
    match table {
        "tasks" => Ok("tasks"),
        "events" => Ok("events"),
        "focus_sessions" => Ok("focus_sessions"),
        "notes" => Ok("notes"),
        "habits" => Ok("habits"),
        "habit_logs" => Ok("habit_logs"),
        "reviews" => Ok("reviews"),
        "categories" => Ok("categories"),
        "goals" => Ok("goals"),
        "countdowns" => Ok("countdowns"),
        _ => Err(format!("unknown table: {table}")),
    }
}

pub fn remove_entity(conn: &Connection, table: &str, id: &str) -> Result<(), String> {
    let table = known_table(table)?;
    conn.execute(&format!("DELETE FROM {table} WHERE id = ?1"), params![id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn clear_entity(conn: &Connection, table: &str) -> Result<(), String> {
    let table = known_table(table)?;
    conn.execute(&format!("DELETE FROM {table}"), [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn entity_count(conn: &Connection, table: &str) -> Result<i64, String> {
    let table = known_table(table)?;
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

pub fn kv_count(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM kv_store", [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

pub fn schema_version(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

fn has_version(conn: &Connection, version: i64) -> Result<bool, String> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
        params![version],
        |row| row.get(0),
    )
    .map_err(|error| error.to_string())
}

pub fn migrate_kv(conn: &Connection) -> Result<(), String> {
    if !has_version(conn, 2)? {
        migrate_v2(conn)?;
    }
    if !has_version(conn, 3)? {
        migrate_v3(conn)?;
    }
    if !has_version(conn, 4)? {
        migrate_v4(conn)?;
    }
    if !has_version(conn, 5)? {
        migrate_v5(conn)?;
    }
    if !has_version(conn, 6)? {
        migrate_v6(conn)?;
    }
    if !has_version(conn, 7)? {
        migrate_v7(conn)?;
    }
    Ok(())
}

fn migrate_v6(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (6)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn migrate_v7(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (7)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn migrate_v5(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    let columns = [
        ("events", "kind", "TEXT NOT NULL DEFAULT 'event'"),
        ("events", "repeat_json", "TEXT"),
        ("events", "exdates_json", "TEXT"),
        ("events", "linked_task_id", "TEXT"),
    ];

    for (table, column, ddl) in columns {
        if !column_exists(&transaction, table, column)? {
            transaction
                .execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}"), [])
                .map_err(|error| error.to_string())?;
        }
    }

    transaction
        .execute("CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (5)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;

    for name in names {
        if name.map_err(|error| error.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_v4(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;
    let columns = [
        ("tasks", "timer_mode", "TEXT"),
        ("tasks", "focus_minutes", "INTEGER"),
        ("tasks", "break_minutes", "INTEGER"),
        ("tasks", "cycles_planned", "INTEGER"),
        ("tasks", "cycles_completed", "INTEGER"),
        ("tasks", "importance", "TEXT"),
        ("tasks", "category_id", "TEXT"),
        ("tasks", "linked_event_id", "TEXT"),
        ("focus_sessions", "cycle_index", "INTEGER"),
        ("focus_sessions", "abandoned", "INTEGER NOT NULL DEFAULT 0"),
    ];

    for (table, column, ddl) in columns {
        if !column_exists(&transaction, table, column)? {
            transaction
                .execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}"), [])
                .map_err(|error| error.to_string())?;
        }
    }

    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (4)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn migrate_v2(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;

    if let Some(Value::Array(items)) = read_value(&transaction, KV_TASKS)? {
        for item in &items {
            save_task(&transaction, item)?;
        }
    }
    if let Some(Value::Array(items)) = read_value(&transaction, KV_EVENTS)? {
        for item in &items {
            save_event(&transaction, item)?;
        }
    }
    if let Some(Value::Array(items)) = read_value(&transaction, KV_FOCUS)? {
        for item in &items {
            save_focus(&transaction, item)?;
        }
    }
    if let Some(Value::Array(items)) = read_value(&transaction, KV_NOTES)? {
        for item in &items {
            save_note(&transaction, item)?;
        }
    }

    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (2)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn migrate_v3(conn: &Connection) -> Result<(), String> {
    let transaction = conn.unchecked_transaction().map_err(|error| error.to_string())?;

    if let Some(Value::Array(items)) = read_value(&transaction, KV_HABITS)? {
        for item in &items {
            save_habit(&transaction, item)?;
        }
    }
    if let Some(Value::Array(items)) = read_value(&transaction, KV_HABIT_LOGS)? {
        for item in &items {
            save_habit_log(&transaction, item)?;
        }
    }
    if let Some(Value::Array(items)) = read_value(&transaction, KV_REVIEWS)? {
        for item in &items {
            save_review(&transaction, item)?;
        }
    }

    transaction
        .execute("INSERT OR REPLACE INTO schema_migrations(version) VALUES (3)", [])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        conn
    }

    #[test]
    fn schema_is_idempotent() {
        let conn = memory_db();
        init_schema(&conn).unwrap();
        assert_eq!(schema_version(&conn).unwrap(), 1);
    }

    #[test]
    fn kv_roundtrip_and_remove() {
        let conn = memory_db();
        assert_eq!(read_value(&conn, "missing").unwrap(), None);

        write_value(&conn, "k", &json!({ "a": 1 })).unwrap();
        assert_eq!(read_value(&conn, "k").unwrap().unwrap(), json!({ "a": 1 }));

        delete_value(&conn, "k").unwrap();
        assert_eq!(read_value(&conn, "k").unwrap(), None);
    }

    #[test]
    fn migrates_kv_into_relation_tables() {
        let conn = memory_db();

        write_value(
            &conn,
            KV_TASKS,
            &json!([{
                "id": "t1",
                "title": "数据结构作业",
                "status": "inbox",
                "priority": "high",
                "source": "manual",
                "createdAt": "2026-09-07T08:00:00.000Z",
                "updatedAt": "2026-09-07T08:00:00.000Z"
            }]),
        )
        .unwrap();
        write_value(
            &conn,
            KV_EVENTS,
            &json!([{
                "id": "e1",
                "title": "小组会议",
                "start": "2026-09-07T10:00:00.000Z",
                "end": "2026-09-07T11:00:00.000Z",
                "allDay": false,
                "category": "meeting",
                "source": "manual"
            }]),
        )
        .unwrap();
        write_value(
            &conn,
            KV_FOCUS,
            &json!([{
                "id": "f1",
                "startedAt": "2026-09-07T09:00:00.000Z",
                "plannedSeconds": 1500,
                "actualSeconds": 1500,
                "mode": "focus",
                "completed": true
            }]),
        )
        .unwrap();
        write_value(
            &conn,
            KV_NOTES,
            &json!([{
                "id": "n1",
                "content": "实验报告要重画图表",
                "createdAt": "2026-09-07T08:00:00.000Z",
                "updatedAt": "2026-09-07T08:00:00.000Z"
            }]),
        )
        .unwrap();
        write_value(
            &conn,
            KV_HABITS,
            &json!([{
                "id": "h1",
                "name": "阅读",
                "color": "#000",
                "frequency": { "type": "daily" },
                "archived": false,
                "createdAt": "2026-09-01T08:00:00.000Z"
            }]),
        )
        .unwrap();
        write_value(
            &conn,
            KV_HABIT_LOGS,
            &json!([{
                "id": "hl1",
                "habitId": "h1",
                "date": "2026-09-07",
                "value": 1
            }]),
        )
        .unwrap();

        migrate_kv(&conn).unwrap();
        assert_eq!(schema_version(&conn).unwrap(), 7);
        assert_eq!(entity_count(&conn, "tasks").unwrap(), 1);
        assert_eq!(entity_count(&conn, "events").unwrap(), 1);
        assert_eq!(entity_count(&conn, "focus_sessions").unwrap(), 1);
        assert_eq!(entity_count(&conn, "notes").unwrap(), 1);
        assert_eq!(entity_count(&conn, "habits").unwrap(), 1);
        assert_eq!(entity_count(&conn, "habit_logs").unwrap(), 1);

        let tasks = list_tasks(&conn).unwrap();
        assert_eq!(tasks[0]["title"], "数据结构作业");

        // 幂等：再次迁移不会重复插入
        migrate_kv(&conn).unwrap();
        assert_eq!(entity_count(&conn, "tasks").unwrap(), 1);
        assert_eq!(entity_count(&conn, "habit_logs").unwrap(), 1);
    }

    #[test]
    fn task_crud_and_clear() {
        let conn = memory_db();
        let task = json!({
            "id": "t1",
            "title": "复习高数",
            "status": "planned",
            "priority": "normal",
            "source": "manual",
            "scheduledStart": "2026-09-07T14:00:00.000Z",
            "scheduledEnd": "2026-09-07T15:00:00.000Z",
            "createdAt": "2026-09-06T08:00:00.000Z",
            "updatedAt": "2026-09-07T08:00:00.000Z"
        });

        save_task(&conn, &task).unwrap();
        assert_eq!(list_tasks(&conn).unwrap().len(), 1);

        let mut updated = task.clone();
        updated["status"] = json!("done");
        save_task(&conn, &updated).unwrap();
        let stored = list_tasks(&conn).unwrap();
        assert_eq!(stored[0]["status"], "done");

        remove_entity(&conn, "tasks", "t1").unwrap();
        assert_eq!(list_tasks(&conn).unwrap().len(), 0);

        save_task(&conn, &task).unwrap();
        clear_entity(&conn, "tasks").unwrap();
        assert_eq!(list_tasks(&conn).unwrap().len(), 0);
    }

    #[test]
    fn habit_and_log_crud() {
        let conn = memory_db();
        let habit = json!({
            "id": "h1",
            "name": "运动",
            "color": "#000",
            "frequency": { "type": "weekly", "timesPerWeek": 3 },
            "archived": false,
            "createdAt": "2026-09-01T08:00:00.000Z"
        });
        save_habit(&conn, &habit).unwrap();
        assert_eq!(list_habits(&conn).unwrap().len(), 1);

        let log = json!({
            "id": "hl1",
            "habitId": "h1",
            "date": "2026-09-07",
            "value": 1
        });
        save_habit_log(&conn, &log).unwrap();
        save_habit_log(&conn, &log).unwrap();
        assert_eq!(list_habit_logs(&conn).unwrap().len(), 1);

        let stored = list_habits(&conn).unwrap();
        assert_eq!(stored[0]["frequency"]["timesPerWeek"], 3);

        remove_entity(&conn, "habit_logs", "hl1").unwrap();
        assert_eq!(list_habit_logs(&conn).unwrap().len(), 0);
    }

    #[test]
    fn review_crud() {
        let conn = memory_db();
        let review = json!({
            "id": "r1",
            "type": "weekly",
            "periodStart": "2026-09-07",
            "periodEnd": "2026-09-13",
            "metrics": { "focusMinutes": 120 },
            "answers": { "win": "完成实验" },
            "createdAt": "2026-09-13T20:00:00.000Z"
        });
        save_review(&conn, &review).unwrap();
        let stored = list_reviews(&conn).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0]["answers"]["win"], "完成实验");

        clear_entity(&conn, "reviews").unwrap();
        assert_eq!(list_reviews(&conn).unwrap().len(), 0);
    }

    #[test]
    fn category_crud() {
        let conn = memory_db();
        let category = json!({
            "id": "c1",
            "name": "数学",
            "color": "#000",
            "kind": "course",
            "archived": false
        });

        save_category(&conn, &category).unwrap();
        let stored = list_categories(&conn).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0]["name"], "数学");

        clear_entity(&conn, "categories").unwrap();
        assert_eq!(list_categories(&conn).unwrap().len(), 0);
    }

    #[test]
    fn goal_and_countdown_crud() {
        let conn = memory_db();

        let goal = json!({
            "id": "g1",
            "title": "拿到奖学金",
            "targetDate": "2026-12-31",
            "progress": 30,
            "status": "active",
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z"
        });
        save_goal(&conn, &goal).unwrap();
        let stored = list_goals(&conn).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0]["title"], "拿到奖学金");
        assert_eq!(stored[0]["progress"], 30);

        let countdown = json!({
            "id": "d1",
            "title": "期末考试",
            "date": "2027-01-10",
            "yearly": false,
            "createdAt": "2026-09-07T00:00:00.000Z"
        });
        save_countdown(&conn, &countdown).unwrap();
        let stored = list_countdowns(&conn).unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0]["date"], "2027-01-10");

        remove_entity(&conn, "goals", "g1").unwrap();
        remove_entity(&conn, "countdowns", "d1").unwrap();
        assert_eq!(list_goals(&conn).unwrap().len(), 0);
        assert_eq!(list_countdowns(&conn).unwrap().len(), 0);
    }

    #[test]
    fn deadline_pair_saved_atomically() {
        let conn = memory_db();

        let event = json!({
            "id": "e1",
            "title": "数据结构作业",
            "start": "2026-09-10T23:00:00.000Z",
            "end": "2026-09-10T23:00:00.000Z",
            "allDay": false,
            "category": "course",
            "source": "manual",
            "kind": "deadline",
            "linkedTaskId": "t1"
        });
        let task = json!({
            "id": "t1",
            "title": "数据结构作业",
            "status": "inbox",
            "priority": "normal",
            "source": "deadline",
            "createdAt": "2026-09-07T00:00:00.000Z",
            "updatedAt": "2026-09-07T00:00:00.000Z",
            "linkedEventId": "e1"
        });

        save_deadline_pair(&conn, &event, &task).unwrap();
        assert_eq!(list_events(&conn).unwrap().len(), 1);
        assert_eq!(list_tasks(&conn).unwrap().len(), 1);
    }
}