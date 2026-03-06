import {
  buildExtraId,
  buildFocusToken,
} from "./announcementNavigation.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
  ANNOUNCEMENT_TYPES,
} from "./announcementTypes.js";
import { resolveAnnouncementRecipientContext } from "./announcementRecipientResolver.js";

const DEDUPE_TTL_MS = 120000;
const dedupeCache = new Map();
export const ANNOUNCEMENT_EMITTED_EVENT = "ptpm-announcement-emitted";
const RECENT_ACTIVITY_STORAGE_KEY = "ptpm_admin_recent_activity_v1";
const RECENT_ACTIVITIES_UPDATED_EVENT = "ptpm-recent-activities-updated";
const MAX_RECENT_ACTIVITY_RECORDS = 20;

const RECENT_ACTIVITY_ACTION_BY_EVENT_KEY = Object.freeze({
  [ANNOUNCEMENT_EVENT_KEYS.INQUIRY_ALLOCATED]: "Updated inquiry allocation",
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_CREATED]: "Created quote/job",
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_SENT]: "Updated quote",
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_ACCEPTED]: "Updated quote",
  [ANNOUNCEMENT_EVENT_KEYS.INVOICE_TRIGGERED]: "Updated invoice",
  [ANNOUNCEMENT_EVENT_KEYS.BILL_APPROVED]: "Updated bill",
  [ANNOUNCEMENT_EVENT_KEYS.INVOICE_SENT_TO_CUSTOMER]: "Updated invoice",
  [ANNOUNCEMENT_EVENT_KEYS.PAYMENT_STATUS_CHANGED]: "Updated payment status",
  [ANNOUNCEMENT_EVENT_KEYS.POST_CREATED]: "Created memo post",
  [ANNOUNCEMENT_EVENT_KEYS.COMMENT_CREATED]: "Created memo comment",
  [ANNOUNCEMENT_EVENT_KEYS.ACTIVITY_ADDED]: "Created activity",
  [ANNOUNCEMENT_EVENT_KEYS.MATERIAL_ADDED]: "Created material",
  [ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_SCHEDULED]: "Created appointment",
  [ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_COMPLETED]: "Updated appointment",
  [ANNOUNCEMENT_EVENT_KEYS.TASK_ADDED]: "Created task",
  [ANNOUNCEMENT_EVENT_KEYS.TASK_COMPLETED]: "Updated task",
  [ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED]: "Created upload",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED]: "Created property",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED]: "Updated property",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_LINKED]: "Updated property link",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_ADDED]: "Created property affiliation",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_UPDATED]: "Updated property affiliation",
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_DELETED]: "Deleted property affiliation",
});

