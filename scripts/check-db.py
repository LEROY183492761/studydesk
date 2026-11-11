import os
import sqlite3

path = os.path.join(os.environ["APPDATA"], "com.studydesk.app", "studydesk.db")
print("db:", path)
print("exists:", os.path.exists(path))

if not os.path.exists(path):
    raise SystemExit(1)

conn = sqlite3.connect(path)
tables = sorted(
    row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
)
print("tables:", tables)

if "schema_migrations" in tables:
    version = conn.execute("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").fetchone()[0]
    print("schema_version:", version)

for table in (
    "kv_store",
    "tasks",
    "events",
    "focus_sessions",
    "notes",
    "habits",
    "habit_logs",
    "reviews",
):
    if table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"{table}: {count}")

conn.close()