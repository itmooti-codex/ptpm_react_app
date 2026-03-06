import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useVitalStatsPlugin } from "../../platform/vitalstats/useVitalStatsPlugin.js";
import { APP_USER } from "../../config/userConfig.js";

const STORAGE_KEY = "ptpm_admin_recent_activity_v1";
const MAX_RECORDS = 20;
const ACTIVITIES_UPDATED_EVENT = "ptpm-recent-activities-updated";
const MAX_SYNC_RETRY_PER_SIGNATURE = 3;

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function isMajorActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return (
    normalized.includes("create") ||
    normalized.includes("update") ||
    normalized.includes("delete") ||
    normalized.includes("cancel") ||
    normalized.includes("new inquiry")
  );
}

function isDeleteLikeActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return normalized.includes("delete") || normalized.includes("cancel");
}

function resolvePageType(pathname = "") {
  const normalizedPath = toText(pathname).toLowerCase();
  if (!normalizedPath) return "unknown";
  if (normalizedPath.startsWith("/inquiry-details")) return "inquiry-details";
  if (normalizedPath.startsWith("/inquiry-direct")) return "inquiry-direct";
  if (normalizedPath.startsWith("/job-direct")) return "job-direct";
  if (normalizedPath.startsWith("/details")) return "job-details";
  if (normalizedPath.startsWith("/profile")) return "profile";
  if (normalizedPath.startsWith("/settings")) return "settings";
  if (normalizedPath.startsWith("/notifications")) return "notifications";
  if (normalizedPath === "/") return "dashboard";
  return "app";
}

function resolvePageName(pageType = "") {
  const normalizedType = toText(pageType).toLowerCase();
  if (normalizedType === "inquiry-details") return "Inquiry Details";
  if (normalizedType === "inquiry-direct") return "Inquiry Direct";
  if (normalizedType === "job-direct") return "Job Direct";
  if (normalizedType === "job-details") return "Job Details";
  if (normalizedType === "profile") return "Profile";
  if (normalizedType === "settings") return "Settings";
  if (normalizedType === "notifications") return "Notifications";
  if (normalizedType === "dashboard") return "Dashboard";
  return "App";
}

function normalizeActivityRecord(record = {}) {
  const timestamp = Number(record?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const path = toText(record?.path);
  const pageType = toText(record?.page_type) || resolvePageType(path);
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

function normalizeRecords(records = []) {
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

function readRecords() {
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

function writeRecords(records = []) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRecords(records)));
    window.dispatchEvent(new CustomEvent(ACTIVITIES_UPDATED_EVENT));
  } catch {
    // no-op
  }
}