const EVENT_CONFIG = {
  [ANNOUNCEMENT_EVENT_KEYS.INQUIRY_ALLOCATED]: {
    type: ANNOUNCEMENT_TYPES.INQUIRY,
    tab: "Overview",
    focusKind: "inquiry",
    title: "New inquiry allocation",
    content: "A new inquiry has been allocated to you.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_CREATED]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Overview",
    focusKind: "quote",
    title: "Quote created",
    content: "A new quote has been created and linked.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_SENT]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Overview",
    focusKind: "quote_sent",
    title: "Quote sent",
    content: "A quote was sent to the customer.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.QUOTE_ACCEPTED]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Overview",
    focusKind: "quote_accepted",
    title: "Quote accepted",
    content: "A quote has been accepted.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.INVOICE_TRIGGERED]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Invoice & Payment",
    focusKind: "invoice",
    title: "Invoice updated",
    content: "Invoice generation/update was requested.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.BILL_APPROVED]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Invoice & Payment",
    focusKind: "bill",
    title: "Bill approved",
    content: "Bill was approved by admin.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.INVOICE_SENT_TO_CUSTOMER]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Invoice & Payment",
    focusKind: "invoice_send",
    title: "Invoice sent",
    content: "Invoice was queued for customer delivery.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PAYMENT_STATUS_CHANGED]: {
    type: ANNOUNCEMENT_TYPES.QUOTE_JOB,
    tab: "Invoice & Payment",
    focusKind: "payment",
    title: "Payment status changed",
    content: "Payment status was updated.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.POST_CREATED]: {
    type: ANNOUNCEMENT_TYPES.POST,
    tab: "Overview",
    focusKind: "post",
    openMemo: true,
    title: "New memo post",
    content: "A new memo post was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.COMMENT_CREATED]: {
    type: ANNOUNCEMENT_TYPES.COMMENT,
    tab: "Overview",
    focusKind: "comment",
    openMemo: true,
    title: "New memo comment",
    content: "A new memo reply was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.ACTIVITY_ADDED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Activities",
    focusKind: "activity",
    title: "New activity",
    content: "A new activity was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.MATERIAL_ADDED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Materials",
    focusKind: "material",
    title: "New material",
    content: "A new material item was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_SCHEDULED]: {
    type: ANNOUNCEMENT_TYPES.APPOINTMENT,
    tab: "Appointments",
    focusKind: "appointment",
    title: "Appointment scheduled",
    content: "A new appointment was scheduled.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_COMPLETED]: {
    type: ANNOUNCEMENT_TYPES.APPOINTMENT,
    tab: "Appointments",
    focusKind: "appointment",
    title: "Appointment completed",
    content: "An appointment was marked as completed.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.TASK_ADDED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Tasks",
    focusKind: "task",
    title: "New task",
    content: "A new task was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.TASK_COMPLETED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Tasks",
    focusKind: "task",
    title: "Task completed",
    content: "A task was marked as completed.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Uploads",
    focusKind: "upload",
    title: "New upload",
    content: "A new file was uploaded.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "property",
    title: "Property created",
    content: "A new property was created.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "property",
    title: "Property updated",
    content: "Property details were updated.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_LINKED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "property_link",
    title: "Property linked",
    content: "A property was linked to this record.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_ADDED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "affiliation",
    title: "Property contact added",
    content: "A property contact link was added.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_UPDATED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "affiliation",
    title: "Property contact updated",
    content: "A property contact link was updated.",
  },
  [ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_DELETED]: {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "affiliation",
    title: "Property contact removed",
    content: "A property contact link was removed.",
  },
};

function toText(value) {
  return String(value ?? "").trim();
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
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
  return Promise.resolve(result);
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function resolvePublishDateTime(value) {
  const text = toText(value);
  if (!text) return nowEpochSeconds();
  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
    }
    return nowEpochSeconds();
  }
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed / 1000);
  }
  return nowEpochSeconds();
}

function cleanupDedupeCache(nowMs) {
  for (const [key, timestamp] of dedupeCache.entries()) {
    if (nowMs - timestamp >= DEDUPE_TTL_MS) {
      dedupeCache.delete(key);
    }
  }
}

function shouldSuppressByDedupe(key) {
  if (!key) return false;
  const nowMs = Date.now();
  cleanupDedupeCache(nowMs);
  const existing = dedupeCache.get(key);
  if (existing && nowMs - existing < DEDUPE_TTL_MS) {
    return true;
  }
  dedupeCache.set(key, nowMs);
  return false;
}

function extractCreatedId(result) {
  const managed = result?.mutations?.PeterpmAnnouncement?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (/^\d+$/.test(String(managedKey || ""))) return String(managedKey);
      const nested = toText(managedValue?.id || managedValue?.ID);
      if (nested) return nested;
    }
  }
  const directCandidates = [
    result?.mutations?.PeterpmAnnouncement?.id,
    result?.mutations?.PeterpmAnnouncement?.ID,
    result?.payload?.data?.createAnnouncement?.id,
    result?.payload?.data?.createAnnouncement?.ID,
    result?.data?.createAnnouncement?.id,
    result?.data?.createAnnouncement?.ID,
    result?.id,
    result?.ID,
  ];
  for (const candidate of directCandidates) {
    const normalized = toText(candidate);
    if (normalized) return normalized;
  }
  return "";
}

async function resolveCreatedAnnouncementIdByPayload({
  model,
  payload,
} = {}) {
  if (!model?.query || !payload || !payload.notified_contact_id) return "";
  try {
    const query = model
      .query()
      .where("notified_contact_id", normalizeId(payload.notified_contact_id))
      .andWhere("publish_date_time", normalizeId(payload.publish_date_time))
      .andWhere("title", toText(payload.title))
      .deSelectAll()
      .select(["id", "title", "publish_date_time", "notified_contact_id"])
      .orderBy("id", "desc")
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const rows = Array.isArray(result?.resp)
      ? result.resp
      : Array.isArray(result?.data)
        ? result.data
        : [];
    const first = Array.isArray(rows) ? rows[0] : null;
    return toText(first?.id || first?.ID);
  } catch (error) {
    console.warn("[Announcements] resolve-created-id failed", { error });
    return "";
  }
}

