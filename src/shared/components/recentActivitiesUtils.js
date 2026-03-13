import { STORAGE_KEY, MAX_RECORDS, ACTIVITIES_UPDATED_EVENT } from "./recentActivitiesConstants.js";
import { toText } from "../utils/formatters.js";

export function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function isMajorActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return (
    normalized.includes("create") ||
    normalized.includes("update") ||
    normalized.includes("delete") ||
    normalized.includes("cancel") ||
    normalized.includes("new inquiry")
  );
}

export function isDeleteLikeActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return normalized.includes("delete") || normalized.includes("cancel");
}

export function normalizeLegacyInquiryPageType(value = "") {
  const normalized = toText(value).toLowerCase();
  if (normalized === "inquiry-direct") return "inquiry-details";
  return normalized;
}

export function resolvePageType(pathname = "") {
  const normalizedPath = toText(pathname).toLowerCase();
  if (!normalizedPath) return "unknown";
  if (normalizedPath.startsWith("/inquiry-details")) return "inquiry-details";
  if (normalizedPath.startsWith("/inquiry-direct")) return "inquiry-details";
  if (normalizedPath.startsWith("/job-direct")) return "job-direct";
  if (normalizedPath.startsWith("/details")) return "job-details";
  if (normalizedPath.startsWith("/profile")) return "profile";
  if (normalizedPath.startsWith("/settings")) return "settings";
  if (normalizedPath.startsWith("/notifications")) return "notifications";
  if (normalizedPath === "/") return "dashboard";
  return "app";
}

export function resolvePageName(pageType = "") {
  const normalizedType = normalizeLegacyInquiryPageType(pageType);
  if (normalizedType === "inquiry-details") return "Inquiry Details";
  if (normalizedType === "job-direct") return "Job Direct";
  if (normalizedType === "job-details") return "Job Details";
  if (normalizedType === "profile") return "Profile";
  if (normalizedType === "settings") return "Settings";
  if (normalizedType === "notifications") return "Notifications";
  if (normalizedType === "dashboard") return "Dashboard";
  return "App";
}

export function normalizeActivityRecord(record = {}) {
  const timestamp = Number(record?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const path = toText(record?.path);
  const pageType =
    normalizeLegacyInquiryPageType(record?.page_type) || resolvePageType(path);
  const metadata =
    record?.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {};
  const metadataInquiryId =
    toText(metadata?.inquiry_id) || toText(metadata?.inquiryId) || toText(metadata?.deal_id);
  const metadataInquiryUid =
    toText(metadata?.inquiry_uid) || toText(metadata?.inquiryUid) || toText(metadata?.deal_uid);
  return {
    id:
      toText(record?.id) ||
      `activity-${normalizedTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: normalizedTimestamp,
    action: toText(record?.action) || "Viewed page",
    page_type: pageType,
    page_name: toText(record?.page_name) || resolvePageName(pageType),
    path,
    inquiry_id: toText(record?.inquiry_id || metadataInquiryId),
    inquiry_uid: toText(record?.inquiry_uid || metadataInquiryUid),
    metadata,
  };
}

export function normalizeRecords(records = []) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((item) => normalizeActivityRecord(item))
    .filter((item) => isMajorActivityAction(item?.action))
    .sort((left, right) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0));
  const createdNewInquiryKeys = new Set(
    normalized
      .filter((item) => toText(item?.action).toLowerCase() === "created new inquiry")
      .map((item) => toText(item?.inquiry_uid).toLowerCase() || toText(item?.path).toLowerCase())
      .filter(Boolean)
  );
  const seen = new Set();
  const deduped = [];
  for (const item of normalized) {
    const actionKey = toText(item?.action).toLowerCase();
    const inquiryUidKey = toText(item?.inquiry_uid).toLowerCase();
    const inquiryIdKey = toText(item?.inquiry_id).toLowerCase();
    const pathKey = toText(item?.path);
    const inquiryKey = inquiryUidKey || inquiryIdKey || pathKey.toLowerCase();

    if (
      actionKey === "started new inquiry" &&
      inquiryKey &&
      createdNewInquiryKeys.has(inquiryKey)
    ) {
      continue;
    }

    const key = inquiryKey ? `${actionKey}|${inquiryKey}` : `${actionKey}|${pathKey.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, MAX_RECORDS);
}

export function readRecords() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeRecords(parsed);
  } catch {
    return [];
  }
}

