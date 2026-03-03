import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { ColorSelectField } from "../../../../shared/components/ui/ColorSelectField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useJobDirectSelector, useJobDirectStoreActions } from "../../hooks/useJobDirectStore.jsx";
import { useServiceProviderLookupData } from "../../hooks/useServiceProviderLookupData.js";
import { showMutationErrorToast } from "../../utils/mutationFeedback.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  DocumentActionIcon,
  EditActionIcon,
  EyeActionIcon,
  TrashActionIcon,
} from "../icons/ActionIcons.jsx";
import {
  JobDirectCardFormPanel,
  JobDirectCardTablePanel,
  JobDirectFormActionsRow,
  JobDirectSplitSection,
} from "../primitives/JobDirectLayout.jsx";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectTable,
  useRenderWindow,
} from "../primitives/JobDirectTable.jsx";
import {
  MATERIAL_STATUS_OPTIONS,
  MATERIAL_TAX_OPTIONS,
  MATERIAL_TRANSACTION_TYPE_OPTIONS,
} from "../../constants/options.js";
import { selectMaterials } from "../../state/selectors.js";
import {
  createMaterialRecord,
  deleteMaterialRecord,
  uploadMaterialFile,
  updateMaterialRecord,
} from "../../sdk/jobDirectSdk.js";

function toText(value) {
  return String(value ?? "").trim();
}

function toId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return normalized;
}

function formatDateForDisplay(value) {
  const text = toText(value);
  if (!text) return "-";

  let date;
  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      date = new Date(asMs);
    }
  }

  if (!date) {
    date = new Date(text);
  }
  if (Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function extractFileUrl(input) {
  if (!input) return "";
  if (typeof input === "string") {
    const stripWrappingQuotes = (value = "") => {
      let next = toText(value);
      while (
        (next.startsWith('"') && next.endsWith('"')) ||
        (next.startsWith("'") && next.endsWith("'"))
      ) {
        next = next.slice(1, -1).trim();
      }
      return next;
    };

    let value = stripWrappingQuotes(input);
    if (!value) return "";

    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      try {
        value = stripWrappingQuotes(decodeURIComponent(value));
      } catch {
        // keep as-is
      }
    }

    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        return extractFileUrl(parsed);
      } catch {
        return value;
      }
    }

    return value;
  }
  if (typeof input === "object") {
    if (input?.File) {
      const nested = extractFileUrl(input.File);
      if (nested) return nested;
    }
    return toText(input?.link || input?.url || input?.src || input?.path);
  }
  return "";
}

function parseMaterialFilePayload(input) {
  if (!input) return "";
  if (typeof input === "object") {
    if (input?.File) return parseMaterialFilePayload(input.File);
    const link = extractFileUrl(input?.link || input?.url || input?.src || input?.path);
    if (!link) return "";
    return {
      link,
      name: toText(input?.name || input?.filename) || getFileNameFromUrl(link),
      size: input?.size ?? "",
      type: toText(input?.type || input?.mime),
      s3_id: toText(input?.s3_id || input?.s3Id),
    };
  }

  if (typeof input === "string") {
    const text = toText(input);
    if (!text) return "";
    try {
      if (text.startsWith("{") || text.startsWith("[")) {
        const parsed = JSON.parse(text);
        return parseMaterialFilePayload(parsed);
      }
    } catch {
      // Ignore parse failure and treat as URL.
    }
    const link = extractFileUrl(text);
    if (!link) return "";
    return buildFilePayloadFromUrl(link);
  }
  return "";
}

function resolveMaterialFileUrl(material) {
  return (
    extractFileUrl(material?.file_url) ||
    extractFileUrl(material?.file_payload) ||
    extractFileUrl(material?.file) ||
    extractFileUrl(material?.File) ||
    extractFileUrl(material?.receipt) ||
    extractFileUrl(material?.Receipt)
  );
}

function buildFilePayloadFromUrl(url) {
  const normalized = extractFileUrl(url);
  if (!normalized) return "";
  return {
    link: normalized,
    name: getFileNameFromUrl(normalized),
    size: "",
    type: "",
    s3_id: "",
  };
}

function getFileNameFromUrl(url) {
  const normalized = toText(url);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname || "";
    const fromPath = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(fromPath) || normalized;
  } catch (_) {
    return normalized.split("/").filter(Boolean).pop() || normalized;
  }
}

