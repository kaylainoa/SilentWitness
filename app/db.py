import sqlite3

DB_PATH = "silentwitness.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                latitude TEXT NOT NULL,
                longitude TEXT NOT NULL,
                audio_file_path TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS emergency_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone_number TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS push_tokens (
                token TEXT PRIMARY KEY
            )
            """
        )
        conn.commit()


def insert_incident(timestamp: int, latitude: str, longitude: str, audio_file_path: str) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO incidents (timestamp, latitude, longitude, audio_file_path) VALUES (?, ?, ?, ?)",
            (timestamp, latitude, longitude, audio_file_path),
        )
        conn.commit()
        return cursor.lastrowid


def get_incidents() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM incidents ORDER BY id").fetchall()
        return [dict(row) for row in rows]


def get_incident(incident_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        return dict(row) if row else None


def replace_contacts(contacts: list[dict]):
    """Overwrites the full saved contact list with what the app currently has."""
    with get_connection() as conn:
        conn.execute("DELETE FROM emergency_contacts")
        conn.executemany(
            "INSERT INTO emergency_contacts (name, phone_number) VALUES (:name, :phone_number)",
            contacts,
        )
        conn.commit()


def get_contacts() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM emergency_contacts ORDER BY id").fetchall()
        return [dict(row) for row in rows]


def add_push_token(token: str):
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO push_tokens (token) VALUES (?)", (token,))
        conn.commit()


def get_push_tokens() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute("SELECT token FROM push_tokens").fetchall()
        return [row["token"] for row in rows]