async function persistExtraIdBestEffort({
  model,
  announcementId,
  extraId,
} = {}) {
  const normalizedId = normalizeId(announcementId);
  if (!model?.mutation || !normalizedId) return false;
  const nextExtraId = toText(extraId);
  if (!nextExtraId) return false;

  const candidates = [
    {
      Extra_id: nextExtraId || null,
    },
    {
      Extra_ID: nextExtraId || null,
    },
    {
      ExtraId: nextExtraId || null,
    },
    {
      extra_id: nextExtraId || null,
    },
    {
      extraId: nextExtraId || null,
    },
  ];

  for (const candidate of candidates) {
    try {
      const mutation = await model.mutation();
      mutation.update((query) => query.where("id", normalizedId).set(candidate));
      const result = await toPromiseLike(mutation.execute(true));
      if (result && !result?.isCancelling) {
        const field = Object.keys(candidate)[0] || "extra_id";
        console.info("[Announcements] extra_id update succeeded", {
          announcementId: normalizedId,
          field,
        });
        return true;
      }
    } catch (error) {
      const field = Object.keys(candidate)[0] || "extra_id";
      console.warn("[Announcements] extra_id update failed for field", {
        announcementId: normalizedId,
        field,
        error,
      });
    }
  }
  return false;
}

function getEventConfig(eventKey) {
  return EVENT_CONFIG[eventKey] || {
    type: ANNOUNCEMENT_TYPES.ACTIVITY,
    tab: "Overview",
    focusKind: "activity",
    title: "New announcement",
    content: "A new update is available.",
  };
}

function dispatchAnnouncementEmittedEvent(detail = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(
      new CustomEvent(ANNOUNCEMENT_EMITTED_EVENT, {
        detail,
      })
    );
  } catch (error) {
    console.warn("[Announcements] Failed dispatching emitted event", error);
  }
}

function normalizeLegacyInquiryPageType(value = "") {
  const normalized = toText(value).toLowerCase();
  if (normalized === "inquiry-direct") return "inquiry-details";
  return normalized;
}

