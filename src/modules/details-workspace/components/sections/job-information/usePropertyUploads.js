import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import {
  useDetailsWorkspaceSelector,
  useDetailsWorkspaceStoreActions,
} from "../../../hooks/useDetailsWorkspaceStore.jsx";
import { selectPropertyUploadsByPropertyKey } from "../../../state/selectors.js";
import {
  createPropertyUploadFromFile,
  deleteUploadRecord,
  fetchPropertyUploads,
  subscribePropertyUploadsByPropertyId,
} from "../../../api/core/runtime.js";
import { dedupeUploadRecords, normalizePropertyId } from "./jobInfoUtils.js";

export function usePropertyUploads({
  plugin,
  resolvedPropertyId,
  announcementJobId,
  announcementInquiryId,
  success,
  error,
}) {
  const storeActions = useDetailsWorkspaceStoreActions();

  const [pendingPropertyUploads, setPendingPropertyUploads] = useState([]);
  const [isPropertyDropActive, setIsPropertyDropActive] = useState(false);
  const [isUploadsLoading, setIsUploadsLoading] = useState(false);
  const [uploadsLoadError, setUploadsLoadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteUploadTarget, setDeleteUploadTarget] = useState(null);
  const [isDeletingUpload, setIsDeletingUpload] = useState(false);
  const uploadsInputRef = useRef(null);
  const pendingPropertyUploadsRef = useRef([]);

  const propertyUploads = useDetailsWorkspaceSelector(
    useCallback(
      (state) => selectPropertyUploadsByPropertyKey(state, resolvedPropertyId),
      [resolvedPropertyId]
    )
  );

  const hasCachedPropertyUploads = useDetailsWorkspaceSelector(
    useCallback((state) => {
      const key = String(resolvedPropertyId || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.propertyUploadsByProperty || {},
        key
      );
    }, [resolvedPropertyId])
  );

  const mergePropertyUploadsForCurrentProperty = useCallback(
    (records = []) => {
      const currentId = normalizePropertyId(resolvedPropertyId);
      if (!currentId) return;
      const nextRecords = (Array.isArray(records) ? records : []).map((record) => ({
        ...record,
        property_name_id:
          normalizePropertyId(record?.property_name_id || record?.property_id) || currentId,
      }));
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        currentId,
        dedupeUploadRecords(nextRecords)
      );
    },
    [resolvedPropertyId, storeActions]
  );

  useEffect(() => {
    let isActive = true;
    if (!plugin || !resolvedPropertyId) {
      setUploadsLoadError("");
      setIsUploadsLoading(false);
      return undefined;
    }

    setIsUploadsLoading(!hasCachedPropertyUploads);
    setUploadsLoadError("");
    if (!hasCachedPropertyUploads) {
      fetchPropertyUploads({ plugin, propertyId: resolvedPropertyId })
        .then((records) => {
          if (!isActive) return;
          mergePropertyUploadsForCurrentProperty(records || []);
          setUploadsLoadError("");
        })
        .catch((fetchError) => {
          if (!isActive) return;
          console.error("[JobDirect] Failed loading property uploads", fetchError);
          setUploadsLoadError("Unable to load property uploads. Waiting for realtime updates.");
        })
        .finally(() => {
          if (!isActive) return;
          setIsUploadsLoading(false);
        });
    }

    const unsubscribe = subscribePropertyUploadsByPropertyId({
      plugin,
      propertyId: resolvedPropertyId,
      onChange: (records) => {
        if (!isActive) return;
        mergePropertyUploadsForCurrentProperty(records || []);
        setUploadsLoadError("");
      },
      onError: (subscriptionError) => {
        if (!isActive) return;
        console.error("[JobDirect] Property upload subscription error", subscriptionError);
      },
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [
    hasCachedPropertyUploads,
    mergePropertyUploadsForCurrentProperty,
    plugin,
    resolvedPropertyId,
  ]);

  useEffect(() => {
    pendingPropertyUploadsRef.current = pendingPropertyUploads;
  }, [pendingPropertyUploads]);

  useEffect(
    () => () => {
      pendingPropertyUploadsRef.current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  useEffect(() => {
    setPendingPropertyUploads((previous) => {
      previous.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [resolvedPropertyId]);

  const queuePendingPropertyFiles = (files = []) => {
    if (!files.length || !resolvedPropertyId) return;
    setPendingPropertyUploads((previous) => {
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

  const triggerUploadFilePicker = () => {
    if (!resolvedPropertyId) {
      error("Cannot upload", "Select a property first.");
      return;
    }
    uploadsInputRef.current?.click();
  };

  const handleUploadFilesSelected = (event) => {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    queuePendingPropertyFiles(files);
    if (input) input.value = "";
  };

  const handlePropertyDropZoneDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!resolvedPropertyId || isUploading) return;
    if (!isPropertyDropActive) setIsPropertyDropActive(true);
  };

  const handlePropertyDropZoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsPropertyDropActive(false);
  };

  const handlePropertyDropZoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsPropertyDropActive(false);
    if (!resolvedPropertyId || isUploading) return;
    const files = Array.from(event?.dataTransfer?.files || []);
    queuePendingPropertyFiles(files);
  };

  const removePendingPropertyUpload = (pendingId) => {
    setPendingPropertyUploads((previous) => {
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

  const savePendingPropertyUploads = async () => {
    if (!plugin || !resolvedPropertyId || !pendingPropertyUploads.length || isUploading) return;

    setIsUploading(true);
    setUploadsLoadError("");
    const created = [];
    const failed = [];

    for (const pending of pendingPropertyUploads) {
      try {
        const saved = await createPropertyUploadFromFile({
          plugin,
          propertyId: resolvedPropertyId,
          file: pending.file,
          uploadPath: `property-uploads/${resolvedPropertyId}`,
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
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        resolvedPropertyId,
        dedupeUploadRecords([...created, ...(propertyUploads || [])])
      );
      const createdUploadIds = created
        .map((record) => normalizePropertyId(record?.id || record?.ID))
        .filter(Boolean);
      emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED,
        quoteJobId: announcementJobId,
        inquiryId: announcementInquiryId,
        focusId: createdUploadIds.length === 1 ? createdUploadIds[0] : "",
        focusIds: createdUploadIds,
        dedupeEntityId:
          createdUploadIds.join(",") || `${announcementJobId}:${announcementInquiryId}:property_upload_batch`,
        title: created.length > 1 ? "Property uploads added" : "Property upload added",
        content:
          created.length > 1
            ? `${created.length} files were uploaded to the property.`
            : "A file was uploaded to the property.",
        logContext: "job-direct:PropertyTabSection:savePendingPropertyUploads",
      }).catch((announcementError) => {
        console.warn("[JobDirect] Property upload announcement emit failed", announcementError);
      });
    }

    setPendingPropertyUploads(failed);

    if (created.length) {
      success(
        created.length > 1 ? "Uploads added" : "Upload added",
        created.length > 1
          ? `${created.length} files were uploaded and linked to this property.`
          : "File was uploaded and linked to this property."
      );
    }

    if (failed.length) {
      const firstMessage = failed[0]?.uploadError || "Unable to upload one or more files.";
      setUploadsLoadError(firstMessage);
      error(
        "Upload failed",
        failed.length === pendingPropertyUploads.length
          ? firstMessage
          : `${failed.length} file(s) failed. ${firstMessage}`
      );
    }

    setIsUploading(false);
  };

  const confirmDeleteUpload = async () => {
    if (!plugin || !deleteUploadTarget?.id || isDeletingUpload) return;
    setIsDeletingUpload(true);
    try {
      await deleteUploadRecord({ plugin, id: deleteUploadTarget.id });
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        resolvedPropertyId,
        (propertyUploads || []).filter(
          (item) => String(item?.id || "").trim() !== String(deleteUploadTarget.id || "").trim()
        )
      );
      success("Upload deleted", "Property upload was removed.");
      setDeleteUploadTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting property upload", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete upload.");
    } finally {
      setIsDeletingUpload(false);
    }
  };

  return {
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
  };
}
