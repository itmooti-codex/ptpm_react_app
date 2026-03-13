import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import {
  EyeActionIcon as EyeIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import { formatFileSize } from "./jobInfoUtils.js";

export function PropertyUploadsSection({
  resolvedPropertyId,
  propertyUploads,
  pendingPropertyUploads,
  isPropertyDropActive,
  isUploadsLoading,
  uploadsLoadError,
  isUploading,
  deleteUploadTarget,
  isDeletingUpload,
  uploadsInputRef,
  triggerUploadFilePicker,
  handleUploadFilesSelected,
  handlePropertyDropZoneDragOver,
  handlePropertyDropZoneDragLeave,
  handlePropertyDropZoneDrop,
  removePendingPropertyUpload,
  savePendingPropertyUploads,
  confirmDeleteUpload,
  setDeleteUploadTarget,
}) {
  return (
    <>
      <section
        data-section="property-uploads"
        className="grid grid-cols-1 gap-4 xl:grid-cols-[480px_1fr]"
      >
        <Card className="space-y-4">
          <h3 className="type-subheadline text-slate-800">Upload Files</h3>
          <div
            className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
              isPropertyDropActive
                ? "border-sky-500 bg-sky-50"
                : "border-slate-300 bg-slate-50"
            }`}
            onDragEnter={handlePropertyDropZoneDragOver}
            onDragOver={handlePropertyDropZoneDragOver}
            onDragLeave={handlePropertyDropZoneDragLeave}
            onDrop={handlePropertyDropZoneDrop}
          >
            <p className="text-sm text-slate-500">Drag and drop files here or browse</p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={triggerUploadFilePicker}
              disabled={!resolvedPropertyId || isUploading}
            >
              Choose Files
            </Button>
            <input
              ref={uploadsInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={handleUploadFilesSelected}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">
                Pending Uploads ({pendingPropertyUploads.length})
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={savePendingPropertyUploads}
                disabled={!resolvedPropertyId || !pendingPropertyUploads.length || isUploading}
              >
                {isUploading ? "Saving..." : "Save Uploads"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-1/2 px-2 py-2">Name</th>
                    <th className="w-1/4 px-2 py-2">Size</th>
                    <th className="w-1/4 px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!pendingPropertyUploads.length ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={3}>
                        No pending files.
                      </td>
                    </tr>
                  ) : (
                    pendingPropertyUploads.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-3 break-all">{record.name}</td>
                        <td className="px-2 py-3">{formatFileSize(record.size)}</td>
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
                              onClick={() => removePendingPropertyUpload(record.id)}
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
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="type-subheadline text-slate-800">Existing Uploads</h3>
          </div>

          {!resolvedPropertyId ? (
            <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-400">
              Select a property to manage uploads.
            </div>
          ) : null}

          {resolvedPropertyId && isUploadsLoading ? (
            <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
              Loading property uploads...
            </div>
          ) : null}

          {resolvedPropertyId && !isUploadsLoading && uploadsLoadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {uploadsLoadError}
            </div>
          ) : null}

          {resolvedPropertyId && !isUploadsLoading && !uploadsLoadError ? (
            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-1/4 px-2 py-2">Type</th>
                    <th className="w-2/4 px-2 py-2">Name</th>
                    <th className="w-1/4 px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!propertyUploads.length ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={3}>
                        No uploads available.
                      </td>
                    </tr>
                  ) : (
                    propertyUploads.map((record, index) => {
                      const uploadId = String(record?.id || "").trim();
                      const uploadUrl = String(record?.url || "").trim();
                      return (
                        <tr
                          key={`${uploadId || uploadUrl || "upload"}-${index}`}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="px-2 py-3">{record?.type || (record?.isPhoto ? "Photo" : "File")}</td>
                          <td className="px-2 py-3 break-all">{record?.name || "Upload"}</td>
                          <td className="px-2 py-3">
                            <div className="flex w-full items-center justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => {
                                  if (!uploadUrl) return;
                                  window.open(uploadUrl, "_blank", "noopener,noreferrer");
                                }}
                                aria-label="View upload"
                                title="View Upload"
                                disabled={!uploadUrl}
                              >
                                <EyeIcon />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => setDeleteUploadTarget(record)}
                                aria-label="Delete upload"
                                title="Delete Upload"
                                disabled={!uploadId}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </section>

      <Modal
        open={Boolean(deleteUploadTarget)}
        onClose={() => {
          if (isDeletingUpload) return;
          setDeleteUploadTarget(null);
        }}
        title="Delete Property Upload"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteUploadTarget(null)}
              disabled={isDeletingUpload}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteUpload}
              disabled={isDeletingUpload}
            >
              {isDeletingUpload ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this property upload?
        </p>
      </Modal>
    </>
  );
}
