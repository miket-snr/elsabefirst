from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEMO_USER = {
    "username": "demo",
    "firstnames": "Demo",
    "surname": "User",
    "email": "demo@example.com",
    "cellno": "+15550101000",
    "validfrom": date.today().isoformat(),
    "validto": "2099-12-31",
}


def database_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", PROJECT_ROOT / "elsabefirst.db"))


def connect(path: Path | None = None) -> sqlite3.Connection:
    selected_path = path or database_path()
    selected_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(selected_path, timeout=30, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def connection_for(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = connect(path)
    try:
        yield connection
    finally:
        connection.close()


def initialize_database(path: Path | None = None) -> None:
    with connection_for(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                firstnames TEXT NOT NULL,
                surname TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                cellno TEXT NOT NULL UNIQUE,
                validfrom TEXT NOT NULL,
                validto TEXT NOT NULL,
                CHECK (validfrom <= validto)
            );

            CREATE TABLE IF NOT EXISTS tokens (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_type TEXT NOT NULL CHECK (token_type IN ('temporary', 'access')),
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked_at TEXT
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_notes_user_updated
                ON notes(user_id, updated_at DESC);
            """
        )
        user_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(users)")
        }
        if "password_hash" not in user_columns:
            connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            connection.execute(
                """
                INSERT INTO users
                    (username, firstnames, surname, email, cellno, validfrom, validto)
                VALUES
                    (:username, :firstnames, :surname, :email, :cellno, :validfrom, :validto)
                """,
                DEMO_USER,
            )
        connection.commit()
