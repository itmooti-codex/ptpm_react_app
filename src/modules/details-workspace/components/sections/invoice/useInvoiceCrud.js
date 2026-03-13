import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import { useJobDirectStoreActions } from "../../../hooks/useDetailsWorkspaceStore.jsx";
import {
  updateInvoiceTriggerByJobId,
  updateJobRecordById,
  waitForJobInvoiceApiResponseChange,
} from "../../../api/core/runtime.js";
import { toText } from "@shared/utils/formatters.js";
import {
  normalizeStatus,
  resolveApiResponseTone,
  toEpochSecondsFromDateInput,
  isTrue,
} from "./invoiceUtils.js";

export function useInvoiceCrud({
  plugin,
  jobId,
  inquiryRecordId,
  activeJob,
  invoiceDate,
  invoiceDueDate,
  billDate,
  billDueDate,
  setInvoiceDirty,
  setBillDirty,
  hasSeenPaymentStatusRef,
  previousPaymentStatusRef,
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();

  const [isInvoiceSaving, setIsInvoiceSaving] = useState(false);
  const [isBillSaving, setIsBillSaving] = useState(false);
  const [isSendingToCustomer, setIsSendingToCustomer] = useState(false);
  const [isWaitingForInvoiceResponse, setIsWaitingForInvoiceResponse] = useState(false);

  useEffect(() => {
    const currentStatus = normalizeStatus(activeJob?.payment_status || activeJob?.Payment_Status);
    if (!hasSeenPaymentStatusRef.current) {
      hasSeenPaymentStatusRef.current = true;
      previousPaymentStatusRef.current = currentStatus;
      return;
    }

    const previousStatus = previousPaymentStatusRef.current;
    previousPaymentStatusRef.current = currentStatus;

    if (!jobId || !currentStatus || !previousStatus || previousStatus === currentStatus) {
      return;
    }

    emitAnnouncement({
      plugin,
      eventKey: ANNOUNCEMENT_EVENT_KEYS.PAYMENT_STATUS_CHANGED,
      quoteJobId: toText(jobId),
      inquiryId: inquiryRecordId,
      focusId: toText(jobId),
      dedupeEntityId: `${toText(jobId)}:${previousStatus}->${currentStatus}`,
      title: "Payment status changed",
      content: `Payment status changed from ${previousStatus} to ${currentStatus}.`,
      logContext: "job-direct:InvoiceSection:paymentStatusWatcher",
    }).catch((announcementError) => {
      console.warn("[JobDirect] Payment status announcement emit failed", announcementError);
    });
  }, [
    activeJob?.payment_status,
    activeJob?.Payment_Status,
    plugin,
    jobId,
    inquiryRecordId,
    hasSeenPaymentStatusRef,
    previousPaymentStatusRef,
  ]);

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
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.INVOICE_TRIGGERED,
        quoteJobId: toText(jobId),
        inquiryId: inquiryRecordId,
        focusId: toText(jobId),
        dedupeEntityId: `${toText(jobId)}:${invoiceDate}:${invoiceDueDate}`,
        title: "Invoice update requested",
        content: "Invoice generation/update was requested.",
        logContext: "job-direct:InvoiceSection:handleGenerateOrUpdateInvoice",
      });
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
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.BILL_APPROVED,
        quoteJobId: toText(jobId),
        inquiryId: inquiryRecordId,
        focusId: toText(jobId),
        dedupeEntityId: `${toText(jobId)}:bill-approved`,
        title: "Bill approved",
        content: "Service provider bill was approved.",
        logContext: "job-direct:InvoiceSection:handleApproveBill",
      });
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
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.INVOICE_SENT_TO_CUSTOMER,
        quoteJobId: toText(jobId),
        inquiryId: inquiryRecordId,
        focusId: toText(jobId),
        dedupeEntityId: `${toText(jobId)}:invoice-sent`,
        title: "Invoice sent to customer",
        content: "Invoice send flag was updated for customer delivery.",
        logContext: "job-direct:InvoiceSection:handleSendToCustomer",
      });
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

  return {
    isInvoiceSaving,
    isBillSaving,
    isSendingToCustomer,
    isWaitingForInvoiceResponse,
    handleGenerateOrUpdateInvoice,
    handleApproveBill,
    handleSendToCustomer,
    handleCopyToClipboard,
  };
}
