import { useEffect, useRef } from "react";
import { selectJobEntity } from "../state/selectors.js";
import { useDetailsWorkspaceSelector, useDetailsWorkspaceStoreActions } from "./useDetailsWorkspaceStore.jsx";
import {
  subscribeAppointmentsByJobId,
  subscribeActivitiesByJobId,
  subscribeJobById,
  subscribeJobUploadsByJobId,
  subscribeMaterialsByJobId,
  subscribeTasksByJobId,
} from "../api/core/runtime.js";

function normalizeId(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function isRealtimeDebugEnabled() {
  if (typeof window === "undefined") return false;
  if (window.__JOB_DIRECT_REALTIME_DEBUG__ === true) return true;
  try {
    return window.localStorage?.getItem("jobDirect.realtime.debug") === "1";
  } catch {
    return false;
  }
}

function createMetrics() {
  return {
    startedAt: Date.now(),
    updates: {
      job: 0,
      activities: 0,
      materials: 0,
      tasks: 0,
      appointments: 0,
      jobUploads: 0,
    },
  };
}

export function useJobDirectRealtimeSync({ plugin, initialJobData } = {}) {
  const actions = useDetailsWorkspaceStoreActions();
  const jobEntity = useDetailsWorkspaceSelector(selectJobEntity);
  const metricsRef = useRef(createMetrics());
  const updateCountRef = useRef(0);
  const debugEnabled = isRealtimeDebugEnabled();

  const jobId = normalizeId(
    jobEntity?.id ||
      jobEntity?.ID ||
      initialJobData?.id ||
      initialJobData?.ID
  );

  useEffect(() => {
    if (!plugin || !jobId) return undefined;
    metricsRef.current = createMetrics();
    updateCountRef.current = 0;

    const logUpdate = (channel) => {
      metricsRef.current.updates[channel] += 1;
      updateCountRef.current += 1;
      if (!debugEnabled) return;
      if (updateCountRef.current % 20 !== 0) return;
      const elapsedSeconds = Math.max(
        1,
        Math.round((Date.now() - metricsRef.current.startedAt) / 1000)
      );
      console.debug("[JobDirect][Realtime] Update metrics", {
        jobId,
        elapsedSeconds,
        updates: metricsRef.current.updates,
      });
    };

    if (debugEnabled) {
      console.debug("[JobDirect][Realtime] Subscribing", { jobId });
    }

    const unsubscribeJob = subscribeJobById({
      plugin,
      jobId,
      onChange: (record) => {
        if (!record || typeof record !== "object") return;
        logUpdate("job");
        actions.patchJobEntity(record);
      },
    });

    const unsubscribeActivities = subscribeActivitiesByJobId({
      plugin,
      jobId,
      onChange: (records) => {
        logUpdate("activities");
        actions.replaceEntityCollection("activities", Array.isArray(records) ? records : []);
      },
    });

    const unsubscribeMaterials = subscribeMaterialsByJobId({
      plugin,
      jobId,
      onChange: (records) => {
        logUpdate("materials");
        actions.replaceEntityCollection("materials", Array.isArray(records) ? records : []);
      },
    });

    const unsubscribeTasks = subscribeTasksByJobId({
      plugin,
      jobId,
      onChange: (records) => {
        logUpdate("tasks");
        actions.replaceEntityCollection("tasks", Array.isArray(records) ? records : []);
      },
    });

    const unsubscribeAppointments = subscribeAppointmentsByJobId({
      plugin,
      jobId,
      onChange: (records) => {
        logUpdate("appointments");
        actions.replaceEntityCollection("appointments", Array.isArray(records) ? records : []);
      },
    });

    const unsubscribeJobUploads = subscribeJobUploadsByJobId({
      plugin,
      jobId,
      onChange: (records) => {
        logUpdate("jobUploads");
        actions.replaceEntityCollection("jobUploads", Array.isArray(records) ? records : []);
      },
    });

    return () => {
      if (debugEnabled) {
        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - metricsRef.current.startedAt) / 1000)
        );
        console.debug("[JobDirect][Realtime] Unsubscribed", {
          jobId,
          elapsedSeconds,
          updates: metricsRef.current.updates,
        });
      }
      unsubscribeJob?.();
      unsubscribeActivities?.();
      unsubscribeMaterials?.();
      unsubscribeTasks?.();
      unsubscribeAppointments?.();
      unsubscribeJobUploads?.();
    };
  }, [actions, debugEnabled, jobId, plugin]);

}
