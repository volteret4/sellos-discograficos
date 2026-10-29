import { useEffect, useRef } from "react";

const SELECTED = "bg-zinc-800 border-l-2 border-l-zinc-300 !opacity-100";

export default function AlbumColumn({ primaryAlbums, extraAlbums, onSelect, metaText, emptyLabel, selectedId }) {
  const isEmpty = primaryAlbums.length === 0 && extraAlbums.length === 0;
  const selectedRef = useRef(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId, primaryAlbums, extraAlbums]);
  const refFor = (album) => (selectedId != null && album.id === selectedId ? selectedRef : null);
  return (
    <div className="flex flex-col w-full h-full border-r border-zinc-800 min-w-0">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Discos</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isEmpty && <p className="text-zinc-600 text-xs px-3 py-4">{emptyLabel || "Nada aquí"}</p>}

        {primaryAlbums.map((album) => (
          <button
            key={album.id}
            ref={refFor(album)}
            onClick={() => onSelect(album)}
            className={`w-full text-left px-3 py-2 border-b border-zinc-900 hover:bg-zinc-900 transition-colors ${
              album.id === selectedId ? SELECTED : ""
            }`}
          >
            <div className="truncate text-zinc-100">{album.name}</div>
            <div className="text-xs text-zinc-500">{metaText(album)}</div>
          </button>
        ))}

        {extraAlbums.length > 0 && (
          <div className="px-3 py-1 mt-1 text-[10px] uppercase tracking-wide text-zinc-600 border-t border-zinc-900">
            Otros discos de este artista
          </div>
        )}
        {extraAlbums.map((album) => (
          <button
            key={album.id}
            ref={refFor(album)}
            onClick={() => onSelect(album)}
            className={`w-full text-left px-3 py-2 border-b border-zinc-900 opacity-50 hover:opacity-90 hover:bg-zinc-900 transition-all ${
              album.id === selectedId ? SELECTED : ""
            }`}
          >
            <div className="truncate text-zinc-200">{album.name}</div>
            <div className="text-xs text-zinc-500">{metaText(album)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
