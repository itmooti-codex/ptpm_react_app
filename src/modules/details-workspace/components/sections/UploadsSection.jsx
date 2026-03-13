import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import {
  EyeIcon,
  FileTypeIcon,
  TrashIcon,
} from "./uploadsIcons.jsx";
import {
  formatFileSize,
  isImageUpload,
  isPdfUpload,
  resolveUploadDisplayName,
  resolveUploadExtension,
  resolveUploadPreviewUrl,
  triggerFileDownload,
} from "./uploadsUtils.js";
import { useUploadsSection } from "./useUploadsSection.js";
import { UploadFormModal } from "./UploadFormModal.jsx";
import { UploadsExistingCard } from "./UploadsExistingCard.jsx";

export function UploadsSection({
  plugin,
  jobData,
  additionalCreatePayload = null,
  uploadsMode = "job",
  inquiryId = "",
  inquiryUid = "",
  linkedJobId = "",
  highlightUploadId = "",
  layoutMode = "split",
  existingUploadsView = "table",
  onRequestAddUpload = null,
  enableFormUploads = false,
}) {
  const {
    sectionRef,
    inputRef,
    pendingUploads,
    isDropActive,
    isLoading,
    loadError,
    isUploading,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    previewTarget,
    setPreviewTarget,
    activeUploadsTab,
    setActiveUploadsTab,
    isUploadFormModalOpen,
    setIsUploadFormModalOpen,
    uploadFormDraft,
    editingUploadFormId,
    isSavingUploadForm,
    togglingCustomerCanViewId,
    formsEnabled,
    targetRecordId,
    normalizedHighlightUploadId,
    filteredUploads,
    uploadTabCounts,
    hasMorePendingUploads,
    remainingPendingUploadsCount,
    showMorePendingUploads,
    isPendingUploadsWindowed,
    visiblePendingUploads,
    hasMoreExistingUploads,
    remainingExistingUploadsCount,
    showMoreExistingUploads,
    isExistingUploadsWindowed,
    visibleExistingUploads,
    triggerFilePicker,
    handleFilesSelected,
    handleDropZoneDragOver,
    handleDropZoneDragLeave,
    handleDropZoneDrop,
    togglePendingUploadCustomerCanView,
    removePendingUpload,
    savePendingUploads,
    activeUploadFormConfig,
    toggleCustomerCanView,
    openCreateUploadForm,
    openEditUploadForm,
    handleUploadFormFieldChange,
    saveUploadForm,
    confirmDeleteUpload,
  } = useUploadsSection({
    plugin,
    jobData,
    additionalCreatePayload,
    uploadsMode,
    inquiryId,
    inquiryUid,
    linkedJobId,
    highlightUploadId,
    enableFormUploads,
  });

  const resolvedLayoutMode = String(layoutMode || "split").trim().toLowerCase();
  const isTableOnlyLayout = resolvedLayoutMode === "table";
  const isFormOnlyLayout = resolvedLayoutMode === "form";
  const resolvedExistingUploadsView = String(existingUploadsView || "table").trim().toLowerCase();
  const useUploadTilesView = resolvedExistingUploadsView === "tiles";
  const showUploadComposer = !isTableOnlyLayout;
  const showExistingUploads = !isFormOnlyLayout;
  const isInquiryMode = String(uploadsMode || "job").trim().toLowerCase() === "inquiry";

  const previewUrl = resolveUploadPreviewUrl(previewTarget);
  const previewName = resolveUploadDisplayName(previewTarget);
  const previewExtension = resolveUploadExtension(previewTarget);
  const previewIsImage = isImageUpload(previewTarget);
  const previewIsPdf = isPdfUpload(previewTarget);
  const previewSupportsInline = previewIsImage || previewIsPdf;

  return (
    <section
      ref={sectionRef}
      data-section="uploads"
      className={
        showUploadComposer && showExistingUploads
          ? "grid grid-cols-1 gap-4 xl:grid-cols-[480px_1fr]"
          : "space-y-4"
      }
    >
      {showUploadComposer ? (
      <Card className="space-y-4">
        <h3 className="type-subheadline text-slate-800">Upload Files</h3>
        <div
          className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
            isDropActive ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50"
          }`}
          onDragEnter={handleDropZoneDragOver}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
        >
          <p className="text-sm text-slate-500">Drag and drop files here or browse</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={triggerFilePicker}
            disabled={!targetRecordId || isUploading}
          >
            Choose Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFilesSelected}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              Pending Uploads ({pendingUploads.length})
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={savePendingUploads}
              disabled={!targetRecordId || !pendingUploads.length || isUploading}
            >
              {isUploading ? "Saving..." : "Save Uploads"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-[40%] px-2 py-2">Name</th>
                  <th className="w-[15%] px-2 py-2">Size</th>
                  <th className="w-[25%] px-2 py-2">Customer Can View</th>
                  <th className="w-[20%] px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!visiblePendingUploads.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={4}>
                      No pending files.
                    </td>
                  </tr>
                ) : (
                  visiblePendingUploads.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-3 break-all">{record.name}</td>
                      <td className="px-2 py-3">{formatFileSize(record.size)}</td>
                      <td className="px-2 py-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={record.customerCanView === true}
                            onChange={() => togglePendingUploadCustomerCanView(record.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </label>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex w-full items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              if (!record.previewUrl) return;
                              window.open(record.previewUrl, "_blank", "noopener,noreferrer");
                            }}
                            aria-label="View pending upload"
                            title="View"
                            disabled={!record.previewUrl}
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                            onClick={() => removePendingUpload(record.id)}
                            aria-label="Remove pending upload"
                            title="Remove"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMorePendingUploads ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visiblePendingUploads.length} of {pendingUploads.length} pending uploads
              </span>
              <Button type="button" variant="outline" onClick={showMorePendingUploads}>
                Load {Math.min(remainingPendingUploadsCount, 100)} more
              </Button>
            </div>
          ) : isPendingUploadsWindowed ? (
            <div className="text-xs text-slate-500">
              Showing all {pendingUploads.length} pending uploads.
            </div>
          ) : null}
        </div>
      </Card>
      ) : null}

      {showExistingUploads ? (
        <UploadsExistingCard
          formsEnabled={formsEnabled}
          isTableOnlyLayout={isTableOnlyLayout}
          useUploadTilesView={useUploadTilesView}
          isInquiryMode={isInquiryMode}
          targetRecordId={targetRecordId}
          isLoading={isLoading}
          loadError={loadError}
          activeUploadsTab={activeUploadsTab}
          setActiveUploadsTab={setActiveUploadsTab}
          uploadTabCounts={uploadTabCounts}
          filteredUploads={filteredUploads}
          visibleExistingUploads={visibleExistingUploads}
          hasMoreExistingUploads={hasMoreExistingUploads}
          remainingExistingUploadsCount={remainingExistingUploadsCount}
          showMoreExistingUploads={showMoreExistingUploads}
          isExistingUploadsWindowed={isExistingUploadsWindowed}
          normalizedHighlightUploadId={normalizedHighlightUploadId}
          togglingCustomerCanViewId={togglingCustomerCanViewId}
          onRequestAddUpload={onRequestAddUpload}
          setDeleteTarget={setDeleteTarget}
          setPreviewTarget={setPreviewTarget}
          toggleCustomerCanView={toggleCustomerCanView}
          openCreateUploadForm={openCreateUploadForm}
          openEditUploadForm={openEditUploadForm}
        />
      ) : null}

      <UploadFormModal
        isOpen={isUploadFormModalOpen}
        onClose={() => setIsUploadFormModalOpen(false)}
        editingUploadFormId={editingUploadFormId}
        activeUploadFormConfig={activeUploadFormConfig}
        uploadFormDraft={uploadFormDraft}
        isSavingUploadForm={isSavingUploadForm}
        onFieldChange={handleUploadFormFieldChange}
        onSave={saveUploadForm}
      />

      <Modal
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewName || "Upload Preview"}
        widthClass="max-w-[min(96vw,1100px)]"
        footer={
          <div className="flex justify-end gap-2">
            {previewUrl && !previewSupportsInline ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => triggerFileDownload(previewUrl, previewName)}
              >
                Download
              </Button>
            ) : null}
            {previewUrl ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              >
                Open in New Tab
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={() => setPreviewTarget(null)}>
              Close
            </Button>
          </div>
        }
      >
        {!previewUrl ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Preview is not available for this file.
          </div>
        ) : previewIsImage ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <img
              src={previewUrl}
              alt={previewName || "Upload preview"}
              className="mx-auto max-h-[72vh] w-auto rounded"
            />
          </div>
        ) : previewIsPdf ? (
          <iframe
            title={previewName || "Upload preview"}
            src={previewUrl}
            className="h-[72vh] w-full rounded border border-slate-200 bg-white"
          />
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <FileTypeIcon extension={previewExtension} />
            <div className="text-sm text-slate-600">Preview is not available for this file type.</div>
            <Button
              type="button"
              variant="primary"
              onClick={() => triggerFileDownload(previewUrl, previewName)}
            >
              Download File
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Upload"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteUpload}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this upload?</p>
      </Modal>
    </section>
  );
}
