import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  useDetailsWorkspaceSelector,
  useDetailsWorkspaceStoreActions,
} from "../../hooks/useDetailsWorkspaceStore.jsx";
import { selectJobUploads } from "../../state/selectors.js";
import { useRenderWindow } from "../primitives/WorkspaceTablePrimitives.jsx";
import {
  createInquiryUploadFromFile,
  createJobUploadFromFile,
  fetchInquiryUploads,
  fetchJobUploads,
} from "../../api/core/runtime.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  PRESTART_FORM_KIND,
  UPLOAD_FILTER_TABS,
} from "./uploadsConstants.js";
import {
  buildUploadFormDraft,
  dedupeUploadRecords,
  normalizeJobId,
  normalizeRecordId,
  readUploadsCache,
  resolveUploadCategory,
  writeUploadsCache,
} from "./uploadsUtils.js";

export function useUploadsPending({
  plugin,
  jobData,
  additionalCreatePayload,
  uploadsMode,
  inquiryId,
  inquiryUid,
  linkedJobId,
  highlightUploadId,
  enableFormUploads,
}) {
  const { success, error } = useToast();
  const storeActions = useDetailsWorkspaceStoreActions();
  const uploads = useDetailsWorkspaceSelector(selectJobUploads);

  const [pendingUploads, setPendingUploads] = useState([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [activeUploadsTab, setActiveUploadsTab] = useState("all");
  const [isUploadFormModalOpen, setIsUploadFormModalOpen] = useState(false);
  const [uploadFormKind, setUploadFormKind] = useState(PRESTART_FORM_KIND);
  const [uploadFormDraft, setUploadFormDraft] = useState(() =>
    buildUploadFormDraft(PRESTART_FORM_KIND)
  );
  const [editingUploadFormId, setEditingUploadFormId] = useState("");
  const [isSavingUploadForm, setIsSavingUploadForm] = useState(false);
  const [togglingCustomerCanViewId, setTogglingCustomerCanViewId] = useState("");

  const sectionRef = useRef(null);
  const inputRef = useRef(null);
  const pendingUploadsRef = useRef([]);

  const formsEnabled = Boolean(enableFormUploads);
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

  const mode =
    String(uploadsMode || "job").trim().toLowerCase() === "inquiry" ? "inquiry" : "job";
  const isInquiryMode = mode === "inquiry";
  const targetRecordId = isInquiryMode ? normalizedInquiryId : jobId;
  const uploadsCacheMode = isInquiryMode ? "inquiry" : "job";
  const normalizedHighlightUploadId = normalizeRecordId(highlightUploadId);
  const announcementInquiryId = isInquiryMode ? normalizedInquiryId : inquiryIdFromPayload;
  const announcementJobId = isInquiryMode ? normalizedLinkedJobId : jobId;

  const effectiveAdditionalPayload = useMemo(
    () => ({
      ...(additionalCreatePayload && typeof additionalCreatePayload === "object"
        ? additionalCreatePayload
        : {}),
      ...(isInquiryMode && normalizedLinkedJobId
        ? { job_id: normalizedLinkedJobId, Job_ID: normalizedLinkedJobId }
        : {}),
    }),
    [additionalCreatePayload, isInquiryMode, normalizedLinkedJobId]
  );

  const filteredUploads = useMemo(() => {
    if (!formsEnabled || activeUploadsTab === "all") return uploads;
    return (Array.isArray(uploads) ? uploads : []).filter(
      (record) => resolveUploadCategory(record) === activeUploadsTab
    );
  }, [formsEnabled, activeUploadsTab, uploads]);

  const uploadTabCounts = useMemo(() => {
    const uploadRows = Array.isArray(uploads) ? uploads : [];
    const counts = { all: uploadRows.length, photo: 0, file: 0, forms: 0 };
    uploadRows.forEach((record) => {
      const category = resolveUploadCategory(record);
      if (!counts[category] && counts[category] !== 0) return;
      counts[category] += 1;
    });
    return counts;
  }, [uploads]);

  const editingUploadRecord = useMemo(() => {
    if (!editingUploadFormId) return null;
    return (
      (Array.isArray(uploads) ? uploads : []).find(
        (record) => normalizeRecordId(record?.id || record?.ID) === editingUploadFormId
      ) || null
    );
  }, [uploads, editingUploadFormId]);

  const {
    hasMore: hasMorePendingUploads,
    remainingCount: remainingPendingUploadsCount,
    showMore: showMorePendingUploads,
    shouldWindow: isPendingUploadsWindowed,
    visibleRows: visiblePendingUploads,
  } = useRenderWindow(pendingUploads, { threshold: 150, pageSize: 100 });

  const {
    hasMore: hasMoreExistingUploads,
    remainingCount: remainingExistingUploadsCount,
    showMore: showMoreExistingUploads,
    shouldWindow: isExistingUploadsWindowed,
    visibleRows: visibleExistingUploads,
  } = useRenderWindow(filteredUploads, { threshold: 150, pageSize: 100 });

  // Load uploads effect
  useEffect(() => {
    let isActive = true;
    if (!plugin || !targetRecordId) {
      storeActions.replaceEntityCollection("jobUploads", []);
      setLoadError("");
      setIsLoading(false);
      return undefined;
    }

    const cachedUploads = readUploadsCache(uploadsCacheMode, targetRecordId);
    if (cachedUploads) {
      storeActions.replaceEntityCollection("jobUploads", cachedUploads.records || []);
      setIsLoading(false);
      setLoadError("");
    } else {
      setIsLoading(true);
      setLoadError("");
    }

    const fetchPromise = isInquiryMode
      ? fetchInquiryUploads({ plugin, inquiryId: normalizedInquiryId })
      : fetchJobUploads({ plugin, jobId });

    fetchPromise
      .then((records) => {
        if (!isActive) return;
        const normalizedRecords = dedupeUploadRecords(records || []);
        storeActions.replaceEntityCollection("jobUploads", normalizedRecords);
        writeUploadsCache(uploadsCacheMode, targetRecordId, normalizedRecords);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading job uploads", fetchError);
        if (!cachedUploads) {
          storeActions.replaceEntityCollection("jobUploads", []);
          setLoadError("Unable to load uploads.");
        }
      })
      .finally(() => {
        if (!isActive) return;
        if (!cachedUploads) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    targetRecordId,
    isInquiryMode,
    normalizedInquiryId,
    jobId,
    storeActions,
    uploadsCacheMode,
  ]);

  // Keep ref in sync with pending uploads
  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  // Revoke object URLs on unmount
  useEffect(
    () => () => {
      pendingUploadsRef.current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  // Clear pending uploads when target record changes
  useEffect(() => {
    setPendingUploads((previous) => {
      previous.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [targetRecordId]);

  // Reset tab to "all" when forms disabled
  useEffect(() => {
    if (!formsEnabled && activeUploadsTab !== "all") {
      setActiveUploadsTab("all");
    }
  }, [formsEnabled, activeUploadsTab]);

  // When highlight upload exists, ensure "all" tab is active
  useEffect(() => {
    if (!normalizedHighlightUploadId || activeUploadsTab === "all") return;
    const exists = (Array.isArray(uploads) ? uploads : []).some(
      (record) => normalizeRecordId(record?.id || record?.ID) === normalizedHighlightUploadId
    );
    if (exists) {
      setActiveUploadsTab("all");
    }
  }, [activeUploadsTab, normalizedHighlightUploadId, uploads]);

  // Expand window to show highlighted upload
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

  // Scroll highlighted upload into view
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
          customerCanView: false,
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

  const togglePendingUploadCustomerCanView = (pendingId) => {
    setPendingUploads((previous) =>
      previous.map((item) =>
        item.id === pendingId ? { ...item, customerCanView: !item.customerCanView } : item
      )
    );
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
        const perFilePayload = {
          ...effectiveAdditionalPayload,
          customer_can_view: pending.customerCanView === true,
        };
        const saved = isInquiryMode
          ? await createInquiryUploadFromFile({
              plugin,
              inquiryId: normalizedInquiryId,
              file: pending.file,
              uploadPath: `inquiry-uploads/${normalizedInquiryId || inquiryUid || "inquiry"}`,
              additionalPayload: perFilePayload,
            })
          : await createJobUploadFromFile({
              plugin,
              jobId,
              file: pending.file,
              uploadPath: `job-uploads/${jobId}`,
              additionalPayload: perFilePayload,
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

  return {
    sectionRef, inputRef,
    uploads, filteredUploads, uploadTabCounts, editingUploadRecord,
    pendingUploads,
    isDropActive, isLoading, loadError, setLoadError, isUploading,
    deleteTarget, setDeleteTarget, isDeleting, setIsDeleting,
    previewTarget, setPreviewTarget,
    activeUploadsTab, setActiveUploadsTab,
    isUploadFormModalOpen, setIsUploadFormModalOpen,
    uploadFormKind, setUploadFormKind,
    uploadFormDraft, setUploadFormDraft,
    editingUploadFormId, setEditingUploadFormId,
    isSavingUploadForm, setIsSavingUploadForm,
    togglingCustomerCanViewId, setTogglingCustomerCanViewId,
    formsEnabled, jobId, normalizedInquiryId, normalizedLinkedJobId,
    isInquiryMode, targetRecordId, normalizedHighlightUploadId,
    announcementInquiryId, announcementJobId, effectiveAdditionalPayload,
    hasMorePendingUploads, remainingPendingUploadsCount, showMorePendingUploads,
    isPendingUploadsWindowed, visiblePendingUploads,
    hasMoreExistingUploads, remainingExistingUploadsCount, showMoreExistingUploads,
    isExistingUploadsWindowed, visibleExistingUploads,
    triggerFilePicker, queuePendingFiles, handleFilesSelected,
    handleDropZoneDragOver, handleDropZoneDragLeave, handleDropZoneDrop,
    togglePendingUploadCustomerCanView, removePendingUpload, savePendingUploads,
    success, error, storeActions,
  };
}
