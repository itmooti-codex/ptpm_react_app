import { useCallback } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useJobDirectStoreActions } from "../../hooks/useDetailsWorkspaceStore.jsx";
import { showMutationErrorToast } from "../../utils/mutationFeedback.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  createMaterialRecord,
  deleteMaterialRecord,
  uploadMaterialFile,
  updateMaterialRecord,
} from "../../api/core/runtime.js";
import { toText } from "@shared/utils/formatters.js";
import {
  toId,
  resolveTaxPayloadValue,
  parseMaterialFilePayload,
  buildFilePayloadFromUrl,
} from "./materialsUtils.js";

export function useMaterialsCrud({
  plugin,
  jobId,
  inquiryId,
  materials,
  form,
  editBaseline,
  pendingFile,
  isFileCleared,
  isEditing,
  resetForm,
  setIsSubmitting,
  setSubmitStage,
  setActiveActionId,
  setDeleteTarget,
  deleteTarget,
  onSubmitSuccess,
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!plugin) {
        error("SDK unavailable", "Please wait for SDK initialization.");
        return;
      }
      if (!jobId) {
        error("Create failed", "Job does not exist.");
        return;
      }
      if (!toText(form.material_name)) {
        error("Material name required", "Please enter a material name.");
        return;
      }

      setIsSubmitting(true);
      setSubmitStage(pendingFile?.file ? "uploading" : "saving");

      try {
        const nextValues = {
          material_name: toText(form.material_name),
          total: toText(form.total),
          description: toText(form.description),
          transaction_type: toText(form.transaction_type),
          tax: resolveTaxPayloadValue(form.tax),
          status: toText(form.status) || "New",
          service_provider_id: toText(form.service_provider_id),
        };

        const payload = {};
        if (isEditing) {
          const baseline = editBaseline || {};
          if (nextValues.material_name !== toText(baseline.material_name)) {
            payload.material_name = nextValues.material_name;
          }
          if (nextValues.total !== toText(baseline.total)) {
            payload.total = nextValues.total;
          }
          if (nextValues.description !== toText(baseline.description)) {
            payload.description = nextValues.description;
          }
          if (nextValues.transaction_type !== toText(baseline.transaction_type)) {
            payload.transaction_type = nextValues.transaction_type;
          }
          if (nextValues.tax !== toText(baseline.tax)) {
            payload.tax = nextValues.tax;
          }
          if (nextValues.status !== toText(baseline.status)) {
            payload.status = nextValues.status;
          }
          if (nextValues.service_provider_id !== toText(baseline.service_provider_id)) {
            payload.service_provider_id = nextValues.service_provider_id
              ? toId(nextValues.service_provider_id)
              : "";
          }
        } else {
          payload.job_id = toId(jobId);
          payload.material_name = nextValues.material_name;
          payload.total = nextValues.total;
          payload.description = nextValues.description;
          payload.transaction_type = nextValues.transaction_type;
          payload.tax = nextValues.tax;
          payload.status = nextValues.status;
          payload.service_provider_id = nextValues.service_provider_id
            ? toId(nextValues.service_provider_id)
            : "";
        }

        if (pendingFile?.file) {
          setSubmitStage("uploading");
          const uploaded = await uploadMaterialFile({
            file: pendingFile.file,
            uploadPath: "materials/receipts",
          });
          const uploadedUrl = toText(uploaded?.url);
          const uploadedFilePayload = parseMaterialFilePayload(uploaded?.fileObject || null);
          payload.file = uploadedFilePayload || buildFilePayloadFromUrl(uploadedUrl);
          payload.receipt = uploadedUrl;
        } else if (isFileCleared) {
          payload.file = "";
          payload.receipt = "";
        }

        if (isEditing && !Object.keys(payload).length) {
          success("No changes", "Nothing to update.");
          return;
        }

        setSubmitStage("saving");
        let savedMaterial = null;

        if (isEditing) {
          const updatedMaterial = await updateMaterialRecord({
            plugin,
            id: toId(form.id),
            payload,
          });
          savedMaterial = updatedMaterial;
          if (updatedMaterial) {
            storeActions.upsertEntityRecord("materials", updatedMaterial, { idField: "id" });
          }
          success("Material updated", "Material changes have been saved.");
        } else {
          const createdMaterial = await createMaterialRecord({ plugin, payload });
          savedMaterial = createdMaterial;
          if (createdMaterial) {
            storeActions.upsertEntityRecord("materials", createdMaterial, { idField: "id" });
            const materialId = toText(createdMaterial?.id || createdMaterial?.ID);
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.MATERIAL_ADDED,
              quoteJobId: jobId,
              inquiryId,
              focusId: materialId,
              dedupeEntityId: materialId || `${jobId}:${nextValues.material_name}`,
              title: "New material added",
              content: nextValues.material_name || "A new material item was added.",
              logContext: "job-direct:AddMaterialsSection:handleSubmit",
            });
          }
          success("Material added", "New material created successfully.");
        }
        if (typeof onSubmitSuccess === "function") {
          onSubmitSuccess(savedMaterial || null);
        }
        resetForm();
      } catch (submitError) {
        console.error("[JobDirect] Material save failed", submitError);
        showMutationErrorToast(error, {
          title: isEditing ? "Update failed" : "Create failed",
          error: submitError,
          fallbackMessage: "Unable to save material.",
        });
      } finally {
        setIsSubmitting(false);
        setSubmitStage("");
      }
    },
    [
      plugin,
      jobId,
      inquiryId,
      form,
      editBaseline,
      pendingFile,
      isFileCleared,
      isEditing,
      resetForm,
      storeActions,
      onSubmitSuccess,
      success,
      error,
      setIsSubmitting,
      setSubmitStage,
    ]
  );

  const handleDelete = useCallback(async () => {
    const targetId = toText(deleteTarget?.id || deleteTarget?.ID);
    if (!targetId || !plugin) return;

    setActiveActionId(targetId);
    try {
      const deletedId = await deleteMaterialRecord({
        plugin,
        id: toId(targetId),
      });
      success("Material deleted", "Material has been removed.");
      const normalizedDeletedId = toText(deletedId || targetId);
      const nextMaterials = (materials || []).filter(
        (item) => toText(item?.id || item?.ID) !== normalizedDeletedId
      );
      storeActions.replaceEntityCollection("materials", nextMaterials);
      if (toText(form.id) === targetId) resetForm();
    } catch (deleteError) {
      console.error("[JobDirect] Failed to delete material", deleteError);
      showMutationErrorToast(error, {
        title: "Delete failed",
        error: deleteError,
        fallbackMessage: "Unable to delete material.",
      });
    } finally {
      setActiveActionId("");
      setDeleteTarget(null);
    }
  }, [deleteTarget, plugin, materials, form.id, resetForm, storeActions, success, error, setActiveActionId, setDeleteTarget]);

  return { handleSubmit, handleDelete };
}
