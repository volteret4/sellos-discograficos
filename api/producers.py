"""
No existe una tabla normalizada de productores en la BD: solo el campo de
texto libre albums.producers ("Rollo, Sister Bliss"). Este módulo construye
en memoria, a partir de ese campo, el índice slug -> productor -> discos.

v1: split simple por comas, sin normalización de variantes del mismo nombre
(p.ej. "Rollo" y "Rollo & Sister Bliss" cuentan como productores distintos).
"""
import re
import time
from collections import defaultdict

from .db import query

_CACHE_TTL = 300
_cache: dict = {"built_at": 0, "index": None}


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "unknown"


def _split_producers(raw: str) -> list[str]:
    return [p.strip() for p in raw.split(",") if p.strip()]


def _build_index() -> dict:
    rows = query(
        """
        SELECT al.id AS album_id, al.name AS album_name, al.year, al.genre,
               al.producers, ar.id AS artist_id, ar.name AS artist_name
        FROM albums al
        JOIN artists ar ON ar.id = al.artist_id
        WHERE al.producers IS NOT NULL AND al.producers != ''
        """
    )
    index: dict = defaultdict(lambda: {"name": None, "albums": {}})
    for row in rows:
        for name in _split_producers(row["producers"]):
            slug = _slugify(name)
            entry = index[slug]
            entry["name"] = entry["name"] or name
            entry["albums"][row["album_id"]] = {
                "id": row["album_id"],
                "name": row["album_name"],
                "year": row["year"],
                "genre": row["genre"],
                "artist_id": row["artist_id"],
                "artist_name": row["artist_name"],
            }
    return dict(index)


def get_index() -> dict:
    now = time.time()
    if _cache["index"] is None or now - _cache["built_at"] > _CACHE_TTL:
        _cache["index"] = _build_index()
        _cache["built_at"] = now
    return _cache["index"]


def list_producers(q: str = "") -> list[dict]:
    index = get_index()
    q_lower = q.strip().lower()
    out = []
    for slug, entry in index.items():
        if q_lower and q_lower not in entry["name"].lower():
            continue
        artist_ids = {a["artist_id"] for a in entry["albums"].values()}
        out.append(
            {
                "slug": slug,
                "name": entry["name"],
                "album_count": len(entry["albums"]),
                "artist_count": len(artist_ids),
            }
        )
    out.sort(key=lambda p: p["name"].lower())
    return out


def get_producer(slug: str) -> dict | None:
    entry = get_index().get(slug)
    if not entry:
        return None
    artist_ids = {a["artist_id"] for a in entry["albums"].values()}
    genres = defaultdict(int)
    for a in entry["albums"].values():
        if a["genre"]:
            genres[a["genre"]] += 1
    top_genres = sorted(genres, key=genres.get, reverse=True)[:5]
    return {
        "slug": slug,
        "name": entry["name"],
        "album_count": len(entry["albums"]),
        "artist_count": len(artist_ids),
        "top_genres": top_genres,
    }


def producer_artists(slug: str) -> list[dict]:
    entry = get_index().get(slug)
    if not entry:
        return []
    by_artist: dict = defaultdict(lambda: {"id": None, "name": None, "album_count": 0})
    for a in entry["albums"].values():
        rec = by_artist[a["artist_id"]]
        rec["id"] = a["artist_id"]
        rec["name"] = a["artist_name"]
        rec["album_count"] += 1
    out = list(by_artist.values())
    out.sort(key=lambda a: a["name"].lower())
    return out


def producer_artist_albums(slug: str, artist_id: int) -> list[dict]:
    entry = get_index().get(slug)
    if not entry:
        return []
    albums = [a for a in entry["albums"].values() if a["artist_id"] == artist_id]
    albums.sort(key=lambda a: (a["year"] or ""))
    return albums


def match_artist_row(name: str) -> dict | None:
    rows = query("SELECT * FROM artists WHERE name = ? COLLATE NOCASE LIMIT 1", (name,))
    return rows[0] if rows else None
