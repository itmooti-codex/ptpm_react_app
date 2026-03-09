import { toText, isMissingFieldValue } from "../../utils/formatters.js";
import { CopyIcon } from "../icons/index.jsx";

export function CardField({
  label,
  value,
  mono = false,
  className = "",
  href = "",
  openInNewTab = false,
  copyable = false,
  copyValue = "",
  onCopy = null,
}) {
  const displayValue = toText(value);
  if (isMissingFieldValue(displayValue)) return null;
  const canLink = Boolean(toText(href));
  const copyText = toText(copyValue || value);
  const canCopy = Boolean(copyable && copyText);
  const valueMaxWidthClass = canCopy ? "max-w-[calc(100%-1.5rem)]" : "max-w-full";

  const handleCopyClick = async () => {
    if (!canCopy) return;
    if (typeof onCopy === "function") {
      await onCopy({ label, value: copyText });
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyText);
    }
  };

  return (
    <div className={`group min-w-0 ${className}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex w-full min-w-0 items-start gap-2">
        {canLink ? (
          <a
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </a>
        ) : (
          <div
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-slate-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </div>
        )}
        {canCopy ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            onClick={handleCopyClick}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            <CopyIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}
