import { Button } from "../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { toText } from "@shared/utils/formatters.js";

export function InquiryDetailsActionModals({
  isCreateQuoteModalOpen,
  handleCloseCreateQuoteModal,
  isCreatingQuote,
  handleConfirmCreateQuote,
  quoteCreateDraft,
  setQuoteCreateDraft,
  isDeleteRecordModalOpen,
  handleCloseDeleteRecordModal,
  isDeletingRecord,
  handleConfirmDeleteRecord,
  isPopupCommentModalOpen,
  setPopupCommentDrafts,
  contactPopupComment,
  companyPopupComment,
  setIsPopupCommentModalOpen,
  isSavingPopupComment,
  handleSavePopupComments,
  showContactDetails,
  showCompanyDetails,
  popupCommentDrafts,
  memoDeleteTarget,
  closeMemoDeleteModal,
  isDeletingMemoItem,
  confirmDeleteMemoItem,
}) {
  return (
    <>
      <Modal
        open={isCreateQuoteModalOpen}
        onClose={handleCloseCreateQuoteModal}
        title="Create Quote/Job"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseCreateQuoteModal}
              disabled={isCreatingQuote}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmCreateQuote}
              disabled={isCreatingQuote}
            >
              {isCreatingQuote ? "Creating..." : "Create Quote/Job"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <InputField
            label="Quote Date"
            type="date"
            field="quote_date"
            value={quoteCreateDraft.quote_date}
            onChange={(event) =>
              setQuoteCreateDraft((previous) => ({
                ...previous,
                quote_date: String(event?.target?.value || ""),
              }))
            }
          />
        </div>
      </Modal>
      <Modal
        open={isDeleteRecordModalOpen}
        onClose={handleCloseDeleteRecordModal}
        title="Delete Record"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseDeleteRecordModal}
              disabled={isDeletingRecord}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteRecord}
              disabled={isDeletingRecord}
            >
              {isDeletingRecord ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          This will mark the inquiry status as <strong>Cancelled</strong> and return you to the
          dashboard.
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
        onClose={closeMemoDeleteModal}
        title={toText(memoDeleteTarget?.type) === "post" ? "Delete Memo" : "Delete Reply"}
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeMemoDeleteModal}
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
