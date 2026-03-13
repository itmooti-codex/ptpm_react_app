import { useCallback, useMemo } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useDetailsWorkspaceStoreActions } from "../../hooks/useDetailsWorkspaceStore.jsx";
import { showMutationErrorToast } from "../../utils/mutationFeedback.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  createActivityRecord,
  deleteActivityRecord,
  updateActivityRecord,
} from "../../api/core/runtime.js";
import { formatActivityServiceLabel } from "@shared/utils/formatters.js";
import {
  ACTIVITY_TASK_OPTIONS,
  ACTIVITY_OPTION_OPTIONS,
} from "../../constants/options.js";
import { toText } from "@shared/utils/formatters.js";
import {
  toId,
  buildComboKey,
  parseTaskNumber,
  parseOptionNumber,
  defaultActivityForm,
} from "./activitiesUtils.js";

export function useActivitiesCombinations({ activities }) {
  const existingCombinationSet = useMemo(() => {
    const combinations = new Set();
    (activities || []).forEach((activity) => {
      const task = toText(activity?.task || activity?.Task);
      const option = toText(activity?.option || activity?.Option);
      const key = buildComboKey(task, option);
      if (key) combinations.add(key);
    });
    return combinations;
  }, [activities]);

  const nextValidCombinations = useMemo(() => {
    const maxTaskCount = ACTIVITY_TASK_OPTIONS.length;
    const maxOptionCount = ACTIVITY_OPTION_OPTIONS.length;
    const optionsByTask = new Map();

    (activities || []).forEach((activity) => {
      const task = toText(activity?.task || activity?.Task);
      const option = toText(activity?.option || activity?.Option);
      const taskNumber = parseTaskNumber(task);
      const optionNumber = parseOptionNumber(option);
      if (!taskNumber || !optionNumber) return;
      const usedOptions = optionsByTask.get(taskNumber) || new Set();
      usedOptions.add(optionNumber);
      optionsByTask.set(taskNumber, usedOptions);
    });

    if (!optionsByTask.size) {
      return [{ task: "Job 1", option: "Option 1" }];
    }

    const combinations = [];
    const sortedTaskNumbers = Array.from(optionsByTask.keys()).sort((a, b) => a - b);
    sortedTaskNumbers.forEach((taskNumber) => {
      const usedOptions = optionsByTask.get(taskNumber) || new Set();
      let nextOption = 1;
      while (nextOption <= maxOptionCount && usedOptions.has(nextOption)) {
        nextOption += 1;
      }
      if (nextOption <= maxOptionCount) {
        combinations.push({
          task: `Job ${taskNumber}`,
          option: `Option ${nextOption}`,
        });
      }
    });

    const highestTaskNumber = sortedTaskNumbers[sortedTaskNumbers.length - 1] || 0;
    const nextTaskNumber = highestTaskNumber + 1;
    if (nextTaskNumber <= maxTaskCount) {
      combinations.push({
        task: `Job ${nextTaskNumber}`,
        option: "Option 1",
      });
    }

    const deduped = [];
    const seen = new Set();
    combinations.forEach((combination) => {
      const key = buildComboKey(combination.task, combination.option);
      if (!key || seen.has(key) || existingCombinationSet.has(key)) return;
      seen.add(key);
      deduped.push(combination);
    });
    return deduped.length ? deduped : [{ task: "Job 1", option: "Option 1" }];
  }, [activities, existingCombinationSet]);

  const nextOptionsByTask = useMemo(() => {
    const map = new Map();
    nextValidCombinations.forEach((combination) => {
      const task = toText(combination.task);
      const option = toText(combination.option);
      if (!task || !option) return;
      const set = map.get(task) || new Set();
      set.add(option);
      map.set(task, set);
    });
    return map;
  }, [nextValidCombinations]);

  const nextValidCombinationSet = useMemo(
    () =>
      new Set(
        nextValidCombinations
          .map((combination) => buildComboKey(combination.task, combination.option))
          .filter(Boolean)
      ),
    [nextValidCombinations]
  );

  const allowedTaskValues = useMemo(
    () => new Set(nextValidCombinations.map((item) => toText(item.task)).filter(Boolean)),
    [nextValidCombinations]
  );

  return {
    existingCombinationSet,
    nextValidCombinations,
    nextOptionsByTask,
    nextValidCombinationSet,
    allowedTaskValues,
  };
}

