import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import {
  PCA_FORM_KIND,
  PRESTART_FORM_KIND,
  UPLOAD_FILTER_TABS,
} from "./uploadsConstants.js";
import {
  CloseIcon,
  CustomerEyeIcon,
  EyeIcon,
  FileTypeIcon,
  FormTileIcon,
  TrashIcon,
} from "./uploadsIcons.jsx";
import {
  isImageUpload,
  isPdfUpload,
  isUploadFormRecord,
  normalizeRecordId,
  resolveUploadDisplayName,
  resolveUploadExtension,
  resolveUploadPreviewUrl,
  triggerFileDownload,
} from "./uploadsUtils.js";

export function UploadsExistingCard({
  formsEnabled,
  isTableOnlyLayout,
  useUploadTilesView,
  isInquiryMode,
  targetRecordId,
  isLoading,
  loadError,
  activeUploadsTab,
  setActiveUploadsTab,
  uploadTabCounts,
  filteredUploads,
  visibleExistingUploads,
  hasMoreExistingUploads,
  remainingExistingUploadsCount,
  showMoreExistingUploads,
  isExistingUploadsWindowed,
  normalizedHighlightUploadId,
  togglingCustomerCanViewId,
  onRequestAddUpload,
  setDeleteTarget,
  setPreviewTarget,
  toggleCustomerCanView,
  openCreateUploadForm,
  openEditUploadForm,
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-subheadline text-slate-800">Existing Uploads</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {formsEnabled ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 whitespace-nowrap px-3 text-xs"
                onClick={() => openCreateUploadForm(PRESTART_FORM_KIND)}
                disabled={!targetRecordId}
              >
                Prestart Form
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 whitespace-nowrap px-3 text-xs"
                onClick={() => openCreateUploadForm(PCA_FORM_KIND)}
                disabled={!targetRecordId}
              >
                Pest Control Advice Form
              </Button>
            </>
          ) : null}
          {isTableOnlyLayout && typeof onRequestAddUpload === "function" ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="h-8 whitespace-nowrap px-3 text-xs"
              onClick={() => onRequestAddUpload()}
              disabled={!targetRecordId}
            >
              Add Upload
            </Button>
          ) : null}
        </div>
      </div>

      {formsEnabled ? (
        <div className="inline-flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-slate-50 p-1">
          {UPLOAD_FILTER_TABS.map((tab) => {
            const isActive = activeUploadsTab === tab;
            const label = tab === "forms" ? "Forms" : tab.charAt(0).toUpperCase() + tab.slice(1);
            const count = uploadTabCounts?.[tab] || 0;
            return (
              <button
                key={tab}
                type="button"
                className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-[#003882] text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
                onClick={() => setActiveUploadsTab(tab)}
              >
                <span>{label}</span>
                <span className={isActive ? "text-white/80" : "text-slate-500"}>{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!targetRecordId ? (
        <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-400">
          {isInquiryMode ? "Inquiry is not loaded yet." : "Job is not loaded yet."}
        </div>
      ) : null}

      {targetRecordId && isLoading ? (
        <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
          Loading uploads...
        </div>
      ) : null}

      {targetRecordId && !isLoading && loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {targetRecordId && !isLoading && !loadError ? (
        <>
          {useUploadTilesView ? (
            <div className="flex flex-wrap gap-2">
              {!visibleExistingUploads.length ? (
                <div className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  {formsEnabled && activeUploadsTab !== "all"
                    ? `No ${activeUploadsTab} uploads available.`
                    : "No uploads available."}
                </div>
              ) : (
                visibleExistingUploads.map((record, index) => {
                  const uploadId = String(record?.id || "").trim();
                  const uploadUrl = resolveUploadPreviewUrl(record);
                  const uploadName = resolveUploadDisplayName(record);
                  const isFormUpload = isUploadFormRecord(record);
                  const uploadExtension = isFormUpload ? "FORM" : resolveUploadExtension(record);
                  const supportsInlinePreview =
                    !isFormUpload && (isImageUpload(record) || isPdfUpload(record));
                  const isHighlighted =
                    Boolean(normalizedHighlightUploadId) &&
                    normalizeRecordId(uploadId) === normalizedHighlightUploadId;
                  return (
                    <div
                      key={`${uploadId || uploadUrl || "upload"}-${index}`}
                      data-ann-kind="upload"
                      data-ann-id={normalizeRecordId(uploadId)}
                      data-ann-highlighted={isHighlighted ? "true" : "false"}
                      className={`relative w-[88px] max-w-[88px] rounded border bg-white px-2 py-2 ${
                        isHighlighted ? "border-amber-300 bg-amber-50" : "border-slate-200"
                      }`}
                    >
                      {!isFormUpload ? (
                        <button
                          type="button"
                          className={`absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40 ${
                            record.customer_can_view
                              ? "text-blue-600 hover:text-blue-800"
                              : "text-slate-300 hover:text-slate-500"
                          }`}
                          onClick={() => toggleCustomerCanView(record)}
                          aria-label={
                            record.customer_can_view
                              ? "Customer can view — click to hide"
                              : "Hidden from customer — click to make visible"
                          }
                          title={
                            record.customer_can_view
                              ? "Customer Can View: On"
                              : "Customer Can View: Off"
                          }
                          disabled={togglingCustomerCanViewId === uploadId}
                        >
                          <CustomerEyeIcon active={record.customer_can_view} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setDeleteTarget(record)}
                        aria-label="Delete upload"
                        title="Delete Upload"
                        disabled={!uploadId}
                      >
                        <CloseIcon />
                      </button>
                      <div className="flex min-h-[48px] items-center justify-center">
                        {isFormUpload ? (
                          <FormTileIcon />
                        ) : (
                          <FileTypeIcon extension={uploadExtension} />
                        )}
                      </div>
                      <button
                        type="button"
                        className="mt-1 w-full truncate text-center text-[10px] font-medium text-sky-700 underline decoration-sky-500/60 underline-offset-2 hover:text-sky-800 disabled:cursor-not-allowed disabled:text-slate-400"
                        onClick={() => {
                          if (isFormUpload) {
                            openEditUploadForm(record);
                            return;
                          }
                          if (!uploadUrl) return;
                          setPreviewTarget(record);
                        }}
                        disabled={!isFormUpload && !uploadUrl}
                        title={uploadName}
                      >
                        {uploadName}
                      </button>
                      {!isFormUpload && !supportsInlinePreview && uploadUrl ? (
                        <button
                          type="button"
                          className="mt-1 inline-flex h-5 w-full items-center justify-center rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => triggerFileDownload(uploadUrl, uploadName)}
                          title={`Download ${uploadName}`}
                          aria-label={`Download ${uploadName}`}
                        >
                          Download
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-[15%] px-2 py-2">Type</th>
                    <th className="w-[40%] px-2 py-2">Name</th>
                    <th className="w-[25%] px-2 py-2">Customer Can View</th>
                    <th className="w-[20%] px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!visibleExistingUploads.length ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={4}>
                        {formsEnabled && activeUploadsTab !== "all"
                          ? `No ${activeUploadsTab} uploads available.`
                          : "No uploads available."}
                      </td>
                    </tr>
                  ) : (
                    visibleExistingUploads.map((record, index) => {
                      const uploadId = String(record?.id || "").trim();
                      const uploadUrl = resolveUploadPreviewUrl(record);
                      const isFormUpload = isUploadFormRecord(record);
                      const isHighlighted =
                        Boolean(normalizedHighlightUploadId) &&
                        normalizeRecordId(uploadId) === normalizedHighlightUploadId;
                      return (
                        <tr
                          key={`${uploadId || uploadUrl || "upload"}-${index}`}
                          data-ann-kind="upload"
                          data-ann-id={normalizeRecordId(uploadId)}
                          data-ann-highlighted={isHighlighted ? "true" : "false"}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            isHighlighted ? "bg-amber-50" : ""
                          }`}
                        >
                          <td className="px-2 py-3">{record?.type || "File"}</td>
                          <td className="px-2 py-3 break-all">{record?.name || "Upload"}</td>
                          <td className="px-2 py-3">
                            {!isFormUpload ? (
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                                  record.customer_can_view
                                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                                onClick={() => toggleCustomerCanView(record)}
                                title={
                                  record.customer_can_view
                                    ? "Customer Can View: On — click to hide"
                                    : "Customer Can View: Off — click to make visible"
                                }
                                disabled={togglingCustomerCanViewId === uploadId}
                              >
                                <CustomerEyeIcon active={record.customer_can_view} />
                                {record.customer_can_view ? "On" : "Off"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex w-full items-center justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => {
                                  if (isFormUpload) {
                                    openEditUploadForm(record);
                                    return;
                                  }
                                  if (!uploadUrl) return;
                                  window.open(uploadUrl, "_blank", "noopener,noreferrer");
                                }}
                                aria-label={isFormUpload ? "Edit form upload" : "View upload"}
                                title={isFormUpload ? "Edit Form" : "View Upload"}
                                disabled={!isFormUpload && !uploadUrl}
                              >
                                <EyeIcon />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => setDeleteTarget(record)}
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
          )}
          {hasMoreExistingUploads ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visibleExistingUploads.length} of {filteredUploads.length} uploads
              </span>
              <Button type="button" variant="outline" onClick={showMoreExistingUploads}>
                Load {Math.min(remainingExistingUploadsCount, 100)} more
              </Button>
            </div>
          ) : isExistingUploadsWindowed ? (
            <div className="text-xs text-slate-500">
              Showing all {filteredUploads.length} uploads.
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
