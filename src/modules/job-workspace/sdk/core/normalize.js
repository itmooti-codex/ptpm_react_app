export function normalizeIdentifier(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeEpochSeconds(value) {
  if (value === null || value === undefined) return null;
  const text = normalizeText(value);
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const normalizedDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text;
  const parsed = new Date(normalizedDateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}
