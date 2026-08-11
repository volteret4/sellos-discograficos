# sellos-discograficos

Navegador web de la colección musical de [music-fuzzy](https://github.com/volteret4/mfuz),
organizada por:

- **Sellos** → Artistas → Discos
- **Productores** → Artistas → Discos

Al pulsar cualquier sello, artista, productor o disco se abre un panel
lateral con su imagen e información (biografía, país, enlaces a
Discogs/MusicBrainz/Last.fm/Wikipedia, créditos...).

Mismo patrón que `mixxx_info` dentro de [repeat-one/tumtumpa](https://github.com/volteret4):
API en FastAPI + web en React/Vite servida por nginx, cada una en su propio
contenedor.

## Origen de los datos

Lee **directamente y en modo solo lectura** la base de datos SQLite de
`music-fuzzy` (`musica_local.sqlite`, tablas `labels`, `label_release_relationships`,
`artists`, `albums`). No existe tabla normalizada de productores: el listado
de "Productores" se construye en memoria (`api/producers.py`) a partir del
campo de texto `albums.producers` (nombres separados por comas), sin
normalización de variantes del mismo nombre — es una primera versión.

**La copia más actualizada de `musica_local.sqlite` vive en este portátil**,
no en el servidor. Para que el contenedor en producción tenga datos frescos,
hay que copiar el archivo al servidor antes de levantar el servicio (ver
sección de despliegue más abajo) y repetirlo cada vez que quieras
refrescarlos — no hay sincronización automática todavía.

## Imágenes

Para cada sello/artista/disco/productor, en este orden:

1. Ruta local guardada en la BD (`artists.img_paths`, `albums.album_art_path`) —
   solo resuelve en local, donde esas rutas absolutas del portátil existen.
2. Caché en disco (`covers/<tipo>/<id>.jpg`) de una descarga anterior.
3. Descarga desde Discogs (usa `DISCOGS_TOKEN` si está configurado; si no,
   cae a la API pública de Discogs sin autenticar, con límite de tasa más
   bajo), Cover Art Archive (discos, vía MusicBrainz release id) o Last.fm
   (artistas, vía `LASTFM_API_KEY`), y la cachea.

En producción (Docker en el servidor) el paso 1 falla siempre —las rutas
absolutas del portátil no existen dentro del contenedor— y cae automáticamente
al 3, sin configuración adicional.

## Desarrollo local

```bash
# API
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
ln -s ~/gits/pollo/music-fuzzy/db/sqlite/musica_local.sqlite ./musica_local.sqlite
DB_PATH=./musica_local.sqlite COVERS_DIR=./covers uvicorn api.main:app --reload --port 8000

# Web (en otra terminal)
cd web
npm install
npm run dev
```

`DISCOGS_TOKEN` / `LASTFM_API_KEY` se leen del entorno si ya los tienes
exportados (ver `.env.example`).

## Despliegue como submodule de repeat-one/tumtumpa

```bash
# En el servidor, dentro de ~/contenedores/repeat-one
git submodule add https://github.com/volteret4/sellos-discograficos.git services/sellos-discograficos

# Copiar la BD actualizada desde este portátil (repetir para refrescar datos)
rsync -avz ~/gits/pollo/music-fuzzy/db/sqlite/musica_local.sqlite \
  pepecono:~/contenedores/repeat-one/services/sellos-discograficos/musica_local.sqlite

scripts/up.sh --profile sellos_discograficos up -d --build
# abre http://<servidor>:8758
```

Puertos: `8757` (API), `8758` (web).
