"""
Resolución de imágenes para sellos/artistas/discos.

Orden: 1) ruta local guardada en la BD (funciona en desarrollo, donde las
rutas absolutas del portátil existen de verdad) -> 2) caché en disco de una
descarga anterior -> 3) descarga desde Discogs/LastFM/Cover Art Archive y
cachea. En producción (Docker en el servidor) el paso 1 simplemente falla
(la ruta no existe dentro del contenedor) y cae automáticamente al 3, sin
necesidad de configuración distinta por entorno.
"""
import json
import os
import re
from pathlib import Path

import requests

_HEADERS = {"User-Agent": "sellos_discograficos/0.1 +viciosmusicales@gmail.com"}

COVERS_DIR = Path(os.environ.get("COVERS_DIR", "covers"))
DISCOGS_TOKEN = os.environ.get("DISCOGS_TOKEN", "")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")


def _local_candidates(row: dict, *fields: str) -> list[str]:
    paths = []
    for field in fields:
        val = row.get(field)
        if not val:
            continue
        if val.strip().startswith("["):
            try:
                paths.extend(json.loads(val))
                continue
            except (json.JSONDecodeError, TypeError):
                pass
        paths.append(val)
    return paths


def _first_existing_local_file(row: dict, *fields: str) -> Path | None:
    for p in _local_candidates(row, *fields):
        path = Path(p)
        if path.is_file():
            return path
    return None


def _cached(kind: str, entity_id: str) -> Path | None:
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = COVERS_DIR / kind / f"{entity_id}.{ext}"
        if p.is_file():
            return p
    return None


def _download(url: str, dest: Path) -> bool:
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return True
    except Exception:
        return False


def _cache_dest(kind: str, entity_id: str, url: str) -> Path:
    ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
    ext = ext if ext in ("jpg", "jpeg", "png", "webp") else "jpg"
    return COVERS_DIR / kind / f"{entity_id}.{ext}"


def _discogs_id(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"/(\d+)$", url)
    return m.group(1) if m else None


def _discogs_image(kind: str, discogs_id: str) -> str | None:
    if not DISCOGS_TOKEN:
        return None
    endpoint = {"artist": "artists", "album": "releases", "label": "labels"}[kind]
    try:
        resp = requests.get(
            f"https://api.discogs.com/{endpoint}/{discogs_id}",
            params={"token": DISCOGS_TOKEN},
            headers=_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        images = resp.json().get("images", [])
        primary = next((img for img in images if img.get("type") == "primary"), None)
        chosen = primary or (images[0] if images else None)
        return chosen.get("uri") or chosen.get("resource_url") if chosen else None
    except Exception:
        return None


def _lastfm_artist_image(name: str) -> str | None:
    if not LASTFM_API_KEY:
        return None
    try:
        resp = requests.get(
            "https://ws.audioscrobbler.com/2.0/",
            params={
                "method": "artist.getinfo",
                "artist": name,
                "api_key": LASTFM_API_KEY,
                "format": "json",
            },
            headers=_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        images = resp.json().get("artist", {}).get("image", [])
        for img in reversed(images):
            url = img.get("#text")
            if url:
                return url
    except Exception:
        pass
    return None


def _cover_art_archive(mb_release_id: str) -> str | None:
    try:
        resp = requests.get(
            f"https://coverartarchive.org/release/{mb_release_id}",
            headers=_HEADERS,
            timeout=10,
            allow_redirects=True,
        )
        if resp.status_code != 200:
            return None
        images = resp.json().get("images", [])
        front = next((img for img in images if img.get("front")), None)
        return (front or images[0])["image"] if (front or images) else None
    except Exception:
        return None


def resolve_artist_image(artist: dict) -> Path | None:
    local = _first_existing_local_file(artist, "img", "img_paths")
    if local:
        return local
    entity_id = str(artist["id"])
    cached = _cached("artist", entity_id)
    if cached:
        return cached

    url = None
    discogs_id = _discogs_id(artist.get("discogs_url"))
    if discogs_id:
        url = _discogs_image("artist", discogs_id)
    if not url:
        url = _lastfm_artist_image(artist.get("name", ""))
    if not url:
        return None
    dest = _cache_dest("artist", entity_id, url)
    return dest if _download(url, dest) else None


def resolve_album_image(album: dict) -> Path | None:
    local = _first_existing_local_file(album, "album_art_path")
    if local:
        return local
    entity_id = str(album["id"])
    cached = _cached("album", entity_id)
    if cached:
        return cached

    url = None
    if album.get("musicbrainz_albumid"):
        url = _cover_art_archive(album["musicbrainz_albumid"])
    if not url:
        discogs_id = _discogs_id(album.get("discogs_url"))
        if discogs_id:
            url = _discogs_image("album", discogs_id)
    if not url:
        return None
    dest = _cache_dest("album", entity_id, url)
    return dest if _download(url, dest) else None


def resolve_label_image(label: dict) -> Path | None:
    entity_id = str(label["id"])
    cached = _cached("label", entity_id)
    if cached:
        return cached

    discogs_id = _discogs_id(label.get("discogs_url"))
    if not discogs_id:
        return None
    url = _discogs_image("label", discogs_id)
    if not url:
        return None
    dest = _cache_dest("label", entity_id, url)
    return dest if _download(url, dest) else None