export function writeRecords(records = []) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRecords(records)));
    window.dispatchEvent(new CustomEvent(ACTIVITIES_UPDATED_EVENT));
  } catch {
    // no-op
  }
}

export function createRecentActivityJsonData(records = [], serviceProviderId = "") {
  const normalized = normalizeRecords(records);
  const normalizedServiceProviderId = toText(serviceProviderId);
  const payload = {
    service_provider_id: normalizedServiceProviderId || null,
    record_count: normalized.length,
    records: normalized.map((item) => ({
      id: toText(item?.id),
      timestamp: Number(item?.timestamp || 0),
      action: toText(item?.action),
      page_type: toText(item?.page_type),
      page_name: toText(item?.page_name),
      path: toText(item?.path),
      inquiry_id: toText(item?.inquiry_id),
      inquiry_uid: toText(item?.inquiry_uid),
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
    })),
  };

  const seen = new WeakSet();
  try {
    return JSON.stringify(payload, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (
        typeof value === "function" ||
        typeof value === "symbol" ||
        typeof value === "undefined"
      ) {
        return undefined;
      }
      if (value && typeof value === "object") {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
  } catch {
    return JSON.stringify({
      service_provider_id: normalizedServiceProviderId || null,
      record_count: normalized.length,
      records: normalized.map((item) => ({
        id: toText(item?.id),
        timestamp: Number(item?.timestamp || 0),
        action: toText(item?.action),
        page_type: toText(item?.page_type),
        page_name: toText(item?.page_name),
        path: toText(item?.path),
        inquiry_id: toText(item?.inquiry_id),
        inquiry_uid: toText(item?.inquiry_uid),
      })),
    });
  }
}

export function parseServerRecentActivityRecords(rawPayload = "") {
  const normalizedPayload = toText(rawPayload);
  if (!normalizedPayload) return [];
  try {
    const parsed = JSON.parse(normalizedPayload);
    if (Array.isArray(parsed)) return normalizeRecords(parsed);
    if (Array.isArray(parsed?.records)) return normalizeRecords(parsed.records);
  } catch (error) {
    console.warn("[RecentActivitiesDock] Failed parsing server recent activity JSON payload", error);
  }
  return [];
}

export function buildActivitySignature(records = []) {
  const toSignatureJson = (value) => {
    const seen = new WeakSet();
    try {
      return (
        JSON.stringify(value, (_key, current) => {
          if (typeof current === "bigint") return current.toString();
          if (
            typeof current === "function" ||
            typeof current === "symbol" ||
            typeof current === "undefined"
          ) {
            return undefined;
          }
          if (current && typeof current === "object") {
            if (seen.has(current)) return undefined;
            seen.add(current);
          }
          return current;
        }) || ""
      );
    } catch {
      return "";
    }
  };
  return JSON.stringify(
    normalizeRecords(records).map((item) => ({
      id: toText(item?.id),
      timestamp: Number(item?.timestamp || 0),
      action: toText(item?.action),
      page_type: toText(item?.page_type),
      page_name: toText(item?.page_name),
      path: toText(item?.path),
      inquiry_id: toText(item?.inquiry_id),
      inquiry_uid: toText(item?.inquiry_uid),
      metadata: toSignatureJson(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}),
    }))
  );
}

export function normalizeObjectList(value) {
  const queue = [value];
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

export function extractStatusFailure(result) {
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const statusCode = Number(item?.statusCode || item?.extensions?.statusCode || 0);
    if (Number.isFinite(statusCode) && statusCode >= 400) {
      return {
        statusCode,
        statusMessage: toText(item?.extensions?.statusMessage || item?.statusMessage || item?.error),
      };
    }
  }
  return null;
}

export function toPromiseLike(value) {
  if (!value) return Promise.resolve(value);
  if (typeof value.then === "function") return value;
  if (value?.toPromise && typeof value.toPromise === "function") {
    return value.toPromise();
  }
  if (typeof value.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = value.subscribe({
        next: (nextValue) => {
          if (settled) return;
          settled = true;
          resolve(nextValue);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(value);
}

export function extractFirstRecord(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  if (Array.isArray(value?.resp)) return value.resp[0] || null;
  if (Array.isArray(value?.records)) return value.records[0] || null;
  if (Array.isArray(value?.data)) return value.data[0] || null;
  if (value?.data && typeof value.data === "object") {
    for (const nested of Object.values(value.data)) {
      if (Array.isArray(nested)) return nested[0] || null;
    }
  }
  return value && typeof value === "object" ? value : null;
}