function resolveRecentActivityPageType(pathname = "") {
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

function resolveRecentActivityPageName(pageType = "") {
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

function readRecentActivityRecordsFromStorage() {
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

function writeRecentActivityRecordsToStorage(records = []) {
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

function appendRecentActivityFromAnnouncement({
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

export async function emitAnnouncement({
  plugin,
  eventKey,
  title,
  content,
  type,
  quoteJobId,
  inquiryId,
  postId,
  commentId,
  serviceProviderId,
  jobId,
  extraId,
  focusKind,
  focusId,
  focusIds,
  tab,
  openMemo,
  dedupeEntityId,
  logContext,
} = {}) {
  if (!plugin?.switchTo) {
    return { created: false, skippedReason: "plugin_unavailable" };
  }

  const config = getEventConfig(eventKey);
  const resolvedContext = await resolveAnnouncementRecipientContext({
    plugin,
    serviceProviderId,
    jobId: quoteJobId || jobId,
    inquiryId,
    quoteJobId,
  });

  const notifiedContactId = toText(resolvedContext.notifiedContactId);
  if (!notifiedContactId) {
    console.info("[Announcements] skipped emit (recipient unresolved)", {
      eventKey,
      logContext,
    });
    return { created: false, skippedReason: "recipient_unresolved" };
  }

  const resolvedQuoteJobId = toText(quoteJobId || resolvedContext.jobId);
  const resolvedInquiryId = toText(inquiryId || resolvedContext.inquiryId);
  const preferredUid = toText(resolvedContext.jobUid || resolvedContext.inquiryUid);

  const resolvedFocusKind = toText(focusKind || config.focusKind);
  const resolvedFocusIds = Array.from(
    new Set((Array.isArray(focusIds) ? focusIds : []).map((item) => toText(item)).filter(Boolean))
  );
  const resolvedFocusId = toText(
    focusId ||
      commentId ||
      postId
  );
  const resolvedTab = toText(tab || config.tab);
  const focusToken = buildFocusToken(resolvedFocusKind, resolvedFocusId);
  const shouldOpenMemo = Boolean(openMemo ?? config.openMemo);
  const resolvedExtraId =
    toText(extraId) ||
    buildExtraId({
      entity: resolvedFocusKind,
      entityId: resolvedFocusId,
      entityIds: resolvedFocusIds,
      action: toText(eventKey).toLowerCase(),
      jobId: resolvedQuoteJobId,
      inquiryId: resolvedInquiryId,
      uid: preferredUid,
      tab: resolvedTab,
      openMemo: shouldOpenMemo,
    });

  const dedupeKey = [
    notifiedContactId,
    eventKey,
    toText(dedupeEntityId || resolvedFocusId || resolvedQuoteJobId || resolvedInquiryId || eventKey),
  ]
    .filter(Boolean)
    .join("|");

  if (shouldSuppressByDedupe(dedupeKey)) {
    console.info("[Announcements] skipped duplicate emit", {
      eventKey,
      dedupeKey,
      logContext,
    });
    return { created: false, skippedReason: "deduped" };
  }

  const payload = {
    status: "Published",
    title: toText(title || config.title) || "Announcement",
    publish_date_time: resolvePublishDateTime(nowEpochSeconds()),
    type: toText(type || config.type) || ANNOUNCEMENT_TYPES.ACTIVITY,
    content: toText(content || config.content),
    quote_job_id: normalizeId(resolvedQuoteJobId) || null,
    inquiry_id: normalizeId(resolvedInquiryId) || null,
    comment_id: normalizeId(commentId) || null,
    post_id: normalizeId(postId) || null,
    notified_contact_id: normalizeId(notifiedContactId) || null,
    is_read: false,
    Extra_id: resolvedExtraId || null,
  };

  if (!payload.Extra_id) {
    console.warn("[Announcements] extra_id is empty before create", {
      eventKey,
      notifiedContactId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      focusIdsCount: resolvedFocusIds.length,
      tab: resolvedTab,
      logContext,
    });
  }

  console.info("[Announcements] extra_id debug", {
    eventKey,
    notifiedContactId,
    announcementId: null,
    extraId: payload.Extra_id,
    extraIdLength: toText(payload.Extra_id).length,
    focusKind: resolvedFocusKind,
    focusId: resolvedFocusId,
    focusIdsCount: resolvedFocusIds.length,
    tab: resolvedTab,
    logContext,
  });

  try {
    const model = plugin.switchTo("PeterpmAnnouncement");
    const mutation = await model.mutation();
    mutation.createOne(payload);
    const result = await toPromiseLike(mutation.execute(true));
    let createdId = extractCreatedId(result);
    if (!createdId) {
      createdId = await resolveCreatedAnnouncementIdByPayload({
        model,
        payload,
      });
    }
    await persistExtraIdBestEffort({
      model,
      announcementId: createdId,
      extraId: resolvedExtraId,
    });
    console.info("[Announcements] extra_id persisted", {
      eventKey,
      id: createdId || null,
      extraId: resolvedExtraId || null,
      extraIdLength: toText(resolvedExtraId).length,
      logContext,
    });
    console.info("[Announcements] created", {
      eventKey,
      id: createdId || null,
      notifiedContactId,
      logContext,
    });
    const recentActivityPersisted = appendRecentActivityFromAnnouncement({
      eventKey: toText(eventKey),
      inquiryId: resolvedInquiryId,
      quoteJobId: resolvedQuoteJobId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      tab: resolvedTab,
      title: payload.title,
    });
    const resolvedRecentActivityAction = toText(
      RECENT_ACTIVITY_ACTION_BY_EVENT_KEY[toText(eventKey)]
    );
    dispatchAnnouncementEmittedEvent({
      eventKey: toText(eventKey),
      announcementId: createdId || null,
      quoteJobId: resolvedQuoteJobId,
      inquiryId: resolvedInquiryId,
      notifiedContactId,
      focusKind: resolvedFocusKind,
      focusId: resolvedFocusId,
      focusIds: resolvedFocusIds,
      tab: resolvedTab,
      title: payload.title,
      content: payload.content,
      action: resolvedRecentActivityAction,
      recentActivityPersisted,
      path:
        typeof window !== "undefined"
          ? `${toText(window.location?.pathname)}${toText(window.location?.search)}`
          : "",
      timestamp: Date.now(),
    });
    return { created: true, id: createdId };
  } catch (error) {
    console.warn("[Announcements] emit failed", {
      eventKey,
      error,
      logContext,
    });
    return { created: false, skippedReason: "emit_failed" };
  }
}
