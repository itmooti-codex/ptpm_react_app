import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { ColorSelectField } from "../../../../shared/components/ui/ColorSelectField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useJobDirectSelector, useJobDirectStoreActions } from "../../hooks/useJobDirectStore.jsx";
import { showMutationErrorToast } from "../../utils/mutationFeedback.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  EditActionIcon,
  EyeActionIcon,
  TrashActionIcon,
} from "../icons/ActionIcons.jsx";
import {
  JobDirectCardFormPanel,
  JobDirectCardTablePanel,
  JobDirectFormActionsRow,
  JobDirectSplitSection,
} from "../primitives/JobDirectLayout.jsx";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectStatusBadge,
  JobDirectTable,
  resolveStatusStyle,
  useRenderWindow,
} from "../primitives/JobDirectTable.jsx";
import { selectActivities } from "../../state/selectors.js";
import {
  ACTIVITY_OPTION_OPTIONS,
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_TASK_OPTIONS,
} from "../../constants/options.js";
import {
  createActivityRecord,
  deleteActivityRecord,
  fetchServicesForActivities,
  updateActivityRecord,
} from "../../sdk/core/runtime.js";

function toText(value) {
  return String(value ?? "").trim();
}

function toId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return normalized;
}

function normalizeActivityId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  return /^\d+$/.test(normalized) ? String(Number.parseInt(normalized, 10)) : normalized;
}

