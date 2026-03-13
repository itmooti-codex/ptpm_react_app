import { useEffect, useMemo, useRef } from "react";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../../hooks/useDetailsWorkspaceStore.jsx";
import { selectAppointments } from "../../../state/selectors.js";
import {
  fetchAppointmentsByJobId,
  fetchAppointmentsByInquiryUid,
} from "../../../api/core/runtime.js";
import { useRenderWindow } from "../../primitives/WorkspaceTablePrimitives.jsx";
import { useAppointmentLookups } from "./useAppointmentLookups.js";
import { useAppointmentCrud } from "./useAppointmentCrud.js";
import {
  normalizeAppointmentValue,
  parseAppointmentDateInputToUnix,
} from "./appointmentTabHelpers.js";

export function useAppointmentOperations({
  plugin,
  jobData,
  preloadedLookupData,
  onCountChange,
  inquiryRecordId,
  inquiryUid,
  highlightAppointmentId,
  // form hook outputs:
  draftState,
  setDraftState,
  isCreating,
  setIsCreating,
  updatingId,
  setUpdatingId,
  deleteTarget,
  setDeleteTarget,
  isDeleting,
  setIsDeleting,
  normalizeTextValue,
  normalizeIdValue,
  normalizedPrefill,
  applyPrefillToState,
  normalizeDraftState,
  resetForm,
  computeDurationMinutes,
  defaultEventColor,
  emptyForm,
  form,
  forcedMode,
  resolvedEditingId,
  isEditMode,
  shouldHideStatusFieldInForm,
  editingAppointmentId,
  onSubmitSuccess,
  onDraftChange,
  draft,
  sectionRef,
  formatDateTimeLocalInput,
  deriveDurationFromRecord,
  // toast
  success,
  error,
}) {
  const storeActions = useJobDirectStoreActions();
  const appointments = useJobDirectSelector(selectAppointments);

  const jobId = useMemo(
    () => normalizeIdValue(jobData?.id || jobData?.ID || ""),
    [jobData, normalizeIdValue]
  );
  const inquiryUidValue = useMemo(() => String(inquiryUid || "").trim(), [inquiryUid]);
  const dealId = useMemo(
    () => normalizeIdValue(inquiryRecordId),
    [inquiryRecordId, normalizeIdValue]
  );

  const normalizedHighlightAppointmentId = useMemo(() => {
    const value = normalizeIdValue(highlightAppointmentId);
    return value == null ? "" : String(value).trim();
  }, [highlightAppointmentId, normalizeIdValue]);

  const {
    hasMore: hasMoreAppointments,
    remainingCount: remainingAppointmentsCount,
    showMore: showMoreAppointments,
    shouldWindow: isAppointmentsWindowed,
    visibleRows: visibleAppointments,
  } = useRenderWindow(appointments, {
    threshold: 180,
    pageSize: 120,
  });

  const lastDraftJsonRef = useRef(JSON.stringify(normalizeDraftState(draft)));

  const editingRecordStatusValue = useMemo(() => {
    if (!isEditMode) return "";
    const targetId = normalizeTextValue(resolvedEditingId);
    if (!targetId) return "";
    const matchedRecord = (Array.isArray(appointments) ? appointments : []).find(
      (record) => normalizeTextValue(record?.id || record?.ID) === targetId
    );
    return normalizeTextValue(matchedRecord?.status);
  }, [appointments, isEditMode, normalizeTextValue, resolvedEditingId]);

  const lookups = useAppointmentLookups({
    plugin,
    preloadedLookupData,
    normalizedPrefill,
    normalizeTextValue,
    form,
    defaultEventColor,
    emptyForm,
    formatDateTimeLocalInput,
    deriveDurationFromRecord,
    setDraftState,
  });

  const crud = useAppointmentCrud({
    plugin,
    jobId,
    inquiryUidValue,
    dealId,
    form,
    isEditMode,
    resolvedEditingId,
    shouldHideStatusFieldInForm,
    editingRecordStatusValue,
    defaultEventColor,
    normalizeTextValue,
    normalizeIdValue,
    normalizeAppointmentValue,
    computeDurationMinutes,
    parseAppointmentDateInputToUnix,
    resetForm,
    setIsCreating,
    setUpdatingId,
    setDeleteTarget,
    setIsDeleting,
    deleteTarget,
    isDeleting,
    appointments,
    storeActions,
    onSubmitSuccess,
    success,
    error,
    setDraftState,
  });

  // Highlight scroll effect
  useEffect(() => {
    if (!normalizedHighlightAppointmentId || !hasMoreAppointments) return;
    const hasVisibleHighlightedRow = visibleAppointments.some(
      (record) =>
        String(record?.id || record?.ID || "").trim() === normalizedHighlightAppointmentId
    );
    if (hasVisibleHighlightedRow) return;
    showMoreAppointments();
  }, [
    normalizedHighlightAppointmentId,
    hasMoreAppointments,
    visibleAppointments,
    showMoreAppointments,
  ]);

  // Focus/scroll effect
  useEffect(() => {
    if (!normalizedHighlightAppointmentId) return;
    const timeoutId = window.setTimeout(() => {
      const root = sectionRef.current;
      if (!root) return;
      const matches = Array.from(root.querySelectorAll('[data-ann-kind="appointment"]'));
      const target = matches.find(
        (node) =>
          String(node?.getAttribute("data-ann-id") || "").trim() ===
          normalizedHighlightAppointmentId
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedHighlightAppointmentId, sectionRef, visibleAppointments.length]);

  // Data fetch effect
  useEffect(() => {
    if (!plugin) return undefined;

    const hasJobContext = jobId !== null && jobId !== undefined && String(jobId).trim() !== "";
    const hasInquiryContext = !hasJobContext && Boolean(inquiryUidValue);
    if (!hasJobContext && !hasInquiryContext) return undefined;

    let isActive = true;
    const request = hasJobContext
      ? fetchAppointmentsByJobId({ plugin, jobId })
      : fetchAppointmentsByInquiryUid({ plugin, inquiryUid: inquiryUidValue });

    request
      .then((records) => {
        if (!isActive) return;
        storeActions.replaceEntityCollection("appointments", records || []);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        const contextLabel = hasJobContext ? "job" : "inquiry";
        console.error(`[JobDirect] Failed loading ${contextLabel} appointments`, fetchError);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, jobId, inquiryUidValue, storeActions]);

  // Count change effect
  useEffect(() => {
    onCountChange?.(appointments.length);
  }, [appointments.length, onCountChange]);

  // Draft sync effect (parent → local)
  useEffect(() => {
    if (draft === undefined || draft === null) return;
    const normalized = normalizeDraftState(draft);
    const nextJson = JSON.stringify(normalized);
    if (nextJson === lastDraftJsonRef.current) return;
    lastDraftJsonRef.current = nextJson;
    setDraftState(normalized);
  }, [draft, normalizeDraftState, setDraftState]);

  // Parent notification effect (local → parent)
  useEffect(() => {
    const nextJson = JSON.stringify(draftState);
    if (nextJson === lastDraftJsonRef.current) return;
    lastDraftJsonRef.current = nextJson;
    onDraftChange?.(draftState);
  }, [draftState, onDraftChange]);

  // Prefill sync effect
  useEffect(() => {
    setDraftState((previous) => {
      const activeEditing =
        forcedMode === "create"
          ? ""
          : normalizeTextValue(editingAppointmentId || previous.editingAppointmentId);
      if (activeEditing) return previous;
      return applyPrefillToState(previous);
    });
  }, [applyPrefillToState, editingAppointmentId, forcedMode, normalizeTextValue, setDraftState]);

  return {
    appointments,
    storeActions,
    jobId,
    inquiryUidValue,
    dealId,
    normalizedHighlightAppointmentId,
    hasMoreAppointments,
    remainingAppointmentsCount,
    showMoreAppointments,
    isAppointmentsWindowed,
    visibleAppointments,
    ...lookups,
    ...crud,
  };
}
