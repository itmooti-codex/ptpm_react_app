import { cx } from "../../lib/cx.js";
import { formatFileSize } from "../../utils/formatters.js";

export function EmptyState({ title, description, tone = "neutral" }) {
  const toneClassName =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white/85 text-slate-600";

  return (
    <div className={cx("rounded-[22px] border px-4 py-4 shadow-sm backdrop-blur", toneClassName)}>
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
            tone === "error"
              ? "border-red-200 bg-white text-red-500"
              : "border-slate-200 bg-slate-50 text-[#003882]"
          )}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M5.5 8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 16 16H9l-3.5 2v-2A2.5 2.5 0 0 1 3 13.5v-5A2.5 2.5 0 0 1 5.5 8.5Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M7.75 9.75h8.5M7.75 12.25h5.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-xs leading-5">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function AttachmentChip({ meta }) {
  if (!meta?.link) return null;

  return (
    <a
      href={meta.link}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#003882] shadow-sm transition hover:bg-white"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
        <path
          d="M8.25 12.75 13.8 7.2a2.8 2.8 0 1 1 3.96 3.96l-7.25 7.25a4.2 4.2 0 0 1-5.94-5.94l7.25-7.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="max-w-[220px] truncate">
        {meta.name || "View attachment"}
        {meta.size ? ` (${formatFileSize(meta.size)})` : ""}
      </span>
    </a>
  );
}

