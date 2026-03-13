import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { ColorSelectField } from "../../../../shared/components/ui/ColorSelectField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import {
  JobDirectCardFormPanel,
  JobDirectFormActionsRow,
} from "../primitives/WorkspaceLayoutPrimitives.jsx";
import {
  EyeActionIcon,
  TrashActionIcon,
} from "../icons/ActionIcons.jsx";
import {
  MATERIAL_STATUS_OPTIONS,
  MATERIAL_TAX_OPTIONS,
  MATERIAL_TRANSACTION_TYPE_OPTIONS,
} from "../../constants/options.js";
import { getFileNameFromUrl } from "./materialsUtils.js";
import { toText } from "../../../../shared/utils/formatters.js";

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

export function MaterialsFormPanel({
  form,
  setForm,
  isEditing,
  isSubmitting,
  submitStage,
  serviceProviders,
  fileInputRef,
  pendingFile,
  setPendingFile,
  setIsFileCleared,
  handleSubmit,
  resetForm,
}) {
  const currentFileUrl = toText(form.file);
  const displayedFileName = pendingFile?.file?.name || getFileNameFromUrl(currentFileUrl);
  const hasSelectedFile = Boolean(pendingFile?.file || currentFileUrl);

  return (
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
          <Button type="submit" variant="primary" disabled={isSubmitting}>
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
  );
}
