import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Column from "./components/Column.jsx";
import AlbumColumn from "./components/AlbumColumn.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import {
  fetchGroups,
  fetchGroupArtists,
  fetchGroupArtistAlbums,
  fetchArtists,
  fetchArtistAlbums,
} from "./api.js";

const MODES = [
  { kind: "labels", tabLabel: "Sellos", columnTitle: "Sellos", field: "label" },
  { kind: "producers", tabLabel: "Productores", columnTitle: "Productores", field: "producers" },
  { kind: "masters", tabLabel: "Masters", columnTitle: "Masters", field: "mastering_engineers" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Orden alfabético" },
  { value: "artist_count", label: "Nº de artistas" },
  { value: "album_count", label: "Nº de discos" },
];

function sortGroups(items, sortBy) {
  const arr = [...items];
  arr.sort((a, b) => {
    if (sortBy !== "name") {
      const diff = (b[sortBy] || 0) - (a[sortBy] || 0);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
  return arr;
}

// Debe coincidir con api/text_groups.py::_slugify
function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

// Sellos no se trocea por comas (nombres de sello pueden llevar ", Inc" /
// ", S.L."), Productores/Masters sí — debe coincidir con text_groups.py.
function splitValues(kind, raw) {
  const text = (raw || "").trim();
  if (!text) return [];
  return kind === "labels" ? [text] : text.split(",").map((v) => v.trim()).filter(Boolean);
}

function firstValue(kind, raw) {
  return splitValues(kind, raw)[0] || "";
}

export default function App() {
  const [mode, setMode] = useState("labels"); // "labels" | "producers" | "masters"
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [group, setGroup] = useState(null); // { slug, name }
  const [artistSearch, setArtistSearch] = useState("");
  const [artist, setArtist] = useState(null); // selected artist
  const [albumId, setAlbumId] = useState(null); // disco marcado en la 3ª columna
  const [detail, setDetail] = useState(null); // { kind, id }

  const modeInfo = MODES.find((m) => m.kind === mode);

  function switchMode(next) {
    setMode(next);
    setSearch("");
    setArtistSearch("");
    setGroup(null);
    setArtist(null);
    setAlbumId(null);
    setDetail(null);
  }

  const groupsQuery = useQuery({
    queryKey: [mode, "groups", search],
    queryFn: () => fetchGroups(mode, search),
  });

  const sortedGroups = useMemo(
    () => sortGroups(groupsQuery.data || [], sortBy),
    [groupsQuery.data, sortBy]
  );

  const groupSlug = group?.slug || null;

  // Artistas del sello/productor/master seleccionado — se filtran en el
  // cliente con el cuadro de búsqueda (listas pequeñas, no hace falta ir al
  // server).
  const groupArtistsQuery = useQuery({
    queryKey: [mode, "artists", groupSlug],
    queryFn: () => fetchGroupArtists(mode, groupSlug),
    enabled: !!groupSlug,
  });

  const filteredGroupArtists = useMemo(() => {
    const data = groupArtistsQuery.data || [];
    const q = artistSearch.trim().toLowerCase();
    return q ? data.filter((a) => a.name.toLowerCase().includes(q)) : data;
  }, [groupArtistsQuery.data, artistSearch]);

  // Sin sello/productor/master marcado, o si la búsqueda no encuentra a
  // nadie dentro del marcado: busca entre todos los artistas de la colección
  // (requiere texto para no traerse miles de filas de golpe).
  const searchingGlobally =
    artistSearch.trim().length > 0 &&
    (!groupSlug || (groupArtistsQuery.isSuccess && filteredGroupArtists.length === 0));
  const globalArtistsQuery = useQuery({
    queryKey: ["artists-search", artistSearch],
    queryFn: () => fetchArtists(artistSearch),
    enabled: searchingGlobally,
  });

  const artistsQuery = searchingGlobally ? globalArtistsQuery : groupArtistsQuery;
  const artistItems = searchingGlobally ? globalArtistsQuery.data || [] : filteredGroupArtists;

  const albumsQuery = useQuery({
    queryKey: [mode, "albums", groupSlug, artist?.id],
    queryFn: () => fetchGroupArtistAlbums(mode, groupSlug, artist.id),
    enabled: !!groupSlug && !!artist,
  });

  // Discografía completa del artista seleccionado.
  const artistAlbumsQuery = useQuery({
    queryKey: ["artist-albums", artist?.id],
    queryFn: () => fetchArtistAlbums(artist.id),
    enabled: !!artist,
  });

  // Con sello/productor/master activo: los del filtro como principales y el
  // resto de la discografía atenuada debajo. Sin filtro activo (búsqueda
  // global de artista): la discografía completa tal cual, sin sección
  // "otros".
  const primaryAlbums = groupSlug ? albumsQuery.data || [] : artistAlbumsQuery.data || [];
  const extraAlbums = useMemo(() => {
    if (!groupSlug) return [];
    const primaryIds = new Set((albumsQuery.data || []).map((a) => a.id));
    return (artistAlbumsQuery.data || [])
      .filter((a) => !primaryIds.has(a.id))
      .sort((a, b) => (a.year || "").localeCompare(b.year || ""));
  }, [groupSlug, albumsQuery.data, artistAlbumsQuery.data]);

  function metaText(album) {
    const value = firstValue(mode, album[modeInfo.field]);
    return [album.year, value].filter(Boolean).join(" · ") || album.year || "";
  }

  function selectGroup(item) {
    setGroup(item);
    setArtist(null);
    setAlbumId(null);
    setArtistSearch("");
    setDetail({ kind: mode, id: item.slug });
  }

  function selectArtist(item) {
    setArtist(item);
    setAlbumId(null);
    setDetail({ kind: "artist", id: item.id });
  }

  // Marca el disco y, si su sello/productor/master no es el marcado en la
  // columna 1, salta a ese (con varios productores/masters, se queda en el
  // actual si es uno de ellos). Se mantiene el artista seleccionado.
  function markAlbum(album) {
    const values = splitValues(mode, album[modeInfo.field]);
    if (values.length && !values.some((v) => slugify(v) === groupSlug)) {
      setGroup({ slug: slugify(values[0]), name: values[0] });
      setSearch("");
    }
    setAlbumId(album.id);
  }

  function selectAlbum(album) {
    markAlbum(album);
    setDetail({ kind: "album", id: album.id });
  }

  // ── Siempre un elemento marcado en cada columna ──────────────────────────
  // Las selecciones automáticas solo marcan; el panel de detalle se abre
  // únicamente al pulsar.
  useEffect(() => {
    if (!group && sortedGroups.length > 0) {
      setGroup({ slug: sortedGroups[0].slug, name: sortedGroups[0].name });
    }
  }, [group, sortedGroups]);

  useEffect(() => {
    const data = groupArtistsQuery.data || [];
    if (groupSlug && !artist && data.length > 0) setArtist(data[0]);
  }, [groupSlug, artist, groupArtistsQuery.data]);

  useEffect(() => {
    if (!artist || !artistAlbumsQuery.isSuccess || (groupSlug && !albumsQuery.isSuccess)) return;
    const all = [...primaryAlbums, ...extraAlbums];
    if (all.some((a) => a.id === albumId)) return;
    if (primaryAlbums.length > 0) setAlbumId(primaryAlbums[0].id);
    // Artista de fuera del filtro (búsqueda global): saltar al grupo de su
    // primer disco, así las tres columnas vuelven a cuadrar.
    else if (extraAlbums.length > 0) markAlbum(extraAlbums[0]);
  }, [artist, albumId, primaryAlbums, extraAlbums, artistAlbumsQuery.isSuccess, albumsQuery.isSuccess, groupSlug]);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 shrink-0">
        <h1 className="font-semibold text-zinc-50">Sellos &amp; Productores</h1>
        <div className="flex rounded overflow-hidden border border-zinc-800">
          {MODES.map((m) => (
            <button
              key={m.kind}
              onClick={() => switchMode(m.kind)}
              className={`px-3 py-1 text-xs ${mode === m.kind ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400"}`}
            >
              {m.tabLabel}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0">
          <Column
            title={modeInfo.columnTitle}
            items={sortedGroups}
            selectedId={groupSlug}
            getId={(item) => item.slug}
            onSelect={selectGroup}
            search={search}
            onSearch={setSearch}
            sortOptions={SORT_OPTIONS}
            sortValue={sortBy}
            onSortChange={setSortBy}
            subtitle={(item) => `${item.artist_count} artistas · ${item.album_count} discos`}
            emptyLabel={groupsQuery.isLoading ? "Cargando..." : "Sin resultados"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Column
            title={searchingGlobally && groupSlug ? "Artistas (toda la colección)" : "Artistas"}
            items={artistItems}
            selectedId={artist?.id}
            onSelect={selectArtist}
            search={artistSearch}
            onSearch={setArtistSearch}
            subtitle={(item) => `${item.album_count} discos`}
            emptyLabel={
              group
                ? artistsQuery.isLoading
                  ? "Cargando..."
                  : "Sin artistas"
                : artistSearch.trim()
                  ? artistsQuery.isLoading
                    ? "Buscando..."
                    : "Sin resultados"
                  : "Elige un filtro o busca un artista"
            }
          />
        </div>
        <div className="flex-[2] min-w-0">
          <AlbumColumn
            primaryAlbums={primaryAlbums}
            extraAlbums={extraAlbums}
            onSelect={selectAlbum}
            selectedId={albumId}
            metaText={metaText}
            emptyLabel={
              artist
                ? (groupSlug ? albumsQuery.isLoading : artistAlbumsQuery.isLoading)
                  ? "Cargando..."
                  : "Sin discos"
                : "Elige un artista"
            }
          />
        </div>
      </div>

      {detail && <DetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