function formatDateForInput(value) {
  const text = toText(value);
  if (!text) return "";

  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      const parsed = new Date(asMs);
      if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    return `${ausMatch[3]}-${month}-${day}`;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value) {
  const inputDate = formatDateForInput(value);
  if (!inputDate) return "-";

  const parsed = new Date(`${inputDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return inputDate;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function parseTaskNumber(value) {
  const text = toText(value).toLowerCase();
  const match = text.match(/job\s*(\d+)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return Number.isFinite(number) ? number : null;
}

function parseOptionNumber(value) {
  const text = toText(value).toLowerCase();
  const match = text.match(/option\s*(\d+)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return Number.isFinite(number) ? number : null;
}

function buildComboKey(task, option) {
  const taskNumber = parseTaskNumber(task);
  const optionNumber = parseOptionNumber(option);
  if (!taskNumber || !optionNumber) return "";
  return `${taskNumber}:${optionNumber}`;
}

function normalizeServiceRecord(record = {}) {
  const id = toText(record?.id || record?.ID || record?.service_id || record?.Service_ID);
  const name = toText(
    record?.service_name ||
      record?.Service_Name ||
      record?.name ||
      record?.Service_Service_Name
  );
  if (!id || !name) return null;

  const parentId = toText(
    record?.primary_service_id || record?.Primary_Service_ID || record?.parentId
  );
  const rawType = toText(record?.service_type || record?.Service_Type || record?.type);
  const inferredType =
    /option/i.test(rawType) || (parentId && parentId !== id) ? "option" : "primary";

  return {
    id,
    name,
    type: inferredType,
    parentId,
    priceGuide: toText(record?.Price_Guide || record?.price_guide),
    price: toText(
      record?.service_price ||
        record?.Service_Price ||
        record?.price ||
        record?.Price ||
        record?.activity_price ||
        record?.Activity_Price
    ),
    warranty: toText(
      record?.standard_warranty ||
        record?.Standard_Warranty ||
        record?.warranty ||
        record?.Warranty
    ),
    description: toText(
      record?.service_description ||
        record?.Service_Description ||
        record?.description ||
        record?.Description
    ),
  };
}

function buildPrefilledActivityText(service = null) {
  const description = toText(service?.description);
  const priceGuide = toText(service?.priceGuide);
  if (!priceGuide) return description;
  return [description, "Price Guide", priceGuide].filter(Boolean).join("\n\n");
}

function defaultActivityForm() {
  return {
    id: "",
    task: "Job 1",
    option: "Option 1",
    primaryServiceId: "",
    optionServiceId: "",
    service_id: "",
    quantity: "1",
    activity_price: "",
    activity_status: "To Be Scheduled",
    date_required: "",
    activity_text: "",
    warranty: "",
    note: "",
    invoice_to_client: true,
    include_in_quote_subtotal: true,
    include_in_quote: false,
  };
}

function createFormFromActivity(activity = {}, serviceMap = new Map()) {
  const serviceId = toText(activity?.service_id || activity?.Service_ID);
  const matchedService = serviceMap.get(serviceId) || null;

  let primaryServiceId = "";
  let optionServiceId = "";
  if (matchedService?.type === "option" && matchedService?.parentId) {
    primaryServiceId = toText(matchedService.parentId);
    optionServiceId = matchedService.id;
  } else if (matchedService) {
    primaryServiceId = matchedService.id;
  }

  return {
    id: toText(activity?.id || activity?.ID),
    task: toText(activity?.task || activity?.Task),
    option: toText(activity?.option || activity?.Option),
    primaryServiceId,
    optionServiceId,
    service_id: serviceId,
    quantity: toText(activity?.quantity || activity?.Quantity || "1") || "1",
    activity_price: toText(activity?.activity_price || activity?.Activity_Price),
    activity_status:
      toText(
        activity?.activity_status ||
          activity?.Activity_Status ||
          activity?.status ||
          activity?.Status
      ) || "To Be Scheduled",
    date_required: formatDateForInput(activity?.date_required || activity?.Date_Required),
    activity_text: toText(activity?.activity_text || activity?.Activity_Text),
    warranty: toText(activity?.warranty || activity?.Warranty),
    note: toText(activity?.note || activity?.Note),
    invoice_to_client:
      activity?.invoice_to_client === true ||
      activity?.Invoice_to_Client === true ||
      toText(activity?.invoice_to_client ?? activity?.Invoice_to_Client).toLowerCase() === "true",
    include_in_quote_subtotal:
      activity?.include_in_quote_subtotal === true ||
      activity?.Include_in_Quote_Subtotal === true ||
      activity?.Include_In_Quote_Subtotal === true ||
      toText(activity?.include_in_quote_subtotal ?? activity?.Include_in_Quote_Subtotal ?? activity?.Include_In_Quote_Subtotal).toLowerCase() === "true",
    include_in_quote:
      activity?.include_in_quote === true ||
      activity?.Include_in_Quote === true ||
      activity?.Include_In_Quote === true ||
      toText(activity?.include_in_quote ?? activity?.Include_in_Quote ?? activity?.Include_In_Quote).toLowerCase() === "true",
  };
}

function CheckIndicator({ active }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
        active ? "border-[#003882] bg-[#003882] text-white" : "border-slate-300 bg-white"
      }`}
      aria-hidden="true"
    >
      {active ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 7L9 18L4 13"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

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
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const activities = useJobDirectSelector(selectActivities);
  const [services, setServices] = useState([]);
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

  const serviceById = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      map.set(service.id, service);
    });
    return map;
  }, [services]);

  const primaryServices = useMemo(
    () => services.filter((service) => service.type !== "option"),
    [services]
  );

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

  const secondaryOptions = useMemo(
    () =>
      services.filter(
        (service) => service.type === "option" && service.parentId === toText(form.primaryServiceId)
      ),
    [services, form.primaryServiceId]
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

  const primaryServiceByTask = useMemo(() => {
    const map = new Map();
    (activities || []).forEach((activity) => {
      const task = toText(activity?.task || activity?.Task);
      if (!task || map.has(task)) return;
      const rawServiceId = toText(activity?.service_id || activity?.Service_ID);
      if (!rawServiceId) return;
      const matched = serviceById.get(rawServiceId) || null;
      const primaryServiceId =
        matched?.type === "option" && matched?.parentId
          ? toText(matched.parentId)
          : rawServiceId;
      if (primaryServiceId) {
        map.set(task, primaryServiceId);
      }
    });
    return map;
  }, [activities, serviceById]);

  const applyPrimaryServiceSelection = useCallback(
    (previous, primaryServiceId) => {
      const normalizedPrimaryId = toText(primaryServiceId);
      const primaryService = serviceById.get(normalizedPrimaryId) || null;
      const optionCandidates = services.filter(
        (item) => item.type === "option" && item.parentId === normalizedPrimaryId
      );

      if (!normalizedPrimaryId) {
        return {
          ...previous,
          primaryServiceId: "",
          optionServiceId: "",
          service_id: "",
          activity_price: "",
          warranty: "",
          activity_text: "",
        };
      }

      if (optionCandidates.length) {
        const preferredOption =
          optionCandidates.find((item) => toText(item.id) === toText(previous.optionServiceId)) ||
          optionCandidates[0];
        return {
          ...previous,
          primaryServiceId: normalizedPrimaryId,
          optionServiceId: preferredOption.id,
          service_id: preferredOption.id,
          activity_price: toText(preferredOption.price),
          warranty: toText(preferredOption.warranty),
          activity_text: buildPrefilledActivityText(preferredOption),
        };
      }

      return {
        ...previous,
        primaryServiceId: normalizedPrimaryId,
        optionServiceId: "",
        service_id: primaryService?.id || normalizedPrimaryId,
        activity_price: toText(primaryService?.price),
        warranty: toText(primaryService?.warranty),
        activity_text: buildPrefilledActivityText(primaryService),
      };
    },
    [serviceById, services]
  );

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

  const resetForm = useCallback(() => {
    const fallback = nextValidCombinations[0] || { task: "Job 1", option: "Option 1" };
    setForm({
      ...defaultActivityForm(),
      task: toText(fallback.task) || "Job 1",
      option: toText(fallback.option) || "Option 1",
    });
  }, [nextValidCombinations]);

  const loadServices = useCallback(async () => {
    if (!plugin) {
      setServices([]);
      return;
    }
    try {
      const records = await fetchServicesForActivities({ plugin });
      const normalized = (Array.isArray(records) ? records : [])
        .map((item) => normalizeServiceRecord(item))
        .filter(Boolean);
      setServices(normalized);
    } catch (loadError) {
      console.error("[JobDirect] Failed to load services", loadError);
      showMutationErrorToast(error, {
        title: "Unable to load services",
        error: loadError,
        fallbackMessage: "Please try again.",
      });
    }
  }, [plugin, error]);

  useEffect(() => {
    if (!plugin || !jobId) return;
    loadServices();
  }, [plugin, jobId, loadServices]);

  const handlePrimaryServiceChange = useCallback(
    (event) => {
      const primaryServiceId = toText(event.target.value);
      setForm((previous) => applyPrimaryServiceSelection(previous, primaryServiceId));
    },
    [applyPrimaryServiceSelection]
  );

  const handleOptionServiceChange = useCallback(
    (event) => {
      const optionServiceId = toText(event.target.value);
      const optionService = serviceById.get(optionServiceId) || null;
      setForm((prev) => ({
        ...prev,
        optionServiceId,
        service_id: optionServiceId,
        activity_price: toText(optionService?.price),
        warranty: toText(optionService?.warranty),
        activity_text: buildPrefilledActivityText(optionService),
      }));
    },
    [serviceById]
  );

  const handleEdit = useCallback(
    (activity) => {
      setForm(createFormFromActivity(activity, serviceById));
    },
    [serviceById]
  );

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
        if (savedActivity) {
          storeActions.upsertEntityRecord("activities", savedActivity, { idField: "id" });
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
        if (savedActivity && typeof onActivitySaved === "function") {
          const enrichedActivity = toText(savedActivity.service_name)
            ? savedActivity
            : { ...savedActivity, service_name: toText(selectedService?.name || "") };
          onActivitySaved(enrichedActivity);
        }
        resetForm();
        if (typeof onSubmitSuccess === "function") {
          onSubmitSuccess(savedActivity || null);
        }
      } catch (submitError) {
        console.error("[JobDirect] Activity save failed", submitError);
        showMutationErrorToast(error, {
          title: isEditing ? "Update failed" : "Create failed",
          error: submitError,
          fallbackMessage: "Unable to save activity.",
        });
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
      onSubmitSuccess,
      resetForm,
      existingCombinationSet,
      nextValidCombinationSet,
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
  }, [deleteTarget, plugin, activities, form.id, resetForm, storeActions, success, error]);

  return (
    <>
      <JobDirectSplitSection dataSection="add-activities" className={(isTableOnlyLayout || isFormOnlyLayout) ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 xl:grid-cols-[440px_1fr]"}>
        {showFormPanel ? (
        <JobDirectCardFormPanel title={isEditing ? "Edit Activity" : "Add New Activity"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label="Task"
                data-field="task"
                value={form.task}
                onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
                options={taskOptions}
              />
              <SelectField
                label="Options"
                data-field="option"
                value={form.option}
                onChange={(event) => setForm((prev) => ({ ...prev, option: event.target.value }))}
                options={optionOptions}
              />
              <SelectField
                label="Primary Service"
                data-field="service_name"
                value={form.primaryServiceId}
                onChange={handlePrimaryServiceChange}
                options={primaryServices.map((service) => ({
                  value: service.id,
                  label: service.name,
                }))}
              />
              <InputField
                label="Quantity"
                data-field="quantity"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
              />
              {secondaryOptions.length ? (
                <SelectField
                  label="Option Service"
                  value={form.optionServiceId}
                  onChange={handleOptionServiceChange}
                  options={secondaryOptions.map((service) => ({
                    value: service.id,
                    label: service.name,
                  }))}
                />
              ) : (
                <div />
              )}
              <InputField
                label="Activity Price"
                data-field="activity_price"
                placeholder="$ 0.00"
                value={form.activity_price}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, activity_price: event.target.value }))
                }
              />
              <ColorSelectField
                label="Activity Status"
                data-field="activity_status"
                value={form.activity_status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, activity_status: event.target.value }))
                }
                options={ACTIVITY_STATUS_OPTIONS}
              />
              <InputField
                label="Date Required"
                type="date"
                data-field="date_required"
                value={form.date_required}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, date_required: event.target.value }))
                }
              />
            </div>

            <TextareaField
              label="Activity Text"
              rows={2}
              data-field="activity_text"
              value={form.activity_text}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, activity_text: event.target.value }))
              }
            />
            <TextareaField
              label="Warranty"
              rows={2}
              data-field="warranty"
              value={form.warranty}
              onChange={(event) => setForm((prev) => ({ ...prev, warranty: event.target.value }))}
            />
            <TextareaField
              label="Note"
              rows={2}
              data-field="note"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />

            <div className="grid grid-cols-1 gap-2">
              <CheckboxField
                data-field="invoice_to_client"
                label="Invoice to client"
                checked={form.invoice_to_client}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, invoice_to_client: event.target.checked }))
                }
              />
              <CheckboxField
                data-field="include_in_quote_subtotal"
                label="Include in quote subtotal"
                checked={form.include_in_quote_subtotal}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    include_in_quote_subtotal: event.target.checked,
                  }))
                }
              />
              <CheckboxField
                data-field="include_in_quote"
                label="Include in quote"
                checked={form.include_in_quote}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, include_in_quote: event.target.checked }))
                }
              />
            </div>

            <JobDirectFormActionsRow>
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isEditing ? "Update" : "Add"}
              </Button>
            </JobDirectFormActionsRow>
          </form>
        </JobDirectCardFormPanel>
        ) : null}

        {showTablePanel ? (
        <JobDirectCardTablePanel className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="type-subheadline text-slate-800">Activities</div>
            {isTableOnlyLayout && typeof onRequestCreate === "function" ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="h-8 whitespace-nowrap px-3 text-xs"
                onClick={() => onRequestCreate()}
              >
                Add Activity
              </Button>
            ) : null}
          </div>
          <JobDirectTable className="table-fixed" minWidthClass="min-w-[920px]">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-[11%] px-2 py-2">Task</th>
                  <th className="w-[11%] px-2 py-2">Option</th>
                  <th className="w-[19%] px-2 py-2">Services</th>
                  <th className="w-[16%] px-2 py-2">Status</th>
                  <th className="w-[11%] px-2 py-2">Price</th>
                  <th className="w-[12%] px-2 py-2">Invoice to Client</th>
                  <th className="w-[20%] px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleActivities.length ? (
                  visibleActivities.map((activity) => {
                    const activityId = toText(activity?.id || activity?.ID);
                    const normalizedActivityId = normalizeActivityId(activityId);
                    const status = toText(
                      activity?.activity_status || activity?.Activity_Status || activity?.status
                    );
                    const style = resolveStatusStyle(status, ACTIVITY_STATUS_OPTIONS);
                    const isBusy = Boolean(activityId) && activeActionId === activityId;
                    const isHighlighted =
                      Boolean(normalizedHighlightActivityId) &&
                      normalizedActivityId === normalizedHighlightActivityId;
                    return (
                      <tr
                        key={activityId || `${activity.task}-${activity.option}`}
                        data-ann-kind="activity"
                        data-ann-id={normalizedActivityId || activityId}
                        data-ann-highlighted={isHighlighted ? "true" : "false"}
                        className={`border-b border-slate-100 ${
                          isHighlighted ? "bg-amber-50" : ""
                        }`}
                      >
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(activity?.task) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(activity?.option) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(activity?.service_name) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <JobDirectStatusBadge label={status || "-"} style={style} />
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {formatCurrency(activity?.activity_price)}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <div className="flex justify-center">
                            <CheckIndicator
                              active={
                                activity?.invoice_to_client === true ||
                                toText(activity?.invoice_to_client).toLowerCase() === "true"
                              }
                            />
                          </div>
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <div className="flex justify-end gap-1">
                            <JobDirectIconActionButton
                              onClick={() => setViewActivity(activity)}
                              title="View Activity"
                            >
                              <EyeActionIcon />
                            </JobDirectIconActionButton>
                            <JobDirectIconActionButton
                              onClick={() => {
                                if (isTableOnlyLayout && typeof onRequestEdit === "function") {
                                  onRequestEdit(activity);
                                  return;
                                }
                                handleEdit(activity);
                              }}
                              disabled={isSubmitting || isBusy}
                              title="Edit Activity"
                            >
                              <EditActionIcon />
                            </JobDirectIconActionButton>
                            <JobDirectIconActionButton
                              variant="danger"
                              onClick={() => setDeleteTarget(activity)}
                              disabled={isSubmitting || isBusy}
                              title="Delete Activity"
                            >
                              <TrashActionIcon />
                            </JobDirectIconActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <JobDirectEmptyTableRow colSpan={7} message="No activities found." />
                )}
              </tbody>
          </JobDirectTable>
          {hasMoreActivities ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visibleActivities.length} of {activities.length} activities
              </span>
              <Button type="button" variant="outline" onClick={showMoreActivities}>
                Load {Math.min(remainingActivitiesCount, 120)} more
              </Button>
            </div>
          ) : isActivitiesWindowed ? (
            <div className="mt-3 text-xs text-slate-500">
              Showing all {activities.length} activities.
            </div>
          ) : null}
        </JobDirectCardTablePanel>
        ) : null}
      </JobDirectSplitSection>

      <Modal
        open={Boolean(viewActivity)}
        onClose={() => setViewActivity(null)}
        title="Activity Details"
        widthClass="max-w-3xl"
      >
        {viewActivity ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Task:</span> {toText(viewActivity.task) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Option:</span> {toText(viewActivity.option) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Service:</span> {toText(viewActivity.service_name) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Status:</span>{" "}
              {toText(viewActivity.activity_status || viewActivity.status) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Date Required:</span>{" "}
              {formatDateForDisplay(viewActivity.date_required)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Price:</span>{" "}
              {formatCurrency(viewActivity.activity_price)}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Activity Text:</span>{" "}
              {toText(viewActivity.activity_text) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Warranty:</span>{" "}
              {toText(viewActivity.warranty) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Note:</span> {toText(viewActivity.note) || "-"}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (activeActionId) return;
          setDeleteTarget(null);
        }}
        title="Delete Activity?"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(activeActionId)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={Boolean(activeActionId)}
            >
              {activeActionId ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this activity?
        </p>
      </Modal>
    </>
  );
}
