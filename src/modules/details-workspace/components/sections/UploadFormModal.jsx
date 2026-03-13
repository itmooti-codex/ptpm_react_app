import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { PRESTART_ACTIVITY_OPTIONS } from "./uploadsConstants.js";
import { humanizeFieldLabel } from "./uploadsUtils.js";
import { toText } from "@shared/utils/formatters.js";

export function UploadFormModal({
  isOpen,
  onClose,
  editingUploadFormId,
  activeUploadFormConfig,
  uploadFormDraft,
  isSavingUploadForm,
  onFieldChange,
  onSave,
}) {
  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (isSavingUploadForm) return;
        onClose();
      }}
      title={`${editingUploadFormId ? "Edit" : "New"} ${activeUploadFormConfig.title}`}
      widthClass="max-w-[min(96vw,1040px)]"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSavingUploadForm}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            disabled={isSavingUploadForm}
          >
            {isSavingUploadForm ? "Saving..." : "Save Form"}
          </Button>
        </div>
      }
    >
      <div className="max-h-[76vh] space-y-3 overflow-y-auto pr-1">
        {activeUploadFormConfig.includeActivityDescription ? (
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Activity
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-[11px] font-medium text-slate-700">Activity Description</div>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                  value={toText(uploadFormDraft.activity_description)}
                  onChange={(event) => onFieldChange("activity_description", event.target.value)}
                >
                  <option value="">Select Activity</option>
                  {PRESTART_ACTIVITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {toText(uploadFormDraft.activity_description) === "Other" ? (
                <label className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-700">Activity Other</div>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    value={String(uploadFormDraft.activity_other ?? "")}
                    onChange={(event) => onFieldChange("activity_other", event.target.value)}
                    placeholder="Describe activity"
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="rounded border border-slate-200 p-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Checklist
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {activeUploadFormConfig.checkboxFields.map((fieldName) => (
              <label
                key={fieldName}
                className="inline-flex items-start gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#003882] focus:ring-[#003882]"
                  checked={Boolean(uploadFormDraft[fieldName])}
                  onChange={(event) => onFieldChange(fieldName, event.target.checked)}
                />
                <span>{humanizeFieldLabel(fieldName)}</span>
              </label>
            ))}
          </div>
        </div>

        {activeUploadFormConfig.numberFields.length ? (
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Quantities
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeUploadFormConfig.numberFields.map((fieldName) => (
                <label key={fieldName} className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-700">
                    {humanizeFieldLabel(fieldName)}
                  </div>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    value={toText(uploadFormDraft[fieldName])}
                    onChange={(event) => onFieldChange(fieldName, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {activeUploadFormConfig.datetimeFields.length ? (
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Date &amp; Time
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeUploadFormConfig.datetimeFields.map((fieldName) => (
                <label key={fieldName} className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-700">
                    {humanizeFieldLabel(fieldName)}
                  </div>
                  <input
                    type="datetime-local"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    value={toText(uploadFormDraft[fieldName])}
                    onChange={(event) => onFieldChange(fieldName, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {activeUploadFormConfig.textFields.length ? (
          <div className="rounded border border-slate-200 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Notes
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeUploadFormConfig.textFields.map((fieldName) => {
                const isMultiline =
                  activeUploadFormConfig.multilineTextFields.includes(fieldName);
                return (
                  <label key={fieldName} className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-700">
                      {humanizeFieldLabel(fieldName)}
                    </div>
                    {isMultiline ? (
                      <textarea
                        rows={3}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                        value={String(uploadFormDraft[fieldName] ?? "")}
                        onChange={(event) => onFieldChange(fieldName, event.target.value)}
                      />
                    ) : (
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                        value={String(uploadFormDraft[fieldName] ?? "")}
                        onChange={(event) => onFieldChange(fieldName, event.target.value)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
