import { useQuery } from "@tanstack/react-query";
import { fetchLabel, fetchProducer, fetchArtist, fetchAlbum, imageUrl } from "../api.js";

const FETCHERS = {
  label: fetchLabel,
  producer: fetchProducer,
  artist: fetchArtist,
  album: fetchAlbum,
};

const KIND_LABEL = {
  label: "Sello",
  producer: "Productor",
  artist: "Artista",
  album: "Disco",
};

function Link({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
    >
      {children}
    </a>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200 whitespace-pre-line">{value}</div>
    </div>
  );
}

export default function DetailPanel({ detail, onClose }) {
  const { kind, id } = detail;
  const fetcher = FETCHERS[kind];
  const { data, isLoading } = useQuery({
    queryKey: [kind, id],
    queryFn: () => fetcher(id),
  });

  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-xs uppercase tracking-wide text-zinc-500">{KIND_LABEL[kind]}</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100 text-lg leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && <p className="text-zinc-500 text-sm">Cargando...</p>}
        {!isLoading && data && (
          <>
            <img
              src={imageUrl(kind, id)}
              alt={data.name}
              className="w-full aspect-square object-cover rounded bg-zinc-900"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <h1 className="mt-3 text-lg font-semibold text-zinc-50">{data.name}</h1>
            {kind === "album" && data.artist_name && (
              <p className="text-sm text-zinc-400">{data.artist_name}</p>
            )}

            {kind === "label" && (
              <>
                <Field label="País" value={data.country} />
                <Field label="Fundado" value={data.founded_year} />
                <Field label="Sello padre" value={data.parent_label} />
                <Field label="Perfil" value={data.profile || data.description} />
                <div className="mt-3 flex flex-col gap-1">
                  <Link href={data.discogs_url}>Discogs</Link>
                  <Link href={data.official_website}>Web oficial</Link>
                  <Link href={data.wikipedia_url}>Wikipedia</Link>
                  <Link href={data.bandcamp_url}>Bandcamp</Link>
                </div>
              </>
            )}

            {kind === "producer" && (
              <>
                <Field label="Discos" value={data.album_count} />
                <Field label="Artistas" value={data.artist_count} />
                <Field label="Géneros habituales" value={(data.top_genres || []).join(", ")} />
                {data.matched_artist_id && (
                  <p className="mt-3 text-xs text-zinc-500">
                    También aparece como artista en la colección.
                  </p>
                )}
              </>
            )}

            {kind === "artist" && (
              <>
                <Field label="Origen" value={data.origin || data.origen} />
                <Field label="Formado en" value={data.formed_year} />
                <Field label="Etiquetas" value={data.tags} />
                <Field label="Biografía" value={data.bio} />
                <div className="mt-3 flex flex-col gap-1">
                  <Link href={data.discogs_url}>Discogs</Link>
                  <Link href={data.musicbrainz_url}>MusicBrainz</Link>
                  <Link href={data.lastfm_url}>Last.fm</Link>
                  <Link href={data.spotify_url}>Spotify</Link>
                  <Link href={data.bandcamp_url}>Bandcamp</Link>
                  <Link href={data.wikipedia_url}>Wikipedia</Link>
                  <Link href={data.website}>Web</Link>
                </div>
              </>
            )}

            {kind === "album" && (
              <>
                <Field label="Año" value={data.year} />
                <Field label="Género" value={data.genre} />
                <Field label="Sello" value={data.label} />
                <Field label="Nº de catálogo" value={data.catalognumber} />
                <Field label="Productores" value={data.producers} />
                <Field label="Ingenieros" value={data.engineers} />
                <Field label="Mastering" value={data.mastering_engineers} />
                <div className="mt-3 flex flex-col gap-1">
                  <Link href={data.discogs_url}>Discogs</Link>
                  <Link href={data.musicbrainz_url}>MusicBrainz</Link>
                  <Link href={data.spotify_url}>Spotify</Link>
                  <Link href={data.bandcamp_url}>Bandcamp</Link>
                  <Link href={data.wikipedia_url}>Wikipedia</Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