function resolveTaxOptionValue(rawValue) {
  const current = toText(rawValue).toLowerCase();
  if (!current) return "";
  const matched = MATERIAL_TAX_OPTIONS.find(
    (option) =>
      toText(option.value).toLowerCase() === current ||
      toText(option.label).toLowerCase() === current
  );
  return matched ? toText(matched.value) : toText(rawValue);
}

function resolveTaxPayloadValue(rawValue) {
  const current = toText(rawValue).toLowerCase();
  if (!current) return "";
  const matched = MATERIAL_TAX_OPTIONS.find(
    (option) =>
      toText(option.value).toLowerCase() === current ||
      toText(option.label).toLowerCase() === current
  );
  return matched ? toText(matched.label) : toText(rawValue);
}

function defaultMaterialForm() {
  return {
    id: "",
    material_name: "",
    total: "",
    description: "",
    transaction_type: "",
    tax: "",
    status: "New",
    service_provider_id: "",
    file: "",
    file_payload: "",
  };
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M16.3311 15.5156L12.7242 11.9095C13.7696 10.6544 14.2909 9.04453 14.1797 7.41486C14.0684 5.7852 13.3331 4.26116 12.1268 3.15979C10.9205 2.05843 9.33603 1.46453 7.70299 1.50164C6.06995 1.53875 4.51409 2.20402 3.35906 3.35906C2.20402 4.51409 1.53875 6.06995 1.50164 7.70299C1.46453 9.33603 2.05843 10.9205 3.15979 12.1268C4.26116 13.3331 5.7852 14.0684 7.41486 14.1797C9.04453 14.2909 10.6544 13.7696 11.9095 12.7242L15.5156 16.3311C15.5692 16.3847 15.6328 16.4271 15.7027 16.4561C15.7727 16.4851 15.8477 16.5 15.9234 16.5C15.9991 16.5 16.0741 16.4851 16.144 16.4561C16.214 16.4271 16.2776 16.3847 16.3311 16.3311C16.3847 16.2776 16.4271 16.214 16.4561 16.144C16.4851 16.0741 16.5 15.9991 16.5 15.9234C16.5 15.8477 16.4851 15.7727 16.4561 15.7027C16.4271 15.6328 16.3847 15.5692 16.3311 15.5156Z"
        fill="#78829D"
      />
    </svg>
  );
}

