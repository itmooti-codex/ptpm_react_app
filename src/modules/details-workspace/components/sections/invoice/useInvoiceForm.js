import { useEffect, useMemo, useRef, useState } from "react";
import { useDetailsWorkspaceSelector } from "../../../hooks/useDetailsWorkspaceStore.jsx";
import {
  selectBillMaterialSummary,
  selectDefaultInvoiceActivityIds,
} from "../../../state/derivedSelectors.js";
import {
  selectActivities,
  selectMaterials,
} from "../../../state/selectors.js";
import {
  activityTaskGroupKey,
  areTextArraysEqual,
  buildAccountSummary,
  buildServiceProviderSummary,
  collectMaterialSummary,
  formatDateTimeDisplay,
  hasRenderableActivityRecord,
  isTrue,
  lineAmount,
  normalizeSelectedActivityIdsByTask,
  normalizeStatus,
  round2,
  statusFromRawValue,
  statusWithFallback,
  toDateInput,
  toNumber,
  resolveApiResponseTone,
} from "./invoiceUtils.js";
import { toText } from "@shared/utils/formatters.js";
import {
  PAYMENT_STATUS_OPTIONS,
  XERO_BILL_STATUS_OPTIONS,
  XERO_INVOICE_STATUS_OPTIONS,
} from "../../../constants/options.js";
import { formatActivityServiceLabel } from "@shared/utils/formatters.js";

export function useInvoiceForm({ jobData, jobEntity, activeTab, activeTabVersion, onExternalUnsavedChange }) {
  const storeActivities = useDetailsWorkspaceSelector(selectActivities);
  const storeMaterials = useDetailsWorkspaceSelector(selectMaterials);
  const defaultInvoiceActivityIds = useDetailsWorkspaceSelector(selectDefaultInvoiceActivityIds);
  const storeMaterialSummary = useDetailsWorkspaceSelector(selectBillMaterialSummary);

  const [activeBillingTab, setActiveBillingTab] = useState("quote");
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (activeTab) setActiveBillingTab(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeTabVersion]);

  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);

  const [billDate, setBillDate] = useState("");
  const [billDueDate, setBillDueDate] = useState("");

  const [invoiceDirty, setInvoiceDirty] = useState(false);
  const [billDirty, setBillDirty] = useState(false);

  const hasSeenPaymentStatusRef = useRef(false);
  const previousPaymentStatusRef = useRef("");

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
          service: formatActivityServiceLabel(record) || "-",
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
      setSelectedActivityIds(
        normalizeSelectedActivityIdsByTask(defaultInvoiceActivityIds, activeActivities)
      );
      return;
    }
    const preselectedIds = activeActivities
      .filter((record) => isTrue(record?.invoice_to_client || record?.Invoice_to_Client))
      .map((record) => toText(record?.id || record?.ID))
      .filter(Boolean);
    setSelectedActivityIds(
      normalizeSelectedActivityIdsByTask(preselectedIds, activeActivities)
    );
  }, [activeActivities, defaultInvoiceActivityIds, invoiceDirty, storeActivities]);

  useEffect(() => {
    setSelectedActivityIds((previous) => {
      const normalized = normalizeSelectedActivityIdsByTask(previous, activeActivities);
      if (areTextArraysEqual(previous, normalized)) return previous;
      return normalized;
    });
  }, [activeActivities]);

  useEffect(() => {
    if (typeof onExternalUnsavedChange !== "function") return;
    onExternalUnsavedChange(hasUnsavedChanges);
  }, [hasUnsavedChanges, onExternalUnsavedChange]);

  const toggleActivitySelection = (activityId, checked) => {
    const normalized = toText(activityId);
    if (!normalized) return;
    setSelectedActivityIds((previous) => {
      let nextIds = Array.from(
        new Set(previous.map((item) => toText(item)).filter(Boolean))
      );
      if (checked) {
        const selectedRecord = activeActivities.find(
          (record) => toText(record?.id || record?.ID) === normalized
        );
        const selectedGroup = activityTaskGroupKey(selectedRecord);
        if (selectedGroup) {
          nextIds = nextIds.filter((id) => {
            const record = activeActivities.find(
              (candidate) => toText(candidate?.id || candidate?.ID) === id
            );
            return activityTaskGroupKey(record) !== selectedGroup;
          });
        }
        nextIds.push(normalized);
      } else {
        nextIds = nextIds.filter((id) => id !== normalized);
      }
      return normalizeSelectedActivityIdsByTask(nextIds, activeActivities);
    });
    setInvoiceDirty(true);
  };

  const billApprovedByAdmin = isTrue(
    activeJob?.bill_approved_admin || activeJob?.Bill_Approved_Admin
  );
  const billApprovalTimeLabel = formatDateTimeDisplay(
    activeJob?.bill_approval_time || activeJob?.Bill_Approval_Time
  );

  return {
    // tab state
    activeBillingTab,
    setActiveBillingTab,
    urlCopied,
    setUrlCopied,
    // invoice dates
    invoiceDate,
    setInvoiceDate,
    invoiceDueDate,
    setInvoiceDueDate,
    // bill dates
    billDate,
    setBillDate,
    billDueDate,
    setBillDueDate,
    // dirty flags
    invoiceDirty,
    setInvoiceDirty,
    billDirty,
    setBillDirty,
    hasUnsavedChanges,
    // payment status tracking refs
    hasSeenPaymentStatusRef,
    previousPaymentStatusRef,
    // job data
    activeJob,
    activeActivities,
    activeMaterials,
    storeActivities,
    // summaries
    accountSummary,
    serviceProviderSummary,
    providerRate,
    materialSummary,
    materialsNetTotal,
    // activity selection
    selectedActivityIds,
    selectedActivityIdSet,
    selectedActivities,
    toggleActivitySelection,
    // invoice totals
    invoiceSubtotal,
    invoiceGst,
    invoiceTotal,
    storedInvoiceTotal,
    // bill
    billActivityRows,
    billSubtotal,
    billGst,
    billTotal,
    billApprovedByAdmin,
    billApprovalTimeLabel,
    // statuses
    invoiceStatus,
    paymentStatus,
    xeroApiResponse,
    xeroApiResponseTone,
    billStatus,
  };
}
