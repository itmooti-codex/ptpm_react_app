import { RECENT_ACTIVITY_ACTION_BY_EVENT_KEY } from "./announcementEmitterConfig.js";
import { toText } from "../utils/formatters.js";

const RECENT_ACTIVITY_STORAGE_KEY = "ptpm_admin_recent_activity_v1";
export const RECENT_ACTIVITIES_UPDATED_EVENT = "ptpm-recent-activities-updated";
const MAX_RECENT_ACTIVITY_RECORDS = 20;

function normalizeLegacyInquiryPageType(value = "") {
  const normalized = toText(value).toLowerCase();
  if (normalized === "inquiry-direct") return "inquiry-details";
  return normalized;
}

export function resolveRecentActivityPageType(pathname = "") {
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

export function resolveRecentActivityPageName(pageType = "") {
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

function isMajorRecentActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return (
    normalized.includes("create") ||
    normalized.includes("update") ||
    normalized.includes("delete") ||
    normalized.includes("cancel") ||
    normalized.includes("new inquiry")
  );
}

function normalizeRecentActivityRecord(record = {}) {
  const timestamp = Number(record?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const path = toText(record?.path);
  const pageType =
    normalizeLegacyInquiryPageType(record?.page_type) || resolveRecentActivityPageType(path);
  const metadata =
    record?.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {};
  return {
    id:
      toText(record?.id) ||
      `activity-${normalizedTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: normalizedTimestamp,
    action: toText(record?.action),
    page_type: pageType,
    page_name: toText(record?.page_name) || resolveRecentActivityPageName(pageType),
    path,
    inquiry_id: toText(record?.inquiry_id),
    inquiry_uid: toText(record?.inquiry_uid),
    metadata,
  };
}

function finalizeRecentActivityList(records = []) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((item) => normalizeRecentActivityRecord(item))
    .filter((item) => isMajorRecentActivityAction(item?.action))
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

    const dedupeKey = inquiryKey
      ? `${actionKey}|${inquiryKey}`
      : `${actionKey}|${pathKey.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(item);
  }
  return deduped.slice(0, MAX_RECENT_ACTIVITY_RECORDS);
}

export function readRecentActivityRecordsFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return finalizeRecentActivityList(parsed);
  } catch {
    return [];
  }
}

export function writeRecentActivityRecordsToStorage(records = []) {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(
      RECENT_ACTIVITY_STORAGE_KEY,
      JSON.stringify(finalizeRecentActivityList(records))
    );
    window.dispatchEvent(new CustomEvent(RECENT_ACTIVITIES_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function appendRecentActivityFromAnnouncement({
  eventKey,
  inquiryId,
  quoteJobId,
  focusKind,
  focusId,
  tab,
  title,
} = {}) {
  if (typeof window === "undefined") return false;
  const action = toText(RECENT_ACTIVITY_ACTION_BY_EVENT_KEY[eventKey]);
  if (!action || !isMajorRecentActivityAction(action)) return false;
  const path = `${toText(window.location?.pathname)}${toText(window.location?.search)}`;
  const pageType = resolveRecentActivityPageType(path);
  const now = Date.now();
  const record = normalizeRecentActivityRecord({
    id: `announcement-${toText(eventKey)}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now,
    action,
    page_type: pageType,
    page_name: resolveRecentActivityPageName(pageType),
    path,
    inquiry_id: toText(inquiryId),
    metadata: {
      event_key: toText(eventKey),
      quote_job_id: toText(quoteJobId),
      focus_kind: toText(focusKind),
      focus_id: toText(focusId),
      tab: toText(tab),
      title: toText(title),
    },
  });
  const existing = readRecentActivityRecordsFromStorage();
  const merged = finalizeRecentActivityList([record, ...(Array.isArray(existing) ? existing : [])]);
  return writeRecentActivityRecordsToStorage(merged);
}
