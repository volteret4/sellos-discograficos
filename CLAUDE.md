# CLAUDE.md

Guía para trabajar en este repo.

## Qué es

Navegador de la colección musical de `music-fuzzy` organizado por
Sellos > Artistas > Discos y Productores > Artistas > Discos, con panel
lateral de detalle (imagen + info) al pulsar cualquier elemento. Ver
README.md para contexto completo (origen de datos, despliegue).

## Arquitectura

- `api/` — FastAPI, Python stdlib `sqlite3` en modo solo lectura (sin ORM).
  - `db.py` — conexión y helpers `query`/`query_one`.
  - `main.py` — todas las rutas (`/api/labels`, `/api/producers`, `/api/artists`,
    `/api/albums`, `/api/images/...`).
  - `producers.py` — construye en memoria (con caché TTL de 5 min) el índice
    de productores a partir de `albums.producers` (texto libre, split por
    comas). No hay tabla `producers` en la BD.
  - `images.py` — resolución de imágenes: ruta local de la BD → caché en
    disco (`covers/<tipo>/<id>.*`) → Discogs/Cover Art Archive/Last.fm.
- `web/` — React 18 + Vite + Tailwind + `@tanstack/react-query`, servida por
  nginx en producción (`web/nginx.conf` proxea `/api/` al contenedor de la
  API). Tres columnas (grupo → artistas → discos) + `DetailPanel` como panel
  lateral fijo a la derecha.

## Base de datos

Lee `musica_local.sqlite` de `music-fuzzy` tal cual, sin copiarla ni
transformarla. Tablas relevantes: `labels`, `label_release_relationships`
(sello↔disco, con `catalog_number`), `artists`, `albums`. `label_artist_relationships`
existe en el esquema pero está vacía — la jerarquía sello→artista se deriva
siempre vía `label_release_relationships` + `albums.artist_id`, nunca de esa
tabla.

`DB_PATH` apunta al archivo (por defecto `musica_local.sqlite` en el cwd).
En producción es un bind-mount de solo lectura del `.sqlite` copiado desde
el portátil (ver README) — no un symlink en vivo, porque el portátil y el
servidor son máquinas distintas.

## Convenciones

Sigue el patrón de `mixxx_info` (otro submodule de `repeat-one/tumtumpa`):
misma estructura API+web, mismo estilo Tailwind (`zinc` dark theme), mismo
patrón de `api.js` con funciones `fetchX()` planas (sin capa de abstracción
extra). No hay panel de configuración (⚙) tipo mixxx_info/dieta_sonora en
esta app — no se pidió y añade complejidad (auth, edición de .env en
caliente) que no aporta aquí; si se necesita en el futuro, revisar cómo lo
hacen esas apps antes de reinventarlo.

## Limitaciones conocidas (v1)

- Productores: sin normalización de variantes de nombre (p.ej. "Rollo" y
  "Rollo & Sister Bliss" son productores distintos). Si hace falta agruparlos,
  tocaría `api/producers.py::_split_producers`/`_slugify`.
- Sin sincronización automática de la BD al servidor: hay que copiarla a mano
  (README → "Despliegue").
