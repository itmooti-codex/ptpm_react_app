/**
 * Creates a TTL-backed in-memory + localStorage cache.
 *
 * @param {string} storageKeyPrefix - localStorage key prefix (e.g. "ptpm:sp-lookup:v1:")
 * @param {number} [ttlMs=120000] - time-to-live in milliseconds (default 2 minutes)
 * @returns {{ get, set, invalidate, has }}
 */
export function createTtlCache(storageKeyPrefix, ttlMs = 120_000) {
  const memoryCache = new Map();

  function canUseStorage() {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  }

  function storageKey(key) {
    return `${storageKeyPrefix}${key}`;
  }

  function get(key) {
    const strKey = String(key || "").trim();
    if (!strKey) return null;

    const mem = memoryCache.get(strKey);
    if (mem) {
      if (Date.now() - mem.createdAt <= ttlMs) return mem.data;
      memoryCache.delete(strKey);
    }

    if (!canUseStorage()) return null;
    try {
      const raw = window.localStorage.getItem(storageKey(strKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const createdAt = Number(parsed.createdAt || 0);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > ttlMs) {
        window.localStorage.removeItem(storageKey(strKey));
        return null;
      }
      memoryCache.set(strKey, { createdAt, data: parsed.data });
      return parsed.data;
    } catch {
      return null;
    }
  }

  function set(key, data) {
    const strKey = String(key || "").trim();
    if (!strKey) return;
    const entry = { createdAt: Date.now(), data };
    memoryCache.set(strKey, entry);
    if (!canUseStorage()) return;
    try {
      window.localStorage.setItem(storageKey(strKey), JSON.stringify(entry));
    } catch {
      // Ignore write failures (storage quota, private browsing, etc.)
    }
  }

  function invalidate(key) {
    const strKey = String(key || "").trim();
    if (!strKey) return;
    memoryCache.delete(strKey);
    if (!canUseStorage()) return;
    try {
      window.localStorage.removeItem(storageKey(strKey));
    } catch {
      // Ignore cleanup failures.
    }
  }

  function has(key) {
    return get(key) !== null;
  }

  return { get, set, invalidate, has };
}
