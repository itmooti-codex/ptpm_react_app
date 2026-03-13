import { useCallback, useEffect, useMemo, useState } from "react";
import { useDetailsWorkspaceSelector } from "../../hooks/useDetailsWorkspaceStore.jsx";
import { JobDirectSplitSection } from "../primitives/WorkspaceLayoutPrimitives.jsx";
import { useRenderWindow } from "../primitives/WorkspaceTablePrimitives.jsx";
import { selectActivities } from "../../state/selectors.js";
import {
  ACTIVITY_OPTION_OPTIONS,
  ACTIVITY_TASK_OPTIONS,
} from "../../constants/options.js";
import { toText } from "@shared/utils/formatters.js";
import {
  normalizeActivityId,
  parseOptionNumber,
  defaultActivityForm,
  createFormFromActivity,
} from "./activitiesUtils.js";
import { useActivitiesServices } from "./useActivitiesServices.js";
import {
  useActivitiesCombinations,
  useActivitiesCrud,
  makeResetForm,
} from "./useActivitiesCrud.js";
import { ActivitiesFormPanel } from "./ActivitiesFormPanel.jsx";
import { ActivitiesTablePanel } from "./ActivitiesTablePanel.jsx";

export function AddActivitiesSection({
  plugin,
  jobData,
  highlightActivityId = "",
  layoutMode = "split",
  mode = "create",
  editingActivityId = "",
  onRequestCreate = null,
  onRequestEdit = null,
  onSubmitSuccess = null,
  onActivitySaved = null,
}) {
  const jobId = toText(jobData?.id || jobData?.ID);
  const inquiryId = toText(jobData?.inquiry_record_id || jobData?.Inquiry_Record_ID);
  const activities = useDetailsWorkspaceSelector(selectActivities);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeActionId, setActiveActionId] = useState("");
  const [viewActivity, setViewActivity] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(defaultActivityForm);

  const normalizedHighlightActivityId = useMemo(
    () => normalizeActivityId(highlightActivityId),
    [highlightActivityId]
  );

  const resolvedLayoutMode = String(layoutMode || "split").trim().toLowerCase();
  const isTableOnlyLayout = resolvedLayoutMode === "table";
  const isFormOnlyLayout = resolvedLayoutMode === "form";
  const showFormPanel = !isTableOnlyLayout;
  const showTablePanel = !isFormOnlyLayout;

  const {
    hasMore: hasMoreActivities,
    remainingCount: remainingActivitiesCount,
    showMore: showMoreActivities,
    shouldWindow: isActivitiesWindowed,
    visibleRows: visibleActivities,
  } = useRenderWindow(activities, {
    threshold: 180,
    pageSize: 120,
  });

  // Services
  const {
    services,
    serviceById,
    primaryServices,
    primaryServiceByTask,
    applyPrimaryServiceSelection,
    handlePrimaryServiceChange: getPrimaryServiceId,
    handleOptionServiceChange: getOptionServiceFields,
    loadServices,
  } = useActivitiesServices({ plugin, activities });

  const secondaryOptions = useMemo(
    () =>
      services.filter(
        (service) => service.type === "option" && service.parentId === toText(form.primaryServiceId)
      ),
    [services, form.primaryServiceId]
  );

  // Combinations
  const {
    existingCombinationSet,
    nextValidCombinations,
    nextOptionsByTask,
    nextValidCombinationSet,
    allowedTaskValues,
  } = useActivitiesCombinations({ activities });

  const resetForm = useCallback(
    makeResetForm({ nextValidCombinations, setForm }),
    [nextValidCombinations]
  );

  const isEditing = Boolean(form.id);

  const taskOptions = useMemo(() => {
    if (isEditing) return ACTIVITY_TASK_OPTIONS;
    const filtered = ACTIVITY_TASK_OPTIONS.filter((item) =>
      allowedTaskValues.has(toText(item.value))
    );
    return filtered.length ? filtered : ACTIVITY_TASK_OPTIONS;
  }, [allowedTaskValues, isEditing]);

  const optionOptions = useMemo(() => {
    if (isEditing) return ACTIVITY_OPTION_OPTIONS;
    const validForTask = nextOptionsByTask.get(toText(form.task));
    if (!validForTask || !validForTask.size) {
      return ACTIVITY_OPTION_OPTIONS;
    }
    const filtered = ACTIVITY_OPTION_OPTIONS.filter((item) =>
      validForTask.has(toText(item.value))
    );
    return filtered.length ? filtered : ACTIVITY_OPTION_OPTIONS;
  }, [form.task, isEditing, nextOptionsByTask]);

  // CRUD
  const { handleSubmit: runSubmit, handleDelete } = useActivitiesCrud({
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
  });

  const handleSubmit = useCallback(
    async (event) => {
      const resolvedActivity = await runSubmit(event);
      if (resolvedActivity) {
        if (typeof onActivitySaved === "function") {
          onActivitySaved(resolvedActivity);
        }
        resetForm();
        if (typeof onSubmitSuccess === "function") {
          onSubmitSuccess(resolvedActivity);
        }
      }
    },
    [runSubmit, onActivitySaved, onSubmitSuccess, resetForm]
  );

  const handleEdit = useCallback(
    (activity) => {
      setForm(createFormFromActivity(activity, serviceById));
    },
    [serviceById]
  );

  const handlePrimaryServiceChange = useCallback(
    (event) => {
      const primaryServiceId = getPrimaryServiceId(event);
      setForm((previous) => applyPrimaryServiceSelection(previous, primaryServiceId));
    },
    [getPrimaryServiceId, applyPrimaryServiceSelection]
  );

  const handleOptionServiceChange = useCallback(
    (event) => {
      const optionServiceId = toText(event.target.value);
      const fields = getOptionServiceFields(optionServiceId);
      setForm((prev) => ({ ...prev, ...fields }));
    },
    [getOptionServiceFields]
  );

  // Scroll highlight into view
  useEffect(() => {
    if (!normalizedHighlightActivityId || !hasMoreActivities) return;
    const hasVisibleHighlightedRow = visibleActivities.some((activity) => {
      const activityId = toText(activity?.id || activity?.ID);
      return normalizeActivityId(activityId) === normalizedHighlightActivityId;
    });
    if (hasVisibleHighlightedRow) return;
    showMoreActivities();
  }, [
    normalizedHighlightActivityId,
    hasMoreActivities,
    visibleActivities,
    showMoreActivities,
  ]);

  useEffect(() => {
    if (!normalizedHighlightActivityId) return;
    const timeoutId = window.setTimeout(() => {
      const matches = Array.from(document.querySelectorAll('[data-ann-kind="activity"]'));
      const target = matches.find(
        (node) =>
          String(node?.getAttribute("data-ann-id") || "").trim() ===
          normalizedHighlightActivityId
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedHighlightActivityId, visibleActivities.length]);

  // Auto-update task/option when combination list changes
  useEffect(() => {
    if (isEditing) return;
    if (!nextValidCombinations.length) return;

    const fallback = nextValidCombinations[0];
    setForm((previous) => {
      const currentTask = toText(previous.task);
      const currentOption = toText(previous.option);
      const nextTask = allowedTaskValues.has(currentTask)
        ? currentTask
        : toText(fallback.task);
      const validOptions = nextOptionsByTask.get(nextTask) || new Set();
      const nextOption = validOptions.has(currentOption)
        ? currentOption
        : toText(Array.from(validOptions)[0] || fallback.option);
      if (nextTask === currentTask && nextOption === currentOption) return previous;
      return {
        ...previous,
        task: nextTask,
        option: nextOption,
      };
    });
  }, [allowedTaskValues, isEditing, nextOptionsByTask, nextValidCombinations]);

  // Inherit primary service from task when option > 1
  useEffect(() => {
    if (isEditing) return;
    const optionNumber = parseOptionNumber(form.option);
    if (!optionNumber || optionNumber <= 1) return;
    const inheritedPrimaryServiceId = primaryServiceByTask.get(toText(form.task));
    if (!inheritedPrimaryServiceId || toText(form.primaryServiceId)) return;
    setForm((previous) => applyPrimaryServiceSelection(previous, inheritedPrimaryServiceId));
  }, [
    applyPrimaryServiceSelection,
    form.option,
    form.primaryServiceId,
    form.task,
    isEditing,
    primaryServiceByTask,
  ]);

  // Load services on mount
  useEffect(() => {
    if (!plugin || !jobId) return;
    loadServices();
  }, [plugin, jobId, loadServices]);

  // Sync form when in form-only layout
  useEffect(() => {
    if (!isFormOnlyLayout) return;
    const normalizedEditingId = normalizeActivityId(editingActivityId);
    if (String(mode || "").trim().toLowerCase() === "update" && normalizedEditingId) {
      const matched = (activities || []).find(
        (activity) => normalizeActivityId(activity?.id || activity?.ID) === normalizedEditingId
      );
      if (matched) {
        setForm(createFormFromActivity(matched, serviceById));
      }
      return;
    }
    resetForm();
  }, [activities, editingActivityId, isFormOnlyLayout, mode, resetForm, serviceById]);

  return (
    <>
      <JobDirectSplitSection
        dataSection="add-activities"
        className={
          isTableOnlyLayout || isFormOnlyLayout
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 gap-4 xl:grid-cols-[440px_1fr]"
        }
      >
        {showFormPanel ? (
          <ActivitiesFormPanel
            form={form}
            setForm={setForm}
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            taskOptions={taskOptions}
            optionOptions={optionOptions}
            primaryServices={primaryServices}
            secondaryOptions={secondaryOptions}
            handlePrimaryServiceChange={handlePrimaryServiceChange}
            handleOptionServiceChange={handleOptionServiceChange}
            handleSubmit={handleSubmit}
            resetForm={resetForm}
          />
        ) : null}

        {showTablePanel ? (
          <ActivitiesTablePanel
            activities={activities}
            visibleActivities={visibleActivities}
            hasMoreActivities={hasMoreActivities}
            remainingActivitiesCount={remainingActivitiesCount}
            isActivitiesWindowed={isActivitiesWindowed}
            showMoreActivities={showMoreActivities}
            normalizedHighlightActivityId={normalizedHighlightActivityId}
            isTableOnlyLayout={isTableOnlyLayout}
            isSubmitting={isSubmitting}
            activeActionId={activeActionId}
            viewActivity={viewActivity}
            setViewActivity={setViewActivity}
            deleteTarget={deleteTarget}
            setDeleteTarget={setDeleteTarget}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            onRequestCreate={onRequestCreate}
            onRequestEdit={onRequestEdit}
          />
        ) : null}
      </JobDirectSplitSection>
    </>
  );
}
