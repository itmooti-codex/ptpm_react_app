import { useCallback } from "react";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import {
  APPOINTMENT_EVENT_COLOR_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
} from "../../../constants/options.js";
import {
  createAppointmentRecord,
  deleteAppointmentRecord,
  updateAppointmentRecord,
} from "../../../api/core/runtime.js";
import {
  normalizeAppointmentValue,
  parseAppointmentDateInputToUnix,
  resolveAppointmentMappedOption,
} from "./appointmentTabHelpers.js";

export function useAppointmentCrud({
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
  normalizeAppointmentValue: _normalizeAppointmentValue,
  computeDurationMinutes,
  parseAppointmentDateInputToUnix: _parseAppointmentDateInputToUnix,
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
}) {
  const handleSubmitAppointment = useCallback(async () => {
    if (!plugin) {
      error(isEditMode ? "Update failed" : "Create failed", "SDK is still initializing. Please try again.");
      return;
    }

    const hasInquiryContext = Boolean(inquiryUidValue || dealId);
    if (!jobId && !hasInquiryContext) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Appointment context is missing. Refresh and try again."
      );
      return;
    }
    if (hasInquiryContext && !dealId) {
      error(isEditMode ? "Update failed" : "Create failed", "Inquiry ID is missing. Refresh and try again.");
      return;
    }

    if (!form.location_id || !form.host_id || !form.primary_guest_contact_id) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Select location, host, and primary guest."
      );
      return;
    }

    const startTime = parseAppointmentDateInputToUnix(form.start_time);
    if (!form.start_time || startTime === null) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Start time is required in a valid date/time format."
      );
      return;
    }

    const durationMinutes = computeDurationMinutes();
    const endTime = startTime + durationMinutes * 60;
    const isInquiryType = normalizeAppointmentValue(form.type) === "inquiry";
    const shouldAttachInquiry = hasInquiryContext || isInquiryType;
    const statusValue = isEditMode
      ? normalizeTextValue(
          shouldHideStatusFieldInForm ? editingRecordStatusValue || form.status : form.status
        ) || "New"
      : "New";

    const payload = {
      status: statusValue,
      type: form.type,
      title: normalizeTextValue(form.title),
      start_time: startTime,
      end_time: endTime,
      description: normalizeTextValue(form.description),
      location_id: normalizeIdValue(form.location_id),
      host_id: normalizeIdValue(form.host_id),
      primary_guest_id: normalizeIdValue(form.primary_guest_contact_id),
      event_color: normalizeTextValue(form.event_color) || defaultEventColor,
      duration_hours: normalizeTextValue(form.duration_hours) || "0",
      duration_minutes: normalizeTextValue(form.duration_minutes) || "0",
      job_id: jobId ? normalizeIdValue(jobId) : "",
      inquiry_id: shouldAttachInquiry ? dealId || "" : "",
    };

    setIsCreating(true);
    try {
      let savedRecord = null;
      if (isEditMode) {
        const targetId = normalizeTextValue(resolvedEditingId);
        if (!targetId) {
          error("Update failed", "Appointment ID is missing.");
          return;
        }
        const updatedRecord = await updateAppointmentRecord({
          plugin,
          id: targetId,
          payload,
        });
        savedRecord = updatedRecord;
        storeActions.upsertEntityRecord("appointments", updatedRecord, { idField: "id" });
        success("Appointment updated", "Appointment changes were saved.");
      } else {
        const createdRecord = await createAppointmentRecord({ plugin, payload });
        savedRecord = createdRecord;
        storeActions.upsertEntityRecord("appointments", createdRecord, { idField: "id" });
        const createdAppointmentId = normalizeTextValue(createdRecord?.id || createdRecord?.ID);
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_SCHEDULED,
          quoteJobId: String(jobId || "").trim(),
          inquiryId: String(dealId || "").trim(),
          serviceProviderId: normalizeTextValue(form.host_id),
          focusId: createdAppointmentId,
          dedupeEntityId: createdAppointmentId || `${jobId}:${dealId}:${form.title}`,
          title: "Appointment scheduled",
          content: normalizeTextValue(form.title) || "A new appointment was scheduled.",
          logContext: "job-direct:AppointmentTabSection:handleSubmitAppointment",
        });
        success("Appointment created", "Appointment was added successfully.");
      }
      resetForm();
      onSubmitSuccess?.(savedRecord || null);
    } catch (submitError) {
      console.error(
        `[JobDirect] Failed ${isEditMode ? "updating" : "creating"} appointment`,
        submitError
      );
      error(
        isEditMode ? "Update failed" : "Create failed",
        submitError?.message || `Unable to ${isEditMode ? "update" : "create"} appointment.`
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    computeDurationMinutes,
    dealId,
    defaultEventColor,
    editingRecordStatusValue,
    error,
    form,
    inquiryUidValue,
    isEditMode,
    jobId,
    normalizeIdValue,
    normalizeTextValue,
    plugin,
    resetForm,
    resolvedEditingId,
    setIsCreating,
    shouldHideStatusFieldInForm,
    storeActions,
    success,
    onSubmitSuccess,
  ]);

  const handleMarkComplete = useCallback(
    async (record) => {
      const appointmentId = String(record?.id || "").trim();
      if (!plugin || !appointmentId) return;
      setUpdatingId(appointmentId);
      try {
        const updatedRecord = await updateAppointmentRecord({
          plugin,
          id: appointmentId,
          payload: {
            status: "Completed",
          },
        });
        storeActions.upsertEntityRecord("appointments", updatedRecord, { idField: "id" });
        if (normalizeTextValue(resolvedEditingId) === appointmentId) {
          setDraftState((previous) => ({
            ...previous,
            form: { ...previous.form, status: "Completed" },
          }));
        }
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_COMPLETED,
          quoteJobId: String(jobId || "").trim(),
          inquiryId: String(dealId || "").trim(),
          focusId: appointmentId,
          dedupeEntityId: `${appointmentId}:completed`,
          title: "Appointment completed",
          content: String(record?.title || "").trim() || "An appointment was marked as completed.",
          logContext: "job-direct:AppointmentTabSection:handleMarkComplete",
        });
        success("Appointment updated", "Appointment marked as completed.");
      } catch (updateError) {
        console.error("[JobDirect] Failed updating appointment", updateError);
        error("Update failed", updateError?.message || "Unable to update appointment.");
      } finally {
        setUpdatingId("");
      }
    },
    [dealId, error, jobId, normalizeTextValue, plugin, resolvedEditingId, setDraftState, setUpdatingId, storeActions, success]
  );

  const confirmDeleteAppointment = useCallback(async () => {
    const appointmentId = String(deleteTarget?.id || "").trim();
    if (!plugin || !appointmentId || isDeleting) return;
    setIsDeleting(true);
    try {
      const deletedId = await deleteAppointmentRecord({ plugin, id: appointmentId });
      const normalizedDeletedId = String(deletedId || "").trim();
      const nextAppointments = Array.isArray(appointments)
        ? appointments.filter(
            (record) => String(record?.id || record?.ID || "").trim() !== normalizedDeletedId
          )
        : [];
      storeActions.replaceEntityCollection("appointments", nextAppointments);
      if (normalizeTextValue(resolvedEditingId) === appointmentId) {
        resetForm({ notifyParent: false });
      }
      success("Appointment deleted", "Appointment was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting appointment", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete appointment.");
    } finally {
      setIsDeleting(false);
    }
  }, [
    appointments,
    deleteTarget,
    error,
    isDeleting,
    normalizeTextValue,
    plugin,
    resetForm,
    resolvedEditingId,
    setDeleteTarget,
    setIsDeleting,
    storeActions,
    success,
  ]);

  const getStatusOption = useCallback(
    (value) => resolveAppointmentMappedOption(APPOINTMENT_STATUS_OPTIONS, value),
    []
  );

  const getEventOption = useCallback(
    (value) => resolveAppointmentMappedOption(APPOINTMENT_EVENT_COLOR_OPTIONS, value),
    []
  );

  return {
    handleSubmitAppointment,
    handleMarkComplete,
    confirmDeleteAppointment,
    getStatusOption,
    getEventOption,
  };
}
