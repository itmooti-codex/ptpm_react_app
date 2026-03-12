import {
  extractFirstRecord,
  extractMutationErrorMessage,
  extractStatusFailure,
} from "@modules/details-workspace/exports/api.js";
import { toPromiseLike } from "@modules/details-workspace/api/core/transport.js";
import { toText } from "@shared/utils/formatters.js";

const RECENT_ADMIN_ACTIVITY_STORAGE_KEY = "ptpm_admin_recent_activity_v1";
export const MAX_RECENT_ADMIN_ACTIVITY_RECORDS = 20;
const RECENT_ACTIVITIES_UPDATED_EVENT = "ptpm-recent-activities-updated";

export function isMajorRecentActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return (
    normalized.includes("create") ||
    normalized.includes("update") ||
    normalized.includes("delete") ||
    normalized.includes("cancel") ||
    normalized.includes("new inquiry")
  );
}

export function normalizeLegacyInquiryPageType(value = "") {
  const normalized = toText(value).toLowerCase();
  if (normalized === "inquiry-direct") return "inquiry-details";
  return normalized;
}

export function resolveActivityPageType(pathname = "") {
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

export function resolveActivityPageName(pageType = "") {
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

export function normalizeRecentActivityRecord(record = {}) {
  const timestamp = Number(record?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const path = toText(record?.path);
  const pageType =
    normalizeLegacyInquiryPageType(record?.page_type) || resolveActivityPageType(path);
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
    action: toText(record?.action),
    page_type: pageType,
    page_name: toText(record?.page_name) || resolveActivityPageName(pageType),
    path,
    inquiry_id: toText(record?.inquiry_id || metadataInquiryId),
    inquiry_uid: toText(record?.inquiry_uid || metadataInquiryUid),
    metadata,
  };
}

function normalizeRecentActivityAction(value = "") {
  return toText(value).toLowerCase();
}

export function finalizeRecentActivityList(records = []) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((item) => normalizeRecentActivityRecord(item))
    .filter((item) => isMajorRecentActivityAction(item?.action))
    .sort((left, right) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0));

  const createdNewInquiryKeys = new Set(
    normalized
      .filter((item) => normalizeRecentActivityAction(item?.action) === "created new inquiry")
      .map((item) => toText(item?.inquiry_uid).toLowerCase() || toText(item?.path).toLowerCase())
      .filter(Boolean)
  );

  const seen = new Set();
  const deduped = [];

  for (const item of normalized) {
    const actionKey = normalizeRecentActivityAction(item?.action);
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

  return deduped.slice(0, MAX_RECENT_ADMIN_ACTIVITY_RECORDS);
}

export function buildRecentActivitySignature(records = []) {
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
    finalizeRecentActivityList(records).map((item) => ({
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

export function readRecentAdminActivitiesFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ADMIN_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return finalizeRecentActivityList(parsed);
  } catch (storageError) {
    console.warn("[InquiryDetails] Failed reading recent admin activity from storage", storageError);
    return [];
  }
}

export function writeRecentAdminActivitiesToStorage(records = []) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const normalized = finalizeRecentActivityList(records);
    window.localStorage.setItem(RECENT_ADMIN_ACTIVITY_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(RECENT_ACTIVITIES_UPDATED_EVENT));
  } catch (storageError) {
    console.warn("[InquiryDetails] Failed writing recent admin activity to storage", storageError);
  }
}

export function createRecentActivityJsonData(records = [], adminProviderId = "") {
  const normalizedRecords = finalizeRecentActivityList(records);
  const normalizedAdminProviderId = toText(adminProviderId);
  const payload = {
    service_provider_id: normalizedAdminProviderId || null,
    record_count: normalizedRecords.length,
    records: normalizedRecords.map((item) => ({
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
      service_provider_id: normalizedAdminProviderId || null,
      record_count: normalizedRecords.length,
      records: normalizedRecords.map((item) => ({
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

function normalizeMutationIdentifier(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

async function fetchServiceProviderByContactId({ plugin, contactId }) {
  const normalizedContactId = normalizeMutationIdentifier(contactId);
  if (!plugin?.switchTo || normalizedContactId == null) return null;

  const providerModel = plugin.switchTo("PeterpmServiceProvider");

  const runQuery = async (restrictToAdminType = false) => {
    let query = providerModel
      .query()
      .where("contact_information_id", normalizedContactId)
      .deSelectAll()
      .select([
        "id",
        "unique_id",
        "type",
        "status",
        "work_email",
        "mobile_number",
        "contact_information_id",
      ])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(1)
      .noDestroy();

    if (restrictToAdminType) {
      query = query.andWhere("type", "Admin");
    }

    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  return (await runQuery(true)) || (await runQuery(false)) || null;
}

export async function resolveRecentActivityAdminProviderId({
  plugin,
  configuredProviderId = "",
  currentUserContactId = "",
} = {}) {
  const configuredId = toText(configuredProviderId);
  if (configuredId) {
    return configuredId;
  }

  const byContactRecord = await fetchServiceProviderByContactId({
    plugin,
    contactId: currentUserContactId,
  });
  const byContactRecordId = toText(byContactRecord?.id || byContactRecord?.ID);
  if (byContactRecordId) return byContactRecordId;

  return "";
}

export async function updateServiceProviderRecentActivityJsonData({
  plugin,
  serviceProviderId,
  jsonPayload,
} = {}) {
  const normalizedProviderId = toText(serviceProviderId);
  if (!plugin?.switchTo || !normalizedProviderId) {
    throw new Error("Service provider context is not ready.");
  }

  const normalizedPayload = toText(jsonPayload);
  if (!normalizedPayload) {
    throw new Error("Recent activity JSON payload is missing.");
  }

  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.mutation) {
    throw new Error("Service provider model is unavailable.");
  }

  const normalizedProviderLookupId = /^\d+$/.test(normalizedProviderId)
    ? Number.parseInt(normalizedProviderId, 10)
    : normalizedProviderId;
  const whereCandidates = [
    ["id", normalizedProviderLookupId],
    ["id", normalizedProviderId],
    ["unique_id", normalizedProviderId],
    ["unique_id", normalizedProviderLookupId],
  ];
  const wherePairs = [];
  const seenWherePairs = new Set();

  for (const [whereField, whereValue] of whereCandidates) {
    const normalizedWhereValue = toText(whereValue);
    if (!normalizedWhereValue) continue;
    const key = `${whereField}:${normalizedWhereValue}`;
    if (seenWherePairs.has(key)) continue;
    seenWherePairs.add(key);
    wherePairs.push([whereField, whereValue]);
  }

  const payloadFields = [
    "recent_activity_json_data",
    "Recent_Activity_Json_Data",
    "recent_activity",
    "Recent_Activity",
  ];
  const normalizePayloadForCompare = (value) => {
    const text = toText(value);
    if (!text) return "";
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  };

  const expectedPayloadNormalized = normalizePayloadForCompare(normalizedPayload);
  const wasPayloadPersisted = async (whereField, whereValue, payloadField) => {
    if (!providerModel?.query) return false;
    try {
      const query = providerModel
        .query()
        .where(whereField, whereValue)
        .deSelectAll()
        .select(["id", "unique_id", payloadField])
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const result = await toPromiseLike(query.fetchDirect());
      const record = extractFirstRecord(result);
      if (!record) return false;
      const persistedPayload = normalizePayloadForCompare(
        record?.[payloadField] ?? record?._data?.[payloadField]
      );
      return persistedPayload === expectedPayloadNormalized;
    } catch {
      return false;
    }
  };

  const executeUpdate = async (whereField, whereValue, payloadField) => {
    const mutation = await providerModel.mutation();
    mutation.update((query) =>
      query.where(whereField, whereValue).set({
        [payloadField]: normalizedPayload,
      })
    );

    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error("Recent activity JSON update was cancelled.");
    }

    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        extractMutationErrorMessage(failure.statusMessage) ||
          "Unable to update service provider recent activity JSON data."
      );
    }

    return true;
  };

  let lastError = null;
  for (const [whereField, whereValue] of wherePairs) {
    for (const payloadField of payloadFields) {
      try {
        await executeUpdate(whereField, whereValue, payloadField);
        const didPersist = await wasPayloadPersisted(whereField, whereValue, payloadField);
        if (didPersist) {
          return true;
        }
        lastError = new Error(
          `Recent activity payload was not persisted for ${whereField} (${toText(whereValue)}) using ${payloadField}.`
        );
      } catch (updateError) {
        lastError = updateError;
      }
    }
  }

  if (lastError) throw lastError;
  return false;
}
