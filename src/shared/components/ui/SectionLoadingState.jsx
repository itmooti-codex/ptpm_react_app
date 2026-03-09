export function SectionLoadingState({
  label = "Loading",
  blocks = 4,
  columnsClass = "sm:grid-cols-2",
  className = "",
}) {
  const placeholderItems = Array.from(
    { length: Math.max(1, Number.parseInt(blocks, 10) || 1) },
    (_, index) => index
  );
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <span>{label}</span>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${columnsClass}`}>
        {placeholderItems.map((item) => (
          <div
            key={`section-loader-${label}-${item}`}
            className="rounded border border-slate-200 bg-slate-50 p-2"
          >
            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
