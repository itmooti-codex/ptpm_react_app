import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  fetchDealRecordById,
  updateDealRecordById,
} from "../../sdk/jobDirectSdk.js";

const SALES_STAGE_OPTIONS = [
  { value: "New Lead", label: "New Lead" },
  { value: "Qualified Prospect", label: "Qualified Prospect" },
  { value: "Visit Scheduled", label: "Visit Scheduled" },
  { value: "Consideration", label: "Consideration" },
  { value: "Committed", label: "Committed" },
  { value: "Closed - Won", label: "Closed - Won" },
  { value: "Closed - Lost", label: "Closed - Lost" },
];

const RECENT_ACTIVITY_OPTIONS = [
  { value: "Active more than a month ago", label: "Active more than a month ago" },
  { value: "Active in the last month", label: "Active in the last month" },
  { value: "Active in the last week", label: "Active in the last week" },
];

const EMPTY_FORM = {
  deal_name: "",
  deal_value: "",
  sales_stage: "",
  expected_win: "",
  expected_close_date: "",
  actual_close_date: "",
  weighted_value: "",
  recent_activity: "",
};

function toStringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getCurrentInquiryRecordId(jobData) {
  const root = document.querySelector('[data-page="new-direct-job"]');
  const selectedId = toStringValue(
    root?.querySelector('[data-field="inquiry_record_id"]')?.value
  );
  if (selectedId) return selectedId;

  return toStringValue(
    jobData?.inquiry_record_id ||
      jobData?.Inquiry_Record_ID ||
      jobData?.inquiry_id ||
      jobData?.Inquiry_ID ||
      jobData?.Inquiry_Record?.id
  );
}

function toDateInput(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const text = String(value).trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (!Number.isFinite(num)) return "";
    const seconds = num > 4102444800 ? Math.floor(num / 1000) : num;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month}-${day}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUnixSeconds(dateInput) {
  const value = toStringValue(dateInput);
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function toNullable(value) {
  const text = toStringValue(value);
  return text ? text : null;
}

export function DealInformationModal({ open, onClose, plugin, jobData }) {
  const { success, error: showError } = useToast();
  const [dealId, setDealId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const hasInquiry = useMemo(() => Boolean(toStringValue(dealId)), [dealId]);

  useEffect(() => {
    if (!open) return;
    setLoadError("");
    setIsSaving(false);

    const resolvedInquiryId = getCurrentInquiryRecordId(jobData);
    setDealId(resolvedInquiryId);

    if (!resolvedInquiryId) {
      setForm(EMPTY_FORM);
      setIsLoading(false);
      return;
    }
    if (!plugin) {
      setForm(EMPTY_FORM);
      setIsLoading(false);
      setLoadError("SDK is still initializing. Please try again.");
      return;
    }

    let isActive = true;
    setIsLoading(true);
    fetchDealRecordById({ plugin, dealId: resolvedInquiryId })
      .then((record) => {
        if (!isActive) return;
        if (!record) {
          setForm(EMPTY_FORM);
          setLoadError("Unable to find inquiry details for this job.");
          return;
        }
        setForm({
          deal_name: toStringValue(record.deal_name),
          deal_value: toStringValue(record.deal_value),
          sales_stage: toStringValue(record.sales_stage),
          expected_win: toStringValue(record.expected_win),
          expected_close_date: toDateInput(record.expected_close_date),
          actual_close_date: toDateInput(record.actual_close_date),
          weighted_value: toStringValue(record.weighted_value),
          recent_activity: toStringValue(record.recent_activity),
        });
      })
      .catch((fetchError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed to load deal information", fetchError);
        setForm(EMPTY_FORM);
        setLoadError(fetchError?.message || "Unable to load inquiry details.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, plugin, jobData]);

  const updateField = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSave = async () => {
    if (!hasInquiry || !plugin || isSaving) return;
    setIsSaving(true);
    setLoadError("");
    try {
      await updateDealRecordById({
        plugin,
        dealId,
        payload: {
          deal_name: toNullable(form.deal_name),
          deal_value: toNullable(form.deal_value),
          sales_stage: toNullable(form.sales_stage),
          expected_win: toNullable(form.expected_win),
          expected_close_date: toUnixSeconds(form.expected_close_date),
          actual_close_date: toUnixSeconds(form.actual_close_date),
          weighted_value: toNullable(form.weighted_value),
          recent_activity: toNullable(form.recent_activity),
        },
      });
      success("Saved", "Deal information updated successfully.");
      onClose?.();
    } catch (saveError) {
      console.error("[JobDirect] Failed to update deal information", saveError);
      const message = saveError?.message || "Unable to save deal information right now.";
      setLoadError(message);
      showError("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deal Information"
      widthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasInquiry || isLoading || isSaving || Boolean(loadError)}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-1 py-1 text-sm text-slate-700">
        {!hasInquiry ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No inquiry related to this job.
          </div>
        ) : null}

        {hasInquiry && isLoading ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Loading inquiry details...
          </div>
        ) : null}

        {hasInquiry && !isLoading && loadError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        {hasInquiry && !isLoading && !loadError ? (
          <>
            <InputField
              label="Deal Name"
              value={form.deal_name}
              onChange={updateField("deal_name")}
              readOnly
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Deal Value"
                value={form.deal_value}
                onChange={updateField("deal_value")}
              />
              <SelectField
                label="Sales Stage"
                options={SALES_STAGE_OPTIONS}
                value={form.sales_stage}
                onChange={updateField("sales_stage")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <InputField
                label="Expected Win Percentage"
                value={form.expected_win}
                onChange={updateField("expected_win")}
                placeholder="0"
              />
              <InputField
                label="Expected Close Date"
                type="date"
                value={form.expected_close_date}
                onChange={updateField("expected_close_date")}
              />
              <InputField
                label="Actual Close Date"
                type="date"
                value={form.actual_close_date}
                onChange={updateField("actual_close_date")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Weighted Value"
                value={form.weighted_value}
                onChange={updateField("weighted_value")}
              />
              <SelectField
                label="Recent Activity"
                options={RECENT_ACTIVITY_OPTIONS}
                value={form.recent_activity}
                onChange={updateField("recent_activity")}
              />
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
