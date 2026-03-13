import { useCallback, useMemo, useState } from "react";
import {
  APPOINTMENT_EVENT_COLOR_OPTIONS,
} from "../../../constants/options.js";

export function useAppointmentForm({
  draft,
  prefillContext,
  mode,
  editingAppointmentId,
  onResetDraft,
  hideStatusFieldInForm,
  layoutMode,
}) {
  const normalizeTextValue = useCallback((value) => String(value || "").trim(), []);

  const defaultEventColor = useMemo(
    () => String(APPOINTMENT_EVENT_COLOR_OPTIONS[0]?.value || "1").trim(),
    []
  );

  const emptyForm = useMemo(
    () => ({
      status: "New",
      type: "select none",
      title: "",
      start_time: "",
      description: "",
      location_id: "",
      host_id: "",
      primary_guest_contact_id: "",
      event_color: defaultEventColor,
      duration_hours: "0",
      duration_minutes: "0",
    }),
    [defaultEventColor]
  );

  const buildEmptyDraftState = useCallback(
    () => ({
      form: { ...emptyForm },
      locationQuery: "",
      hostQuery: "",
      guestQuery: "",
      editingAppointmentId: "",
    }),
    [emptyForm]
  );

  const normalizeDraftState = useCallback(
    (value) => {
      const base = buildEmptyDraftState();
      if (!value || typeof value !== "object") return base;

      const hasWrappedForm = value.form && typeof value.form === "object";
      const sourceForm = hasWrappedForm ? value.form : value;
      const next = {
        ...base,
        ...(hasWrappedForm
          ? {
              locationQuery: normalizeTextValue(value.locationQuery),
              hostQuery: normalizeTextValue(value.hostQuery),
              guestQuery: normalizeTextValue(value.guestQuery),
              editingAppointmentId: normalizeTextValue(
                value.editingAppointmentId || value.editingId
              ),
            }
          : {}),
      };

      next.form = {
        ...base.form,
        status: normalizeTextValue(sourceForm.status) || "New",
        type: normalizeTextValue(sourceForm.type) || "select none",
        title: normalizeTextValue(sourceForm.title),
        start_time: normalizeTextValue(sourceForm.start_time),
        description: normalizeTextValue(sourceForm.description),
        location_id: normalizeTextValue(sourceForm.location_id),
        host_id: normalizeTextValue(sourceForm.host_id),
        primary_guest_contact_id: normalizeTextValue(
          sourceForm.primary_guest_contact_id || sourceForm.primary_guest_id
        ),
        event_color: normalizeTextValue(sourceForm.event_color) || defaultEventColor,
        duration_hours: normalizeTextValue(sourceForm.duration_hours) || "0",
        duration_minutes: normalizeTextValue(sourceForm.duration_minutes) || "0",
      };
      return next;
    },
    [buildEmptyDraftState, defaultEventColor, normalizeTextValue]
  );

  const [draftState, setDraftState] = useState(() => normalizeDraftState(draft));
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const normalizeIdValue = useCallback((value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
    return text;
  }, []);

  const normalizedPrefill = useMemo(
    () => ({
      locationId: normalizeTextValue(prefillContext?.locationId),
      locationLabel: normalizeTextValue(prefillContext?.locationLabel),
      hostId: normalizeTextValue(prefillContext?.hostId),
      hostLabel: normalizeTextValue(prefillContext?.hostLabel),
      guestId: normalizeTextValue(prefillContext?.guestId),
      guestLabel: normalizeTextValue(prefillContext?.guestLabel),
      title: normalizeTextValue(prefillContext?.title),
      description: normalizeTextValue(prefillContext?.description),
    }),
    [prefillContext, normalizeTextValue]
  );

  const applyPrefillToState = useCallback(
    (state) => {
      const next = {
        ...state,
        form: { ...state.form },
      };
      let changed = false;

      if (!normalizeTextValue(next.form.location_id) && normalizedPrefill.locationId) {
        next.form.location_id = normalizedPrefill.locationId;
        if (!normalizeTextValue(next.locationQuery)) {
          next.locationQuery =
            normalizedPrefill.locationLabel || `Property #${normalizedPrefill.locationId}`;
        }
        changed = true;
      }

      if (!normalizeTextValue(next.form.host_id) && normalizedPrefill.hostId) {
        next.form.host_id = normalizedPrefill.hostId;
        if (!normalizeTextValue(next.hostQuery)) {
          next.hostQuery = normalizedPrefill.hostLabel || `Provider #${normalizedPrefill.hostId}`;
        }
        changed = true;
      }

      if (
        !normalizeTextValue(next.form.primary_guest_contact_id) &&
        normalizedPrefill.guestId
      ) {
        next.form.primary_guest_contact_id = normalizedPrefill.guestId;
        if (!normalizeTextValue(next.guestQuery)) {
          next.guestQuery = normalizedPrefill.guestLabel || `Contact #${normalizedPrefill.guestId}`;
        }
        changed = true;
      }

      if (!normalizeTextValue(next.form.title) && normalizedPrefill.title) {
        next.form.title = normalizedPrefill.title;
        changed = true;
      }

      if (!normalizeTextValue(next.form.description) && normalizedPrefill.description) {
        next.form.description = normalizedPrefill.description;
        changed = true;
      }

      return changed ? next : state;
    },
    [normalizeTextValue, normalizedPrefill]
  );

  const resetForm = useCallback(
    ({ notifyParent = true } = {}) => {
      const base = buildEmptyDraftState();
      const next = applyPrefillToState(base);
      setDraftState(next);
      if (notifyParent) onResetDraft?.();
    },
    [applyPrefillToState, buildEmptyDraftState, onResetDraft]
  );

  const handleFieldChange = useCallback((field, value) => {
    setDraftState((previous) => ({
      ...previous,
      form: {
        ...previous.form,
        [field]: value,
      },
    }));
  }, []);

  const parseUnixValue = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (String(Math.trunc(Math.abs(numeric))).length <= 10) {
      return Math.trunc(numeric);
    }
    return Math.trunc(numeric / 1000);
  }, []);

  const formatDateTimeLocalInput = useCallback(
    (value) => {
      const unix = parseUnixValue(value);
      if (unix === null) return "";
      const date = new Date(unix * 1000);
      if (Number.isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hour}:${minute}`;
    },
    [parseUnixValue]
  );

  const deriveDurationFromRecord = useCallback(
    (record) => {
      const rawHours = normalizeTextValue(record?.duration_hours);
      const rawMinutes = normalizeTextValue(record?.duration_minutes);
      if (rawHours || rawMinutes) {
        return {
          hours: rawHours || "0",
          minutes: rawMinutes || "0",
        };
      }

      const start = parseUnixValue(record?.start_time);
      const end = parseUnixValue(record?.end_time);
      if (start == null || end == null || end <= start) {
        return {
          hours: "0",
          minutes: "0",
        };
      }

      const totalMinutes = Math.floor((end - start) / 60);
      return {
        hours: String(Math.floor(totalMinutes / 60)),
        minutes: String(totalMinutes % 60),
      };
    },
    [normalizeTextValue, parseUnixValue]
  );

  const forcedMode = normalizeTextValue(mode).toLowerCase();
  const resolvedLayoutMode = normalizeTextValue(layoutMode).toLowerCase();
  const resolvedEditingId =
    forcedMode === "create"
      ? ""
      : normalizeTextValue(editingAppointmentId || draftState.editingAppointmentId);
  const isEditMode = forcedMode === "update" || Boolean(resolvedEditingId);
  const shouldHideStatusFieldInForm = Boolean(hideStatusFieldInForm);

  const form = draftState.form;

  const computeDurationMinutes = useCallback(() => {
    const hours = Number.parseInt(normalizeTextValue(form.duration_hours) || "0", 10);
    const minutes = Number.parseInt(normalizeTextValue(form.duration_minutes) || "0", 10);
    const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
    return safeHours * 60 + safeMinutes;
  }, [form.duration_hours, form.duration_minutes, normalizeTextValue]);

  return {
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
    buildEmptyDraftState,
    resetForm,
    handleFieldChange,
    parseUnixValue,
    formatDateTimeLocalInput,
    deriveDurationFromRecord,
    computeDurationMinutes,
    defaultEventColor,
    emptyForm,
    forcedMode,
    resolvedEditingId,
    isEditMode,
    shouldHideStatusFieldInForm,
    form,
  };
}
