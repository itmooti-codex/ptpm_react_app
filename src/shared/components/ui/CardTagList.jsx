import { toText } from "../../utils/formatters.js";
import { SmallCloseIcon } from "../icons/index.jsx";

export function CardTagList({
  label,
  tags = [],
  className = "",
  compact = false,
  onRemoveTag = null,
  isTagRemoving = null,
  isRemovalDisabled = false,
}) {
  const safeTags = (Array.isArray(tags) ? tags : [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const text = toText(item);
        if (!text) return null;
        return { key: text, code: "", label: text };
      }
      const labelValue = toText(item?.label || item?.value || item?.code);
      const keyValue = toText(item?.key || item?.code || labelValue);
      if (!labelValue || !keyValue) return null;
      return { key: keyValue, code: toText(item?.code), label: labelValue };
    })
    .filter(Boolean);

  if (!safeTags.length) return null;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 min-h-0 ${
          compact ? "max-h-7 overflow-x-auto overflow-y-hidden" : "max-h-[72px] overflow-auto"
        }`}
      >
        <div className={`flex gap-1 ${compact ? "flex-nowrap whitespace-nowrap pr-1" : "flex-wrap"}`}>
          {safeTags.map((tag) => {
            const tagKey = toText(tag?.key);
            const tagLabel = toText(tag?.label);
            const canRemove = typeof onRemoveTag === "function";
            const removing =
              typeof isTagRemoving === "function" ? Boolean(isTagRemoving(tag)) : false;
            return (
              <span
                key={`${label}-${tagKey}`}
                className="inline-flex items-center rounded border border-sky-200 px-2 py-0.5 text-[11px] text-sky-800"
              >
                <span>{tagLabel}</span>
                {canRemove ? (
                  <button
                    type="button"
                    className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onRemoveTag(tag)}
                    disabled={isRemovalDisabled || removing}
                    aria-label={`Remove ${tagLabel}`}
                    title={`Remove ${tagLabel}`}
                  >
                    <SmallCloseIcon />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
