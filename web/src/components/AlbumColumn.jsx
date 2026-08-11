export default function AlbumColumn({ primaryAlbums, extraAlbums, onSelectPrimary, onSelectExtra, emptyLabel }) {
  const isEmpty = primaryAlbums.length === 0 && extraAlbums.length === 0;
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
            onClick={() => onSelectPrimary(album)}
            className="w-full text-left px-3 py-2 border-b border-zinc-900 hover:bg-zinc-900 transition-colors"
          >
            <div className="truncate text-zinc-100">{album.name}</div>
            <div className="text-xs text-zinc-500">{album.year || ""}</div>
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
            onClick={() => onSelectExtra(album)}
            className="w-full text-left px-3 py-2 border-b border-zinc-900 opacity-50 hover:opacity-90 hover:bg-zinc-900 transition-all"
          >
            <div className="truncate text-zinc-200">{album.name}</div>
            <div className="text-xs text-zinc-500">
              {album.year || ""}
              {album.label ? ` · ${album.label}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
