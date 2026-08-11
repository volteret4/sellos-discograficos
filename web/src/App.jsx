import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Column from "./components/Column.jsx";
import AlbumColumn from "./components/AlbumColumn.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import {
  fetchLabels,
  fetchLabelArtists,
  fetchLabelArtistAlbums,
  fetchProducers,
  fetchProducerArtists,
  fetchProducerArtistAlbums,
  fetchArtistAlbums,
} from "./api.js";

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

// Debe coincidir con api/producers.py::_slugify
function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export default function App() {
  const [mode, setMode] = useState("labels"); // "labels" | "producers"
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [group, setGroup] = useState(null); // selected label or producer
  const [artist, setArtist] = useState(null); // selected artist
  const [detail, setDetail] = useState(null); // { kind, id }

  const groupKind = mode === "labels" ? "label" : "producer";

  function switchMode(next) {
    setMode(next);
    setSearch("");
    setGroup(null);
    setArtist(null);
    setDetail(null);
  }

  const groupsQuery = useQuery({
    queryKey: [mode, "groups", search],
    queryFn: () => (mode === "labels" ? fetchLabels(search) : fetchProducers(search)),
  });

  const sortedGroups = useMemo(
    () => sortGroups(groupsQuery.data || [], sortBy),
    [groupsQuery.data, sortBy]
  );

  const groupId = group ? (mode === "labels" ? group.id : group.slug) : null;

  const artistsQuery = useQuery({
    queryKey: [mode, "artists", groupId],
    queryFn: () =>
      mode === "labels" ? fetchLabelArtists(groupId) : fetchProducerArtists(groupId),
    enabled: !!groupId,
  });

  const albumsQuery = useQuery({
    queryKey: [mode, "albums", groupId, artist?.id],
    queryFn: () =>
      mode === "labels"
        ? fetchLabelArtistAlbums(groupId, artist.id)
        : fetchProducerArtistAlbums(groupId, artist.id),
    enabled: !!groupId && !!artist,
  });

  // Resto de discos del artista seleccionado, para mostrarlos atenuados
  // junto a los del sello/productor activo.
  const artistAlbumsQuery = useQuery({
    queryKey: ["artist-albums", artist?.id],
    queryFn: () => fetchArtistAlbums(artist.id),
    enabled: !!artist,
  });

  const extraAlbums = useMemo(() => {
    const primaryIds = new Set((albumsQuery.data || []).map((a) => a.id));
    return (artistAlbumsQuery.data || [])
      .filter((a) => !primaryIds.has(a.id))
      .sort((a, b) => (a.year || "").localeCompare(b.year || ""));
  }, [albumsQuery.data, artistAlbumsQuery.data]);

  function selectGroup(item) {
    setGroup(item);
    setArtist(null);
    setDetail({ kind: groupKind, id: mode === "labels" ? item.id : item.slug });
  }

  function selectArtist(item) {
    setArtist(item);
    setDetail({ kind: "artist", id: item.id });
  }

  function selectAlbum(item) {
    setDetail({ kind: "album", id: item.id });
  }

  // Disco de este mismo artista pero fuera del sello/productor activo:
  // saltamos el filtro de columna 1 al sello/productor de ESE disco,
  // manteniendo el artista seleccionado.
  function selectForeignAlbum(album) {
    if (mode === "labels") {
      if (album.label_id) {
        setGroup({ id: album.label_id, name: album.label });
        setSearch("");
      }
    } else {
      const producers = (album.producers || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (producers.length) {
        setGroup({ slug: slugify(producers[0]), name: producers[0] });
        setSearch("");
      }
    }
    setDetail({ kind: "album", id: album.id });
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800 shrink-0">
        <h1 className="font-semibold text-zinc-50">Sellos &amp; Productores</h1>
        <div className="flex rounded overflow-hidden border border-zinc-800">
          <button
            onClick={() => switchMode("labels")}
            className={`px-3 py-1 text-xs ${mode === "labels" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400"}`}
          >
            Sellos
          </button>
          <button
            onClick={() => switchMode("producers")}
            className={`px-3 py-1 text-xs ${mode === "producers" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400"}`}
          >
            Productores
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Column
          title={mode === "labels" ? "Sellos" : "Productores"}
          items={sortedGroups}
          selectedId={groupId}
          onSelect={selectGroup}
          search={search}
          onSearch={setSearch}
          sortOptions={SORT_OPTIONS}
          sortValue={sortBy}
          onSortChange={setSortBy}
          subtitle={(item) => `${item.artist_count} artistas · ${item.album_count} discos`}
          emptyLabel={groupsQuery.isLoading ? "Cargando..." : "Sin resultados"}
        />
        <Column
          title="Artistas"
          items={artistsQuery.data || []}
          selectedId={artist?.id}
          onSelect={selectArtist}
          subtitle={(item) => `${item.album_count} discos`}
          emptyLabel={group ? (artistsQuery.isLoading ? "Cargando..." : "Sin artistas") : "Elige un sello o productor"}
        />
        <AlbumColumn
          primaryAlbums={albumsQuery.data || []}
          extraAlbums={extraAlbums}
          onSelectPrimary={selectAlbum}
          onSelectExtra={selectForeignAlbum}
          emptyLabel={artist ? (albumsQuery.isLoading ? "Cargando..." : "Sin discos") : "Elige un artista"}
        />
      </div>

      {detail && <DetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
