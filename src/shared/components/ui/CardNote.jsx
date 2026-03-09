import { toText, isMissingFieldValue } from "../../utils/formatters.js";

export function CardNote({ label, value, className = "" }) {
  const displayValue = toText(value);
  if (isMissingFieldValue(displayValue)) return null;
  return (
    <div className={`rounded border border-slate-200 bg-slate-50 p-1.5 ${className}`}>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="max-h-[72px] overflow-auto whitespace-pre-wrap text-[12px] leading-4 text-slate-700">
        {displayValue}
      </div>
    </div>
  );
}
