import {
  AddPropertyModal,
  ContactDetailsModal,
  TasksModal,
} from "@modules/details-workspace/exports/components.js";
import { Button } from "@shared/components/ui/Button.jsx";
import { Modal } from "@shared/components/ui/Modal.jsx";
import { toText } from "@shared/utils/formatters.js";

export function JobDetailsModalStack({
  activeWorkspaceProperty,
  closeContactDetailsModal,
  closeMarkCompleteConfirm,
  closeTasksModal,
  companyPopupComment = "",
  confirmDeleteMemoItem,
  contactModalState,
  contactPopupComment = "",
  effectiveJobId,
  handleConfirmMarkComplete,
  handleSavePopupComments,
  isAddPropertyOpen,
  isDeletingMemoItem = false,
  isMarkCompleteConfirmOpen = false,
  isPopupCommentModalOpen = false,
  isSavingMarkComplete = false,
  isSavingPopupComment = false,
  memoDeleteTarget,
  onCloseAddProperty,
  pendingMarkCompleteValue = false,
  plugin,
  popupCommentDrafts,
  relatedInquiryId,
  relatedInquiryRecord,
  saveProperty,
  setIsPopupCommentModalOpen,
  setMemoDeleteTarget,
  setPopupCommentDrafts,
  showCompanyDetails = false,
  showContactDetails = false,
  tasksModalOpen = false,
  propertyModalMode = "create",
}) {
  return (
    <>
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

      <AddPropertyModal
        open={isAddPropertyOpen}
        onClose={onCloseAddProperty}
        onSave={saveProperty}
        plugin={plugin}
        initialData={propertyModalMode === "edit" ? activeWorkspaceProperty : null}
      />

      <TasksModal
        open={tasksModalOpen}
        onClose={closeTasksModal}
        plugin={plugin}
        jobData={{
          ...(relatedInquiryRecord || {}),
          id: effectiveJobId,
          ID: effectiveJobId,
          inquiry_record_id: relatedInquiryId || null,
          Inquiry_Record_ID: relatedInquiryId || null,
          deal_id: relatedInquiryId || null,
          Deal_id: relatedInquiryId || null,
        }}
        contextType={effectiveJobId ? "job" : "deal"}
        contextId={effectiveJobId || relatedInquiryId}
        additionalCreatePayload={{
          ...(effectiveJobId ? { job_id: effectiveJobId, Job_id: effectiveJobId } : {}),
          ...(relatedInquiryId ? { deal_id: relatedInquiryId, Deal_id: relatedInquiryId } : {}),
        }}
        additionalUpdatePayload={{
          ...(effectiveJobId ? { job_id: effectiveJobId, Job_id: effectiveJobId } : {}),
          ...(relatedInquiryId ? { deal_id: relatedInquiryId, Deal_id: relatedInquiryId } : {}),
        }}
      />

      <Modal
        open={isMarkCompleteConfirmOpen}
        title={pendingMarkCompleteValue ? "Mark Complete" : "Mark Incomplete"}
        onClose={() => {
          if (isSavingMarkComplete) return;
          closeMarkCompleteConfirm();
        }}
        widthClass="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeMarkCompleteConfirm}
              disabled={isSavingMarkComplete}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmMarkComplete}
              disabled={isSavingMarkComplete}
            >
              {isSavingMarkComplete ? "Saving..." : "Confirm"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          {pendingMarkCompleteValue
            ? "Are you sure you want to mark this job as complete?"
            : "Are you sure you want to mark this job as incomplete?"}
        </p>
      </Modal>

      <Modal
        open={isPopupCommentModalOpen}
        onClose={() => {
          if (isSavingPopupComment) return;
          setPopupCommentDrafts({
            contact: contactPopupComment,
            company: companyPopupComment,
          });
          setIsPopupCommentModalOpen(false);
        }}
        title="Popup Comments"
        widthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPopupCommentDrafts({
                  contact: contactPopupComment,
                  company: companyPopupComment,
                });
                setIsPopupCommentModalOpen(false);
              }}
              disabled={isSavingPopupComment}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePopupComments}
              disabled={isSavingPopupComment}
            >
              {isSavingPopupComment ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {showContactDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Primary Contact Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.contact}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    contact: event.target.value,
                  }))
                }
                placeholder="Add popup comment for primary contact"
              />
            </div>
          ) : null}

          {showCompanyDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Company Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.company}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    company: event.target.value,
                  }))
                }
                placeholder="Add popup comment for company"
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(memoDeleteTarget)}
        onClose={() => {
          if (isDeletingMemoItem) return;
          setMemoDeleteTarget(null);
        }}
        title={toText(memoDeleteTarget?.type) === "post" ? "Delete Memo" : "Delete Reply"}
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoDeleteTarget(null)}
              disabled={isDeletingMemoItem}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteMemoItem}
              disabled={isDeletingMemoItem}
            >
              {isDeletingMemoItem ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {toText(memoDeleteTarget?.type) === "post"
            ? "Are you sure you want to delete this memo?"
            : "Are you sure you want to delete this reply?"}
        </p>
      </Modal>
    </>
  );
}
