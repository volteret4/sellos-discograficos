export default function Column({
  title,
  items,
  selectedId,
  onSelect,
  subtitle,
  search,
  onSearch,
  emptyLabel,
  sortOptions,
  sortValue,
  onSortChange,
}) {
  return (
    <div className="flex flex-col w-full h-full border-r border-zinc-800 min-w-0">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {onSearch && (
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar..."
            className="mt-2 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-600"
          />
        )}
        {sortOptions && (
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="mt-2 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-600"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-zinc-600 text-xs px-3 py-4">{emptyLabel || "Nada aquí"}</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className={`w-full text-left px-3 py-2 border-b border-zinc-900 hover:bg-zinc-900 transition-colors ${
              selectedId === item.id ? "bg-zinc-800" : ""
            }`}
          >
            <div className="truncate text-zinc-100">{item.name}</div>
            {subtitle && <div className="text-xs text-zinc-500">{subtitle(item)}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
