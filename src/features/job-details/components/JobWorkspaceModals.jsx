import {
  AddActivitiesSection,
  AddMaterialsSection,
  AppointmentTabSection,
  PropertyAffiliationModal,
  UploadsSection,
} from "@modules/details-workspace/exports/components.js";
import { Modal } from "@shared/components/ui/Modal.jsx";
import { toText } from "@shared/utils/formatters.js";

export function JobWorkspaceModals({
  affiliationModalState,
  appointmentModalMode,
  appointmentPrefillContext,
  closeAffiliationModal,
  closeUploadsModal,
  editingActivityId,
  editingAppointmentId,
  editingMaterialId,
  effectiveJobId,
  handleActivitySaved,
  handleCloseActivityModal,
  handleCloseAppointmentModal,
  handleCloseMaterialModal,
  isActivityModalOpen,
  isAppointmentModalOpen,
  isMaterialModalOpen,
  isUploadsModalOpen,
  jobData,
  loadedPropertyId,
  lookupData,
  materialModalMode,
  openContactDetailsModal,
  plugin,
  relatedInquiryId,
  relatedInquiryUid,
  saveAffiliation,
  selectedWorkspacePropertyId,
  uploadsPropertyId,
  activityModalMode,
}) {
  return (
    <>
      <PropertyAffiliationModal
        open={affiliationModalState.open}
        onClose={closeAffiliationModal}
        onSave={saveAffiliation}
        initialData={affiliationModalState.initialData}
        plugin={plugin}
        propertyId={toText(selectedWorkspacePropertyId || loadedPropertyId)}
        onOpenContactDetailsModal={openContactDetailsModal}
      />

      <Modal
        open={isUploadsModalOpen}
        onClose={closeUploadsModal}
        title="Add Uploads"
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <UploadsSection
            plugin={plugin}
            uploadsMode={effectiveJobId ? "job" : "inquiry"}
            jobData={{ id: effectiveJobId, ID: effectiveJobId }}
            inquiryId={relatedInquiryId}
            inquiryUid={relatedInquiryUid}
            linkedJobId={effectiveJobId}
            additionalCreatePayload={{
              ...(relatedInquiryId
                ? { inquiry_id: relatedInquiryId, Inquiry_ID: relatedInquiryId }
                : {}),
              ...(effectiveJobId ? { job_id: effectiveJobId, Job_ID: effectiveJobId } : {}),
              ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
            }}
            layoutMode="form"
            enableFormUploads
          />
        </div>
      </Modal>

      <Modal
        open={isAppointmentModalOpen}
        onClose={handleCloseAppointmentModal}
        title={appointmentModalMode === "update" ? "Edit Appointment" : "Add Appointment"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AppointmentTabSection
            plugin={plugin}
            jobData={jobData}
            preloadedLookupData={lookupData}
            inquiryRecordId={relatedInquiryId}
            inquiryUid={relatedInquiryUid}
            prefillContext={appointmentPrefillContext}
            layoutMode="form"
            mode={appointmentModalMode}
            editingAppointmentId={editingAppointmentId}
            onSubmitSuccess={handleCloseAppointmentModal}
          />
        </div>
      </Modal>

      <Modal
        open={isActivityModalOpen}
        onClose={handleCloseActivityModal}
        title={activityModalMode === "update" ? "Edit Activity" : "Add Activity"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AddActivitiesSection
            plugin={plugin}
            jobData={{
              id: effectiveJobId,
              ID: effectiveJobId,
              inquiry_record_id: relatedInquiryId,
            }}
            layoutMode="form"
            mode={activityModalMode}
            editingActivityId={editingActivityId}
            onActivitySaved={handleActivitySaved}
            onSubmitSuccess={handleCloseActivityModal}
          />
        </div>
      </Modal>

      <Modal
        open={isMaterialModalOpen}
        onClose={handleCloseMaterialModal}
        title={materialModalMode === "update" ? "Edit Material" : "Add Material"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AddMaterialsSection
            plugin={plugin}
            jobData={{
              id: effectiveJobId,
              ID: effectiveJobId,
              inquiry_record_id: relatedInquiryId,
            }}
            preloadedLookupData={lookupData}
            layoutMode="form"
            mode={materialModalMode}
            editingMaterialId={editingMaterialId}
            onSubmitSuccess={handleCloseMaterialModal}
          />
        </div>
      </Modal>
    </>
  );
}
