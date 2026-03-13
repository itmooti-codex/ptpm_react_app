import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  fetchJobDirectDataByUid,
  fetchTasksByDealId,
  fetchTasksByJobId,
  updateTaskRecord,
} from "../../api/core/runtime.js";
import {
  dedupeTasksById,
  hasMeaningfulTaskData,
  pickFirstId,
  toString,
  writeTasksToCache,
} from "./tasksModalUtils.js";

export function useTasksCrud({
  plugin,
  open,
  directResolvedJobId,
  resolvedDealId,
  jobUniqueIdCandidate,
  tasksCacheKey,
  onTasksChanged,
  additionalUpdatePayload,
}) {
  const { success, error } = useToast();
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [resolvedJobIdFromUid, setResolvedJobIdFromUid] = useState("");
  const onTasksChangedRef = useRef(onTasksChanged);

  // Compute final resolved job id here, combining direct and uid-resolved
  const resolvedJobId = useMemo(
    () => pickFirstId(directResolvedJobId, resolvedJobIdFromUid),
    [directResolvedJobId, resolvedJobIdFromUid]
  );

  useEffect(() => {
    onTasksChangedRef.current = onTasksChanged;
  }, [onTasksChanged]);

  const resolveJobIdByUid = useCallback(
    async (uid) => {
      const jobUid = toString(uid);
      if (!plugin || !jobUid) return "";
      try {
        const jobRecord = await fetchJobDirectDataByUid({
          plugin,
          jobUid,
        });
        return toString(jobRecord?.id || jobRecord?.ID);
      } catch (lookupError) {
        console.warn("[JobDirect] Task modal failed to resolve job ID by unique ID", {
          jobUid,
          error: lookupError,
        });
        return "";
      }
    },
    [plugin]
  );

  useEffect(() => {
    let cancelled = false;
    if (!open || !plugin) {
      setResolvedJobIdFromUid("");
      return undefined;
    }
    if (directResolvedJobId || !jobUniqueIdCandidate) {
      setResolvedJobIdFromUid("");
      return undefined;
    }
    resolveJobIdByUid(jobUniqueIdCandidate).then((resolvedId) => {
      if (cancelled) return;
      setResolvedJobIdFromUid(toString(resolvedId));
    });
    return () => {
      cancelled = true;
    };
  }, [open, plugin, directResolvedJobId, jobUniqueIdCandidate, resolveJobIdByUid]);

  const loadTasks = useCallback(async ({ showLoading = true } = {}) => {
    if (!plugin || (!resolvedJobId && !resolvedDealId)) {
      setTasks([]);
      return [];
    }

    if (showLoading) {
      setIsLoadingTasks(true);
    }
    try {
      const [jobTasks, dealTasks] = await Promise.all([
        resolvedJobId ? fetchTasksByJobId({ plugin, jobId: resolvedJobId }) : Promise.resolve([]),
        resolvedDealId
          ? fetchTasksByDealId({ plugin, dealId: resolvedDealId })
          : Promise.resolve([]),
      ]);
      const normalized = dedupeTasksById([
        ...(Array.isArray(jobTasks) ? jobTasks : []),
        ...(Array.isArray(dealTasks) ? dealTasks : []),
      ]).filter(hasMeaningfulTaskData);
      setTasks(normalized);
      writeTasksToCache(tasksCacheKey, normalized);
      if (typeof onTasksChangedRef.current === "function") {
        onTasksChangedRef.current(normalized);
      }
      return normalized;
    } catch (loadError) {
      console.error("[JobDirect] Failed loading tasks", loadError);
      return [];
    } finally {
      if (showLoading) {
        setIsLoadingTasks(false);
      }
    }
  }, [plugin, resolvedJobId, resolvedDealId, tasksCacheKey]);

  const handleMarkComplete = useCallback(
    async (task) => {
      const id = toString(task?.id);
      if (!id || !plugin) return;

      setActiveTaskId(id);
      try {
        const updatedTask = await updateTaskRecord({
          plugin,
          id,
          payload: {
            status: "Completed",
            ...(resolvedJobId ? { job_id: resolvedJobId, Job_id: resolvedJobId } : {}),
            ...(resolvedDealId ? { deal_id: resolvedDealId, Deal_id: resolvedDealId } : {}),
            ...(additionalUpdatePayload && typeof additionalUpdatePayload === "object"
              ? additionalUpdatePayload
              : {}),
          },
        });
        if (!updatedTask?.id) {
          throw new Error("Task update was not confirmed.");
        }
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.TASK_COMPLETED,
          quoteJobId: resolvedJobId,
          inquiryId: resolvedDealId,
          focusId: id,
          dedupeEntityId: `${id}:completed`,
          title: "Task completed",
          content: toString(task?.subject) || "A task was marked as completed.",
          logContext: "job-direct:TasksModal:handleMarkComplete",
        });
        await loadTasks();
        success("Task completed", "Task status set to Completed.");
      } catch (completeError) {
        console.error("[JobDirect] Mark complete failed", completeError);
        error("Update failed", completeError?.message || "Unable to mark task complete.");
      } finally {
        setActiveTaskId("");
      }
    },
    [plugin, loadTasks, success, error, additionalUpdatePayload, resolvedJobId, resolvedDealId]
  );

  return {
    isLoadingTasks,
    setIsLoadingTasks,
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    resolvedJobId,
    resolvedJobIdFromUid,
    setResolvedJobIdFromUid,
    resolveJobIdByUid,
    loadTasks,
    handleMarkComplete,
    onTasksChangedRef,
  };
}
