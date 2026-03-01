import { useEffect, useMemo, useRef, useState } from "react";
import { ensureVitalStatsPlugin } from "../../features/job-direct/sdk/vitalStatsBootstrap.js";

const ANNOUNCEMENT_DEBUG = true;

function logAnnouncementDebug(...args) {
  if (!ANNOUNCEMENT_DEBUG) return;
  console.info("[Announcements]", ...args);
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

async function fetchDirectWithTimeout(query, timeoutMs = 30000) {
  const requestPromise = toPromiseLike(query.fetchDirect());
  let timeoutId = null;
  let didTimeout = false;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      requestPromise?.cancel?.();
      reject(new Error(`Query request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (didTimeout) {
      logAnnouncementDebug("initial fetch timed out");
    }
  }
}

function extractRecordsFromPayload(payload) {
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
  if (Array.isArray(payload?.records)) candidates.push(payload.records);
  if (
    payload?.records &&
    typeof payload.records === "object" &&
    !Array.isArray(payload.records)
  ) {
    candidates.push(
      Object.values(payload.records).map((entry) => entry?.data || entry?.record || entry)
    );
  }

  const hasLikelyRecord = (row) => {
    if (!row) return false;
    const value = row?.data || row?._data || row;
    return (
      value?.id != null ||
      value?.ID != null ||
      value?.unique_id != null ||
      value?.Unique_ID != null ||
      typeof row?.get === "function"
    );
  };

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length && candidate.some(hasLikelyRecord)) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
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
      } catch (_) {}
    }
  }
  return undefined;
}

function toEpochSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(trimmed);
    if (Number.isFinite(asDate)) return Math.floor(asDate / 1000);
  }
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

function normalizeAnnouncementRecord(record) {
  const id = String(
    readRecordField(record, ["id", "ID", "unique_id", "Unique_ID"]) ?? ""
  ).trim();
  const publishDateTime = toEpochSeconds(
    readRecordField(record, ["publish_date_time", "Publish_Date_Time"])
  );
  const type = String(readRecordField(record, ["type", "Type"]) ?? "General").trim() || "General";
  const title =
    String(readRecordField(record, ["title", "Title"]) ?? "").trim() ||
    String(readRecordField(record, ["unique_id", "Unique_ID"]) ?? "").trim() ||
    "Notification";
  const content = String(readRecordField(record, ["content", "Content"]) ?? "").trim();
  const originUrl = String(readRecordField(record, ["origin_url", "Origin_URL"]) ?? "").trim();
  return {
    id,
    type,
    title,
    message: content,
    read: normalizeBoolean(readRecordField(record, ["is_read", "Is_Read"])),
    timeLabel: formatNotificationTime(publishDateTime),
    publishDateTime: publishDateTime ?? 0,
    originUrl,
  };
}

export function useAnnouncements() {
  const [notifications, setNotifications] = useState([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notificationError, setNotificationError] = useState(null);
  const [markingById, setMarkingById] = useState({});
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const pluginRef = useRef(null);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    let isActive = true;
    let activeQuery = null;
    let activeSubscription = null;

    const subscribeToAnnouncements = async () => {
      setIsNotifLoading(true);
      setNotificationError(null);
      try {
        const existingPlugin =
          window.getVitalStatsPlugin?.() ||
          window.__ptpmVitalStatsPlugin ||
          window.tempPlugin ||
          window.plugin ||
          null;
        const plugin = existingPlugin || (await ensureVitalStatsPlugin());
        if (!isActive) return;
        pluginRef.current = plugin;

        const announcementModel = plugin.switchTo("PeterpmAnnouncement");
        const query = announcementModel
          .query()
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
            "origin_url",
          ])
          .noDestroy();
        query.getOrInitQueryCalc?.();
        activeQuery = query;

        try {
          const initialResult = await fetchDirectWithTimeout(query, 30000);
          if (!isActive) return;
          const initialRows = extractRecordsFromPayload(initialResult);
          const initialMapped = initialRows
            .map(normalizeAnnouncementRecord)
            .filter((item) => item.id)
            .sort((a, b) => b.publishDateTime - a.publishDateTime);
          logAnnouncementDebug("initial fetch resolved", {
            initialRowsCount: initialRows.length,
            initialMappedCount: initialMapped.length,
            firstInitialMapped: initialMapped[0] ?? null,
          });
          if (initialMapped.length) {
            setNotifications(initialMapped);
            setNotificationError(null);
            setIsNotifLoading(false);
          }
        } catch (initialError) {
          logAnnouncementDebug("initial fetch failed (continuing with stream)", initialError);
        }

        const source =
          (typeof query.subscribe === "function" && query.subscribe()) ||
          (typeof query.localSubscribe === "function" && query.localSubscribe()) ||
          null;

        if (!source || typeof source.subscribe !== "function") {
          throw new Error("Announcement stream is unavailable.");
        }

        let stream = source;
        if (
          typeof window !== "undefined" &&
          typeof window.toMainInstance === "function" &&
          typeof stream.pipe === "function"
        ) {
          stream = stream.pipe(window.toMainInstance(true));
        }

        activeSubscription = stream.subscribe({
          next: (payload) => {
            if (!isActive) return;
            const rawRows = extractRecordsFromPayload(payload);
            const mapped = rawRows
              .map(normalizeAnnouncementRecord)
              .filter((item) => item.id)
              .sort((a, b) => b.publishDateTime - a.publishDateTime);

            logAnnouncementDebug("stream payload received", {
              payloadType: payload?.type ?? null,
              rawRowsCount: rawRows.length,
              mappedCount: mapped.length,
              firstMapped: mapped[0] ?? null,
            });

            // Ignore transport/no-op events that carry no announcement rows,
            // so we don't replace existing rendered notifications with empty state.
            if (mapped.length === 0 && notificationsRef.current.length > 0) {
              logAnnouncementDebug(
                "ignored empty announcement update to preserve existing rows"
              );
              setNotificationError(null);
              setIsNotifLoading(false);
              return;
            }

            setNotifications(mapped);
            setNotificationError(null);
            setIsNotifLoading(false);
          },
          error: (error) => {
            if (!isActive) return;
            logAnnouncementDebug("stream error", error);
            setNotificationError(error);
            setIsNotifLoading(false);
          },
        });
      } catch (error) {
        if (!isActive) return;
        logAnnouncementDebug("subscription setup failed", error);
        setNotificationError(error);
        setIsNotifLoading(false);
      }
    };

    subscribeToAnnouncements();

    return () => {
      isActive = false;
      try {
        activeSubscription?.unsubscribe?.();
      } catch (_) {}
      try {
        activeQuery?.destroy?.();
      } catch (_) {}
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const persistReadState = async (ids) => {
    const normalizedIds = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))
    );
    if (!normalizedIds.length) return;
    const plugin =
      pluginRef.current ||
      window.getVitalStatsPlugin?.() ||
      window.__ptpmVitalStatsPlugin ||
      null;
    if (!plugin?.switchTo) {
      throw new Error("SDK plugin is not ready.");
    }
    const announcementModel = plugin.switchTo("PeterpmAnnouncement");
    const mutation = await announcementModel.mutation();
    normalizedIds.forEach((id) => {
      mutation.update((query) => query.where("id", id).set({ is_read: true }));
    });
    const result = await mutation.execute(true).toPromise();
    if (!result || result?.isCancelling) {
      throw new Error("Announcement update was cancelled.");
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length || isMarkingAll) return;
    const previous = notifications;
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await persistReadState(unreadIds);
    } catch (error) {
      console.error("[useAnnouncements] mark-all-as-read failed", error);
      setNotifications(previous);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const markOneAsRead = async (notification) => {
    if (!notification?.id) return;
    const id = notification.id;
    const previous = notifications;
    setMarkingById((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) =>
      prev.map((current) =>
        current.id === id
          ? {
              ...current,
              read: true,
            }
          : current
      )
    );
    try {
      if (!notification.read) {
        await persistReadState([id]);
      }
    } catch (error) {
      console.error("[useAnnouncements] mark-notification-read failed", error);
      setNotifications(previous);
    } finally {
      setMarkingById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return {
    notifications,
    unreadCount,
    isNotifLoading,
    notificationError,
    markingById,
    isMarkingAll,
    markAllAsRead,
    markOneAsRead,
  };
}
