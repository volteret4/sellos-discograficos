# CLAUDE.md

Guía para trabajar en este repo.

## Qué es

Navegador de la colección musical de `music-fuzzy` organizado por
Sellos > Artistas > Discos, Productores > Artistas > Discos y
Masters > Artistas > Discos, con panel lateral de detalle (imagen + info)
al pulsar cualquier elemento. Ver README.md para contexto completo (origen
de datos, despliegue).

## Arquitectura

- `api/` — FastAPI, Python stdlib `sqlite3` en modo solo lectura (sin ORM).
  - `db.py` — conexión y helpers `query`/`query_one`.
  - `main.py` — todas las rutas: `/api/groups/{kind}/...` (sellos/productores/masters),
    `/api/artists`, `/api/albums`, `/api/images/...`.
  - `text_groups.py` — `TextGroupIndex`, construye en memoria (caché TTL de
    5 min) el índice de un campo de texto libre de `albums` (`label`,
    `producers` o `mastering_engineers`) → slug → {artistas, discos}. Las
    tres agrupaciones ("kind": `labels`/`producers`/`masters`) comparten esta
    misma clase; no hay tablas `producers`/`masters` en la BD, y **`labels`
    tampoco se usa para agrupar** (solo como enriquecimiento opcional, ver
    más abajo).
  - `images.py` — resolución de imágenes: ruta local de la BD → caché en
    disco (`covers/<tipo>/<id>.*`) → Discogs/Cover Art Archive/Last.fm.
- `web/` — React 18 + Vite + Tailwind + `@tanstack/react-query`, servida por
  nginx en producción (`web/nginx.conf` proxea `/api/` al contenedor de la
  API). Tres columnas (grupo → artistas → discos) + `DetailPanel` como panel
  lateral fijo a la derecha. `MODES` en `App.jsx` es la única fuente de
  verdad de qué "kind" existen y qué campo de `albums` usan — añadir un
  cuarto filtro es, en principio, una entrada más ahí + en `INDEXES` del
  backend.

## Base de datos

Lee `musica_local.sqlite` de `music-fuzzy` tal cual, sin copiarla ni
transformarla.

**Sellos/Productores/Masters se agrupan por texto libre de `albums`**
(`label`, `producers`, `mastering_engineers`), no por tablas normalizadas.
Esto fue una decisión deliberada: la tabla `labels` + `label_release_relationships`
existe y está bastante poblada, pero esa segunda tabla enlaza un álbum con
*todos* los sellos que MusicBrainz asocia al release-group entero (a veces
más de 50 filas por álbum — reediciones/prensajes de todo el mundo), no con
"el sello de tu copia concreta". Usarla como fuente de la agrupación
producía sellos que no coincidían con lo que el usuario tenía tageado
(incluso discos con `albums.label` vacío aparecían bajo un sello real). Se
descartó a favor de agrupar directamente por `albums.label`, igual que ya
se hacía con Productores.

`labels` (la tabla) se sigue usando, pero solo como **enriquecimiento
opcional**: si el nombre de sello derivado del texto hace *match* exacto
(case-insensitive) con `labels.name`, se añaden país/perfil/discogs_url/etc.
al detalle (ver `get_group` en `main.py`). Sin match, el sello solo tiene lo
que se puede derivar del propio texto (recuento de discos/artistas,
géneros). El mismo patrón de match-por-nombre se usa para Productores/Masters
contra la tabla `artists` (p.ej. Nils Frahm aparece tanto como artista como
mastering engineer).

Sellos NO trocea por comas (nombres de sello a veces llevan ", Inc" / ", S.L.");
Productores/Masters sí (listas de personas). Ver `text_groups.py::TextGroupIndex`.

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

- Productores/Masters: sin normalización de variantes de nombre (p.ej.
  "Rollo" y "Rollo & Sister Bliss" son productores distintos). Si hace falta
  agruparlos, tocaría `TextGroupIndex._split`/`_slugify` en `text_groups.py`.
- Sellos: al no trocear por comas, un caso real como "Epic, Clean Slate" (dos
  sellos conjuntos) queda como un único grupo con ese nombre literal, en vez
  de partirse en dos. Se aceptó el trade-off para no romper razones sociales
  con coma ("Casablanca Records, Inc").
- Sin sincronización automática de la BD al servidor: hay que copiarla a mano
  (README → "Despliegue").
