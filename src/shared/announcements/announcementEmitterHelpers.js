import { toText } from "../utils/formatters.js";

export const ANNOUNCEMENT_EMITTED_EVENT = "ptpm-announcement-emitted";

const DEDUPE_TTL_MS = 120000;
const dedupeCache = new Map();

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

export function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function resolvePublishDateTime(value) {
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

export function shouldSuppressByDedupe(key) {
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

export function extractCreatedId(result) {
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

export async function resolveCreatedAnnouncementIdByPayload({
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

export async function persistExtraIdBestEffort({
  model,
  announcementId,
  extraId,
} = {}) {
  const normalizedId = normalizeId(announcementId);
  if (!model?.mutation || !normalizedId) return false;
  const nextExtraId = toText(extraId);
  if (!nextExtraId) return false;

  const candidates = [
    { Extra_id: nextExtraId || null },
    { Extra_ID: nextExtraId || null },
    { ExtraId: nextExtraId || null },
    { extra_id: nextExtraId || null },
    { extraId: nextExtraId || null },
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

export function dispatchAnnouncementEmittedEvent(detail = {}) {
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
