const CACHE_PREFIX = "dashboard:v1";

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function toStorageKey(key) {
  return `${CACHE_PREFIX}:${String(key || "").trim()}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function readDashboardCache(key, { maxAgeMs = 5 * 60 * 1000 } = {}) {
  if (!canUseStorage()) return null;
  const storageKey = toStorageKey(key);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (maxAgeMs > 0 && Date.now() - ts > maxAgeMs) return null;
    return parsed?.value ?? null;
  } catch (_) {
    return null;
  }
}

export function writeDashboardCache(key, value) {
  if (!canUseStorage()) return;
  const storageKey = toStorageKey(key);
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ts: Date.now(),
        value,
      })
    );
  } catch (_) {
    // Ignore localStorage quota/security errors.
  }
}

export function buildRowsCacheKey({
  tab = "",
  filters = {},
  page = 1,
  pageSize = 25,
  sort = "desc",
} = {}) {
  return [
    "rows",
    String(tab || ""),
    String(page || 1),
    String(pageSize || 25),
    String(sort || "desc"),
    stableStringify(filters || {}),
  ].join("|");
}

export function buildCalendarCacheKey({
  tab = "",
  filters = {},
} = {}) {
  return [
    "calendar",
    String(tab || ""),
    stableStringify(filters || {}),
  ].join("|");
}
