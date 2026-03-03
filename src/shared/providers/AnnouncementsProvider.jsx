import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_USER } from "../../config/userConfig.js";
import { ensureVitalStatsPlugin } from "../../features/job-direct/sdk/vitalStatsBootstrap.js";
import { resolveNotificationNavigation } from "../announcements/announcementNavigation.js";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile.js";

export const AnnouncementsContext = createContext(null);

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

async function fetchDirectWithTimeout(query, timeoutMs = 30000) {
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

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = toText(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizeAnnouncementType(value) {
  return toText(value).toLowerCase();
}

function isNotificationAllowedByPreferences(notification, preferences) {
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

function applyAnnouncementOrder(query) {
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

function normalizeAnnouncementRecord(record) {
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

async function fetchLatestAnnouncementById(plugin, id) {
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

export function AnnouncementsProvider({ children }) {
  const navigate = useNavigate();
  const { profile } = useCurrentUserProfile();
  const [notifications, setNotifications] = useState([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notificationError, setNotificationError] = useState(null);
  const [markingById, setMarkingById] = useState({});
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const pluginRef = useRef(null);
  const notificationsRef = useRef([]);
  const preferences = useMemo(
    () => ({
      pauseAllNotification: normalizeBoolean(profile?.pauseAllNotification),
      quotesJobs: normalizeBoolean(profile?.quotesJobs, true),
      inquiries: normalizeBoolean(profile?.inquiries, true),
      memosComments: normalizeBoolean(profile?.memosComments, true),
      extras: normalizeBoolean(profile?.extras, true),
    }),
    [
      profile?.pauseAllNotification,
      profile?.quotesJobs,
      profile?.inquiries,
      profile?.memosComments,
      profile?.extras,
    ]
  );

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    let isActive = true;
    let activeQuery = null;
    let activeSubscription = null;

    if (preferences.pauseAllNotification) {
      setNotifications([]);
      setNotificationError(null);
      setIsNotifLoading(false);
      return () => {
        isActive = false;
      };
    }

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
        let query = announcementModel
          .query()
          .where("notified_contact_id", toText(APP_USER?.id))
          .andWhere("status", "Published")
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
          .noDestroy();
        query = applyAnnouncementOrder(query);

        query.getOrInitQueryCalc?.();
        activeQuery = query;

        try {
          const initialResult = await fetchDirectWithTimeout(query, 30000);
          if (!isActive) return;
          const mapped = extractRecordsFromPayload(initialResult)
            .map(normalizeAnnouncementRecord)
            .filter((item) => item.id);

          if (mapped.length) {
            setNotifications(mapped);
          }
          setNotificationError(null);
          setIsNotifLoading(false);
        } catch {
          // continue with stream
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
            const mapped = extractRecordsFromPayload(payload)
              .map(normalizeAnnouncementRecord)
              .filter((item) => item.id);

            if (mapped.length === 0 && notificationsRef.current.length > 0) {
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
            setNotificationError(error);
            setIsNotifLoading(false);
          },
        });
      } catch (error) {
        if (!isActive) return;
        setNotificationError(error);
        setIsNotifLoading(false);
      }
    };

    subscribeToAnnouncements();

    return () => {
      isActive = false;
      try {
        activeSubscription?.unsubscribe?.();
      } catch {
        // ignore
      }
      try {
        activeQuery?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [preferences.pauseAllNotification]);

  const filteredNotifications = useMemo(
    () =>
      (Array.isArray(notifications) ? notifications : []).filter((item) =>
        isNotificationAllowedByPreferences(item, preferences)
      ),
    [notifications, preferences]
  );

  const unreadCount = useMemo(
    () => filteredNotifications.filter((item) => !item.read).length,
    [filteredNotifications]
  );

  const persistReadState = useCallback(async (ids) => {
    const normalizedIds = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((id) => toText(id)).filter(Boolean))
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
    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error("Announcement update was cancelled.");
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = filteredNotifications.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length || isMarkingAll) return;
    const unreadSet = new Set(unreadIds);

    const previous = notifications;
    setIsMarkingAll(true);
    setNotifications((prev) =>
      prev.map((item) =>
        unreadSet.has(item.id)
          ? {
              ...item,
              read: true,
            }
          : item
      )
    );

    try {
      await persistReadState(unreadIds);
    } catch (error) {
      console.error("[Announcements] mark-all-as-read failed", error);
      setNotifications(previous);
    } finally {
      setIsMarkingAll(false);
    }
  }, [filteredNotifications, notifications, isMarkingAll, persistReadState]);

  const markOneAsRead = useCallback(
    async (notification) => {
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
        console.error("[Announcements] mark-notification-read failed", error);
        setNotifications(previous);
      } finally {
        setMarkingById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [notifications, persistReadState]
  );

  const openNotification = useCallback(
    async (notification) => {
      if (!notification?.id) return;
      try {
        await markOneAsRead(notification);
      } catch {
        // proceed to navigation even if read-state fails
      }

      const plugin =
        pluginRef.current ||
        window.getVitalStatsPlugin?.() ||
        window.__ptpmVitalStatsPlugin ||
        null;
      const latest =
        (await fetchLatestAnnouncementById(plugin, notification.id)) || notification;
      console.info("[Announcements] openNotification latest payload", {
        id: latest?.id || notification?.id,
        extraId: toText(latest?.extraId),
        type: toText(latest?.type),
        title: toText(latest?.title),
      });
      const target = await resolveNotificationNavigation(latest, plugin);
      console.info("[Announcements] openNotification target", {
        id: latest?.id || notification?.id,
        target,
      });
      if (target) {
        navigate(target);
      }
    },
    [markOneAsRead, navigate]
  );

  const value = useMemo(
    () => ({
      notifications: filteredNotifications,
      unreadCount,
      isNotifLoading,
      notificationError,
      markingById,
      isMarkingAll,
      markAllAsRead,
      markOneAsRead,
      openNotification,
    }),
    [
      filteredNotifications,
      unreadCount,
      isNotifLoading,
      notificationError,
      markingById,
      isMarkingAll,
      markAllAsRead,
      markOneAsRead,
      openNotification,
    ]
  );

  return (
    <AnnouncementsContext.Provider value={value}>
      {children}
    </AnnouncementsContext.Provider>
  );
}
