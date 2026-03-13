import { useCallback, useEffect, useMemo } from "react";
import { toText } from "@shared/utils/formatters.js";
import { isCompanyAccountType } from "@shared/utils/accountTypeUtils.js";
import {
  extractFirstRecord,
} from "@modules/details-workspace/exports/api.js";
import { updateJobFieldsById } from "@modules/job-records/exports/api.js";
import { uploadMaterialFile } from "@modules/details-workspace/exports/api.js";
import {
  buildJobLastActionPayload,
  LAST_ACTION_STATUSES,
} from "../shared/jobDetailsWorkflow.js";
import {
  formatCurrencyDisplay,
  formatDateDisplay,
} from "../shared/jobDetailsFormatting.js";
import {
  resolveQuoteStatusStyle,
  resolvePaymentStatusStyle,
  resolvePriorityStyle,
} from "../../../shared/constants/statusStyles.js";

export function useJobQuoteWorkflow({
  accountsContactSearchValue,
  effectiveJobId,
  error,
  isCompanyAccount,
  isQuoteWorkflowUpdating,
  isSavingQuoteContacts,
  isSdkReady,
  loadedAccountType,
  loadedClientEntityId,
  loadedClientIndividualId,
  plugin,
  quotePaymentDetails,
  selectedAccountsContactId,
  selectedJobEmailContactId,
  setIsQuoteWorkflowUpdating,
  setIsSavingQuoteContacts,
  setLoadedAccountType,
  setLoadedAccountsContactId,
  setLoadedClientEntityId,
  setLoadedClientIndividualId,
  setLoadedJobStatus,
  setQuotePaymentDetails,
  success,
}) {
  const quoteStatusValue = toText(quotePaymentDetails?.quote_status);
  const quoteStatusLabel = quoteStatusValue || "New";
  const quoteStatusNormalized = quoteStatusLabel.toLowerCase();
  const paymentStatusLabel = toText(quotePaymentDetails?.payment_status);
  const hasQuoteStatusValue = Boolean(quoteStatusValue);
  const hasPaymentStatusValue = Boolean(paymentStatusLabel);
  const hasQuoteDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.quote_date));
  const hasFollowUpDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.follow_up_date));
  const hasQuoteValidUntilValue = Boolean(formatDateDisplay(quotePaymentDetails?.quote_valid_until));
  const hasQuoteRequestedDateValue = Boolean(
    formatDateDisplay(quotePaymentDetails?.date_quote_requested)
  );
  const hasQuoteSentDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.date_quote_sent));
  const hasQuoteAcceptedDateValue = Boolean(
    formatDateDisplay(quotePaymentDetails?.date_quoted_accepted)
  );
  const hasPriorityValue = Boolean(toText(quotePaymentDetails?.priority));
  const hasAdminRecommendationValue = Boolean(toText(quotePaymentDetails?.admin_recommendation));
  const hasAnyQuotePaymentDisplayField = Boolean(
    hasQuoteStatusValue ||
      hasPaymentStatusValue ||
      hasQuoteDateValue ||
      hasFollowUpDateValue ||
      hasQuoteValidUntilValue ||
      hasQuoteRequestedDateValue ||
      hasQuoteSentDateValue ||
      hasQuoteAcceptedDateValue ||
      hasPriorityValue ||
      hasAdminRecommendationValue
  );
  const quoteStatusStyle = useMemo(
    () => resolveQuoteStatusStyle(quoteStatusLabel),
    [quoteStatusLabel]
  );
  const paymentStatusStyle = useMemo(
    () => resolvePaymentStatusStyle(paymentStatusLabel),
    [paymentStatusLabel]
  );
  const priorityLabel = toText(quotePaymentDetails?.priority);
  const priorityStyle = useMemo(
    () => (priorityLabel ? resolvePriorityStyle(priorityLabel) : null),
    [priorityLabel]
  );
  const canSendQuote = Boolean(effectiveJobId) &&
    quoteStatusNormalized !== "sent" &&
    quoteStatusNormalized !== "accepted";
  const canAcceptQuote = Boolean(effectiveJobId) && quoteStatusNormalized === "sent";

  const buildQuoteContactPayload = useCallback(() => {
    const selectedJobEmailId = toText(selectedJobEmailContactId);
    const payload = isCompanyAccount
      ? {
          client_entity_id: selectedJobEmailId || null,
          client_individual_id: null,
        }
      : {
          client_individual_id: selectedJobEmailId || null,
          client_entity_id: null,
        };
    return payload;
  }, [isCompanyAccount, selectedJobEmailContactId]);

  const handleSaveQuoteContacts = useCallback(async () => {
    if (isSavingQuoteContacts || isQuoteWorkflowUpdating) return;
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Save failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }

    const selectedAccountsContact = toText(selectedAccountsContactId);
    const selectedJobEmail = toText(selectedJobEmailContactId);

    setIsSavingQuoteContacts(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          ...buildQuoteContactPayload(),
          accounts_contact_id: selectedAccountsContact || null,
        },
      });

      if (isCompanyAccount) {
        setLoadedClientEntityId(selectedJobEmail);
        setLoadedClientIndividualId("");
      } else {
        setLoadedClientIndividualId(selectedJobEmail);
        setLoadedClientEntityId("");
      }
      setLoadedAccountsContactId(selectedAccountsContact);
      success("Contacts saved", "Quote contacts updated.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed saving quote contacts", saveError);
      error("Save failed", saveError?.message || "Unable to update quote contacts.");
    } finally {
      setIsSavingQuoteContacts(false);
    }
  }, [
    buildQuoteContactPayload,
    effectiveJobId,
    error,
    isCompanyAccount,
    isQuoteWorkflowUpdating,
    isSavingQuoteContacts,
    isSdkReady,
    plugin,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    success,
  ]);

  const handleSendQuote = useCallback(async () => {
    if (isQuoteWorkflowUpdating) return;
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Send failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Send failed", "Job ID is missing.");
      return;
    }
    if (!toText(selectedAccountsContactId)) {
      error("Send failed", "Select Accounts Contact before sending quote.");
      return;
    }

    const now = Math.trunc(Date.now() / 1000);
    setIsQuoteWorkflowUpdating(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          quote_status: "Sent",
          date_quote_sent: now,
          accounts_contact_id: toText(selectedAccountsContactId),
          ...buildQuoteContactPayload(),
          ...buildJobLastActionPayload({
            type: "job.quote.send",
            message: "Quote marked as sent.",
            status: LAST_ACTION_STATUSES.SUCCEEDED,
          }),
        },
      });
      setQuotePaymentDetails((previous) => ({
        ...previous,
        quote_status: "Sent",
        date_quote_sent: now,
      }));
      setLoadedAccountsContactId(toText(selectedAccountsContactId));
      if (isCompanyAccount) {
        setLoadedClientEntityId(toText(selectedJobEmailContactId));
        setLoadedClientIndividualId("");
      } else {
        setLoadedClientIndividualId(toText(selectedJobEmailContactId));
        setLoadedClientEntityId("");
      }
      success("Quote sent", "Quote status was updated to Sent.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed sending quote", saveError);
      error("Send failed", saveError?.message || "Unable to mark quote as sent.");
    } finally {
      setIsQuoteWorkflowUpdating(false);
    }
  }, [
    buildQuoteContactPayload,
    effectiveJobId,
    error,
    isCompanyAccount,
    isQuoteWorkflowUpdating,
    isSdkReady,
    plugin,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    success,
  ]);

  const handleAcceptQuote = useCallback(async ({ signatureBlob } = {}) => {
    if (isQuoteWorkflowUpdating) return;
    if (quoteStatusNormalized !== "sent") {
      error("Accept failed", "Quote can be accepted only after it is sent.");
      return;
    }
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Accept failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Accept failed", "Job ID is missing.");
      return;
    }

    const now = Math.trunc(Date.now() / 1000);
    setIsQuoteWorkflowUpdating(true);
    try {
      let signatureUrl = "";
      if (signatureBlob) {
        const signatureFile = new File([signatureBlob], "signature.png", { type: "image/png" });
        const uploaded = await uploadMaterialFile({
          file: signatureFile,
          uploadPath: `signatures/${jobId}`,
        });
        signatureUrl = String(uploaded?.url || "").trim();
      }

      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          quote_status: "Accepted",
          job_status: "In Progress",
          date_quoted_accepted: now,
          terms_and_conditions_accepted: true,
          ...(signatureUrl ? { signature: signatureUrl } : {}),
          ...buildJobLastActionPayload({
            type: "job.quote.accept",
            message: "Quote accepted.",
            status: LAST_ACTION_STATUSES.SUCCEEDED,
          }),
        },
      });
      setQuotePaymentDetails((previous) => ({
        ...previous,
        quote_status: "Accepted",
        date_quoted_accepted: now,
      }));
      setLoadedJobStatus("In Progress");
      success("Quote accepted", "Quote status was updated to Accepted.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed accepting quote", saveError);
      error("Accept failed", saveError?.message || "Unable to mark quote as accepted.");
    } finally {
      setIsQuoteWorkflowUpdating(false);
    }
  }, [
    effectiveJobId,
    error,
    isQuoteWorkflowUpdating,
    isSdkReady,
    plugin,
    quoteStatusNormalized,
    success,
    uploadMaterialFile,
  ]);

  // Real-time quote/payment subscription
  useEffect(() => {
    if (!isSdkReady || !plugin || !effectiveJobId) return;

    const jobModel = plugin.switchTo?.("PeterpmJob");
    if (!jobModel?.query) return;

    const numericId = /^\d+$/.test(effectiveJobId) ? Number(effectiveJobId) : effectiveJobId;
    const query = jobModel
      .query()
      .where("id", numericId)
      .deSelectAll()
      .select(["id", "quote_status", "payment_status"])
      .noDestroy();

    query.getOrInitQueryCalc?.();

    let stream = null;
    let subscription = null;
    try {
      stream = typeof query.subscribe === "function" ? query.subscribe() : null;
      if (!stream && typeof query.localSubscribe === "function") {
        stream = query.localSubscribe();
      }
      if (stream && typeof stream.subscribe === "function") {
        subscription = stream.subscribe({
          next: (payload) => {
            const record = extractFirstRecord(payload);
            if (!record) return;
            const nextQuoteStatus = toText(record.quote_status || record.Quote_Status);
            const nextPaymentStatus = toText(record.payment_status || record.Payment_Status);
            setQuotePaymentDetails((prev) => {
              if (
                nextQuoteStatus === prev.quote_status &&
                nextPaymentStatus === prev.payment_status
              ) {
                return prev;
              }
              return {
                ...prev,
                ...(nextQuoteStatus ? { quote_status: nextQuoteStatus } : {}),
                ...(nextPaymentStatus ? { payment_status: nextPaymentStatus } : {}),
              };
            });
          },
          error: (err) => {
            console.warn("[JobDetailsBlank] Quote status subscription error", err);
          },
        });
      }
    } catch (err) {
      console.warn("[JobDetailsBlank] Failed to set up quote status subscription", err);
    }

    return () => {
      try {
        subscription?.unsubscribe?.();
        query?.destroy?.();
      } catch (_) {}
    };
  }, [effectiveJobId, isSdkReady, plugin]);

  return {
    buildQuoteContactPayload,
    canAcceptQuote,
    canSendQuote,
    handleAcceptQuote,
    handleSaveQuoteContacts,
    handleSendQuote,
    hasAdminRecommendationValue,
    hasAnyQuotePaymentDisplayField,
    hasFollowUpDateValue,
    hasPaymentStatusValue,
    hasPriorityValue,
    hasQuoteAcceptedDateValue,
    hasQuoteDateValue,
    hasQuoteRequestedDateValue,
    hasQuoteSentDateValue,
    hasQuoteStatusValue,
    hasQuoteValidUntilValue,
    paymentStatusLabel,
    paymentStatusStyle,
    priorityLabel,
    priorityStyle,
    quoteStatusLabel,
    quoteStatusNormalized,
    quoteStatusStyle,
  };
}
