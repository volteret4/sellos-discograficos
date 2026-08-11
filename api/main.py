"""
FastAPI backend for sellos_discograficos — navegador de la colección musical
organizada por Sellos > Artistas > Discos, Productores > Artistas > Discos
y Masters > Artistas > Discos.

Run: uvicorn api.main:app --reload --port 8000
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import images, text_groups
from .db import query, query_one

app = FastAPI(title="sellos_discograficos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _index(kind: str) -> text_groups.TextGroupIndex:
    index = text_groups.INDEXES.get(kind)
    if not index:
        raise HTTPException(404, "Tipo de filtro no encontrado")
    return index


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Sellos / Productores / Masters (derivados de texto libre) ──────────────


@app.get("/api/groups/{kind}")
def list_groups(kind: str, q: str = Query("", alias="q")):
    return _index(kind).list_groups(q)


@app.get("/api/groups/{kind}/{slug}")
def get_group(kind: str, slug: str):
    group = _index(kind).get_group(slug)
    if not group:
        raise HTTPException(404, "No encontrado")
    if kind == "labels":
        matched = text_groups.match_label_row(group["name"])
        for field in (
            "country", "founded_year", "profile", "description", "discogs_url",
            "official_website", "wikipedia_url", "bandcamp_url", "parent_label",
        ):
            group[field] = matched.get(field) if matched else None
        group["matched_label_id"] = matched["id"] if matched else None
    else:
        matched = text_groups.match_artist_row(group["name"])
        group["matched_artist_id"] = matched["id"] if matched else None
    return group


@app.get("/api/groups/{kind}/{slug}/artists")
def group_artists(kind: str, slug: str):
    return _index(kind).group_artists(slug)


@app.get("/api/groups/{kind}/{slug}/artists/{artist_id}/albums")
def group_artist_albums(kind: str, slug: str, artist_id: int):
    albums = _index(kind).group_artist_albums(slug, artist_id)
    if not albums:
        return []
    full = query(
        f"SELECT * FROM albums WHERE id IN ({','.join('?' * len(albums))})",
        tuple(a["id"] for a in albums),
    )
    order = {a["id"]: i for i, a in enumerate(albums)}
    full.sort(key=lambda a: order[a["id"]])
    return full


# ── Artistas / Discos ────────────────────────────────────────────────────


@app.get("/api/artists")
def list_artists(q: str = Query("", alias="q")):
    sql = """
        SELECT a.id, a.name, COUNT(al.id) AS album_count
        FROM artists a
        LEFT JOIN albums al ON al.artist_id = a.id
        {where}
        GROUP BY a.id
        ORDER BY a.name COLLATE NOCASE
    """
    params: tuple = ()
    where = ""
    if q:
        where = "WHERE a.name LIKE ?"
        params = (f"%{q}%",)
    return query(sql.format(where=where), params)


@app.get("/api/artists/{artist_id}")
def get_artist(artist_id: int):
    artist = query_one("SELECT * FROM artists WHERE id = ?", (artist_id,))
    if not artist:
        raise HTTPException(404, "Artista no encontrado")
    return artist


@app.get("/api/artists/{artist_id}/albums")
def artist_albums(artist_id: int):
    return query(
        "SELECT * FROM albums WHERE artist_id = ? ORDER BY year",
        (artist_id,),
    )


@app.get("/api/albums/{album_id}")
def get_album(album_id: int):
    album = query_one(
        """
        SELECT al.*, ar.name AS artist_name
        FROM albums al
        JOIN artists ar ON ar.id = al.artist_id
        WHERE al.id = ?
        """,
        (album_id,),
    )
    if not album:
        raise HTTPException(404, "Disco no encontrado")
    return album


# ── Imágenes ─────────────────────────────────────────────────────────────


def _serve(path: Path | None):
    if not path:
        raise HTTPException(404, "Sin imagen")
    return FileResponse(path)


@app.get("/api/images/artist/{artist_id}")
def image_artist(artist_id: int):
    artist = query_one("SELECT * FROM artists WHERE id = ?", (artist_id,))
    if not artist:
        raise HTTPException(404, "Artista no encontrado")
    return _serve(images.resolve_artist_image(artist))


@app.get("/api/images/album/{album_id}")
def image_album(album_id: int):
    album = query_one("SELECT * FROM albums WHERE id = ?", (album_id,))
    if not album:
        raise HTTPException(404, "Disco no encontrado")
    return _serve(images.resolve_album_image(album))


@app.get("/api/images/group/{kind}/{slug}")
def image_group(kind: str, slug: str):
    group = _index(kind).get_group(slug)
    if not group:
        raise HTTPException(404, "No encontrado")
    if kind == "labels":
        matched = text_groups.match_label_row(group["name"])
        if not matched:
            raise HTTPException(404, "Sin imagen")
        return _serve(images.resolve_label_image(matched))
    matched = text_groups.match_artist_row(group["name"])
    if not matched:
        raise HTTPException(404, "Sin imagen")
    return _serve(images.resolve_artist_image(matched))
