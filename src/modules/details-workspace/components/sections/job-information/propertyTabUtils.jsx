export function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 15V6C5 4.89543 5.89543 4 7 4H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function toSafeText(value) {
  return String(value || "").trim();
}

export function hasDisplayValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return true;
  const text = String(value).trim();
  return Boolean(text && text !== "-" && text !== "—");
}
