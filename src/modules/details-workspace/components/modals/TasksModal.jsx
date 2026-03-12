import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import assigneesJson from "../../../../../assignees.json";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectStatusBadge,
  JobDirectTable,
  useRenderWindow,
} from "../primitives/WorkspaceTablePrimitives.jsx";
import {
  JobDirectFormActionsRow,
  JobDirectMutedPanel,
  JobDirectPlainPanel,
} from "../primitives/WorkspaceLayoutPrimitives.jsx";
import {
  CheckActionIcon,
  EditActionIcon,
} from "../icons/ActionIcons.jsx";
import {
  createTaskRecord,
  fetchJobDirectDataByUid,
  fetchTasksByDealId,
  fetchTasksByJobId,
  updateTaskRecord,
} from "../../api/core/runtime.js";
import { useAdminProviderLookup } from "../../hooks/useServiceProviderLookup.js";

function toString(value) {
  return String(value ?? "").trim();
}

function pickFirstId(...values) {
  for (const value of values) {
    const text = toString(value);
    if (text) return text;
  }
  return "";
}

function dedupeTasksById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((task, index) => {
    const id = toString(task?.id || task?.ID || task?.Task_ID);
    const key = id || `idx-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Parses "\n\nAssigned to: John Doe | 5" appended at end of details
function parseAssignedTo(details) {
  const match = String(details || "").match(/\n\nAssigned to: (.+?) \| (\w+)\s*$/);
  if (!match) return null;
  return { name: match[1], id: match[2] };
}

function stripAssignedTo(details) {
  return String(details || "").replace(/\n\nAssigned to: .+$/s, "").trimEnd();
}

const TASKS_CACHE_TTL_MS = 2 * 60 * 1000;
const tasksCacheByContext = new Map();

function buildTasksCacheKey({
  contextType = "",
  contextId = "",
  resolvedJobId = "",
  resolvedDealId = "",
  jobUid = "",
} = {}) {
  return [
    toString(contextType) || "job",
    toString(contextId),
    toString(resolvedJobId),
    toString(resolvedDealId),
    toString(jobUid).toLowerCase(),
  ].join("|");
}

function readTasksFromCache(cacheKey = "") {
  const key = toString(cacheKey);
  if (!key) return null;
  const cached = tasksCacheByContext.get(key);
  if (!cached || typeof cached !== "object") return null;
  const cachedAt = Number(cached.cachedAt || 0);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > TASKS_CACHE_TTL_MS) {
    tasksCacheByContext.delete(key);
    return null;
  }
  return {
    cachedAt,
    records: Array.isArray(cached.records) ? cached.records : [],
  };
}

function writeTasksToCache(cacheKey = "", records = []) {
  const key = toString(cacheKey);
  if (!key) return;
  tasksCacheByContext.set(key, {
    cachedAt: Date.now(),
    records: Array.isArray(records) ? records : [],
  });
}

function formatDateForInput(value) {
  const text = toString(value);
  if (!text) return "";

  const normalizedNumericText = text.replace(/,/g, "");
  const hasOnlyNumericChars = /^-?\d+(\.\d+)?$/.test(normalizedNumericText);
  if (hasOnlyNumericChars) {
    const numeric = Number(normalizedNumericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const length = String(Math.abs(rounded)).length;
      const asMs = length <= 10 ? rounded * 1000 : rounded;
      const fromUnix = new Date(asMs);
      if (!Number.isNaN(fromUnix.getTime())) {
        const year = fromUnix.getFullYear();
        const month = String(fromUnix.getMonth() + 1).padStart(2, "0");
        const day = String(fromUnix.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    return `${ausMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value) {
  const iso = formatDateForInput(value);
  if (!iso) return "-";

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function statusBadgeClass(status) {
  const normalized = toString(status).toLowerCase();
  if (normalized === "completed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "in progress") {
    return "bg-sky-100 text-sky-700";
  }
  if (normalized === "cancelled") {
    return "bg-slate-200 text-slate-700";
  }
  return "bg-amber-100 text-amber-700";
}

function AssigneeSearchField({
  label,
  options,
  selectedId,
  onSelect,
  disabled = false,
  isLoading = false,
}) {
  const rootRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((item) => item.id === selectedId) || null,
    [options, selectedId]
  );
  const [query, setQuery] = useState(selectedOption?.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.id, selectedOption?.label]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = toString(query).toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative block">
      <span className="type-label text-slate-600">{label}</span>
      <input
        type="text"
        value={query}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          const normalizedNext = toString(nextQuery).toLowerCase();
          const normalizedSelected = toString(selectedOption?.label).toLowerCase();
          if (selectedId && normalizedNext !== normalizedSelected) {
            onSelect("", "");
          }
        }}
        disabled={disabled}
        placeholder={isLoading ? "Loading assignees..." : "Search assignee"}
        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
      />

      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {filteredOptions.length ? (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(option.id, option.label);
                      setQuery(option.label);
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              {isLoading ? "Loading..." : "No assignees found."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function emptyFormState() {
  return {
    id: "",
    subject: "",
    dueDate: "",
    spId: "",
    spName: "",
    details: "",
  };
}

function hasMeaningfulTaskData(task) {
  if (!task || typeof task !== "object") return false;
  return Boolean(
    toString(task.id) ||
      toString(task.subject) ||
      toString(task.assignee_id) ||
      toString(task.details) ||
      toString(task.date_due) ||
      toString(task.status)
  );
}

// The silent assignee ID always sent from assignees.json
const silentAssigneeId = toString(assigneesJson?.[0]?.id ?? "");

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

  const [resolvedJobIdFromUid, setResolvedJobIdFromUid] = useState("");
  const resolvedJobId = pickFirstId(directResolvedJobId, resolvedJobIdFromUid);
  const hasContextIds = Boolean(resolvedJobId || resolvedDealId);

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

  const { success, error } = useToast();
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [form, setForm] = useState(emptyFormState);
  const onTasksChangedRef = useRef(onTasksChanged);
  const tasksCacheKey = useMemo(
    () =>
      buildTasksCacheKey({
        contextType: normalizedContextType,
        contextId: contextIdText,
        resolvedJobId,
        resolvedDealId,
        jobUid: jobUniqueIdCandidate,
      }),
    [
      normalizedContextType,
      contextIdText,
      resolvedJobId,
      resolvedDealId,
      jobUniqueIdCandidate,
    ]
  );

  useEffect(() => {
    onTasksChangedRef.current = onTasksChanged;
  }, [onTasksChanged]);

  const isEditing = Boolean(form.id);

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

  const resetForm = useCallback(() => {
    setForm(emptyFormState());
  }, []);

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

  useEffect(() => {
    if (!open) {
      resetForm();
      setActiveTaskId("");
      setIsSubmitting(false);
      setIsLoadingTasks(false);
      setTaskFilter("all");
      setAssigneeFilter("");
    }
  }, [open, resetForm]);

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
  }, [open, loadTasks, tasksCacheKey]);

  // Parse the assigned-to name from the task's details field
  const getAssigneeName = useCallback((task) => {
    const parsed = parseAssignedTo(toString(task?.details));
    if (parsed?.name) return parsed.name;
    return "-";
  }, []);

  const handleEditTask = useCallback((task) => {
    const isCompleted = toString(task?.status).toLowerCase() === "completed";
    if (isCompleted) return;
    const rawDetails = toString(task?.details);
    const parsed = parseAssignedTo(rawDetails);
    setForm({
      id: toString(task?.id),
      subject: toString(task?.subject),
      dueDate: formatDateForInput(task?.date_due),
      spId: parsed?.id || "",
      spName: parsed?.name || "",
      details: stripAssignedTo(rawDetails),
    });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!plugin) {
        error("SDK unavailable", "Please wait for SDK initialization.");
        return;
      }
      if (!hasContextIds) {
        error("Missing context", "Inquiry ID and/or Job ID is required to save task.");
        return;
      }

      const subject = toString(form.subject);
      if (!subject) {
        error("Subject required", "Please enter a task subject.");
        return;
      }
      if (!form.dueDate) {
        error("Due date required", "Please select a due date.");
        return;
      }
      if (!form.spId) {
        error("Assignee required", "Please select an assignee.");
        return;
      }

      // Append "Assigned to:" to details so it can be parsed/filtered later
      const baseDetails = toString(form.details);
      const appendedDetails = form.spName
        ? `${baseDetails}\n\nAssigned to: ${form.spName} | ${form.spId}`.trimStart()
        : baseDetails;

      const payload = {
        subject,
        date_due: form.dueDate,
        assignee_id: silentAssigneeId,  // always from assignees.json, never shown
        details: appendedDetails,
      };

      let effectiveJobId = resolvedJobId;
      if (!effectiveJobId && jobUniqueIdCandidate) {
        const lookedUpId = await resolveJobIdByUid(jobUniqueIdCandidate);
        effectiveJobId = toString(lookedUpId);
        if (effectiveJobId) {
          setResolvedJobIdFromUid(effectiveJobId);
        }
      }
      if (effectiveJobId) {
        payload.job_id = effectiveJobId;
        payload.Job_id = effectiveJobId;
      }
      if (resolvedDealId) {
        payload.deal_id = resolvedDealId;
        payload.Deal_id = resolvedDealId;
      }
      if (additionalCreatePayload && typeof additionalCreatePayload === "object") {
        Object.assign(payload, additionalCreatePayload);
      }
      const payloadJobId = toString(payload.Job_id || payload.job_id);
      const payloadDealId = toString(payload.Deal_id || payload.deal_id);
      if (payloadJobId) {
        payload.job_id = payloadJobId;
        payload.Job_id = payloadJobId;
      }
      if (payloadDealId) {
        payload.deal_id = payloadDealId;
        payload.Deal_id = payloadDealId;
      }

      setIsSubmitting(true);
      try {
        if (isEditing) {
          const updatePayload = {
            ...payload,
            ...(additionalUpdatePayload && typeof additionalUpdatePayload === "object"
              ? additionalUpdatePayload
              : {}),
          };
          const updateJobId = toString(updatePayload.Job_id || updatePayload.job_id);
          const updateDealId = toString(updatePayload.Deal_id || updatePayload.deal_id);
          if (updateJobId) {
            updatePayload.job_id = updateJobId;
            updatePayload.Job_id = updateJobId;
          }
          if (updateDealId) {
            updatePayload.deal_id = updateDealId;
            updatePayload.Deal_id = updateDealId;
          }
          await updateTaskRecord({ plugin, id: form.id, payload: updatePayload });
          success("Task updated", "Task changes have been saved.");
        } else {
          const createdTask = await createTaskRecord({ plugin, payload });
          const createdTaskId = toString(createdTask?.id || createdTask?.ID);
          await emitAnnouncement({
            plugin,
            eventKey: ANNOUNCEMENT_EVENT_KEYS.TASK_ADDED,
            quoteJobId: resolvedJobId,
            inquiryId: resolvedDealId,
            focusId: createdTaskId,
            dedupeEntityId: createdTaskId || `${resolvedJobId}:${resolvedDealId}:${subject}`,
            title: "New task added",
            content: subject,
            logContext: "job-direct:TasksModal:handleSubmit",
          });
          success("Task added", "New task created successfully.");
        }
        await loadTasks();
        resetForm();
      } catch (submitError) {
        console.error("[JobDirect] Task save failed", submitError);
        error(
          isEditing ? "Update failed" : "Create failed",
          submitError?.message || "Unable to save task."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      plugin,
      hasContextIds,
      form,
      isEditing,
      resolvedJobId,
      resolvedDealId,
      jobUniqueIdCandidate,
      resolveJobIdByUid,
      additionalCreatePayload,
      additionalUpdatePayload,
      loadTasks,
      resetForm,
      success,
      error,
    ]
  );

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
        <JobDirectMutedPanel>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField
                label="Subject"
                value={form.subject}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    subject: event.target.value,
                  }))
                }
                placeholder="Task subject"
                disabled={isSubmitting}
              />

              <InputField
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    dueDate: event.target.value,
                  }))
                }
                disabled={isSubmitting}
              />

              <AssigneeSearchField
                label="Assignee"
                options={assigneeOptions}
                selectedId={form.spId}
                onSelect={(spId, spName) =>
                  setForm((prev) => ({
                    ...prev,
                    spId,
                    spName,
                  }))
                }
                disabled={isSubmitting}
                isLoading={isLoadingAssignees}
              />

              <TextareaField
                label="Details"
                rows={3}
                value={form.details}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    details: event.target.value,
                  }))
                }
                placeholder="Task details"
                disabled={isSubmitting}
              />
            </div>

            <JobDirectFormActionsRow className="mt-4 flex-wrap">
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                Clear
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !hasContextIds}>
                {isSubmitting ? "Saving..." : isEditing ? "Update Task" : "Add Task"}
              </Button>
            </JobDirectFormActionsRow>
          </form>
        </JobDirectMutedPanel>

        <JobDirectPlainPanel>
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            {/* Status tabs */}
            {[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "completed", label: "Completed" },
            ].map((tab) => {
              const isActive = taskFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTaskFilter(tab.id)}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? "bg-[#003882] text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Assignee filter */}
            <div className="ml-auto">
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="">All Assignees</option>
                {assigneeOptions.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <JobDirectTable minWidthClass="min-w-[700px]">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-2">Subject</th>
                  <th className="px-2 py-2">Due Date</th>
                  <th className="px-2 py-2">Assignee</th>
                  <th className="px-2 py-2">Details</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingTasks ? (
                  <JobDirectEmptyTableRow colSpan={6} message="Loading tasks..." />
                ) : visibleTasks.length ? (
                  visibleTasks.map((task) => {
                    const taskId = toString(task?.id);
                    const isBusy = Boolean(taskId) && activeTaskId === taskId;
                    const isCompleted = toString(task?.status).toLowerCase() === "completed";

                    return (
                      <tr key={taskId || `${task.subject}-${task.date_due}`} className="border-b border-slate-100">
                        <td className="px-2 py-3 align-middle text-slate-700">{toString(task?.subject) || "-"}</td>
                        <td className="px-2 py-3 align-middle">{formatDateForDisplay(task?.date_due)}</td>
                        <td className="px-2 py-3 align-middle">{getAssigneeName(task)}</td>
                        <td className="px-2 py-3 align-middle">{stripAssignedTo(toString(task?.details)) || "-"}</td>
                        <td className="px-2 py-3 align-middle">
                          <JobDirectStatusBadge
                            className={statusBadgeClass(task?.status)}
                            label={toString(task?.status) || "Pending"}
                          />
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <div className="flex flex-wrap justify-end gap-1">
                            <JobDirectIconActionButton
                              onClick={() => handleEditTask(task)}
                              disabled={isSubmitting || isBusy || !taskId || isCompleted}
                              aria-label="Edit task"
                              title="Edit Task"
                            >
                              <EditActionIcon />
                            </JobDirectIconActionButton>
                            <JobDirectIconActionButton
                              variant="success"
                              onClick={() => handleMarkComplete(task)}
                              disabled={isSubmitting || isBusy || isCompleted || !taskId}
                              aria-label="Mark task complete"
                              title={isCompleted ? "Already completed" : "Mark Complete"}
                            >
                              {isBusy ? (
                                <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                              ) : (
                                <CheckActionIcon />
                              )}
                            </JobDirectIconActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <JobDirectEmptyTableRow colSpan={6} message={emptyMessage} />
                )}
              </tbody>
          </JobDirectTable>
          {hasMoreTasks ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visibleTasks.length} of {filteredTasks.length} tasks
              </span>
              <Button type="button" variant="outline" onClick={showMoreTasks}>
                Load {Math.min(remainingTasksCount, 100)} more
              </Button>
            </div>
          ) : isTasksWindowed ? (
            <div className="mt-3 text-xs text-slate-500">
              Showing all {filteredTasks.length} tasks.
            </div>
          ) : null}
        </JobDirectPlainPanel>
      </div>
    </Modal>
  );
}
