function extractArrayFromDataObject(dataObject) {
  if (!dataObject || typeof dataObject !== "object") return [];
  for (const value of Object.values(dataObject)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function extractFirstRecord(payload) {
  const records = extractRecords(payload);
  return records[0] || null;
}

export function extractRecords(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const fromData = extractArrayFromDataObject(payload.data);
    if (fromData.length) return fromData;
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const fromNestedData = extractArrayFromDataObject(payload.payload.data);
    if (fromNestedData.length) return fromNestedData;
  }
  if (Array.isArray(payload)) return payload;
  if (payload?.resp && typeof payload.resp === "object") return [payload.resp];
  if (payload && typeof payload === "object") return [payload];
  return [];
}

export function extractOperationRecord(payload, operationName) {
  const key = String(operationName || "").trim();
  if (!key) return null;

  const objects = normalizeObjectList(payload);
  for (const item of objects) {
    if (!item || typeof item !== "object") continue;

    if (item?.data && typeof item.data === "object" && key in item.data) {
      return item.data[key] || null;
    }

    if (key in item) {
      return item[key] || null;
    }
  }
  return null;
}

export function isPersistedId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

export function normalizeObjectList(input) {
  const queue = [input];
  const seen = new Set();
  const objects = [];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    objects.push(current);

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (current.payload && typeof current.payload === "object") queue.push(current.payload);
    if (current.resp && typeof current.resp === "object") queue.push(current.resp);
    if (current.data && typeof current.data === "object") queue.push(current.data);
  }

  return objects;
}

export function sanitizeUploadPath(path = "") {
  return String(path || "").trim().replace(/^[\\/]+|[\\/]+$/g, "");
}

export function extractStatusFailure(result) {
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const statusCode = Number(item?.statusCode || item?.extensions?.statusCode || 0);
    if (Number.isFinite(statusCode) && statusCode >= 400) {
      const statusMessage =
        item?.extensions?.statusMessage || item?.statusMessage || item?.error || "";
      return {
        statusCode,
        statusMessage,
      };
    }
  }
  return null;
}

export function findMutationData(result, operationName) {
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const record = item?.data?.[operationName];
    if (record === null) {
      return null;
    }
    if (Array.isArray(record)) {
      if (!record.length) return [];
      const firstObject = record.find((entry) => entry && typeof entry === "object");
      return firstObject || record;
    }
    if (record && typeof record === "object") {
      return record;
    }
  }
  return undefined;
}

export function findMutationDataByMatcher(result, matcher) {
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const data = item?.data;
    if (!data || typeof data !== "object") continue;
    for (const [key, value] of Object.entries(data)) {
      if (!matcher(key)) continue;
      if (value === null) return null;
      if (Array.isArray(value)) {
        if (!value.length) return [];
        const firstObject = value.find((entry) => entry && typeof entry === "object");
        return firstObject || value;
      }
      if (value && typeof value === "object") return value;
    }
  }
  return undefined;
}

export function extractMutationErrorMessage(rawMessage = "") {
  const message = String(rawMessage || "").trim();
  if (!message) return "";

  const lower = message.toLowerCase();
  if (lower.includes("field email is not a valid email")) {
    return "Email is not valid. Please enter a valid email address.";
  }

  const ontraportPrefix = "ontraport response:";
  const index = lower.indexOf(ontraportPrefix);
  if (index >= 0) {
    const trimmed = message.slice(index + ontraportPrefix.length).trim();
    return trimmed || message;
  }

  return message;
}

export function extractCancellationMessage(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    return extractMutationErrorMessage(failure.statusMessage) || fallbackMessage;
  }

  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const candidate =
      item?.extensions?.statusMessage ||
      item?.statusMessage ||
      item?.error ||
      item?.message ||
      "";
    if (typeof candidate === "function") continue;
    const normalized = extractMutationErrorMessage(candidate);
    if (/^function\s+[A-Za-z0-9_]+\s*\(/.test(normalized)) continue;
    if (normalized) return normalized;
  }

  return fallbackMessage;
}
