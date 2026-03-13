import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobDirectSelector } from "../../hooks/useDetailsWorkspaceStore.jsx";
import { useServiceProviderLookupData } from "../../hooks/useServiceProviderLookupData.js";
import { JobDirectSplitSection } from "../primitives/WorkspaceLayoutPrimitives.jsx";
import { useRenderWindow } from "../primitives/WorkspaceTablePrimitives.jsx";
import { selectMaterials } from "../../state/selectors.js";
import { toText } from "@shared/utils/formatters.js";
import {
  defaultMaterialForm,
  parseMaterialFilePayload,
  resolveMaterialFileUrl,
  resolveTaxOptionValue,
  resolveTaxPayloadValue,
} from "./materialsUtils.js";
import { useMaterialsCrud } from "./useMaterialsCrud.js";
import { MaterialsFormPanel } from "./MaterialsFormPanel.jsx";
import { MaterialsTablePanel } from "./MaterialsTablePanel.jsx";

export function AddMaterialsSection({
  plugin,
  jobData,
  preloadedLookupData,
  layoutMode = "split",
  mode = "create",
  editingMaterialId = "",
  onRequestCreate = null,
  onRequestEdit = null,
  onSubmitSuccess = null,
}) {
  const jobId = toText(jobData?.id || jobData?.ID);
  const inquiryId = toText(jobData?.inquiry_record_id || jobData?.Inquiry_Record_ID);
  const materials = useJobDirectSelector(selectMaterials);
  const resolvedLayoutMode = String(layoutMode || "split").trim().toLowerCase();
  const isTableOnlyLayout = resolvedLayoutMode === "table";
  const isFormOnlyLayout = resolvedLayoutMode === "form";
  const showFormPanel = !isTableOnlyLayout;
  const showTablePanel = !isFormOnlyLayout;

  const { serviceProviders, addServiceProvider } = useServiceProviderLookupData(plugin, {
    initialProviders: preloadedLookupData?.serviceProviders || [],
    skipInitialFetch: true,
  });

  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("");
  const [activeActionId, setActiveActionId] = useState("");
  const [viewMaterial, setViewMaterial] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(defaultMaterialForm);
  const [editBaseline, setEditBaseline] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [isFileCleared, setIsFileCleared] = useState(false);

  const {
    hasMore: hasMoreMaterials,
    remainingCount: remainingMaterialsCount,
    showMore: showMoreMaterials,
    shouldWindow: isMaterialsWindowed,
    visibleRows: visibleMaterials,
  } = useRenderWindow(materials, {
    threshold: 180,
    pageSize: 120,
  });

  const isEditing = Boolean(form.id);

  const providerById = useMemo(() => {
    const map = new Map();
    serviceProviders.forEach((provider) => {
      map.set(provider.id, provider);
    });
    return map;
  }, [serviceProviders]);

  const resetForm = useCallback(() => {
    setForm(defaultMaterialForm());
    setEditBaseline(null);
    setPendingFile(null);
    setIsFileCleared(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleEdit = useCallback(
    (material) => {
      const providerId = toText(material?.service_provider_id || material?.Service_Provider_ID);
      const providerLabel = toText(material?.provider_name);
      if (providerId && providerLabel && !providerById.has(providerId)) {
        addServiceProvider({
          id: providerId,
          first_name: providerLabel,
          last_name: "",
          label: providerLabel,
          sms_number: "",
        });
      }

      const baselineFilePayload =
        parseMaterialFilePayload(material?.file_payload) ||
        parseMaterialFilePayload(material?.file ?? material?.File) ||
        parseMaterialFilePayload(material?.receipt ?? material?.Receipt) ||
        "";
      const baselineFileUrl = resolveMaterialFileUrl({
        ...material,
        file_payload: baselineFilePayload,
      });

      setForm({
        id: toText(material?.id || material?.ID),
        material_name: toText(material?.material_name || material?.Material_Name),
        total: toText(material?.total || material?.Total),
        description: toText(material?.description || material?.Description),
        transaction_type: toText(material?.transaction_type || material?.Transaction_Type),
        tax: resolveTaxOptionValue(material?.tax || material?.Tax),
        status: toText(material?.status || material?.Status) || "New",
        service_provider_id: providerId,
        file: baselineFileUrl,
        file_payload: baselineFilePayload,
      });
      setEditBaseline({
        material_name: toText(material?.material_name || material?.Material_Name),
        total: toText(material?.total || material?.Total),
        description: toText(material?.description || material?.Description),
        transaction_type: toText(material?.transaction_type || material?.Transaction_Type),
        tax: resolveTaxPayloadValue(material?.tax || material?.Tax),
        status: toText(material?.status || material?.Status) || "New",
        service_provider_id: providerId,
        file_url: baselineFileUrl,
        file_payload: baselineFilePayload,
      });
      setPendingFile(null);
      setIsFileCleared(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addServiceProvider, providerById]
  );

  useEffect(() => {
    if (!isFormOnlyLayout) return;
    const normalizedEditingId = toText(editingMaterialId);
    if (String(mode || "").trim().toLowerCase() === "update" && normalizedEditingId) {
      const matched = (materials || []).find(
        (material) => toText(material?.id || material?.ID) === normalizedEditingId
      );
      if (matched) {
        handleEdit(matched);
      }
      return;
    }
    resetForm();
  }, [editingMaterialId, handleEdit, isFormOnlyLayout, materials, mode, resetForm]);

  const { handleSubmit, handleDelete } = useMaterialsCrud({
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
  });

  return (
    <>
      <JobDirectSplitSection
        dataSection="add-materials"
        className={
          isTableOnlyLayout || isFormOnlyLayout
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 gap-4 xl:grid-cols-[440px_1fr]"
        }
      >
        {showFormPanel ? (
          <MaterialsFormPanel
            form={form}
            setForm={setForm}
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            submitStage={submitStage}
            serviceProviders={serviceProviders}
            fileInputRef={fileInputRef}
            pendingFile={pendingFile}
            setPendingFile={setPendingFile}
            setIsFileCleared={setIsFileCleared}
            handleSubmit={handleSubmit}
            resetForm={resetForm}
          />
        ) : null}

        {showTablePanel ? (
          <MaterialsTablePanel
            materials={materials}
            visibleMaterials={visibleMaterials}
            hasMoreMaterials={hasMoreMaterials}
            remainingMaterialsCount={remainingMaterialsCount}
            isMaterialsWindowed={isMaterialsWindowed}
            showMoreMaterials={showMoreMaterials}
            isTableOnlyLayout={isTableOnlyLayout}
            isSubmitting={isSubmitting}
            activeActionId={activeActionId}
            providerById={providerById}
            viewMaterial={viewMaterial}
            setViewMaterial={setViewMaterial}
            deleteTarget={deleteTarget}
            setDeleteTarget={setDeleteTarget}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            onRequestCreate={onRequestCreate}
            onRequestEdit={onRequestEdit}
          />
        ) : null}
      </JobDirectSplitSection>
    </>
  );
}
