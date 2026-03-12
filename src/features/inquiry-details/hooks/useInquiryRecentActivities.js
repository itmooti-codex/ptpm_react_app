import { useCallback, useEffect, useRef, useState } from "react";
import { toText } from "@shared/utils/formatters.js";
import {
  buildRecentActivitySignature,
  createRecentActivityJsonData,
  finalizeRecentActivityList,
  isMajorRecentActivityAction,
  normalizeLegacyInquiryPageType,
  normalizeRecentActivityRecord,
  readRecentAdminActivitiesFromStorage,
  resolveActivityPageName,
  resolveActivityPageType,
  resolveRecentActivityAdminProviderId,
  updateServiceProviderRecentActivityJsonData,
  writeRecentAdminActivitiesToStorage,
  MAX_RECENT_ADMIN_ACTIVITY_RECORDS,
} from "../shared/recentActivity.js";

export function useInquiryRecentActivities({
  plugin,
  configuredAdminProviderId = "",
  currentUserContactId = "",
  currentActivityPath = "",
  inquiryId = "",
  inquiryUid = "",
} = {}) {
  const [recentAdminActivities, setRecentAdminActivities] = useState(() =>
    readRecentAdminActivitiesFromStorage()
  );
  const recentAdminActivitiesRef = useRef(readRecentAdminActivitiesFromStorage());
  const recentActivityProviderIdRef = useRef("");
  const recentActivitySyncTimeoutRef = useRef(null);
  const lastSyncedRecentActivityHashRef = useRef("");

  const trackRecentActivity = useCallback(
    ({
      action = "",
      pageType = "",
      pageName = "",
      path = "",
      metadata = null,
    } = {}) => {
      const normalizedAction = toText(action);
      if (!isMajorRecentActivityAction(normalizedAction)) return;

      const resolvedPath = toText(path || currentActivityPath);
      const resolvedPageType =
        normalizeLegacyInquiryPageType(pageType) || resolveActivityPageType(resolvedPath);
      const resolvedPageName = toText(pageName) || resolveActivityPageName(resolvedPageType);
      const normalizedMetadata =
        metadata && typeof metadata === "object" ? { ...metadata } : {};
      const metadataInquiryId =
        toText(normalizedMetadata?.inquiry_id) ||
        toText(normalizedMetadata?.inquiryId) ||
        toText(normalizedMetadata?.deal_id);
      const metadataInquiryUid =
        toText(normalizedMetadata?.inquiry_uid) ||
        toText(normalizedMetadata?.inquiryUid) ||
        toText(normalizedMetadata?.deal_uid);
      const isNewInquiryPath = toText(resolvedPath).toLowerCase().startsWith("/inquiry-details/new");
      const timestamp = Date.now();
      const nextRecord = normalizeRecentActivityRecord({
        id: `activity-${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp,
        action: normalizedAction,
        page_type: resolvedPageType,
        page_name: resolvedPageName,
        path: resolvedPath,
        inquiry_id: metadataInquiryId || (isNewInquiryPath ? "" : toText(inquiryId)),
        inquiry_uid: metadataInquiryUid || (isNewInquiryPath ? "" : toText(inquiryUid)),
        metadata: normalizedMetadata,
      });

      const currentList = finalizeRecentActivityList(
        recentAdminActivitiesRef.current?.length
          ? recentAdminActivitiesRef.current
          : readRecentAdminActivitiesFromStorage()
      );
      const normalizedActionKey = toText(nextRecord?.action).toLowerCase();
      let merged = [nextRecord, ...currentList];

      if (normalizedActionKey === "created new inquiry") {
        const nextInquiryUid = toText(nextRecord?.inquiry_uid).toLowerCase();
        const startedIndex = currentList.findIndex((item) => {
          if (toText(item?.action).toLowerCase() !== "started new inquiry") {
            return false;
          }
          const startedUid = toText(item?.inquiry_uid).toLowerCase();
          if (nextInquiryUid && startedUid && startedUid === nextInquiryUid) {
            return true;
          }
          return toText(item?.path).toLowerCase().startsWith("/inquiry-details/new");
        });
        if (startedIndex >= 0) {
          const startedRecord = currentList[startedIndex];
          const remaining = currentList.filter((_, index) => index !== startedIndex);
          const upgradedRecord = normalizeRecentActivityRecord({
            ...startedRecord,
            ...nextRecord,
            id: toText(startedRecord?.id) || toText(nextRecord?.id),
          });
          merged = [upgradedRecord, ...remaining];
        }
      }

      const nextRecords = finalizeRecentActivityList(merged);
      recentAdminActivitiesRef.current = nextRecords;
      writeRecentAdminActivitiesToStorage(nextRecords);
      setRecentAdminActivities(nextRecords);
    },
    [currentActivityPath, inquiryId, inquiryUid]
  );

  const syncRecentActivityFile = useCallback(
    async (records = []) => {
      if (!plugin) {
        throw new Error("SDK plugin is not ready for recent activity sync.");
      }

      const normalizedRecords = (Array.isArray(records) ? records : [])
        .map((item) => normalizeRecentActivityRecord(item))
        .filter((item) => isMajorRecentActivityAction(item?.action))
        .sort((left, right) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0))
        .slice(0, MAX_RECENT_ADMIN_ACTIVITY_RECORDS);
      if (!normalizedRecords.length) return false;

      let resolvedProviderId = toText(recentActivityProviderIdRef.current);
      if (!resolvedProviderId) {
        try {
          resolvedProviderId = await resolveRecentActivityAdminProviderId({
            plugin,
            configuredProviderId: configuredAdminProviderId,
            currentUserContactId,
          });
          recentActivityProviderIdRef.current = resolvedProviderId;
        } catch (providerError) {
          console.warn("[InquiryDetails] Failed resolving provider for recent activity sync", providerError);
        }
      }

      if (!resolvedProviderId) {
        throw new Error("Admin service provider ID could not be resolved for recent activity sync.");
      }

      const jsonPayload = createRecentActivityJsonData(normalizedRecords, resolvedProviderId);
      const didUpdate = await updateServiceProviderRecentActivityJsonData({
        plugin,
        serviceProviderId: resolvedProviderId,
        jsonPayload,
      });
      if (!didUpdate) {
        throw new Error("Recent activity JSON update was not acknowledged.");
      }
      return true;
    },
    [configuredAdminProviderId, currentUserContactId, plugin]
  );

  useEffect(() => {
    recentAdminActivitiesRef.current = finalizeRecentActivityList(recentAdminActivities);
  }, [recentAdminActivities]);

  useEffect(() => {
    if (!plugin || !recentAdminActivities.length) return;

    const signature = buildRecentActivitySignature(recentAdminActivities);
    if (!signature || signature === lastSyncedRecentActivityHashRef.current) return;

    if (recentActivitySyncTimeoutRef.current) {
      window.clearTimeout(recentActivitySyncTimeoutRef.current);
    }

    recentActivitySyncTimeoutRef.current = window.setTimeout(async () => {
      try {
        const didSync = await syncRecentActivityFile(recentAdminActivities);
        if (didSync) {
          lastSyncedRecentActivityHashRef.current = signature;
        }
      } catch (syncError) {
        console.error("[InquiryDetails] Failed syncing recent activity file", syncError);
        recentActivityProviderIdRef.current = "";
      }
    }, 250);

    return () => {
      if (recentActivitySyncTimeoutRef.current) {
        window.clearTimeout(recentActivitySyncTimeoutRef.current);
      }
    };
  }, [plugin, recentAdminActivities, syncRecentActivityFile]);

  useEffect(
    () => () => {
      if (recentActivitySyncTimeoutRef.current) {
        window.clearTimeout(recentActivitySyncTimeoutRef.current);
      }
    },
    []
  );

  return {
    trackRecentActivity,
  };
}
