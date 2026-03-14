import { useMemo, useState } from "react";
import { STATUS_COLORS } from "../constants/userManagementConstants.js";

export function ServiceProviderLookup({
  options = [],
  isLoading = false,
  selectedId = "",
  onSelect,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        (sp.email || "").toLowerCase().includes(q) ||
        sp.type.toLowerCase().includes(q)
    );
  }, [options, search]);

  const selected = options.find((sp) => String(sp.id) === String(selectedId));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Link Service Provider</h3>

      {selected ? (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[#003882]/20 bg-[#edf4ff] px-3 py-2">
          <div>
            <div className="text-sm font-medium text-slate-800">{selected.name}</div>
            <div className="text-xs text-slate-500">
              {selected.type} {selected.email ? `- ${selected.email}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-red-600 hover:underline"
            onClick={() => onSelect(null)}
          >
            Unlink
          </button>
        </div>
      ) : null}

      <div className="mt-3">
        <input
          type="text"
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
          placeholder="Search service providers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-2 max-h-[240px] overflow-auto">
        {isLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">Loading service providers...</div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            {search ? "No matches found." : "No service providers available."}
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((sp) => {
              const isSelected = String(sp.id) === String(selectedId);
              const statusColor = STATUS_COLORS[sp.status] || "bg-slate-100 text-slate-600";
              return (
                <li key={sp.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-[#003882]/30 bg-[#edf4ff]"
                        : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => onSelect(sp)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{sp.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>
                        {sp.status || "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{sp.type}</span>
                      {sp.email ? <span>- {sp.email}</span> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
