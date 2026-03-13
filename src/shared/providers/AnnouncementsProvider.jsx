import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_USER } from "../../config/userConfig.js";
import { ensureVitalStatsPlugin } from "@platform/vitalstats/bootstrap.js";
import { resolveNotificationNavigation } from "../announcements/announcementNavigation.js";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile.js";
import {
  toPromiseLike,
  fetchDirectWithTimeout,
  extractRecordsFromPayload,
  normalizeBoolean,
  isNotificationAllowedByPreferences,
  applyAnnouncementOrder,
  sortAnnouncementsByPublishDateDesc,
  normalizeAnnouncementRecord,
  fetchLatestAnnouncementById,
} from "./announcementsProviderHelpers.js";
import { toText } from "../utils/formatters.js";

export const AnnouncementsContext = createContext(null);

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
            setNotifications(sortAnnouncementsByPublishDateDesc(mapped));
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

            setNotifications(sortAnnouncementsByPublishDateDesc(mapped));
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
    () => {
      const visible = (Array.isArray(notifications) ? notifications : []).filter((item) =>
        isNotificationAllowedByPreferences(item, preferences)
      );
      return sortAnnouncementsByPublishDateDesc(visible);
    },
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
