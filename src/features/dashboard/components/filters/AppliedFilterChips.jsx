function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function AppliedFilterChips({ chips = [], onRemove }) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
      {chips.map((chip, index) => (
        <span
          key={`${chip.key}-${chip.value}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700"
        >
          {chip.label}
          <button
            type="button"
            className="ml-0.5 text-slate-400 hover:text-slate-700"
            onClick={() => onRemove?.(chip.key, chip.value)}
            aria-label={`Remove filter: ${chip.label}`}
          >
            <XIcon />
          </button>
        </span>
      ))}
    </div>
  );
}
