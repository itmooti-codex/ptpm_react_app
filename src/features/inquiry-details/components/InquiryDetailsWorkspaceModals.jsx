import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { TasksModal } from "../../../modules/details-workspace/components/modals/TasksModal.jsx";
import { ContactDetailsModal } from "../../../modules/details-workspace/components/modals/ContactDetailsModal.jsx";
import {
  AddPropertyModal,
  AppointmentTabSection,
  UploadsSection,
} from "@modules/details-workspace/exports/components.js";
import { QuickInquiryBookingModal } from "./quick-inquiry/QuickInquiryBookingModal.jsx";
import { InquiryDetailsEditModal } from "./InquiryDetailsEditModal.jsx";

export function InquiryDetailsWorkspaceModals({
  isTasksModalOpen,
  handleCloseTasksModal,
  plugin,
  inquiryNumericId,
  resolvedInquiry,
  contactModalState,
  closeContactDetailsModal,
  isQuickInquiryBookingModalOpen,
  handleCloseQuickInquiryBookingModal,
  quickInquiryPrefillContext,
  configuredAdminProviderId,
  handleQuickInquiryBookingSavingStart,
  handleQuickInquiryBookingSavingProgress,
  handleQuickInquiryBookingSaved,
  handleQuickInquiryBookingError,
  propertyModalState,
  closePropertyModal,
  handleSaveProperty,
  isInquiryDetailsModalOpen,
  handleCloseInquiryDetailsEditor,
  handleSaveInquiryDetails,
  isSavingInquiryDetails,
  inquiryDetailsForm,
  setInquiryDetailsForm,
  inquiryEditFlowRule,
  isInquiryServiceLookupLoading,
  resolvedInquiryServiceOptions,
  shouldShowInquiryEditOther,
  handleInquiryDetailsTextFieldChange,
  isInquiryEditPestAccordionOpen,
  setIsInquiryEditPestAccordionOpen,
  isAppointmentModalOpen,
  closeAppointmentModal,
  appointmentModalMode,
  linkedInquiryJobIdFromRecord,
  workspaceLookupData,
  safeUid,
  appointmentModalEditingId,
  appointmentModalDraft,
  inquiryAppointmentPrefillContext,
  isUploadsModalOpen,
  closeUploadsModal,
  uploadsPropertyId,
}) {
  return (
    <>
      <TasksModal
        open={isTasksModalOpen}
        onClose={handleCloseTasksModal}
        plugin={plugin}
        contextType="deal"
        contextId={inquiryNumericId}
        jobData={{
          ...(resolvedInquiry || {}),
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
          inquiry_record_id: inquiryNumericId,
          Inquiry_Record_ID: inquiryNumericId,
        }}
        additionalCreatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
        additionalUpdatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
      />
      <ContactDetailsModal
        open={contactModalState.open}
        onClose={closeContactDetailsModal}
        mode={contactModalState.mode}
        plugin={plugin}
        onSave={contactModalState.onSave}
        onModeChange={contactModalState.onModeChange}
        allowModeSwitch={contactModalState.allowModeSwitch}
        titleVerb={contactModalState.titleVerb}
        initialValues={contactModalState.initialValues}
        useTopLookupSearch
        enableInlineDuplicateLookup
      />
      <QuickInquiryBookingModal
        open={isQuickInquiryBookingModalOpen}
        onClose={handleCloseQuickInquiryBookingModal}
        plugin={plugin}
        inquiryId={inquiryNumericId}
        prefillContext={quickInquiryPrefillContext}
        configuredAdminProviderId={configuredAdminProviderId}
        onSavingStart={handleQuickInquiryBookingSavingStart}
        onSavingProgress={handleQuickInquiryBookingSavingProgress}
        onSaved={handleQuickInquiryBookingSaved}
        onError={handleQuickInquiryBookingError}
      />
      <AddPropertyModal
        open={propertyModalState.open}
        onClose={closePropertyModal}
        onSave={handleSaveProperty}
        initialData={propertyModalState.initialData}
        plugin={plugin}
      />
      <InquiryDetailsEditModal
        open={isInquiryDetailsModalOpen}
        onClose={handleCloseInquiryDetailsEditor}
        onSave={handleSaveInquiryDetails}
        isSaving={isSavingInquiryDetails}
        inquiryDetailsForm={inquiryDetailsForm}
        setInquiryDetailsForm={setInquiryDetailsForm}
        inquiryEditFlowRule={inquiryEditFlowRule}
        isInquiryServiceLookupLoading={isInquiryServiceLookupLoading}
        resolvedInquiryServiceOptions={resolvedInquiryServiceOptions}
        shouldShowInquiryEditOther={shouldShowInquiryEditOther}
        handleInquiryDetailsTextFieldChange={handleInquiryDetailsTextFieldChange}
        isInquiryEditPestAccordionOpen={isInquiryEditPestAccordionOpen}
        setIsInquiryEditPestAccordionOpen={setIsInquiryEditPestAccordionOpen}
      />
      <Modal
        open={isAppointmentModalOpen}
        onClose={closeAppointmentModal}
        title={appointmentModalMode === "update" ? "Edit Appointment" : "Add Appointment"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AppointmentTabSection
            plugin={plugin}
            jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
            preloadedLookupData={workspaceLookupData}
            inquiryRecordId={inquiryNumericId}
            inquiryUid={safeUid}
            mode={appointmentModalMode}
            editingAppointmentId={appointmentModalEditingId}
            draft={appointmentModalDraft}
            prefillContext={inquiryAppointmentPrefillContext}
            layoutMode="form"
            hideStatusFieldInForm
          />
        </div>
      </Modal>
      <Modal
        open={isUploadsModalOpen}
        onClose={closeUploadsModal}
        title="Add Uploads"
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          {inquiryNumericId ? (
            <UploadsSection
              plugin={plugin}
              jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
              uploadsMode="inquiry"
              inquiryId={inquiryNumericId}
              inquiryUid={safeUid}
              linkedJobId={linkedInquiryJobIdFromRecord}
              additionalCreatePayload={{
                inquiry_id: inquiryNumericId,
                Inquiry_ID: inquiryNumericId,
                inquiry_record_id: inquiryNumericId,
                Inquiry_Record_ID: inquiryNumericId,
                job_id: linkedInquiryJobIdFromRecord || null,
                Job_ID: linkedInquiryJobIdFromRecord || null,
                ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
              }}
              layoutMode="form"
              enableFormUploads
            />
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Inquiry record ID is required to add uploads.
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