function ServiceProviderSearch({
  options,
  selectedId,
  onSelect,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedId) || null,
    [options, selectedId]
  );
  const [query, setQuery] = useState(selectedOption?.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.id, selectedOption?.label]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = toText(query).toLowerCase();
    if (!term) return options;
    return options.filter((option) => {
      const label = toText(option?.label).toLowerCase();
      const phone = toText(option?.phone).toLowerCase();
      return label.includes(term) || phone.includes(term);
    });
  }, [options, query]);

  return (
    <div ref={rootRef} className="w-full">
      <div className="text-sm font-medium leading-4 text-neutral-700">Service Provider</div>
      <div className="relative mt-2 w-full">
        <input
          type="text"
          data-field="material_service_provider_search"
          value={query}
          disabled={disabled}
          placeholder="Search by name, email, phone"
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            const normalizedNext = toText(next).toLowerCase();
            const normalizedSelected = toText(selectedOption?.label).toLowerCase();
            if (selectedId && normalizedNext !== normalizedSelected) {
              onSelect("");
            }
          }}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-3 inline-flex items-center rounded-md px-2 text-slate-400"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Search service provider"
        >
          <SearchIcon />
        </button>

        {open && !disabled ? (
          <div className="absolute z-30 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.length ? (
                filtered.map((option, index) => (
                  <li key={`material-sp-${option.id || option.label || "item"}-${index}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs text-neutral-700"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(option.id);
                        setQuery(option.label);
                        setOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      {option.phone ? (
                        <span className="text-[11px] text-slate-500">{option.phone}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-xs text-slate-400">No providers found.</li>
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AddMaterialsSection({ plugin, jobData, preloadedLookupData }) {
  const jobId = toText(jobData?.id || jobData?.ID);
  const inquiryId = toText(jobData?.inquiry_record_id || jobData?.Inquiry_Record_ID);
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const materials = useJobDirectSelector(selectMaterials);
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

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!plugin) {
        error("SDK unavailable", "Please wait for SDK initialization.");
        return;
      }
      if (!jobId) {
        error("Missing job", "Job ID is required to save materials.");
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

        if (isEditing) {
          const updatedMaterial = await updateMaterialRecord({
            plugin,
            id: toId(form.id),
            payload,
          });
          if (updatedMaterial) {
            storeActions.upsertEntityRecord("materials", updatedMaterial, { idField: "id" });
          }
          success("Material updated", "Material changes have been saved.");
        } else {
          const createdMaterial = await createMaterialRecord({ plugin, payload });
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
      success,
      error,
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
  }, [deleteTarget, plugin, materials, form.id, resetForm, storeActions, success, error]);

  const currentFileUrl = toText(form.file);
  const displayedFileName = pendingFile?.file?.name || getFileNameFromUrl(currentFileUrl);
  const hasSelectedFile = Boolean(pendingFile?.file || currentFileUrl);

  return (
    <>
      <JobDirectSplitSection dataSection="add-materials">
        <JobDirectCardFormPanel title={isEditing ? "Edit Material" : "Add Material"}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label="Material Name"
              data-field="material_name"
              value={form.material_name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, material_name: event.target.value }))
              }
            />

            <InputField
              label="Total"
              data-field="total"
              placeholder="$ 0.00"
              value={form.total}
              onChange={(event) => setForm((prev) => ({ ...prev, total: event.target.value }))}
            />

            <TextareaField
              label="Description"
              rows={2}
              data-field="description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label="Transaction Type"
                data-field="transaction_type"
                value={form.transaction_type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, transaction_type: event.target.value }))
                }
                options={MATERIAL_TRANSACTION_TYPE_OPTIONS}
              />
              <SelectField
                label="Tax"
                data-field="tax"
                value={form.tax}
                onChange={(event) => setForm((prev) => ({ ...prev, tax: event.target.value }))}
                options={MATERIAL_TAX_OPTIONS}
              />
              <ColorSelectField
                label="Status"
                data-field="status"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                options={MATERIAL_STATUS_OPTIONS}
              />
            </div>

            <ServiceProviderSearch
              options={serviceProviders}
              selectedId={toText(form.service_provider_id)}
              onSelect={(serviceProviderId) =>
                setForm((prev) => ({ ...prev, service_provider_id: serviceProviderId }))
              }
              disabled={isSubmitting}
            />

            <div className="space-y-2">
              <span className="type-label text-slate-600">Receipt</span>
              <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={false}
                    className="hidden"
                    onChange={(event) => {
                      const nextFile = Array.from(event?.target?.files || [])[0] || null;
                      setPendingFile(nextFile ? { file: nextFile } : null);
                      setIsFileCleared(false);
                    }}
                  />
                  {displayedFileName ? (
                    <span className="max-w-[240px] truncate text-xs text-slate-600">
                      {displayedFileName}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">No file selected</span>
                  )}
                </div>
                {hasSelectedFile ? (
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                      onClick={() => {
                        const url = pendingFile?.file
                          ? URL.createObjectURL(pendingFile.file)
                          : currentFileUrl;
                        if (!url) return;
                        window.open(url, "_blank", "noopener,noreferrer");
                        if (pendingFile?.file) {
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }
                      }}
                      title="View Receipt"
                      aria-label="View Receipt"
                    >
                      <EyeActionIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-rose-600 hover:border-rose-300 hover:text-rose-700"
                      onClick={() => {
                        if (pendingFile?.file) {
                          setPendingFile(null);
                          setIsFileCleared(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                          return;
                        }
                        setForm((prev) => ({ ...prev, file: "" }));
                        setIsFileCleared(true);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      title="Remove Receipt"
                      aria-label="Remove Receipt"
                    >
                      <TrashActionIcon />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <JobDirectFormActionsRow>
              <Button type="button" variant="ghost" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !jobId}>
                {isSubmitting
                  ? submitStage === "uploading"
                    ? "Uploading..."
                    : "Saving..."
                  : isEditing
                    ? "Update"
                    : "Add"}
              </Button>
            </JobDirectFormActionsRow>
          </form>
        </JobDirectCardFormPanel>

        <JobDirectCardTablePanel title="Materials">
          <JobDirectTable className="table-fixed" minWidthClass="min-w-[920px]">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-[22%] px-2 py-2">Material Name</th>
                  <th className="w-[13%] px-2 py-2">Total</th>
                  <th className="w-[16%] px-2 py-2">Transaction Type</th>
                  <th className="w-[13%] px-2 py-2">Tax</th>
                  <th className="w-[20%] px-2 py-2">Service Provider</th>
                  <th className="w-[16%] px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleMaterials.length ? (
                  visibleMaterials.map((material) => {
                    const materialId = toText(material?.id || material?.ID);
                    const isBusy = Boolean(materialId) && activeActionId === materialId;
                    const materialFileUrl = resolveMaterialFileUrl(material);
                    const providerName =
                      toText(material?.provider_name) ||
                      providerById.get(toText(material?.service_provider_id))?.label ||
                      "-";

                    return (
                      <tr key={materialId || material.material_name} className="border-b border-slate-100">
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(material?.material_name) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {formatCurrency(material?.total)}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(material?.transaction_type) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {toText(material?.tax) || "-"}
                        </td>
                        <td className="px-2 py-3 align-middle text-slate-700">
                          {providerName}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <div className="flex justify-end gap-1">
                            {materialFileUrl ? (
                              <JobDirectIconActionButton
                                onClick={() => {
                                  window.open(materialFileUrl, "_blank", "noopener,noreferrer");
                                }}
                                title="View Receipt"
                              >
                                <DocumentActionIcon />
                              </JobDirectIconActionButton>
                            ) : null}
                            <JobDirectIconActionButton
                              onClick={() => setViewMaterial(material)}
                              title="View Material"
                            >
                              <EyeActionIcon />
                            </JobDirectIconActionButton>
                            <JobDirectIconActionButton
                              onClick={() => handleEdit(material)}
                              disabled={isSubmitting || isBusy}
                              title="Edit Material"
                            >
                              <EditActionIcon />
                            </JobDirectIconActionButton>
                            <JobDirectIconActionButton
                              variant="danger"
                              onClick={() => setDeleteTarget(material)}
                              disabled={isSubmitting || isBusy}
                              title="Delete Material"
                            >
                              <TrashActionIcon />
                            </JobDirectIconActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <JobDirectEmptyTableRow colSpan={6} message="No materials found." />
                )}
              </tbody>
          </JobDirectTable>
          {hasMoreMaterials ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visibleMaterials.length} of {materials.length} materials
              </span>
              <Button type="button" variant="outline" onClick={showMoreMaterials}>
                Load {Math.min(remainingMaterialsCount, 120)} more
              </Button>
            </div>
          ) : isMaterialsWindowed ? (
            <div className="mt-3 text-xs text-slate-500">
              Showing all {materials.length} materials.
            </div>
          ) : null}
        </JobDirectCardTablePanel>
      </JobDirectSplitSection>

      <Modal
        open={Boolean(viewMaterial)}
        onClose={() => setViewMaterial(null)}
        title="Material Details"
        widthClass="max-w-3xl"
      >
        {viewMaterial ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Material Name:</span>{" "}
              {toText(viewMaterial.material_name) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Date Added:</span>{" "}
              {formatDateForDisplay(viewMaterial.created_at)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Total:</span>{" "}
              {formatCurrency(viewMaterial.total)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Status:</span>{" "}
              {toText(viewMaterial.status) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Transaction Type:</span>{" "}
              {toText(viewMaterial.transaction_type) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Tax:</span> {toText(viewMaterial.tax) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Description:</span>{" "}
              {toText(viewMaterial.description) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Receipt:</span>{" "}
              {resolveMaterialFileUrl(viewMaterial) ? (
                <a
                  href={resolveMaterialFileUrl(viewMaterial)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#003882] underline underline-offset-2"
                >
                  {getFileNameFromUrl(resolveMaterialFileUrl(viewMaterial)) || "View receipt"}
                </a>
              ) : (
                "-"
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (activeActionId) return;
          setDeleteTarget(null);
        }}
        title="Delete Material?"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(activeActionId)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={Boolean(activeActionId)}
            >
              {activeActionId ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this material?
        </p>
      </Modal>
    </>
  );
}
