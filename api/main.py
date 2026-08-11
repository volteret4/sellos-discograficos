"""
FastAPI backend for sellos_discograficos — navegador de la colección musical
organizada por Sellos > Artistas > Discos y Productores > Artistas > Discos.

Run: uvicorn api.main:app --reload --port 8000
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import images, producers as producers_mod
from .db import query, query_one

app = FastAPI(title="sellos_discograficos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Sellos ───────────────────────────────────────────────────────────────


@app.get("/api/labels")
def list_labels(q: str = Query("", alias="q")):
    sql = """
        SELECT l.id, l.name, l.country, l.discogs_url,
               COUNT(DISTINCT lrr.album_id) AS album_count,
               COUNT(DISTINCT al.artist_id) AS artist_count
        FROM labels l
        JOIN label_release_relationships lrr ON lrr.label_id = l.id
        JOIN albums al ON al.id = lrr.album_id
        {where}
        GROUP BY l.id
        ORDER BY l.name COLLATE NOCASE
    """
    params: tuple = ()
    where = ""
    if q:
        where = "WHERE l.name LIKE ?"
        params = (f"%{q}%",)
    return query(sql.format(where=where), params)


@app.get("/api/labels/{label_id}")
def get_label(label_id: int):
    label = query_one("SELECT * FROM labels WHERE id = ?", (label_id,))
    if not label:
        raise HTTPException(404, "Sello no encontrado")
    return label


@app.get("/api/labels/{label_id}/artists")
def label_artists(label_id: int):
    return query(
        """
        SELECT ar.id, ar.name, COUNT(DISTINCT al.id) AS album_count
        FROM label_release_relationships lrr
        JOIN albums al ON al.id = lrr.album_id
        JOIN artists ar ON ar.id = al.artist_id
        WHERE lrr.label_id = ?
        GROUP BY ar.id
        ORDER BY ar.name COLLATE NOCASE
        """,
        (label_id,),
    )


@app.get("/api/labels/{label_id}/artists/{artist_id}/albums")
def label_artist_albums(label_id: int, artist_id: int):
    return query(
        """
        SELECT DISTINCT al.*
        FROM label_release_relationships lrr
        JOIN albums al ON al.id = lrr.album_id
        WHERE lrr.label_id = ? AND al.artist_id = ?
        ORDER BY al.year
        """,
        (label_id, artist_id),
    )


# ── Productores ──────────────────────────────────────────────────────────


@app.get("/api/producers")
def list_producers(q: str = Query("", alias="q")):
    return producers_mod.list_producers(q)


@app.get("/api/producers/{slug}")
def get_producer(slug: str):
    producer = producers_mod.get_producer(slug)
    if not producer:
        raise HTTPException(404, "Productor no encontrado")
    matched = producers_mod.match_artist_row(producer["name"])
    producer["matched_artist_id"] = matched["id"] if matched else None
    return producer


@app.get("/api/producers/{slug}/artists")
def producer_artists(slug: str):
    return producers_mod.producer_artists(slug)


@app.get("/api/producers/{slug}/artists/{artist_id}/albums")
def producer_artist_albums(slug: str, artist_id: int):
    albums = producers_mod.producer_artist_albums(slug, artist_id)
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


@app.get("/api/artists/{artist_id}")
def get_artist(artist_id: int):
    artist = query_one("SELECT * FROM artists WHERE id = ?", (artist_id,))
    if not artist:
        raise HTTPException(404, "Artista no encontrado")
    return artist


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


@app.get("/api/images/label/{label_id}")
def image_label(label_id: int):
    label = query_one("SELECT * FROM labels WHERE id = ?", (label_id,))
    if not label:
        raise HTTPException(404, "Sello no encontrado")
    return _serve(images.resolve_label_image(label))


@app.get("/api/images/producer/{slug}")
def image_producer(slug: str):
    producer = producers_mod.get_producer(slug)
    if not producer:
        raise HTTPException(404, "Productor no encontrado")
    matched = producers_mod.match_artist_row(producer["name"])
    if not matched:
        raise HTTPException(404, "Sin imagen")
    return _serve(images.resolve_artist_image(matched))
