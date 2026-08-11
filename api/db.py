import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", "musica_local.sqlite")


def get_connection() -> sqlite3.Connection:
    uri = f"file:{Path(DB_PATH).as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def query(sql: str, params: tuple = ()) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None
