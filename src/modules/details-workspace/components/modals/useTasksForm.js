import { useCallback, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  createTaskRecord,
  updateTaskRecord,
} from "../../api/core/runtime.js";
import {
  emptyFormState,
  formatDateForInput,
  parseAssignedTo,
  silentAssigneeId,
  stripAssignedTo,
  toString,
} from "./tasksModalUtils.js";

export function useTasksForm({
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
}) {
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyFormState);

  const isEditing = Boolean(form.id);

  const resetForm = useCallback(() => {
    setForm(emptyFormState());
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
        assignee_id: silentAssigneeId, // always from assignees.json, never shown
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
      setResolvedJobIdFromUid,
      additionalCreatePayload,
      additionalUpdatePayload,
      loadTasks,
      resetForm,
      success,
      error,
    ]
  );

  return {
    form,
    setForm,
    isSubmitting,
    setIsSubmitting,
    isEditing,
    resetForm,
    handleEditTask,
    handleSubmit,
  };
}
