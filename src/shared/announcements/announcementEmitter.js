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
    publish_date_time: nowEpochSeconds(),
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
