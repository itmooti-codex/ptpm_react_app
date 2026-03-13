import { useRef } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  APPOINTMENT_DURATION_HOURS_OPTIONS,
  APPOINTMENT_DURATION_MINUTES_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
} from "../../../constants/options.js";
import {
  EditActionIcon as EditIcon,
  CheckActionIcon as CheckIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import {
  ColorMappedSelectInput,
  SearchDropdownInput,
  SelectInput,
} from "./JobInfoFormFields.jsx";
import {
  AppointmentTableRow,
  FieldLabel,
} from "./appointmentTabUtils.jsx";
import { useAppointmentForm } from "./useAppointmentForm.js";
import { useAppointmentOperations } from "./useAppointmentOperations.js";

export function AppointmentTabSection({
  plugin,
  jobData,
  preloadedLookupData,
  onCountChange,
  inquiryRecordId = "",
  inquiryUid = "",
  highlightAppointmentId = "",
  draft = null,
  onDraftChange = null,
  onResetDraft = null,
  prefillContext = null,
  mode = "",
  editingAppointmentId = "",
  layoutMode = "split",
  onRequestCreate = null,
  onRequestEdit = null,
  onSubmitSuccess = null,
  hideStatusFieldInForm = false,
  eventRowTintOpacity = 1,
}) {
  const { success, error } = useToast();
  const sectionRef = useRef(null);

  const normalizedEventRowTintOpacity = (() => {
    const numeric = Number(eventRowTintOpacity);
    if (!Number.isFinite(numeric)) return 1;
    return Math.max(0, Math.min(1, numeric));
  })();

  const resolvedLayoutMode = String(layoutMode || "").trim().toLowerCase();
  const isTableOnlyLayout = resolvedLayoutMode === "table";
  const isFormOnlyLayout = resolvedLayoutMode === "form";
  const showFormPanel = !isTableOnlyLayout;
  const showTablePanel = !isFormOnlyLayout;

  const formHook = useAppointmentForm({
    draft,
    prefillContext,
    mode,
    editingAppointmentId,
    onResetDraft,
    onDraftChange,
    hideStatusFieldInForm,
    layoutMode,
  });

  const {
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
    handleFieldChange,
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
  } = formHook;

  const ops = useAppointmentOperations({
    plugin,
    jobData,
    preloadedLookupData,
    onCountChange,
    inquiryRecordId,
    inquiryUid,
    highlightAppointmentId,
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
    success,
    error,
  });

  const {
    appointments,
    searchContacts,
    isContactLookupLoading,
    searchProperties,
    isPropertyLookupLoading,
    isServiceProviderLookupLoading,
    normalizedHighlightAppointmentId,
    hasMoreAppointments,
    remainingAppointmentsCount,
    showMoreAppointments,
    isAppointmentsWindowed,
    visibleAppointments,
    locationItems,
    hostItems,
    guestItems,
    locationItemById,
    hostItemById,
    guestItemById,
    buildDraftFromRecord,
    startEditing,
    handleSubmitAppointment,
    handleMarkComplete,
    confirmDeleteAppointment,
    getStatusOption,
    getEventOption,
  } = ops;

  return (
    <div
      ref={sectionRef}
      data-job-section="job-section-appointment"
      className={
        showFormPanel && showTablePanel
          ? "grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]"
          : "min-w-0"
      }
    >
      {showFormPanel ? (
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>

          {isEditMode && !shouldHideStatusFieldInForm ? (
            <ColorMappedSelectInput
              label="Appointment Status"
              field="status"
              options={APPOINTMENT_STATUS_OPTIONS}
              value={form.status}
              onChange={(value) => handleFieldChange("status", value)}
            />
          ) : null}

          <SelectInput
            label="Type"
            field="type"
            options={APPOINTMENT_TYPE_OPTIONS}
            value={form.type}
            onChange={(value) => handleFieldChange("type", value)}
          />

          <div className="w-full">
            <FieldLabel>Title</FieldLabel>
            <input
              type="text"
              data-field="title"
              value={form.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="w-full">
            <FieldLabel>Start Time</FieldLabel>
            <input
              type="datetime-local"
              data-field="start_time"
              value={form.start_time}
              onChange={(event) => handleFieldChange("start_time", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Duration Hours"
              field="duration_hours"
              options={APPOINTMENT_DURATION_HOURS_OPTIONS}
              value={form.duration_hours}
              onChange={(value) => handleFieldChange("duration_hours", value)}
            />
            <SelectInput
              label="Duration Minutes"
              field="duration_minutes"
              options={APPOINTMENT_DURATION_MINUTES_OPTIONS}
              value={form.duration_minutes}
              onChange={(value) => handleFieldChange("duration_minutes", value)}
            />
          </div>

          <div className="w-full">
            <FieldLabel>Description</FieldLabel>
            <textarea
              rows={6}
              data-field="description"
              value={form.description}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <SearchDropdownInput
            label="Location"
            field="location_id"
            value={draftState.locationQuery}
            placeholder="Search property name or address"
            items={locationItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, locationQuery: value }));
              handleFieldChange("location_id", "");
            }}
            onSearchQueryChange={searchProperties}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                locationQuery: item?.label || "",
              }));
              handleFieldChange("location_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText={isPropertyLookupLoading ? "Loading properties..." : "No properties found."}
          />

          <SearchDropdownInput
            label="Host"
            field="host_id"
            value={draftState.hostQuery}
            placeholder="Search service provider"
            items={hostItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, hostQuery: value }));
              handleFieldChange("host_id", "");
            }}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                hostQuery: item?.label || "",
              }));
              handleFieldChange("host_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText={
              isServiceProviderLookupLoading
                ? "Loading service providers..."
                : "No service providers found."
            }
          />

          <SearchDropdownInput
            label="Primary Guest"
            field="primary_guest_contact_id"
            value={draftState.guestQuery}
            placeholder="Search contact"
            items={guestItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, guestQuery: value }));
              handleFieldChange("primary_guest_contact_id", "");
            }}
            onSearchQueryChange={searchContacts}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                guestQuery: item?.label || "",
              }));
              handleFieldChange("primary_guest_contact_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText={isContactLookupLoading ? "Loading contacts..." : "No contacts found."}
          />
        </Card>

        <div className="flex gap-2">
          <Button
            id="create-appointment"
            className="w-full justify-center bg-[#003882] text-white hover:bg-[#003882]"
            variant="primary"
            onClick={handleSubmitAppointment}
            disabled={isCreating}
          >
            {isCreating
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Appointment"
                : "Create Appointment"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => resetForm()}
            disabled={isCreating}
          >
            {isEditMode ? "Cancel Edit" : "Reset"}
          </Button>
        </div>
      </div>
      ) : null}

      {showTablePanel ? (
      <Card className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>
          {isTableOnlyLayout && typeof onRequestCreate === "function" ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="h-8 whitespace-nowrap px-3 text-xs"
              onClick={() => onRequestCreate()}
            >
              Add Appointment
            </Button>
          ) : null}
        </div>
        <div className="w-full max-w-full overflow-x-auto">
          <table id="appointments-table" className="w-full min-w-[1180px] table-fixed text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="w-[120px] px-2 py-2">Status</th>
                <th className="w-[200px] px-2 py-2">Start - End</th>
                <th className="w-[110px] px-2 py-2">Duration</th>
                <th className="w-[230px] px-2 py-2">Location</th>
                <th className="w-[180px] px-2 py-2">Host</th>
                <th className="w-[180px] px-2 py-2">Guest</th>
                <th className="w-[160px] px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!visibleAppointments.length ? (
                <tr>
                  <td className="px-2 py-3 text-slate-400" colSpan={7}>
                    No appointments added yet.
                  </td>
                </tr>
              ) : (
                visibleAppointments.map((record) => (
                  <AppointmentTableRow
                    key={String(record?.id || record?.ID || "").trim()}
                    record={record}
                    normalizedHighlightAppointmentId={normalizedHighlightAppointmentId}
                    normalizedEventRowTintOpacity={normalizedEventRowTintOpacity}
                    locationItemById={locationItemById}
                    hostItemById={hostItemById}
                    guestItemById={guestItemById}
                    getStatusOption={getStatusOption}
                    getEventOption={getEventOption}
                    updatingId={updatingId}
                    isDeleting={isDeleting}
                    isTableOnlyLayout={isTableOnlyLayout}
                    onRequestEdit={onRequestEdit}
                    buildDraftFromRecord={buildDraftFromRecord}
                    startEditing={startEditing}
                    handleMarkComplete={handleMarkComplete}
                    setDeleteTarget={setDeleteTarget}
                    EditIcon={EditIcon}
                    CheckIcon={CheckIcon}
                    TrashIcon={TrashIcon}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMoreAppointments ? (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {visibleAppointments.length} of {appointments.length} appointments
            </span>
            <Button type="button" variant="outline" onClick={showMoreAppointments}>
              Load {Math.min(remainingAppointmentsCount, 120)} more
            </Button>
          </div>
        ) : isAppointmentsWindowed ? (
          <div className="text-xs text-slate-500">Showing all {appointments.length} appointments.</div>
        ) : null}
      </Card>
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Appointment"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteAppointment}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this appointment?</p>
      </Modal>
    </div>
  );
}
