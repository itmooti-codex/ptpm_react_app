import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../hooks/useJobDirectStore.jsx";
import { selectJobUploads } from "../../state/selectors.js";
import { useRenderWindow } from "../primitives/JobDirectTable.jsx";
import {
  createInquiryUploadFromFile,
  createJobUploadFromFile,
  deleteUploadRecord,
  fetchInquiryUploads,
  fetchJobUploads,
} from "../../sdk/core/runtime.js";

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7H20M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7M7 7L8 19C8.04343 19.5523 8.50736 20 9.0616 20H14.9384C15.4926 20 15.9566 19.5523 16 19L17 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function normalizeRecordId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) ? String(Number.parseInt(raw, 10)) : raw;
}

function normalizeJobId(jobData = null) {
  return normalizeRecordId(jobData?.id || jobData?.ID || "");
}

function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function dedupeUploadRecords(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((item, index) => {
    const key = String(item?.id || item?.url || `upload-${index}`).trim();
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

export function UploadsSection({
  plugin,
  jobData,
  additionalCreatePayload = null,
  uploadsMode = "job",
  inquiryId = "",
  inquiryUid = "",
  linkedJobId = "",
  highlightUploadId = "",
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const uploads = useJobDirectSelector(selectJobUploads);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const sectionRef = useRef(null);
  const inputRef = useRef(null);
  const pendingUploadsRef = useRef([]);
  const jobId = useMemo(() => normalizeJobId(jobData), [jobData]);
  const normalizedInquiryId = useMemo(() => normalizeRecordId(inquiryId), [inquiryId]);
  const normalizedLinkedJobId = useMemo(() => normalizeRecordId(linkedJobId), [linkedJobId]);
  const inquiryIdFromPayload = useMemo(
    () =>
      normalizeRecordId(
        additionalCreatePayload?.inquiry_id ||
          additionalCreatePayload?.Inquiry_ID ||
          additionalCreatePayload?.inquiry_record_id ||
          additionalCreatePayload?.Inquiry_Record_ID
      ),
    [additionalCreatePayload]
  );
  const mode = String(uploadsMode || "job").trim().toLowerCase() === "inquiry" ? "inquiry" : "job";
  const isInquiryMode = mode === "inquiry";
  const targetRecordId = isInquiryMode ? normalizedInquiryId : jobId;
  const normalizedHighlightUploadId = normalizeRecordId(highlightUploadId);
  const announcementInquiryId = isInquiryMode ? normalizedInquiryId : inquiryIdFromPayload;
  const announcementJobId = isInquiryMode ? normalizedLinkedJobId : jobId;
  const {
    hasMore: hasMorePendingUploads,
    remainingCount: remainingPendingUploadsCount,
    showMore: showMorePendingUploads,
    shouldWindow: isPendingUploadsWindowed,
    visibleRows: visiblePendingUploads,
  } = useRenderWindow(pendingUploads, {
    threshold: 150,
    pageSize: 100,
  });
  const {
    hasMore: hasMoreExistingUploads,
    remainingCount: remainingExistingUploadsCount,
    showMore: showMoreExistingUploads,
    shouldWindow: isExistingUploadsWindowed,
    visibleRows: visibleExistingUploads,
  } = useRenderWindow(uploads, {
    threshold: 150,
    pageSize: 100,
  });

  useEffect(() => {
    let isActive = true;
    if (!plugin || !targetRecordId) {
      storeActions.replaceEntityCollection("jobUploads", []);
      setLoadError("");
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setLoadError("");
    const fetchPromise = isInquiryMode
      ? fetchInquiryUploads({ plugin, inquiryId: normalizedInquiryId })
      : fetchJobUploads({ plugin, jobId });

    fetchPromise
      .then((records) => {
        if (!isActive) return;
        storeActions.replaceEntityCollection("jobUploads", records || []);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading job uploads", fetchError);
        storeActions.replaceEntityCollection("jobUploads", []);
        setLoadError("Unable to load uploads.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, targetRecordId, isInquiryMode, normalizedInquiryId, jobId, storeActions]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(
    () => () => {
      pendingUploadsRef.current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  useEffect(() => {
    setPendingUploads((previous) => {
      previous.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [targetRecordId]);

  useEffect(() => {
    if (!normalizedHighlightUploadId || !hasMoreExistingUploads) return;
    const hasVisibleHighlightedRow = visibleExistingUploads.some(
      (record) => normalizeRecordId(record?.id || record?.ID) === normalizedHighlightUploadId
    );
    if (hasVisibleHighlightedRow) return;
    showMoreExistingUploads();
  }, [
    normalizedHighlightUploadId,
    hasMoreExistingUploads,
    visibleExistingUploads,
    showMoreExistingUploads,
  ]);

  useEffect(() => {
    if (!normalizedHighlightUploadId) return;
    const timeoutId = window.setTimeout(() => {
      const root = sectionRef.current;
      if (!root) return;
      const matches = Array.from(root.querySelectorAll('[data-ann-kind="upload"]'));
      const target = matches.find(
        (node) =>
          String(node?.getAttribute("data-ann-id") || "").trim() === normalizedHighlightUploadId
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedHighlightUploadId, visibleExistingUploads.length]);

  const triggerFilePicker = () => {
    if (!targetRecordId) {
      error(
        "Cannot upload",
        isInquiryMode ? "Inquiry record is not loaded yet." : "Job record is not loaded yet."
      );
      return;
    }
    inputRef.current?.click();
  };

  const queuePendingFiles = (files = []) => {
    if (!files.length || !targetRecordId) return;
    setPendingUploads((previous) => {
      const existingSignatures = new Set(
        previous.map((item) => `${item.name}::${item.size}::${item.type}::${item.lastModified}`)
      );
      const next = [...previous];
      files.forEach((file) => {
        const signature = `${file.name}::${file.size}::${file.type}::${file.lastModified}`;
        if (existingSignatures.has(signature)) return;
        existingSignatures.add(signature);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified || 0,
          previewUrl: URL.createObjectURL(file),
        });
      });
      return next;
    });
  };

  const handleFilesSelected = (event) => {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    queuePendingFiles(files);
    if (input) input.value = "";
  };

  const handleDropZoneDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!targetRecordId || isUploading) return;
    if (!isDropActive) setIsDropActive(true);
  };

  const handleDropZoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
  };

  const handleDropZoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
    if (!targetRecordId || isUploading) return;
    const files = Array.from(event?.dataTransfer?.files || []);
    queuePendingFiles(files);
  };

  const removePendingUpload = (pendingId) => {
    setPendingUploads((previous) => {
      const next = [];
      previous.forEach((item) => {
        if (item.id === pendingId) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return;
        }
        next.push(item);
      });
      return next;
    });
  };

  const savePendingUploads = async () => {
    if (!plugin || !targetRecordId || !pendingUploads.length || isUploading) return;

    setIsUploading(true);
    setLoadError("");
    const created = [];
    const failed = [];

    for (const pending of pendingUploads) {
      try {
        const effectiveAdditionalPayload = {
          ...(additionalCreatePayload && typeof additionalCreatePayload === "object"
            ? additionalCreatePayload
            : {}),
          ...(isInquiryMode && normalizedLinkedJobId ? { job_id: normalizedLinkedJobId } : {}),
        };
        const saved = isInquiryMode
          ? await createInquiryUploadFromFile({
              plugin,
              inquiryId: normalizedInquiryId,
              file: pending.file,
              uploadPath: `inquiry-uploads/${normalizedInquiryId || inquiryUid || "inquiry"}`,
              additionalPayload: effectiveAdditionalPayload,
            })
          : await createJobUploadFromFile({
              plugin,
              jobId,
              file: pending.file,
              uploadPath: `job-uploads/${jobId}`,
              additionalPayload: effectiveAdditionalPayload,
            });
        if (saved) created.push(saved);
        if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      } catch (uploadError) {
        failed.push({
          ...pending,
          uploadError: uploadError?.message || "Unable to upload file.",
        });
      }
    }

    if (created.length) {
      storeActions.replaceEntityCollection(
        "jobUploads",
        dedupeUploadRecords([...created, ...(uploads || [])])
      );
      const createdUploadIds = created
        .map((record) => normalizeRecordId(record?.id || record?.ID))
        .filter(Boolean);
      emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED,
        quoteJobId: announcementJobId,
        inquiryId: announcementInquiryId,
        focusId: createdUploadIds.length === 1 ? createdUploadIds[0] : "",
        focusIds: createdUploadIds,
        dedupeEntityId:
          createdUploadIds.join(",") || `${announcementJobId}:${announcementInquiryId}:upload_batch`,
        title: created.length > 1 ? "New uploads added" : "New upload added",
        content:
          created.length > 1
            ? `${created.length} files were uploaded.`
            : "A new file was uploaded.",
        logContext: "job-direct:UploadsSection:savePendingUploads",
      }).catch((announcementError) => {
        console.warn("[JobDirect] Upload announcement emit failed", announcementError);
      });
    }

    setPendingUploads(failed);

    if (created.length) {
      success(
        created.length > 1 ? "Uploads added" : "Upload added",
        created.length > 1
          ? `${created.length} files were uploaded to this ${isInquiryMode ? "inquiry" : "job"}.`
          : `File was uploaded to this ${isInquiryMode ? "inquiry" : "job"}.`
      );
    }

    if (failed.length) {
      const firstMessage = failed[0]?.uploadError || "Unable to upload one or more files.";
      setLoadError(firstMessage);
      error(
        "Upload failed",
        failed.length === pendingUploads.length
          ? firstMessage
          : `${failed.length} file(s) failed. ${firstMessage}`
      );
    }

    setIsUploading(false);
  };

  const confirmDeleteUpload = async () => {
    if (!plugin || !deleteTarget?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUploadRecord({ plugin, id: deleteTarget.id });
      storeActions.replaceEntityCollection(
        "jobUploads",
        (uploads || []).filter(
          (item) => String(item?.id || "").trim() !== String(deleteTarget?.id || "").trim()
        )
      );
      success("Upload deleted", "Upload was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting upload", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete upload.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      data-section="uploads"
      className="grid grid-cols-1 gap-4 xl:grid-cols-[480px_1fr]"
    >
      <Card className="space-y-4">
        <h3 className="type-subheadline text-slate-800">Upload Files</h3>
        <div
          className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
            isDropActive
              ? "border-sky-500 bg-sky-50"
              : "border-slate-300 bg-slate-50"
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
                  <th className="w-1/2 px-2 py-2">Name</th>
                  <th className="w-1/4 px-2 py-2">Size</th>
                  <th className="w-1/4 px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!visiblePendingUploads.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={3}>
                      No pending files.
                    </td>
                  </tr>
                ) : (
                  visiblePendingUploads.map((record) => (
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

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="type-subheadline text-slate-800">Existing Uploads</h3>
        </div>

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
                  {!visibleExistingUploads.length ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={3}>
                        No uploads available.
                      </td>
                    </tr>
                  ) : (
                    visibleExistingUploads.map((record, index) => {
                      const uploadId = String(record?.id || "").trim();
                      const uploadUrl = String(record?.url || "").trim();
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
            {hasMoreExistingUploads ? (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Showing {visibleExistingUploads.length} of {uploads.length} uploads
                </span>
                <Button type="button" variant="outline" onClick={showMoreExistingUploads}>
                  Load {Math.min(remainingExistingUploadsCount, 100)} more
                </Button>
              </div>
            ) : isExistingUploadsWindowed ? (
              <div className="text-xs text-slate-500">
                Showing all {uploads.length} uploads.
              </div>
            ) : null}
          </>
        ) : null}
      </Card>

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