function createRecentActivityJsonData(records = [], serviceProviderId = "") {
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

function parseServerRecentActivityRecords(rawPayload = "") {
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

async function fetchServiceProviderRecentActivityRecordsFromServer({
  plugin,
  serviceProviderId,
} = {}) {
  const normalizedProviderId = toText(serviceProviderId);
  if (!plugin?.switchTo || !normalizedProviderId) return [];
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.query) return [];

  const providerLookupId = /^\d+$/.test(normalizedProviderId)
    ? Number.parseInt(normalizedProviderId, 10)
    : normalizedProviderId;
  const query = providerModel.query().fromGraphql(`
    query calcServiceProviders($id: PeterpmServiceProviderID!) {
      calcServiceProviders(query: [{ where: { id: $id } }]) {
        Recent_Activity_Json_Data: field(arg: ["Recent_Activity_Json_Data"])
      }
    }
  `);
  console.log("[RecentActivitySync][Dock] Hydration query start", {
    serviceProviderId: normalizedProviderId,
  });
  const result = await toPromiseLike(
    query.fetchDirect({
      variables: {
        id: providerLookupId,
      },
    })
  );
  console.log("[RecentActivitySync][Dock] Hydration query response", {
    serviceProviderId: normalizedProviderId,
    hasData: Boolean(result),
  });
  const record = extractFirstRecord(result);
  const rawPayload = toText(record?.Recent_Activity_Json_Data || record?._data?.Recent_Activity_Json_Data);
  return parseServerRecentActivityRecords(rawPayload);
}

async function updateServiceProviderRecentActivityJsonData({
  plugin,
  serviceProviderId,
  jsonPayload,
} = {}) {
  const providerId = toText(serviceProviderId);
  if (!plugin?.switchTo || !providerId) {
    throw new Error("Service provider context is not ready.");
  }
  const normalizedPayload = toText(jsonPayload);
  if (!normalizedPayload) {
    throw new Error("Recent activities JSON payload is missing.");
  }
  const model = plugin.switchTo("PeterpmServiceProvider");
  if (!model?.mutation) {
    throw new Error("Service provider model is unavailable.");
  }
  const normalizedProviderLookupId = /^\d+$/.test(providerId)
    ? Number.parseInt(providerId, 10)
    : providerId;
  const whereCandidates = [
    ["id", normalizedProviderLookupId],
    ["id", providerId],
    ["unique_id", providerId],
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
    if (!model?.query) return false;
    try {
      const query = model
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
    const mutation = await model.mutation();
    mutation.update((query) =>
      query.where(whereField, whereValue).set({
        [payloadField]: normalizedPayload,
      })
    );
    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error("Recent activities update was cancelled.");
    }
    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        failure.statusMessage || `Recent activities update failed with status ${failure.statusCode}.`
      );
    }
    return true;
  };
  let lastError = null;
  for (const [whereField, whereValue] of wherePairs) {
    for (const payloadField of payloadFields) {
      try {
        console.log("[RecentActivitySync][Dock] Executing SDK mutation update", {
          serviceProviderId: providerId,
          whereField,
          payloadField,
        });
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

function buildActivitySignature(records = []) {
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

function normalizeObjectList(value) {
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

function extractStatusFailure(result) {
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

function toPromiseLike(value) {
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

function extractFirstRecord(value) {
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

async function resolveServiceProviderIdByContact({ plugin, contactId }) {
  const normalizedContactId = normalizeId(contactId);
  if (!plugin?.switchTo || !normalizedContactId) return "";
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.query) return "";

  const runQuery = async (restrictToAdminType = false) => {
    let query = providerModel
      .query()
      .where("contact_information_id", normalizedContactId)
      .deSelectAll()
      .select(["id", "unique_id", "contact_information_id", "type", "status"])
      .limit(1)
      .noDestroy();
    if (restrictToAdminType) {
      query = query.andWhere("type", "Admin");
    }
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const record = extractFirstRecord(result);
    return toText(record?.id || record?.ID);
  };

  const adminRecordId = await runQuery(true);
  if (adminRecordId) return adminRecordId;

  const anyRecordId = await runQuery(false);
  if (anyRecordId) return anyRecordId;
  return "";
}

async function resolveAdminServiceProviderId({
  plugin,
  configuredProviderId = "",
  currentUserContactId = "",
} = {}) {
  const configuredId = toText(configuredProviderId);
  if (configuredId) {
    return configuredId;
  }

  const contactResolvedId = await resolveServiceProviderIdByContact({
    plugin,
    contactId: currentUserContactId,
  });
  if (contactResolvedId) return contactResolvedId;

  return "";
}

export function RecentActivitiesDock() {
  const { plugin } = useVitalStatsPlugin();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState(() => readRecords());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const syncTimerRef = useRef(null);
  const syncRetryTimerRef = useRef(null);
  const syncHashRef = useRef("");
  const syncRetryStateRef = useRef({ signature: "", attempts: 0 });
  const resolvedProviderIdRef = useRef("");
  const didHydrateFromServerRef = useRef(false);
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const currentUserContactId = toText(APP_USER?.id);
  const isInquiryDetailsRoute = useMemo(
    () => toText(location?.pathname).toLowerCase().startsWith("/inquiry-details"),
    [location?.pathname]
  );

  const refreshActivitiesFromStorage = useCallback(() => {
    setActivities((previous) => {
      const next = readRecords();
      const previousSignature = buildActivitySignature(previous);
      const nextSignature = buildActivitySignature(next);
      if (previousSignature === nextSignature) return previous;
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleActivitiesUpdated = () => {
      refreshActivitiesFromStorage();
    };
    const handleStorage = (event) => {
      if (event?.key && event.key !== STORAGE_KEY) return;
      refreshActivitiesFromStorage();
    };
    window.addEventListener(ACTIVITIES_UPDATED_EVENT, handleActivitiesUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(ACTIVITIES_UPDATED_EVENT, handleActivitiesUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshActivitiesFromStorage]);

  useEffect(() => {
    if (!plugin || didHydrateFromServerRef.current) return;
    let isActive = true;
    didHydrateFromServerRef.current = true;

    (async () => {
      try {
        const resolvedProviderId = toText(configuredAdminProviderId);
        if (!resolvedProviderId) {
          console.warn("[RecentActivitySync][Dock] Missing VITE_APP_USER_ADMIN_ID for hydration query");
          return;
        }
        resolvedProviderIdRef.current = resolvedProviderId;

        const serverRecords = await fetchServiceProviderRecentActivityRecordsFromServer({
          plugin,
          serviceProviderId: resolvedProviderId,
        });
        if (!isActive || !serverRecords.length) return;

        const localRecords = readRecords();
        const mergedRecords = normalizeRecords([...(localRecords || []), ...serverRecords]);
        const localSignature = buildActivitySignature(localRecords);
        const mergedSignature = buildActivitySignature(mergedRecords);
        if (!mergedSignature || mergedSignature === localSignature) return;

        writeRecords(mergedRecords);
        setActivities(mergedRecords);

        if (!localRecords.length) {
          syncHashRef.current = mergedSignature;
          syncRetryStateRef.current = { signature: mergedSignature, attempts: 0 };
        }
      } catch (hydrationError) {
        console.warn("[RecentActivitiesDock] Failed hydrating recent activity from server", hydrationError);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [configuredAdminProviderId, currentUserContactId, plugin]);

  useEffect(() => {
    if (!plugin || !activities.length || isInquiryDetailsRoute) return;
    const signature = buildActivitySignature(activities);
    if (!signature || signature === syncHashRef.current) return;
    if (syncRetryStateRef.current.signature !== signature) {
      syncRetryStateRef.current = { signature, attempts: 0 };
    }
    if (syncRetryStateRef.current.attempts >= MAX_SYNC_RETRY_PER_SIGNATURE) {
      return;
    }
    console.log("[RecentActivitySync][Dock] Sync scheduled", {
      records: activities.length,
      configuredProviderId: configuredAdminProviderId,
      currentUserContactId,
    });
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(async () => {
      setIsSyncing(true);
      try {
        let resolvedProviderId = toText(resolvedProviderIdRef.current);
        if (!resolvedProviderIdRef.current) {
          resolvedProviderId = await resolveAdminServiceProviderId({
            plugin,
            configuredProviderId: configuredAdminProviderId,
            currentUserContactId,
          });
          resolvedProviderIdRef.current = resolvedProviderId;
        }
        if (!resolvedProviderId) {
          throw new Error("Service provider ID is missing for recent activities sync.");
        }
        const jsonPayload = createRecentActivityJsonData(activities, resolvedProviderId);
        console.log("[RecentActivitySync][Dock] Updating service provider", {
          resolvedProviderId,
          payloadLength: jsonPayload.length,
          records: activities.length,
        });
        const didUpdate = await updateServiceProviderRecentActivityJsonData({
          plugin,
          serviceProviderId: resolvedProviderId,
          jsonPayload,
        });
        if (!didUpdate) {
          throw new Error("Recent activities update did not return success.");
        }
        console.log("[RecentActivitySync][Dock] Sync success", {
          resolvedProviderId,
          records: activities.length,
        });
        if (syncRetryTimerRef.current) {
          window.clearTimeout(syncRetryTimerRef.current);
          syncRetryTimerRef.current = null;
        }
        syncHashRef.current = signature;
        syncRetryStateRef.current = { signature, attempts: 0 };
      } catch (syncError) {
        console.warn("[RecentActivitiesDock] Sync failed", syncError);
        resolvedProviderIdRef.current = "";
        const nextAttempts =
          syncRetryStateRef.current.signature === signature
            ? syncRetryStateRef.current.attempts + 1
            : 1;
        syncRetryStateRef.current = { signature, attempts: nextAttempts };
        if (syncRetryTimerRef.current) {
          window.clearTimeout(syncRetryTimerRef.current);
        }
        if (nextAttempts < MAX_SYNC_RETRY_PER_SIGNATURE) {
          syncRetryTimerRef.current = window.setTimeout(() => {
            setSyncRetryTick((previous) => previous + 1);
          }, 1800);
        } else {
          console.error("[RecentActivitySync][Dock] Retry limit reached for current payload signature", {
            attempts: nextAttempts,
            records: activities.length,
          });
          syncRetryTimerRef.current = null;
        }
      } finally {
        setIsSyncing(false);
      }
    }, 250);
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [
    activities,
    configuredAdminProviderId,
    currentUserContactId,
    isInquiryDetailsRoute,
    plugin,
    syncRetryTick,
  ]);

  useEffect(
    () => () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      if (syncRetryTimerRef.current) {
        window.clearTimeout(syncRetryTimerRef.current);
      }
    },
    []
  );

  const handleOpenRecord = useCallback(
    (item = {}) => {
      const path = toText(item?.path);
      const action = toText(item?.action);
      if (!path || isDeleteLikeActivityAction(action)) return;
      window.open(path, "_blank", "noopener,noreferrer");
    },
    []
  );

  return (
    <div className="pointer-events-none fixed bottom-6 left-0 z-[58] flex items-end">
      <button
        type="button"
        className={`pointer-events-auto mb-3 inline-flex h-10 items-center rounded-r-xl border border-l-0 border-[#003882]/35 bg-[#003882] text-white shadow-[0_8px_22px_rgba(0,56,130,0.28)] transition hover:bg-[#0A4A9E] ${
          isOpen ? "gap-2 px-2.5 text-[11px] font-semibold tracking-wide" : "w-9 justify-center px-0"
        }`}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? "Close recent activities panel" : "Open recent activities panel"}
        title={isOpen ? "Close recent activities panel" : "Open recent activities panel"}
      >
        {isOpen ? <span className="text-[11px]">Recent Activities</span> : null}
        <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold leading-none text-white">
          {Math.min(activities.length, MAX_RECORDS)}
        </span>
      </button>

      {isOpen ? (
        <section className="pointer-events-auto ml-2 flex h-[380px] w-[280px] max-w-[84vw] flex-col overflow-hidden rounded-r-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.2)]">
          <header className="flex items-center justify-between bg-[#003882] px-3 py-2 text-white">
            <div className="text-sm font-semibold">Recent Activities</div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/30 text-white hover:bg-white/10"
              onClick={() => setIsOpen(false)}
              aria-label="Close recent activities panel"
              title="Close"
            >
              ✕
            </button>
          </header>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
            <span>Latest {MAX_RECORDS}</span>
            <span>{isSyncing ? "Syncing..." : "Ready"}</span>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50 p-2">
            {!activities.length ? (
              <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                No recent activities yet.
              </div>
            ) : (
              activities.slice(0, MAX_RECORDS).map((item) => {
                const id = toText(item?.id);
                const action = toText(item?.action) || "Activity";
                const pageName = toText(item?.page_name) || "App";
                const path = toText(item?.path);
                const stamp = Number(item?.timestamp || 0);
                const isDeleteLike = isDeleteLikeActivityAction(action);
                const canNavigate = Boolean(path) && !isDeleteLike;
                return (
                  <button
                    key={id || `${action}-${stamp}`}
                    type="button"
                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-sky-300 hover:bg-sky-50"
                    onClick={() => handleOpenRecord(item)}
                    disabled={!canNavigate}
                    title={
                      isDeleteLike
                        ? "Deleted/cancelled records are not navigable."
                        : path || "Path unavailable"
                    }
                  >
                    <div className="truncate text-[12px] font-semibold text-slate-800">{action}</div>
                    <div className="truncate text-[11px] text-[#003882]">{pageName}</div>
                    <div className="truncate text-[10px] text-slate-500">{path || "Path unavailable"}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {stamp ? new Date(stamp).toLocaleString() : "Just now"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
