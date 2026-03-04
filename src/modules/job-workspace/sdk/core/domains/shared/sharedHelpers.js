import { isPersistedId, normalizeObjectList } from "../../../utils/sdkResponseUtils.js";

export function normalizeIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function parseBooleanValue(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

export function extractCreatedRecordId(payload, key) {
  const managed = payload?.mutations?.[key]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || managedValue?.Contact_ID;
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }
  const pkMap = payload?.extensions?.pkMap || payload?.pkMap;
  if (pkMap && typeof pkMap === "object") {
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  const respId = payload?.resp?.id;
  if (isPersistedId(respId)) {
    return String(respId);
  }

  const objects = normalizeObjectList(payload);
  for (const item of objects) {
    const itemPkMap = item?.extensions?.pkMap || item?.pkMap;
    if (itemPkMap && typeof itemPkMap === "object") {
      for (const value of Object.values(itemPkMap)) {
        if (isPersistedId(value)) return String(value);
      }
    }
  }
  return "";
}

export function parseUploadFileObject(raw = null) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = parseUploadFileObject(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof raw === "string") {
    const stripWrappingQuotes = (value = "") => {
      let next = String(value || "").trim();
      while (
        (next.startsWith('"') && next.endsWith('"')) ||
        (next.startsWith("'") && next.endsWith("'"))
      ) {
        next = next.slice(1, -1).trim();
      }
      return next;
    };

    let trimmed = stripWrappingQuotes(raw);
    if (!trimmed) return null;

    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
      try {
        const decoded = decodeURIComponent(trimmed);
        if (decoded) trimmed = stripWrappingQuotes(decoded);
      } catch {
        // Keep original if decode fails.
      }
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return parseUploadFileObject(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return { link: trimmed };
    }
    return null;
  }
  if (typeof raw === "object") {
    if (raw.File) {
      const nested = parseUploadFileObject(raw.File);
      if (nested) return nested;
    }
    const link = raw.link || raw.url || raw.path || raw.src || "";
    if (!link) return null;
    return {
      link,
      name: raw.name || raw.filename || "",
      size: raw.size ?? "",
      type: raw.type || raw.mime || "",
      s3_id: raw.s3_id || raw.s3Id || "",
    };
  }
  return null;
}
