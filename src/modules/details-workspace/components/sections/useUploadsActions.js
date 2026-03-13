import {
  createInquiryUploadRecord,
  createJobUploadRecord,
  deleteUploadRecord,
  updateUploadRecordFields,
} from "../../api/core/runtime.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  FORM_KIND_CONFIG,
  PCA_FORM_KIND,
  PRESTART_FORM_KIND,
} from "./uploadsConstants.js";
import { toText } from "@shared/utils/formatters.js";
import {
  buildUploadFormDraft,
  buildUploadFormPayload,
  buildUploadFormDisplayName,
  dedupeUploadRecords,
  inferUploadFormKind,
  normalizeRecordId,
} from "./uploadsUtils.js";

export function useUploadsActions(pendingState) {
  const {
    plugin,
    uploads,
    storeActions,
    success,
    error,
    jobId,
    normalizedInquiryId,
    normalizedLinkedJobId,
    isInquiryMode,
    targetRecordId,
    announcementInquiryId,
    announcementJobId,
    effectiveAdditionalPayload,
    editingUploadRecord,
    editingUploadFormId,
    uploadFormKind,
    uploadFormDraft,
    isSavingUploadForm,
    deleteTarget,
    isDeleting,
    togglingCustomerCanViewId,
    setTogglingCustomerCanViewId,
    setUploadFormKind,
    setUploadFormDraft,
    setEditingUploadFormId,
    setIsUploadFormModalOpen,
    setIsSavingUploadForm,
    setDeleteTarget,
    setIsDeleting,
  } = pendingState;

  const activeUploadFormConfig =
    FORM_KIND_CONFIG[uploadFormKind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];

  const toggleCustomerCanView = async (record) => {
    const uploadId = String(record?.id || "").trim();
    if (!plugin || !uploadId || togglingCustomerCanViewId === uploadId) return;
    const next = !record.customer_can_view;
    setTogglingCustomerCanViewId(uploadId);
    try {
      await updateUploadRecordFields({ plugin, id: uploadId, payload: { customer_can_view: next } });
      storeActions.replaceEntityCollection(
        "jobUploads",
        (uploads || []).map((u) =>
          String(u?.id || "").trim() === uploadId ? { ...u, customer_can_view: next } : u
        )
      );
      success(
        next ? "Visible to customer" : "Hidden from customer",
        next
          ? "This upload is now visible to the customer."
          : "This upload is now hidden from the customer."
      );
    } catch {
      error("Update failed", "Could not update customer visibility. Please try again.");
    } finally {
      setTogglingCustomerCanViewId("");
    }
  };

  const openCreateUploadForm = (kind = PRESTART_FORM_KIND) => {
    if (!plugin || !targetRecordId) {
      error(
        "Cannot save form",
        isInquiryMode ? "Inquiry record is not loaded yet." : "Job record is not loaded yet."
      );
      return;
    }
    const resolvedKind =
      kind === PCA_FORM_KIND || kind === PRESTART_FORM_KIND ? kind : PRESTART_FORM_KIND;
    setUploadFormKind(resolvedKind);
    setUploadFormDraft(buildUploadFormDraft(resolvedKind));
    setEditingUploadFormId("");
    setIsUploadFormModalOpen(true);
  };

  const openEditUploadForm = (record = null) => {
    const uploadId = normalizeRecordId(record?.id || record?.ID);
    if (!uploadId) return;
    const resolvedKind = inferUploadFormKind(record);
    setUploadFormKind(resolvedKind);
    setUploadFormDraft(buildUploadFormDraft(resolvedKind, record));
    setEditingUploadFormId(uploadId);
    setIsUploadFormModalOpen(true);
  };

  const handleUploadFormFieldChange = (fieldName, value) => {
    pendingState.setUploadFormDraft((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  };

  const buildUploadAssociationPayload = (record = null) => {
    const base = {};
    const propertyId = normalizeRecordId(
      record?.property_name_id ||
        effectiveAdditionalPayload?.property_name_id ||
        effectiveAdditionalPayload?.Property_Name_ID
    );
    if (propertyId) {
      base.property_name_id = propertyId;
    }
    const resolvedInquiryId = normalizeRecordId(
      record?.inquiry_id ||
        normalizedInquiryId ||
        effectiveAdditionalPayload?.inquiry_id ||
        effectiveAdditionalPayload?.Inquiry_ID ||
        effectiveAdditionalPayload?.inquiry_record_id ||
        effectiveAdditionalPayload?.Inquiry_Record_ID
    );
    if (resolvedInquiryId) {
      base.inquiry_id = resolvedInquiryId;
    }
    const resolvedJobId = normalizeRecordId(
      record?.job_id ||
        jobId ||
        normalizedLinkedJobId ||
        effectiveAdditionalPayload?.job_id ||
        effectiveAdditionalPayload?.Job_ID
    );
    if (resolvedJobId) {
      base.job_id = resolvedJobId;
    }
    return base;
  };

  const saveUploadForm = async () => {
    if (!plugin || !targetRecordId || isSavingUploadForm) return;
    const displayName =
      toText(editingUploadRecord?.name) || buildUploadFormDisplayName(uploadFormKind, new Date());
    const payload = {
      ...buildUploadAssociationPayload(editingUploadRecord),
      ...buildUploadFormPayload({
        kind: uploadFormKind,
        draft: uploadFormDraft,
        displayName,
      }),
    };
    setIsSavingUploadForm(true);
    try {
      const saved = editingUploadFormId
        ? await updateUploadRecordFields({
            plugin,
            id: editingUploadFormId,
            payload,
          })
        : isInquiryMode
          ? await createInquiryUploadRecord({
              plugin,
              inquiryId: normalizedInquiryId,
              payload,
            })
          : await createJobUploadRecord({
              plugin,
              jobId,
              payload,
            });

      if (saved) {
        if (editingUploadFormId) {
          storeActions.replaceEntityCollection(
            "jobUploads",
            dedupeUploadRecords(
              (uploads || []).map((record) => {
                const recordId = normalizeRecordId(record?.id || record?.ID);
                return recordId === editingUploadFormId ? { ...record, ...saved } : record;
              })
            )
          );
          success("Form updated", `${activeUploadFormConfig.title} was updated.`);
        } else {
          storeActions.replaceEntityCollection(
            "jobUploads",
            dedupeUploadRecords([saved, ...(uploads || [])])
          );
          const createdUploadId = normalizeRecordId(saved?.id || saved?.ID);
          if (createdUploadId) {
            emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED,
              quoteJobId: announcementJobId,
              inquiryId: announcementInquiryId,
              focusId: createdUploadId,
              focusIds: [createdUploadId],
              dedupeEntityId: `${announcementJobId}:${announcementInquiryId}:upload_form:${createdUploadId}`,
              title: "New form added",
              content: `${activeUploadFormConfig.title} was added.`,
              logContext: "job-direct:UploadsSection:saveUploadForm",
            }).catch((announcementError) => {
              console.warn("[JobDirect] Upload form announcement emit failed", announcementError);
            });
          }
          success("Form added", `${activeUploadFormConfig.title} was added.`);
        }
      }
      setIsUploadFormModalOpen(false);
      setEditingUploadFormId("");
    } catch (saveError) {
      console.error("[JobDirect] Failed saving upload form", saveError);
      error("Unable to save form", saveError?.message || "Please try again.");
    } finally {
      setIsSavingUploadForm(false);
    }
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

  return {
    activeUploadFormConfig,
    toggleCustomerCanView,
    openCreateUploadForm,
    openEditUploadForm,
    handleUploadFormFieldChange,
    buildUploadAssociationPayload,
    saveUploadForm,
    confirmDeleteUpload,
  };
}
