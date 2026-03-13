import { toText } from "../utils/formatters.js";

export function toPromiseLike(result) {
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

export async function fetchDirectWithTimeout(query, timeoutMs = 30000) {
  const requestPromise = toPromiseLike(query.fetchDirect());
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      requestPromise?.cancel?.();
      reject(new Error(`Query request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function extractRecordsFromPayload(payload) {
  if (!payload) return [];

  if (Array.isArray(payload?.payload?.data?.subscribeToAnnouncements)) {
    return payload.payload.data.subscribeToAnnouncements;
  }
  if (Array.isArray(payload?.data?.subscribeToAnnouncements)) {
    return payload.data.subscribeToAnnouncements;
  }

  const candidates = [];
  if (Array.isArray(payload?.resp)) candidates.push(payload.resp);
  if (Array.isArray(payload?.data)) candidates.push(payload.data);
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = toText(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizeAnnouncementType(value) {
  return toText(value).toLowerCase();
}

export function isNotificationAllowedByPreferences(notification, preferences) {
  if (preferences.pauseAllNotification) return false;
  const type = normalizeAnnouncementType(notification?.rawType || notification?.type);
  if (type === "quote/job") return preferences.quotesJobs;
  if (type === "inquiry") return preferences.inquiries;
  if (type === "post" || type === "comment") return preferences.memosComments;
  return preferences.extras;
}

function readRecordField(record, keys = []) {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] != null) return record[key];
    if (record?.data && record.data[key] != null) return record.data[key];
    if (record?._data && record._data[key] != null) return record._data[key];
    if (typeof record.get === "function") {
      try {
        const value = record.get(key);
        if (value != null) return value;
      } catch {
        // ignore
      }
    }
  }
  return undefined;
}

function toEpochSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = toText(value);
  if (!text) return null;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber)) return asNumber;
  const asDate = Date.parse(text);
  if (Number.isFinite(asDate)) return Math.floor(asDate / 1000);
  return null;
}

function formatNotificationTime(epochSeconds) {
  const ts = Number(epochSeconds);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function applyAnnouncementOrder(query) {
  if (!query || typeof query.orderBy !== "function") return query;
  try {
    query.orderBy([{ path: ["publish_date_time"], type: "desc" }]);
    return query;
  } catch {
    try {
      query.orderBy("publish_date_time", "desc");
    } catch {
      // ignore fallback failure
    }
  }
  return query;
}

function compareByPublishDateDesc(a, b) {
  const aTs = Number(a?.publishDateTime || 0);
  const bTs = Number(b?.publishDateTime || 0);
  if (aTs !== bTs) return bTs - aTs;

  const aId = toText(a?.id);
  const bId = toText(b?.id);
  const aNumericId = /^\d+$/.test(aId) ? Number.parseInt(aId, 10) : null;
  const bNumericId = /^\d+$/.test(bId) ? Number.parseInt(bId, 10) : null;
  if (aNumericId !== null && bNumericId !== null && aNumericId !== bNumericId) {
    return bNumericId - aNumericId;
  }
  return bId.localeCompare(aId);
}

export function sortAnnouncementsByPublishDateDesc(list = []) {
  if (!Array.isArray(list)) return [];
  return [...list].sort(compareByPublishDateDesc);
}

export function normalizeAnnouncementRecord(record) {
  const id = toText(readRecordField(record, ["id", "ID", "unique_id", "Unique_ID"]));
  const publishDateTime = toEpochSeconds(
    readRecordField(record, ["publish_date_time", "Publish_Date_Time"])
  );

  const type =
    toText(readRecordField(record, ["type", "Type"])) || "Announcement";
  const title =
    toText(readRecordField(record, ["title", "Title"])) ||
    toText(readRecordField(record, ["unique_id", "Unique_ID"])) ||
    "Announcement";

  return {
    id,
    type,
    title,
    message: toText(readRecordField(record, ["content", "Content"])),
    read: normalizeBoolean(readRecordField(record, ["is_read", "Is_Read"])),
    timeLabel: formatNotificationTime(publishDateTime),
    publishDateTime: publishDateTime ?? 0,
    extraId: toText(
      readRecordField(record, ["Extra_id", "Extra_ID", "ExtraId", "extra_id", "Extra_Id"])
    ),
    quoteJobId: toText(readRecordField(record, ["quote_job_id", "Quote_Job_ID"])),
    inquiryId: toText(readRecordField(record, ["inquiry_id", "Inquiry_ID"])),
    postId: toText(readRecordField(record, ["post_id", "Post_ID"])),
    commentId: toText(readRecordField(record, ["comment_id", "Comment_ID"])),
    notifiedContactId: toText(
      readRecordField(record, ["notified_contact_id", "Notified_Contact_ID"])
    ),
    rawType: toText(readRecordField(record, ["type", "Type"])),
  };
}

export async function fetchLatestAnnouncementById(plugin, id) {
  const normalizedId = toText(id);
  if (!plugin?.switchTo || !normalizedId) return null;
  try {
    const announcementModel = plugin.switchTo("PeterpmAnnouncement");
    let normalized = null;
    try {
      const query = announcementModel
        .query()
        .where("id", normalizedId)
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "status",
          "title",
          "publish_date_time",
          "type",
          "content",
          "quote_job_id",
          "inquiry_id",
          "post_id",
          "comment_id",
          "notified_contact_id",
          "is_read",
          "Extra_id",
        ])
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const payload = await fetchDirectWithTimeout(query, 10000);
      const first = extractRecordsFromPayload(payload)?.[0];
      normalized = first ? normalizeAnnouncementRecord(first) : null;
      if (toText(normalized?.extraId)) {
        return normalized;
      }
    } catch (error) {
      console.warn("[Announcements] by-id model query failed; falling back to calc query", {
        id: normalizedId,
        error,
      });
    }

    const idLiteral = /^\d+$/.test(normalizedId)
      ? normalizedId
      : `"${normalizedId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const fallbackQuery = announcementModel.query().fromGraphql(`
      query calcAnnouncements {
        calcAnnouncements(query: [{ where: { id: ${idLiteral} } }]) {
          id: field(arg: ["id"])
          status: field(arg: ["status"])
          title: field(arg: ["title"])
          publish_date_time: field(arg: ["publish_date_time"])
          type: field(arg: ["type"])
          content: field(arg: ["content"])
          quote_job_id: field(arg: ["quote_job_id"])
          inquiry_id: field(arg: ["inquiry_id"])
          post_id: field(arg: ["post_id"])
          comment_id: field(arg: ["comment_id"])
          notified_contact_id: field(arg: ["notified_contact_id"])
          is_read: field(arg: ["is_read"])
          Extra_id: field(arg: ["Extra_id"])
        }
      }
    `);
    fallbackQuery.getOrInitQueryCalc?.();
    const fallbackPayload = await fetchDirectWithTimeout(fallbackQuery, 10000);
    const fallbackFirst = extractRecordsFromPayload(fallbackPayload)?.[0];
    return fallbackFirst ? normalizeAnnouncementRecord(fallbackFirst) : normalized;
  } catch (error) {
    console.warn("[Announcements] failed to fetch latest by id", {
      id: normalizedId,
      error,
    });
    return null;
  }
}
