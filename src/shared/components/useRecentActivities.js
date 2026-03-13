import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useVitalStatsPlugin } from "../../platform/vitalstats/useVitalStatsPlugin.js";
import { APP_USER } from "../../config/userConfig.js";
import { ANNOUNCEMENT_EMITTED_EVENT } from "../announcements/announcementEmitter.js";
import {
  STORAGE_KEY,
  MAX_SYNC_RETRY_PER_SIGNATURE,
  ACTIVITIES_UPDATED_EVENT,
} from "./recentActivitiesConstants.js";
import { toText } from "@shared/utils/formatters.js";
import {
  buildActivitySignature,
  normalizeRecords,
  readRecords,
  writeRecords,
  createRecentActivityJsonData,
} from "./recentActivitiesUtils.js";
import {
  mapAnnouncementEventToActivityRecord,
  fetchServiceProviderRecentActivityRecordsFromServer,
  updateServiceProviderRecentActivityJsonData,
  resolveAdminServiceProviderId,
} from "./recentActivitiesApi.js";

export function useRecentActivities() {
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
  const currentPathRef = useRef("");
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const currentUserContactId = toText(APP_USER?.id);
  const isInquiryDetailsRoute = useMemo(
    () => toText(location?.pathname).toLowerCase().startsWith("/inquiry-details"),
    [location?.pathname]
  );

  useEffect(() => {
    currentPathRef.current = `${toText(location?.pathname)}${toText(location?.search)}`;
  }, [location?.pathname, location?.search]);

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
    const handleAnnouncementEmitted = (event) => {
      if (event?.detail?.recentActivityPersisted) {
        refreshActivitiesFromStorage();
        return;
      }
      const nextRecord = mapAnnouncementEventToActivityRecord(
        event?.detail,
        currentPathRef.current
      );
      if (!nextRecord) return;
      const merged = normalizeRecords([nextRecord, ...readRecords()]);
      writeRecords(merged);
      setActivities(merged);
    };
    window.addEventListener(ANNOUNCEMENT_EMITTED_EVENT, handleAnnouncementEmitted);
    return () => {
      window.removeEventListener(ACTIVITIES_UPDATED_EVENT, handleActivitiesUpdated);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ANNOUNCEMENT_EMITTED_EVENT, handleAnnouncementEmitted);
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
        const didUpdate = await updateServiceProviderRecentActivityJsonData({
          plugin,
          serviceProviderId: resolvedProviderId,
          jsonPayload,
        });
        if (!didUpdate) {
          throw new Error("Recent activities update did not return success.");
        }
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
          console.error("[RecentActivitiesDock] Retry limit reached for current payload signature", {
            attempts: nextAttempts,
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

  return {
    isOpen,
    setIsOpen,
    activities,
    isSyncing,
  };
}