export function useActivitiesCrud({
  plugin,
  jobId,
  inquiryId,
  activities,
  form,
  isEditing,
  resetForm,
  existingCombinationSet,
  nextValidCombinationSet,
  serviceById,
  setIsSubmitting,
  setActiveActionId,
  setDeleteTarget,
  deleteTarget,
  activeActionId,
}) {
  const { success, error } = useToast();
  const storeActions = useDetailsWorkspaceStoreActions();

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!plugin) {
        error("SDK unavailable", "Please wait for SDK initialization.");
        return;
      }
      if (!jobId) {
        error("Create failed", "Job does not exist.");
        return;
      }

      const normalizedTask = toText(form.task);
      const normalizedOption = toText(form.option);
      if (!normalizedTask || !normalizedOption) {
        error("Missing fields", "Task and option are required.");
        return;
      }

      const combinationKey = buildComboKey(normalizedTask, normalizedOption);
      if (!isEditing && combinationKey && existingCombinationSet.has(combinationKey)) {
        error(
          "Duplicate not allowed",
          `${normalizedTask} / ${normalizedOption} already exists.`
        );
        return;
      }
      if (
        !isEditing &&
        combinationKey &&
        nextValidCombinationSet.size &&
        !nextValidCombinationSet.has(combinationKey)
      ) {
        error(
          "Invalid sequence",
          "Choose one of the next available Job/Option combinations."
        );
        return;
      }

      const selectedServiceId = toText(form.optionServiceId || form.primaryServiceId || form.service_id);
      const selectedService = serviceById.get(selectedServiceId) || null;
      const selectedPrimaryService =
        selectedService?.parentId
          ? serviceById.get(toText(selectedService.parentId)) || null
          : null;
      const payload = {
        job_id: toId(jobId),
        task: normalizedTask,
        option: normalizedOption,
        quantity: toText(form.quantity) || "1",
        service_id: selectedServiceId ? toId(selectedServiceId) : "",
        warranty: toText(form.warranty),
        activity_text: toText(form.activity_text),
        date_required: toText(form.date_required),
        activity_price: toText(form.activity_price),
        activity_status: toText(form.activity_status) || "To Be Scheduled",
        include_in_quote: Boolean(form.include_in_quote),
        include_in_quote_subtotal: Boolean(form.include_in_quote_subtotal),
        invoice_to_client: Boolean(form.invoice_to_client),
        note: toText(form.note),
      };

      setIsSubmitting(true);
      try {
        let savedActivity = null;
        if (isEditing) {
          savedActivity = await updateActivityRecord({
            plugin,
            id: toId(form.id),
            payload,
          });
          success("Activity updated", "Activity changes have been saved.");
        } else {
          savedActivity = await createActivityRecord({ plugin, payload });
          success("Activity added", "New activity created successfully.");
        }
        const resolvedActivity = savedActivity
          ? (
              formatActivityServiceLabel(savedActivity)
                ? savedActivity
                : {
                    ...savedActivity,
                    service_name: toText(selectedService?.name || ""),
                    primary_service_name: toText(selectedPrimaryService?.name || ""),
                  }
            )
          : null;
        if (savedActivity) {
          storeActions.upsertEntityRecord("activities", resolvedActivity, { idField: "id" });
          if (!isEditing) {
            const activityId = toText(savedActivity?.id || savedActivity?.ID);
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.ACTIVITY_ADDED,
              quoteJobId: jobId,
              inquiryId,
              focusId: activityId,
              dedupeEntityId: activityId || `${jobId}:${toText(form.task)}`,
              title: "New activity added",
              content: toText(form.task) || "A new activity was added.",
              logContext: "job-direct:AddActivitiesSection:handleSubmit",
            });
          }
        }
        return resolvedActivity;
      } catch (submitError) {
        console.error("[JobDirect] Activity save failed", submitError);
        showMutationErrorToast(error, {
          title: isEditing ? "Update failed" : "Create failed",
          error: submitError,
          fallbackMessage: "Unable to save activity.",
        });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      plugin,
      jobId,
      inquiryId,
      form,
      isEditing,
      storeActions,
      success,
      error,
      existingCombinationSet,
      nextValidCombinationSet,
      serviceById,
      setIsSubmitting,
    ]
  );

  const handleDelete = useCallback(async () => {
    const targetId = toText(deleteTarget?.id);
    if (!targetId || !plugin) return;

    setActiveActionId(targetId);
    try {
      const deletedId = await deleteActivityRecord({ plugin, id: toId(targetId) });
      success("Activity deleted", "Activity has been removed.");
      const normalizedDeletedId = toText(deletedId || targetId);
      const nextActivities = (activities || []).filter(
        (item) => toText(item?.id || item?.ID) !== normalizedDeletedId
      );
      storeActions.replaceEntityCollection("activities", nextActivities);
      if (toText(form.id) === targetId) resetForm();
    } catch (deleteError) {
      console.error("[JobDirect] Failed to delete activity", deleteError);
      showMutationErrorToast(error, {
        title: "Delete failed",
        error: deleteError,
        fallbackMessage: "Unable to delete activity.",
      });
    } finally {
      setActiveActionId("");
      setDeleteTarget(null);
    }
  }, [deleteTarget, plugin, activities, form.id, resetForm, storeActions, success, error, setActiveActionId, setDeleteTarget]);

  return { handleSubmit, handleDelete };
}

export function makeResetForm({ nextValidCombinations, setForm }) {
  return function resetForm() {
    const fallback = nextValidCombinations[0] || { task: "Job 1", option: "Option 1" };
    setForm({
      ...defaultActivityForm(),
      task: toText(fallback.task) || "Job 1",
      option: toText(fallback.option) || "Option 1",
    });
  };
}
