"""
Agrupaciones derivadas de campos de texto libre de albums (sin tabla
normalizada): Sellos (albums.label), Productores (albums.producers) y
Masters (albums.mastering_engineers). Las tres comparten la misma lógica de
construcción de índice en memoria; solo cambia el campo origen y si hay que
trocear por comas.

Sellos NO se trocea: los nombres de sello a veces incluyen comas como parte
de la razón social ("Casablanca Records, Inc"), así que trocear rompería
más nombres de los que separaría correctamente. Productores/Masters sí,
son listas de personas.
"""
import re
import time
from collections import defaultdict

from .db import query

_CACHE_TTL = 300


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "unknown"


def _split(raw: str, split: bool) -> list[str]:
    if not split:
        name = raw.strip()
        return [name] if name else []
    return [p.strip() for p in raw.split(",") if p.strip()]


class TextGroupIndex:
    def __init__(self, field: str, split: bool = True):
        self.field = field
        self.split = split
        self._cache: dict = {"built_at": 0, "index": None}

    def _build(self) -> dict:
        rows = query(
            f"""
            SELECT al.id AS album_id, al.name AS album_name, al.year, al.genre,
                   al.{self.field} AS raw, ar.id AS artist_id, ar.name AS artist_name
            FROM albums al
            JOIN artists ar ON ar.id = al.artist_id
            WHERE al.{self.field} IS NOT NULL AND al.{self.field} != ''
            """
        )
        index: dict = defaultdict(lambda: {"name": None, "albums": {}})
        for row in rows:
            for name in _split(row["raw"], self.split):
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

    def get_index(self) -> dict:
        now = time.time()
        if self._cache["index"] is None or now - self._cache["built_at"] > _CACHE_TTL:
            self._cache["index"] = self._build()
            self._cache["built_at"] = now
        return self._cache["index"]

    def list_groups(self, q: str = "") -> list[dict]:
        index = self.get_index()
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
        out.sort(key=lambda g: g["name"].lower())
        return out

    def get_group(self, slug: str) -> dict | None:
        entry = self.get_index().get(slug)
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

    def group_artists(self, slug: str) -> list[dict]:
        entry = self.get_index().get(slug)
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

    def group_artist_albums(self, slug: str, artist_id: int) -> list[dict]:
        entry = self.get_index().get(slug)
        if not entry:
            return []
        albums = [a for a in entry["albums"].values() if a["artist_id"] == artist_id]
        albums.sort(key=lambda a: (a["year"] or ""))
        return albums


LABELS = TextGroupIndex("label", split=False)
PRODUCERS = TextGroupIndex("producers", split=True)
MASTERS = TextGroupIndex("mastering_engineers", split=True)

INDEXES = {"labels": LABELS, "producers": PRODUCERS, "masters": MASTERS}


def match_artist_row(name: str) -> dict | None:
    rows = query("SELECT * FROM artists WHERE name = ? COLLATE NOCASE LIMIT 1", (name,))
    return rows[0] if rows else None


def match_label_row(name: str) -> dict | None:
    rows = query("SELECT * FROM labels WHERE name = ? COLLATE NOCASE LIMIT 1", (name,))
    return rows[0] if rows else None
