import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useJobDirectSelector, useJobDirectStoreActions } from "../../hooks/useJobDirectStore.jsx";
import {
  ClientInvoicePanel,
  ServiceProviderBillPanel,
} from "./invoice/InvoicePanels.jsx";
import {
  PAYMENT_STATUS_OPTIONS,
  XERO_BILL_STATUS_OPTIONS,
  XERO_INVOICE_STATUS_OPTIONS,
} from "../../constants/options.js";
import {
  selectBillMaterialSummary,
  selectDefaultInvoiceActivityIds,
} from "../../state/derivedSelectors.js";
import {
  selectActivities,
  selectJobEntity,
  selectMaterials,
} from "../../state/selectors.js";
import {
  updateInvoiceTriggerByJobId,
  updateJobRecordById,
  waitForJobInvoiceApiResponseChange,
} from "../../sdk/jobDirectSdk.js";

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toDateInput(value) {
  const text = toText(value);
  if (!text) return "";

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric)) {
      const asMs = String(Math.abs(numeric)).length <= 10 ? numeric * 1000 : numeric;
      const date = new Date(asMs);
      if (!Number.isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toEpochSecondsFromDateInput(value) {
  const text = toText(value);
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function formatDateDisplay(value) {
  const iso = toDateInput(value);
  if (!iso) return "-";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatDateTimeDisplay(value) {
  const text = toText(value);
  if (!text) return "-";

  let date = null;
  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric)) {
      const asMs = String(Math.abs(numeric)).length <= 10 ? numeric * 1000 : numeric;
      date = new Date(asMs);
    }
  } else {
    date = new Date(text);
  }

  if (!date || Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function resolveStatusOption(options = [], value = "") {
  const key = normalizeStatus(value);
  if (!key) return null;
  return (
    options.find((item) => normalizeStatus(item?.value) === key) ||
    options.find((item) => normalizeStatus(item?.label) === key) ||
    null
  );
}

function isTrue(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeStatus(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function lineAmount(record) {
  const quantity = Math.max(1, toNumber(record?.quantity || 1));
  const price = toNumber(record?.activity_price || record?.quoted_price || 0);
  return round2(quantity * price);
}

function createStatusStyle(option) {
  if (!option) return undefined;
  return {
    color: option.color,
    backgroundColor: option.backgroundColor,
  };
}

function statusWithFallback(status, palette) {
  const raw = toText(status);
  if (!raw) {
    return {
      label: "Not Synced",
      style: createStatusStyle(resolveStatusOption(palette, "Not Synced")),
    };
  }
  const option = resolveStatusOption(palette, raw);
  return {
    label: option?.label || raw,
    style: createStatusStyle(option),
  };
}

function statusFromRawValue(status, palette) {
  const raw = toText(status);
  if (!raw) {
    return {
      label: "--",
      style: {
        color: "#475569",
        backgroundColor: "#f1f5f9",
      },
    };
  }
  const option = resolveStatusOption(palette, raw);
  return {
    label: option?.label || raw,
    style: option
      ? createStatusStyle(option)
      : {
          color: "#475569",
          backgroundColor: "#f1f5f9",
        },
  };
}

function resolveApiResponseTone(responseText = "") {
  const text = normalizeStatus(responseText);
  if (!text) {
    return {
      tone: "idle",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      title: "Xero API Response",
    };
  }
  if (/error|fail|failed|invalid|unable|cancel|denied|rejected/.test(text)) {
    return {
      tone: "error",
      className: "border-red-200 bg-red-50 text-red-700",
      title: "Xero API Response (Error)",
    };
  }
  if (/pending|processing|in progress|queued|wait/.test(text)) {
    return {
      tone: "pending",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Xero API Response (Processing)",
    };
  }
  if (/success|created|updated|complete|completed|ok/.test(text)) {
    return {
      tone: "success",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      title: "Xero API Response (Success)",
    };
  }
  return {
    tone: "info",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    title: "Xero API Response",
  };
}

function collectMaterialSummary(materials = []) {
  return (Array.isArray(materials) ? materials : []).reduce(
    (acc, item) => {
      const total = toNumber(item?.total || item?.Total);
      const transactionType = normalizeStatus(item?.transaction_type || item?.Transaction_Type);
      if (transactionType === "reimburse") acc.reimburse += total;
      if (transactionType === "deduct") acc.deduct += total;
      return acc;
    },
    { reimburse: 0, deduct: 0 }
  );
}

function hasRenderableActivityRecord(record = {}) {
  if (!record || typeof record !== "object") return false;
  const task = toText(record?.task || record?.Task);
  const option = toText(record?.option || record?.Option);
  const serviceName = toText(record?.service_name || record?.Service_Service_Name);
  const activityText = toText(record?.activity_text || record?.Activity_Text);
  const note = toText(record?.note || record?.Note);
  const warranty = toText(record?.warranty || record?.Warranty);
  const quantity = toNumber(record?.quantity || record?.Quantity || 0);
  const price = toNumber(record?.activity_price || record?.Activity_Price || record?.quoted_price || 0);

  return Boolean(
    task ||
      option ||
      serviceName ||
      activityText ||
      note ||
      warranty ||
      quantity > 0 ||
      price > 0
  );
}

function buildAccountSummary(job = {}) {
  const accountType =
    normalizeStatus(job?.account_type || job?.Account_Type) === "company"
      ? "Company"
      : "Contact";
  const accountsContact = job?.Accounts_Contact?.Contact || {};
  const accountsContactFirstName = toText(
    job?.accounts_contact_contact_first_name ||
      job?.Contact_First_Name1 ||
      job?.Accounts_Contact_Contact_First_Name ||
      accountsContact?.first_name ||
      accountsContact?.First_Name
  );
  const accountsContactLastName = toText(
    job?.accounts_contact_contact_last_name ||
      job?.Contact_Last_Name1 ||
      job?.Accounts_Contact_Contact_Last_Name ||
      accountsContact?.last_name ||
      accountsContact?.Last_Name
  );
  const accountsContactName = [accountsContactFirstName, accountsContactLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const accountsContactEmail = toText(
    job?.accounts_contact_contact_email ||
      job?.ContactEmail1 ||
      job?.Accounts_Contact_Contact_Email ||
      accountsContact?.email ||
      accountsContact?.Email
  );

  return {
    accountType,
    accountName: accountsContactName || "--",
    accountEmail: accountsContactEmail || "--",
    accountId:
      accountType === "Company"
        ? normalizeId(job?.client_entity_id || job?.Client_Entity_ID)
        : normalizeId(job?.client_individual_id || job?.Client_Individual_ID),
    accountsContactId:
      normalizeId(job?.accounts_contact_id || job?.Accounts_Contact_ID) ||
      normalizeId(job?.contact_id || job?.Contact_ID) ||
      normalizeId(job?.client_individual_id || job?.Client_Individual_ID) ||
      "",
    contactXeroId: toText(job?.client_individual_xero_contact_id || job?.Client_Individual_Xero_Contact_ID),
    companyXeroId: toText(job?.client_entity_xero_contact_id || job?.Client_Entity_Xero_Contact_ID),
  };
}

function buildServiceProviderSummary(job = {}) {
  const firstName = toText(
    job?.primary_service_provider_contact_first_name ||
      job?.Primary_Service_Provider_Contact_First_Name ||
      job?.Contact_First_Name2 ||
      job?.Primary_Service_Provider?.Contact_Information?.first_name ||
      job?.Primary_Service_Provider?.Contact_Information?.First_Name
  );
  const lastName = toText(
    job?.primary_service_provider_contact_last_name ||
      job?.Primary_Service_Provider_Contact_Last_Name ||
      job?.Contact_Last_Name2 ||
      job?.Primary_Service_Provider?.Contact_Information?.last_name ||
      job?.Primary_Service_Provider?.Contact_Information?.Last_Name
  );
  const email = toText(
    job?.primary_service_provider_contact_email ||
      job?.Primary_Service_Provider_Contact_Email ||
      job?.ContactEmail2 ||
      job?.Primary_Service_Provider?.Contact_Information?.email ||
      job?.Primary_Service_Provider?.Contact_Information?.Email
  );
  const id = normalizeId(
    job?.primary_service_provider_id ||
      job?.Primary_Service_Provider_ID ||
      job?.Primary_Service_Provider?.id ||
      job?.Primary_Service_Provider?.ID
  );
  const label =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    email ||
    (id ? `Provider #${id}` : "--");

  return {
    id,
    firstName,
    lastName,
    email,
    label,
  };
}

export function InvoiceSection({ plugin, jobData, onExternalUnsavedChange }) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const jobEntity = useJobDirectSelector(selectJobEntity);
  const storeActivities = useJobDirectSelector(selectActivities);
  const storeMaterials = useJobDirectSelector(selectMaterials);
  const defaultInvoiceActivityIds = useJobDirectSelector(selectDefaultInvoiceActivityIds);
  const storeMaterialSummary = useJobDirectSelector(selectBillMaterialSummary);
  const [activeBillingTab, setActiveBillingTab] = useState("client-invoice");

  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);

  const [billDate, setBillDate] = useState("");
  const [billDueDate, setBillDueDate] = useState("");

  const [invoiceDirty, setInvoiceDirty] = useState(false);
  const [billDirty, setBillDirty] = useState(false);

  const [isInvoiceSaving, setIsInvoiceSaving] = useState(false);
  const [isBillSaving, setIsBillSaving] = useState(false);
  const [isSendingToCustomer, setIsSendingToCustomer] = useState(false);
  const [isWaitingForInvoiceResponse, setIsWaitingForInvoiceResponse] = useState(false);

  const activeJob = jobEntity || jobData || null;
  const activeActivities = useMemo(() => {
    const source = Array.isArray(storeActivities) && storeActivities.length
      ? storeActivities
      : Array.isArray(jobData?.activities)
        ? jobData.activities
        : [];
    return source.filter((record) => hasRenderableActivityRecord(record));
  }, [storeActivities, jobData]);
  const activeMaterials = useMemo(() => {
    if (Array.isArray(storeMaterials) && storeMaterials.length) return storeMaterials;
    return Array.isArray(jobData?.materials) ? jobData.materials : [];
  }, [storeMaterials, jobData]);

  const jobId = normalizeId(activeJob?.id || activeJob?.ID);

  const accountSummary = useMemo(() => buildAccountSummary(activeJob || {}), [activeJob]);
  const serviceProviderSummary = useMemo(
    () => buildServiceProviderSummary(activeJob || {}),
    [activeJob]
  );

  const providerRate = useMemo(() => {
    const rate = Number(
      activeJob?.primary_service_provider_job_rate_percentage ??
        activeJob?.Primary_Service_Provider_Job_Rate_Percentage ??
        activeJob?.Primary_Service_Provider?.job_rate_percentage ??
        0
    );
    return Number.isFinite(rate) ? rate : 0;
  }, [activeJob]);

  const selectedActivityIdSet = useMemo(
    () => new Set(selectedActivityIds.map((value) => toText(value)).filter(Boolean)),
    [selectedActivityIds]
  );

  const selectedActivities = useMemo(
    () => activeActivities.filter((record) => selectedActivityIdSet.has(toText(record?.id || record?.ID))),
    [activeActivities, selectedActivityIdSet]
  );

  const invoiceSubtotal = useMemo(
    () => round2(selectedActivities.reduce((sum, record) => sum + lineAmount(record), 0)),
    [selectedActivities]
  );
  const invoiceGst = useMemo(() => round2(invoiceSubtotal / 11), [invoiceSubtotal]);
  const invoiceTotal = useMemo(() => round2(invoiceSubtotal), [invoiceSubtotal]);

  const billActivityRows = useMemo(
    () =>
      selectedActivities.map((record) => {
        const base = lineAmount(record);
        const providerAmount = round2((base * providerRate) / 100);
        return {
          id: toText(record?.id || record?.ID),
          service: toText(record?.service_name || record?.Service_Service_Name || "-"),
          task: toText(record?.task || record?.Task || "-"),
          option: toText(record?.option || record?.Option || "-"),
          amount: providerAmount,
        };
      }),
    [selectedActivities, providerRate]
  );

  const materialSummary = useMemo(() => {
    if (Array.isArray(storeMaterials) && storeMaterials.length) {
      return {
        reimburse: storeMaterialSummary.reimburse,
        deduct: storeMaterialSummary.deduct,
      };
    }
    return collectMaterialSummary(activeMaterials);
  }, [activeMaterials, storeMaterialSummary, storeMaterials]);
  const materialsNetTotal = useMemo(
    () => round2(materialSummary.reimburse - materialSummary.deduct),
    [materialSummary]
  );

  const billSubtotal = useMemo(
    () => round2(billActivityRows.reduce((sum, item) => sum + item.amount, 0) + materialsNetTotal),
    [billActivityRows, materialsNetTotal]
  );
  const billGst = useMemo(() => round2(billSubtotal / 11), [billSubtotal]);
  const billTotal = useMemo(() => round2(billSubtotal), [billSubtotal]);

  const invoiceStatus = useMemo(
    () =>
      statusFromRawValue(
        activeJob?.xero_invoice_status || activeJob?.Xero_Invoice_Status,
        XERO_INVOICE_STATUS_OPTIONS
      ),
    [activeJob]
  );
  const paymentStatus = useMemo(
    () =>
      statusFromRawValue(
        activeJob?.payment_status || activeJob?.Payment_Status,
        PAYMENT_STATUS_OPTIONS
      ),
    [activeJob]
  );
  const xeroApiResponse = useMemo(
    () => toText(activeJob?.xero_api_response || activeJob?.Xero_API_Response),
    [activeJob]
  );
  const xeroApiResponseTone = useMemo(
    () => resolveApiResponseTone(xeroApiResponse),
    [xeroApiResponse]
  );
  const billStatus = useMemo(
    () => statusWithFallback(activeJob?.xero_bill_status || activeJob?.Xero_Bill_Status, XERO_BILL_STATUS_OPTIONS),
    [activeJob]
  );
  const storedInvoiceTotal = useMemo(
    () => round2(toNumber(activeJob?.invoice_total || activeJob?.Invoice_Total)),
    [activeJob]
  );

  const hasUnsavedChanges = invoiceDirty || billDirty;

  useEffect(() => {
    if (invoiceDirty) return;
    setInvoiceDate(toDateInput(activeJob?.invoice_date || activeJob?.Invoice_Date));
    setInvoiceDueDate(toDateInput(activeJob?.due_date || activeJob?.Due_Date));
  }, [
    activeJob?.invoice_date,
    activeJob?.Invoice_Date,
    activeJob?.due_date,
    activeJob?.Due_Date,
    invoiceDirty,
  ]);

  useEffect(() => {
    if (billDirty) return;
    setBillDate(toDateInput(activeJob?.bill_date || activeJob?.Bill_Date));
    setBillDueDate(toDateInput(activeJob?.bill_due_date || activeJob?.Bill_Due_Date));
  }, [
    activeJob?.bill_date,
    activeJob?.Bill_Date,
    activeJob?.bill_due_date,
    activeJob?.Bill_Due_Date,
    billDirty,
  ]);

  useEffect(() => {
    if (invoiceDirty) return;
    if (Array.isArray(storeActivities) && storeActivities.length) {
      setSelectedActivityIds(defaultInvoiceActivityIds);
      return;
    }
    const preselectedIds = activeActivities
      .filter((record) => isTrue(record?.invoice_to_client || record?.Invoice_to_Client))
      .map((record) => toText(record?.id || record?.ID))
      .filter(Boolean);
    setSelectedActivityIds(preselectedIds);
  }, [activeActivities, defaultInvoiceActivityIds, invoiceDirty, storeActivities]);

  useEffect(() => {
    if (typeof onExternalUnsavedChange !== "function") return;
    onExternalUnsavedChange(hasUnsavedChanges);
  }, [hasUnsavedChanges, onExternalUnsavedChange]);

  const toggleActivitySelection = (activityId, checked) => {
    const normalized = toText(activityId);
    if (!normalized) return;
    setSelectedActivityIds((previous) => {
      const nextSet = new Set(previous.map((item) => toText(item)).filter(Boolean));
      if (checked) {
        nextSet.add(normalized);
      } else {
        nextSet.delete(normalized);
      }
      return Array.from(nextSet);
    });
    setInvoiceDirty(true);
  };

  const waitForInvoiceApiResponse = useCallback(
    async (previousSnapshot = null) => {
      if (!plugin || !jobId) return "";

      setIsWaitingForInvoiceResponse(true);
      try {
        const latestResponse = await waitForJobInvoiceApiResponseChange({
          plugin,
          jobId,
          previous: previousSnapshot,
          timeoutMs: 45000,
        });
        if (!latestResponse) {
          success("Invoice request submitted", "Waiting for Xero response. Refresh if needed.");
          return "";
        }

        const responseMessage = toText(latestResponse?.xero_api_response);
        const responseTone = resolveApiResponseTone(responseMessage);
        if (responseMessage && responseTone.tone === "error") {
          error("Invoice failed", responseMessage);
        } else if (responseMessage) {
          success("Invoice response", responseMessage);
        } else if (
          latestResponse?.invoice_url_admin ||
          latestResponse?.invoice_url_client ||
          latestResponse?.invoice_number
        ) {
          success("Invoice ready", "Invoice links/status were updated.");
        } else {
          success("Invoice response", "Invoice status changed.");
        }
        if (latestResponse && typeof latestResponse === "object") {
          storeActions.patchJobEntity(latestResponse);
        }
        return latestResponse;
      } catch (pollError) {
        console.error("[JobDirect] Failed while waiting for Xero API response", pollError);
        error("Response check failed", pollError?.message || "Unable to read Xero API response.");
        return "";
      } finally {
        setIsWaitingForInvoiceResponse(false);
      }
    },
    [error, jobId, plugin, storeActions, success]
  );

  const handleGenerateOrUpdateInvoice = async () => {
    if (isInvoiceSaving) return;
    if (!plugin) {
      error("Save failed", "SDK is still initializing.");
      return;
    }
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }
    if (!invoiceDate || !invoiceDueDate) {
      error("Validation failed", "Invoice Date and Due Date are required.");
      return;
    }

    setIsInvoiceSaving(true);
    try {
      const previousApiResponse = toText(
        activeJob?.xero_api_response || activeJob?.Xero_API_Response
      );
      const previousInvoiceSnapshot = {
        xero_api_response: previousApiResponse,
        invoice_url_admin: toText(activeJob?.invoice_url_admin || activeJob?.Invoice_URL_Admin),
        invoice_url_client: toText(activeJob?.invoice_url_client || activeJob?.Invoice_URL_Client),
        xero_invoice_status: toText(activeJob?.xero_invoice_status || activeJob?.Xero_Invoice_Status),
        xero_invoice_pdf: toText(activeJob?.xero_invoice_pdf || activeJob?.Xero_Invoice_PDF),
        invoice_number: toText(activeJob?.invoice_number || activeJob?.Invoice_Number),
      };

      const updatedRecord = await updateInvoiceTriggerByJobId({
        plugin,
        jobId,
        payload: {
          invoice_date: invoiceDate,
          due_date: invoiceDueDate,
          xero_invoice_status: "Create Invoice",
        },
      });
      if (updatedRecord && typeof updatedRecord === "object") {
        storeActions.patchJobEntity(updatedRecord);
      }
      setInvoiceDirty(false);
      await waitForInvoiceApiResponse(previousInvoiceSnapshot);
    } catch (saveError) {
      console.error("[JobDirect] Invoice trigger failed", saveError);
      error("Save failed", saveError?.message || "Unable to update invoice right now.");
    } finally {
      setIsInvoiceSaving(false);
    }
  };

  const handleApproveBill = async () => {
    if (isBillSaving) return;
    if (!plugin) {
      error("Save failed", "SDK is still initializing.");
      return;
    }
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }

    const approved = isTrue(activeJob?.bill_approved_admin || activeJob?.Bill_Approved_Admin);
    if (approved) {
      error("Already approved", "Bill is already approved by admin.");
      return;
    }
    if (!billDate || !billDueDate) {
      error("Validation failed", "Bill Date and Bill Due Date are required.");
      return;
    }

    const billDateEpoch = toEpochSecondsFromDateInput(billDate);
    const billDueDateEpoch = toEpochSecondsFromDateInput(billDueDate);
    if (billDateEpoch === null || billDueDateEpoch === null) {
      error("Validation failed", "Bill dates are invalid.");
      return;
    }

    setIsBillSaving(true);
    try {
      const savedDates = await updateJobRecordById({
        plugin,
        id: jobId,
        payload: {
          bill_date: billDateEpoch,
          bill_due_date: billDueDateEpoch,
        },
      });
      const approvedRecord = await updateJobRecordById({
        plugin,
        id: jobId,
        payload: {
          bill_date: billDateEpoch,
          bill_due_date: billDueDateEpoch,
          bill_approved_admin: true,
        },
      });
      if (savedDates && typeof savedDates === "object") {
        storeActions.patchJobEntity(savedDates);
      }
      if (approvedRecord && typeof approvedRecord === "object") {
        storeActions.patchJobEntity(approvedRecord);
      }
      setBillDirty(false);
      success("Bill approved", "Bill was approved by admin.");
    } catch (saveError) {
      console.error("[JobDirect] Bill approval failed", saveError);
      error("Save failed", saveError?.message || "Unable to approve bill right now.");
    } finally {
      setIsBillSaving(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (isSendingToCustomer) return;
    if (!plugin || !jobId) {
      error("Send failed", "Job data is not ready.");
      return;
    }

    const invoiceUrl = toText(
      activeJob?.invoice_url_client || activeJob?.Invoice_URL_Client || ""
    );
    if (!invoiceUrl) {
      error("Send failed", "No client invoice URL found. Generate invoice first.");
      return;
    }

    setIsSendingToCustomer(true);
    try {
      const updatedRecord = await updateJobRecordById({
        plugin,
        id: jobId,
        payload: {
          send_to_contact: true,
        },
      });
      if (updatedRecord && typeof updatedRecord === "object") {
        storeActions.patchJobEntity(updatedRecord);
      }
      success("Sent", "Invoice send flag was updated for customer delivery.");
    } catch (sendError) {
      console.error("[JobDirect] Failed sending invoice", sendError);
      error("Send failed", sendError?.message || "Unable to send invoice right now.");
    } finally {
      setIsSendingToCustomer(false);
    }
  };

  const handleCopyToClipboard = useCallback(
    async (value, label = "Value") => {
      const text = toText(value);
      if (!text) return;

      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "absolute";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        success("Copied", `${label} copied.`);
      } catch {
        error("Copy failed", `Unable to copy ${label.toLowerCase()}.`);
      }
    },
    [error, success]
  );

  const billApprovedByAdmin = isTrue(
    activeJob?.bill_approved_admin || activeJob?.Bill_Approved_Admin
  );
  const billApprovalTimeLabel = formatDateTimeDisplay(
    activeJob?.bill_approval_time || activeJob?.Bill_Approval_Time
  );

  const tableHeaderCellClass =
    "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const tableBodyCellClass = "px-3 py-2.5 align-middle text-[13px] text-slate-700";
  const accountXeroId =
    accountSummary.accountType === "Company"
      ? accountSummary.companyXeroId || ""
      : accountSummary.contactXeroId || "";

  return (
    <section data-section="invoice" className="mx-auto w-full max-w-full space-y-4 pb-10 xl:w-[60%]">
      <div className="border-b border-slate-300 bg-white pt-1">
        <div className="inline-flex items-center">
          <button
            type="button"
            className={`inline-flex items-center px-6 py-3 ${
              activeBillingTab === "client-invoice"
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => setActiveBillingTab("client-invoice")}
            data-tab="client-invoice"
          >
            Client Invoice
          </button>
          <button
            type="button"
            className={`inline-flex items-center px-6 py-3 ${
              activeBillingTab === "service-provider-bill"
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => setActiveBillingTab("service-provider-bill")}
            data-tab="service-provider-bill"
          >
            Service Provider Bill
          </button>
        </div>
      </div>

      {activeBillingTab === "client-invoice" ? (
        <ClientInvoicePanel
          activeJob={activeJob}
          invoiceStatus={invoiceStatus}
          isWaitingForInvoiceResponse={isWaitingForInvoiceResponse}
          xeroApiResponse={xeroApiResponse}
          xeroApiResponseTone={xeroApiResponseTone}
          accountSummary={accountSummary}
          accountXeroId={accountXeroId}
          onCopyXeroId={handleCopyToClipboard}
          invoiceDate={invoiceDate}
          invoiceDueDate={invoiceDueDate}
          onInvoiceDateChange={(value) => {
            setInvoiceDate(value);
            setInvoiceDirty(true);
          }}
          onInvoiceDueDateChange={(value) => {
            setInvoiceDueDate(value);
            setInvoiceDirty(true);
          }}
          activeActivities={activeActivities}
          selectedActivityIdSet={selectedActivityIdSet}
          onToggleActivitySelection={toggleActivitySelection}
          selectedActivities={selectedActivities}
          lineAmount={lineAmount}
          toNumber={toNumber}
          formatCurrency={formatCurrency}
          toText={toText}
          tableHeaderCellClass={tableHeaderCellClass}
          tableBodyCellClass={tableBodyCellClass}
          storedInvoiceTotal={storedInvoiceTotal}
          invoiceSubtotal={invoiceSubtotal}
          invoiceGst={invoiceGst}
          invoiceTotal={invoiceTotal}
          paymentStatus={paymentStatus}
          onGenerateOrUpdateInvoice={handleGenerateOrUpdateInvoice}
          isInvoiceSaving={isInvoiceSaving}
          onSendToCustomer={handleSendToCustomer}
          isSendingToCustomer={isSendingToCustomer}
        />
      ) : null}

      {activeBillingTab === "service-provider-bill" ? (
        <ServiceProviderBillPanel
          billStatus={billStatus}
          serviceProviderSummary={serviceProviderSummary}
          providerRate={providerRate}
          activeJob={activeJob}
          accountSummary={accountSummary}
          billDate={billDate}
          billDueDate={billDueDate}
          onBillDateChange={(value) => {
            setBillDate(value);
            setBillDirty(true);
          }}
          onBillDueDateChange={(value) => {
            setBillDueDate(value);
            setBillDirty(true);
          }}
          billApprovedByAdmin={billApprovedByAdmin}
          billActivityRows={billActivityRows}
          tableHeaderCellClass={tableHeaderCellClass}
          tableBodyCellClass={tableBodyCellClass}
          formatCurrency={formatCurrency}
          materialSummary={materialSummary}
          materialsNetTotal={materialsNetTotal}
          billSubtotal={billSubtotal}
          billGst={billGst}
          billTotal={billTotal}
          formatDateDisplay={formatDateDisplay}
          billApprovalTimeLabel={billApprovalTimeLabel}
          onApproveBill={handleApproveBill}
          isBillSaving={isBillSaving}
        />
      ) : null}
    </section>
  );
}
