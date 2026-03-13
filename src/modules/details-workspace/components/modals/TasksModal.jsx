import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useRenderWindow } from "../primitives/WorkspaceTablePrimitives.jsx";
import { useAdminProviderLookup } from "../../hooks/useServiceProviderLookup.js";
import {
  buildTasksCacheKey,
  hasMeaningfulTaskData,
  parseAssignedTo,
  pickFirstId,
  readTasksFromCache,
  TASKS_CACHE_TTL_MS,
  toString,
} from "./tasksModalUtils.js";
import { useTasksCrud } from "./useTasksCrud.js";
import { useTasksForm } from "./useTasksForm.js";
import { TasksFormPanel } from "./TasksFormPanel.jsx";
import { TasksTablePanel } from "./TasksTablePanel.jsx";

export function TasksModal({
  open,
  onClose,
  plugin,
  jobData,
  contextType = "job",
  contextId = "",
  additionalCreatePayload = null,
  additionalUpdatePayload = null,
  onTasksChanged = null,
}) {
  const normalizedContextType = toString(contextType).toLowerCase() === "deal" ? "deal" : "job";
  const contextIdText = toString(contextId);
  const directResolvedJobId = pickFirstId(
    normalizedContextType === "job" ? contextIdText : "",
    jobData?.id,
    jobData?.ID,
    jobData?.job_id,
    jobData?.Job_id,
    jobData?.Job_ID,
    jobData?.related_job_id,
    jobData?.Related_Job_ID,
    jobData?.quote_record_id,
    jobData?.Quote_Record_ID,
    jobData?.Quote_record_ID,
    jobData?.inquiry_for_job_id,
    jobData?.Inquiry_For_Job_ID,
    jobData?.Inquiry_for_Job_ID,
    additionalCreatePayload?.job_id,
    additionalCreatePayload?.Job_id,
    additionalCreatePayload?.Job_ID,
    additionalUpdatePayload?.job_id,
    additionalUpdatePayload?.Job_id,
    additionalUpdatePayload?.Job_ID
  );
  const jobUniqueIdCandidate = pickFirstId(
    normalizedContextType === "job" && contextIdText && !/^\d+$/.test(contextIdText)
      ? contextIdText
      : "",
    jobData?.unique_id,
    jobData?.Unique_ID,
    additionalCreatePayload?.job_unique_id,
    additionalCreatePayload?.Job_Unique_ID,
    additionalUpdatePayload?.job_unique_id,
    additionalUpdatePayload?.Job_Unique_ID
  );
  const resolvedDealId = pickFirstId(
    normalizedContextType === "deal" ? contextIdText : "",
    jobData?.deal_id,
    jobData?.Deal_id,
    jobData?.Deal_ID,
    jobData?.inquiry_record_id,
    jobData?.Inquiry_Record_ID,
    jobData?.inquiry_id,
    jobData?.Inquiry_ID,
    additionalCreatePayload?.deal_id,
    additionalCreatePayload?.Deal_id,
    additionalCreatePayload?.Deal_ID,
    additionalUpdatePayload?.deal_id,
    additionalUpdatePayload?.Deal_id,
    additionalUpdatePayload?.Deal_ID
  );

  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // Admin service providers for the assignee dropdown
  const { records: adminProviders, isLoading: isLoadingAssignees } = useAdminProviderLookup({
    plugin,
    isSdkReady: Boolean(plugin),
  });
  const assigneeOptions = useMemo(
    () =>
      adminProviders
        .map((sp) => ({
          id: toString(sp.id),
          label:
            [toString(sp.first_name), toString(sp.last_name)].filter(Boolean).join(" ") ||
            `SP #${sp.id}`,
        }))
        .filter((item) => item.id),
    [adminProviders]
  );

  const tasksCacheKey = useMemo(
    () =>
      buildTasksCacheKey({
        contextType: normalizedContextType,
        contextId: contextIdText,
        resolvedJobId: directResolvedJobId,
        resolvedDealId,
        jobUid: jobUniqueIdCandidate,
      }),
    [normalizedContextType, contextIdText, directResolvedJobId, resolvedDealId, jobUniqueIdCandidate]
  );

  const {
    isLoadingTasks,
    setIsLoadingTasks,
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    resolvedJobId,
    setResolvedJobIdFromUid,
    resolveJobIdByUid,
    loadTasks,
    handleMarkComplete,
    onTasksChangedRef,
  } = useTasksCrud({
    plugin,
    open,
    directResolvedJobId,
    resolvedDealId,
    jobUniqueIdCandidate,
    tasksCacheKey,
    onTasksChanged,
    additionalUpdatePayload,
  });

  const hasContextIds = Boolean(resolvedJobId || resolvedDealId);

  const {
    form,
    setForm,
    isSubmitting,
    setIsSubmitting,
    isEditing,
    resetForm,
    handleEditTask,
    handleSubmit,
  } = useTasksForm({
    plugin,
    hasContextIds,
    resolvedJobId,
    resolvedDealId,
    jobUniqueIdCandidate,
    resolveJobIdByUid,
    setResolvedJobIdFromUid,
    additionalCreatePayload,
    additionalUpdatePayload,
    loadTasks,
  });

  useEffect(() => {
    if (!open) {
      resetForm();
      setActiveTaskId("");
      setIsSubmitting(false);
      setIsLoadingTasks(false);
      setTaskFilter("all");
      setAssigneeFilter("");
    }
  }, [open, resetForm, setActiveTaskId, setIsSubmitting, setIsLoadingTasks]);

  useEffect(() => {
    if (!open) return;
    const cached = readTasksFromCache(tasksCacheKey);
    if (cached?.records) {
      setTasks(cached.records);
      if (typeof onTasksChangedRef.current === "function") {
        onTasksChangedRef.current(cached.records);
      }
      setIsLoadingTasks(false);
      const isFresh = Date.now() - Number(cached.cachedAt || 0) <= TASKS_CACHE_TTL_MS;
      if (isFresh) return;
      loadTasks({ showLoading: false });
      return;
    }
    loadTasks({ showLoading: true });
  }, [open, loadTasks, tasksCacheKey, setTasks, setIsLoadingTasks, onTasksChangedRef]);

  const normalizedTasks = useMemo(
    () => (Array.isArray(tasks) ? tasks.filter(hasMeaningfulTaskData) : []),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return normalizedTasks.filter((task) => {
      // Status filter
      if (taskFilter !== "all") {
        const status = toString(task?.status).toLowerCase();
        if (taskFilter === "completed" && status !== "completed") return false;
        if (taskFilter === "open" && status !== "open") return false;
      }
      // Assignee filter — match parsed SP id from details
      if (assigneeFilter) {
        const parsed = parseAssignedTo(toString(task?.details));
        if (!parsed || parsed.id !== assigneeFilter) return false;
      }
      return true;
    });
  }, [normalizedTasks, taskFilter, assigneeFilter]);

  const {
    hasMore: hasMoreTasks,
    remainingCount: remainingTasksCount,
    showMore: showMoreTasks,
    shouldWindow: isTasksWindowed,
    visibleRows: visibleTasks,
  } = useRenderWindow(filteredTasks, {
    threshold: 160,
    pageSize: 100,
  });

  const emptyMessage =
    taskFilter === "completed"
      ? "No completed tasks found."
      : taskFilter === "open"
        ? "No open tasks found."
        : assigneeFilter
          ? "No tasks found for the selected assignee."
          : "No tasks found for this context.";

  return (
    <Modal open={open} onClose={onClose} title="Tasks" widthClass="max-w-6xl">
      <div className="space-y-6">
        <TasksFormPanel
          form={form}
          setForm={setForm}
          isSubmitting={isSubmitting}
          isEditing={isEditing}
          hasContextIds={hasContextIds}
          assigneeOptions={assigneeOptions}
          isLoadingAssignees={isLoadingAssignees}
          onSubmit={handleSubmit}
          onClear={resetForm}
        />

        <TasksTablePanel
          isLoadingTasks={isLoadingTasks}
          visibleTasks={visibleTasks}
          filteredTasks={filteredTasks}
          hasMoreTasks={hasMoreTasks}
          remainingTasksCount={remainingTasksCount}
          isTasksWindowed={isTasksWindowed}
          showMoreTasks={showMoreTasks}
          isSubmitting={isSubmitting}
          activeTaskId={activeTaskId}
          taskFilter={taskFilter}
          setTaskFilter={setTaskFilter}
          assigneeFilter={assigneeFilter}
          setAssigneeFilter={setAssigneeFilter}
          assigneeOptions={assigneeOptions}
          onEditTask={handleEditTask}
          onMarkComplete={handleMarkComplete}
          emptyMessage={emptyMessage}
        />
      </div>
    </Modal>
  );
}
