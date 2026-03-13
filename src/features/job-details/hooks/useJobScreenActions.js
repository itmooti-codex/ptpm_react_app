import { useCallback, useEffect } from "react";
import { toText, formatActivityServiceLabel } from "@shared/utils/formatters.js";
import {
  fetchActivitiesByJobId,
  fetchMaterialsByJobId,
  subscribeActivitiesByJobId,
  subscribeMaterialsByJobId,
} from "@modules/details-workspace/exports/api.js";
import {
  mergePropertyLookupRecords,
} from "@modules/details-workspace/exports/api.js";
import {
  fetchLinkedPropertiesByAccount,
  fetchPropertiesForSearch,
} from "@modules/details-workspace/exports/api.js";
import {
  fetchContactLogsForDetails,
  savePropertyForDetails,
  updateCompanyFieldsById,
  updateContactFieldsById,
  updateJobFieldsById,
} from "@modules/job-records/exports/api.js";
import {
  buildEmailMenuLastAction,
  buildJobLastActionPayload,
  LAST_ACTION_STATUSES,
} from "../shared/jobDetailsWorkflow.js";
import { fetchInquiryAccountContextById } from "../api/jobDetailsDataApi.js";
import { useJobModalActions } from "./useJobModalActions.js";

export function useJobScreenActions({
  accountsContactItems,
  activeWorkspaceProperty,
  effectiveJobId,
  error,
  isCreatingCallback,
  isDuplicatingJob,
  isNewJob,
  isRecordingEmailAction,
  isRelatedDataTabMounted,
  isSavingLinkedInquiry,
  isSavingPopupComment,
  isSdkReady,
  isSendingJobUpdate,
  loadedPropertyId,
  navigate,
  plugin,
  relatedInquiryId,
  relatedRecordsAccountId,
  relatedRecordsAccountType,
  safeUid,
  shouldAutoSelectNewAffiliation,
  success,
  // Setters
  contactLogsContactId,
  contactPopupComment,
  companyPopupComment,
  loadedClientEntityId,
  loadedClientIndividualId,
  popupCommentDrafts,
  selectedAccountsContactId,
  selectedWorkspacePropertyId,
  propertyModalMode,
  setAccountsContactSearchValue,
  setActiveWorkspaceTab,
  setAffiliationModalState,
  setAffiliations,
  setAffiliationsError,
  setContactLogs,
  setContactLogsError,
  setEditingActivityId,
  setEditingAppointmentId,
  setEditingMaterialId,
  setInvoiceActiveTab,
  setInvoiceActiveTabVersion,
  setIsAccountDetailsLoading,
  setIsActivityModalOpen,
  setIsAddPropertyOpen,
  setIsAppointmentModalOpen,
  setIsCreatingCallback,
  setIsDuplicatingJob,
  setIsContactLogsLoading,
  setIsMaterialModalOpen,
  setIsPopupCommentModalOpen,
  setIsRecordingEmailAction,
  setIsSavingLinkedInquiry,
  setIsSavingPopupComment,
  setIsSendingJobUpdate,
  setIsTasksModalOpen,
  setIsUploadsModalOpen,
  setJobActivities,
  setJobMaterials,
  setIsWorkspaceSectionsLoading,
  setWorkspaceSectionsError,
  setLinkedProperties,
  setLoadedPropertyId,
  setOpenMenu,
  setPopupCommentDrafts,
  setPropertyModalMode,
  setActivityModalMode,
  setAppointmentModalMode,
  setMaterialModalMode,
  setRelatedInquiryId,
  setRelatedInquiryRecord,
  setRelatedInquiryUid,
  setSelectedAccountsContactId,
  setSelectedWorkspacePropertyId,
  setShouldAutoSelectNewAffiliation,
  setWorkspacePropertyLookupRecords,
  workspacePropertyLookupRecords,
}) {
  const modalActions = useJobModalActions({
    activeWorkspaceProperty,
    effectiveJobId,
    error,
    loadedPropertyId,
    plugin,
    relatedInquiryId,
    shouldAutoSelectNewAffiliation,
    success,
    selectedWorkspacePropertyId,
    setAccountsContactSearchValue,
    setAffiliationModalState,
    setAffiliations,
    setAffiliationsError,
    setEditingActivityId,
    setEditingAppointmentId,
    setEditingMaterialId,
    setIsActivityModalOpen,
    setIsAppointmentModalOpen,
    setIsMaterialModalOpen,
    setIsTasksModalOpen,
    setIsUploadsModalOpen,
    setPropertyModalMode,
    setIsAddPropertyOpen,
    setActivityModalMode,
    setAppointmentModalMode,
    setMaterialModalMode,
    setSelectedAccountsContactId,
    setSelectedWorkspacePropertyId,
    setShouldAutoSelectNewAffiliation,
    setJobActivities,
  });

  const handleToggleRelatedInquiryLink = useCallback(
    async (deal = {}) => {
      if (isSavingLinkedInquiry || !effectiveJobId) return;
      const dealId = toText(deal?.id || deal?.ID);
      if (!dealId) {
        error("Save failed", "Selected inquiry is missing a record ID.");
        return;
      }
      const dealUid = toText(deal?.unique_id || deal?.Unique_ID || deal?.id || deal?.ID);
      const isCurrentlySelected = toText(relatedInquiryId) === dealId;
      const nextInquiryId = isCurrentlySelected ? "" : dealId;
      const nextInquiryUid = isCurrentlySelected ? "" : dealUid;

      setIsSavingLinkedInquiry(true);
      try {
        await updateJobFieldsById({
          plugin,
          jobId: effectiveJobId,
          payload: { inquiry_record_id: nextInquiryId || null },
        });
        setRelatedInquiryId(nextInquiryId);
        setRelatedInquiryUid(nextInquiryUid);
        if (isCurrentlySelected) {
          setRelatedInquiryRecord(null);
          success("Inquiry unlinked", "Linked inquiry has been removed.");
        } else {
          success("Inquiry linked", `Job linked to ${nextInquiryUid || nextInquiryId}.`);
        }
      } catch (saveError) {
        console.error("[JobDetailsBlank] Failed to update linked inquiry", saveError);
        error("Save failed", saveError?.message || "Unable to update linked inquiry.");
      } finally {
        setIsSavingLinkedInquiry(false);
      }
    },
    [effectiveJobId, error, isSavingLinkedInquiry, plugin, relatedInquiryId, success]
  );

  const handleDuplicateJob = useCallback(async () => {
    if (!isSdkReady || !effectiveJobId || isDuplicatingJob) return;
    setIsDuplicatingJob(true);
    try {
      await updateJobFieldsById({ plugin, jobId: effectiveJobId, payload: { duplicate_job: true } });
      success("Job duplicated", "A duplicate of this job has been queued.");
    } catch (dupError) {
      console.error("[JobDetailsBlank] Failed duplicating job", dupError);
      error("Duplicate failed", dupError?.message || "Unable to duplicate this job.");
    } finally {
      setIsDuplicatingJob(false);
    }
  }, [effectiveJobId, error, isDuplicatingJob, isSdkReady, plugin, success]);

  const handleCreateCallback = useCallback(async () => {
    if (!isSdkReady || !effectiveJobId || isCreatingCallback) return;
    setIsCreatingCallback(true);
    try {
      await updateJobFieldsById({ plugin, jobId: effectiveJobId, payload: { create_a_callback: true } });
      success("Callback created", "A callback has been created for this job.");
    } catch (cbError) {
      console.error("[JobDetailsBlank] Failed creating callback", cbError);
      error("Callback failed", cbError?.message || "Unable to create a callback.");
    } finally {
      setIsCreatingCallback(false);
    }
  }, [effectiveJobId, error, isCreatingCallback, isSdkReady, plugin, success]);

  const handleCopyUid = useCallback(async () => {
    if (!safeUid || isNewJob) return;
    try {
      if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(safeUid);
      else throw new Error("Clipboard API is unavailable.");
      success("UID copied", safeUid);
    } catch (copyError) { error("Copy failed", copyError?.message || "Unable to copy UID."); }
  }, [error, isNewJob, safeUid, success]);

  const handleCopyFieldValue = useCallback(
    async ({ label, value }) => {
      const text = toText(value);
      if (!text) return;
      try {
        if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else throw new Error("Clipboard API is unavailable.");
        success(`${label} copied`, text);
      } catch (copyError) { error("Copy failed", copyError?.message || "Unable to copy value."); }
    },
    [error, success]
  );

  const handleRecordEmailAction = useCallback(
    async ({ groupKey = "", option = null, target = "button" } = {}) => {
      const jobId = toText(effectiveJobId);
      if (!plugin || !isSdkReady || !jobId) { error("Action failed", "Job context is not ready."); return; }
      if (isRecordingEmailAction) return;
      const { type, message } = buildEmailMenuLastAction({ groupKey, option, target });
      if (!type) return;
      setIsRecordingEmailAction(true);
      try {
        await updateJobFieldsById({ plugin, jobId, payload: buildJobLastActionPayload({ type, message, status: LAST_ACTION_STATUSES.QUEUED }) });
        success("Email action recorded", message);
      } catch (recordError) {
        console.error("[JobDetailsBlank] Failed recording email action", recordError);
        error("Action failed", recordError?.message || "Unable to record email action.");
      } finally { setIsRecordingEmailAction(false); }
    },
    [effectiveJobId, error, isRecordingEmailAction, isSdkReady, plugin, success]
  );

  const handleEmailJob = useCallback(async () => {
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady || !jobId) { error("Action failed", "Job context is not ready."); return; }
    if (isSendingJobUpdate) return;
    setIsSendingJobUpdate(true);
    try {
      await updateJobFieldsById({
        plugin, jobId,
        payload: {
          send_job_update_to_service_provider: true,
          ...buildJobLastActionPayload({ type: "job.email.job-update", message: "Job update email requested.", status: LAST_ACTION_STATUSES.QUEUED }),
        },
      });
      success("Job update sent", "Service provider has been notified of the job update.");
    } catch (sendError) {
      console.error("[JobDetailsBlank] Failed to send job update", sendError);
      error("Send failed", sendError?.message || "Unable to send job update to service provider.");
    } finally { setIsSendingJobUpdate(false); }
  }, [effectiveJobId, error, isSdkReady, isSendingJobUpdate, plugin, success]);

  const handlePrintJobSheet = useCallback((quoteHeaderData, jobActivitiesList) => {
    const header = quoteHeaderData || {};
    const activities = (Array.isArray(jobActivitiesList) ? jobActivitiesList : []).filter((a) => {
      const v = a?.include_in_quote ?? a?.Include_in_Quote ?? a?.Include_In_Quote;
      return v === true || String(v).toLowerCase() === "true" || v === 1 || v === "1";
    });

    const formatCurrencyAud = (value) => {
      const n = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
      return Number.isFinite(n) ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n) : "$0.00";
    };

    const total = activities.reduce((sum, a) => {
      const price = Number(a?.quoted_price ?? a?.Quoted_Price ?? a?.activity_price ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);
    const gst = total / 11;

    const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rowsHtml = activities.map((a) => {
      const serviceLabel = formatActivityServiceLabel(a);
      const price = Number(a?.quoted_price ?? a?.Quoted_Price ?? a?.activity_price ?? 0);
      return `<tr><td>${escHtml(a.task || a.Task || "-")}</td><td>${escHtml(a.option || a.Option || "-")}</td><td>${escHtml(serviceLabel || "-")}${a.quoted_text || a.Quoted_Text ? `<br><small>${escHtml(a.quoted_text || a.Quoted_Text)}</small>` : ""}${a.warranty || a.Warranty ? `<br><small>Warranty: ${escHtml(a.warranty || a.Warranty)}</small>` : ""}</td><td style="text-align:right;font-weight:600">${escHtml(formatCurrencyAud(price))}</td></tr>`;
    }).join("");

    const residentsHtml = (header.residentsRows || []).map((r) => `<div>${escHtml(r)}</div>`).join("");
    const recommendationHtml = header.recommendation ? `<div style="font-size:11px;margin-bottom:10px"><strong>Recommendations:</strong> ${escHtml(header.recommendation)}</div>` : "";

    const popup = window.open("", "_blank", "width=960,height=800,scrollbars=yes,resizable=yes");
    if (!popup) { error("Popup blocked", "Please allow popups to print the job sheet."); return; }
    popup.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Job Sheet \u2014 ${escHtml(header.workOrderUid || "")}</title>
<style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; } .logo { max-height: 56px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 12px; } .title { text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px; } .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin-bottom: 12px; font-size: 11px; } .section-bar { border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 3px 0; font-size: 11px; font-weight: 700; margin: 10px 0 6px; } table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; } th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; } th { background: #f1f5f9; font-weight: 600; } .totals { border: 1px solid #e2e8f0; padding: 10px 14px; margin-bottom: 12px; } .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; } .total-row.grand { font-weight: 700; font-size: 13px; border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 4px; } small { font-size: 10px; color: #64748b; } @media print { body { padding: 12px; } button { display: none !important; } }</style></head><body>
${header.logoUrl ? `<img class="logo" src="${escHtml(header.logoUrl)}" alt="Logo">` : ""}
<div class="title">JOB SHEET</div>
<div class="info-grid">${header.accountName ? `<div><strong>Account Name:</strong> ${escHtml(header.accountName)}</div>` : ""}${header.accountType ? `<div><strong>Account Type:</strong> ${escHtml(header.accountType)}</div>` : ""}${header.workReqBy ? `<div><strong>Work Req. By:</strong> ${escHtml(header.workReqBy)}</div>` : ""}${header.workOrderUid ? `<div><strong>Work Order #:</strong> ${escHtml(header.workOrderUid)}</div>` : ""}${header.jobAddress ? `<div><strong>Job Address:</strong> ${escHtml(header.jobAddress)}</div>` : ""}${header.jobSuburb ? `<div><strong>Job Suburb:</strong> ${escHtml(header.jobSuburb)}</div>` : ""}<div style="text-align:right;grid-column:2"><strong>Date:</strong> ${escHtml(header.date || "")}</div></div>
<div class="section-bar">Resident's Details</div>
<div style="margin-bottom:10px;font-size:11px">${residentsHtml || "<div>-</div>"}</div>
${recommendationHtml ? `<div class="section-bar">Resident's Feedback</div>${recommendationHtml}` : ""}
<div class="section-bar">Services</div>
${activities.length ? `<table><thead><tr><th>Task</th><th>Option</th><th>Service</th><th style="text-align:right">Quoted Price</th></tr></thead><tbody>${rowsHtml}</tbody></table>` : "<p style='font-size:11px;color:#64748b;margin-bottom:10px'>No activities added to quote.</p>"}
<div class="totals"><div class="total-row"><span>GST (incl.)</span><span>${escHtml(formatCurrencyAud(gst))}</span></div><div class="total-row grand"><span>Quote Total (incl. GST)</span><span>${escHtml(formatCurrencyAud(total))}</span></div></div>
<div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 20px;font-size:12px;cursor:pointer;background:#003882;color:#fff;border:none;border-radius:4px">Print / Save as PDF</button></div>
</body></html>`);
    popup.document.close();
    popup.focus();
  }, [error]);

  const toggleMenu = useCallback((menuKey) => {
    setOpenMenu((previous) => (previous === menuKey ? "" : menuKey));
  }, []);

  // Popup comment sync
  useEffect(() => {
    setPopupCommentDrafts({ contact: contactPopupComment, company: companyPopupComment });
  }, [companyPopupComment, contactPopupComment, loadedClientEntityId, loadedClientIndividualId]);

  const handleSavePopupComments = useCallback(async () => {
    if (isSavingPopupComment) return;
    const nextContactComment = toText(popupCommentDrafts?.contact);
    const nextCompanyComment = toText(popupCommentDrafts?.company);
    const contactChanged = nextContactComment !== contactPopupComment;
    const companyChanged = nextCompanyComment !== companyPopupComment;
    if (!contactChanged && !companyChanged) { setIsPopupCommentModalOpen(false); return; }

    try {
      setIsSavingPopupComment(true);
      if (contactChanged) {
        if (!loadedClientIndividualId) throw new Error("Primary contact is missing.");
        await updateContactFieldsById({ plugin, contactId: loadedClientIndividualId, payload: { popup_comment: nextContactComment || null } });
      }
      if (companyChanged) {
        if (!loadedClientEntityId) throw new Error("Company is missing.");
        await updateCompanyFieldsById({ plugin, companyId: loadedClientEntityId, payload: { popup_comment: nextCompanyComment || null } });
      }
      success("Saved", "Popup comment updated.");
      setIsPopupCommentModalOpen(false);
    } catch (saveError) {
      console.error("[JobDetails] Popup comment save failed", saveError);
      error("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally { setIsSavingPopupComment(false); }
  }, [companyPopupComment, contactPopupComment, error, isSavingPopupComment, loadedClientEntityId, loadedClientIndividualId, plugin, popupCommentDrafts, success]);

  // Save property
  const handleSaveProperty = useCallback(
    async (payload) => {
      if (!plugin) throw new Error("SDK plugin is not ready.");
      const savedPropertyId = await savePropertyForDetails({
        plugin,
        propertyId: propertyModalMode === "edit" ? toText(selectedWorkspacePropertyId || loadedPropertyId) : "",
        propertyPayload: payload,
        inquiryId: relatedInquiryId,
        jobId: effectiveJobId,
      });

      const nextPropertyId = toText(savedPropertyId);
      if (nextPropertyId) {
        setLoadedPropertyId(nextPropertyId);
        setSelectedWorkspacePropertyId(nextPropertyId);
      }

      const [linkedPropertyRecords, allPropertyRecords] = await Promise.all([
        relatedRecordsAccountId
          ? fetchLinkedPropertiesByAccount({ plugin, accountType: relatedRecordsAccountType, accountId: relatedRecordsAccountId })
          : Promise.resolve([]),
        fetchPropertiesForSearch({ plugin }),
      ]);

      const normalizedLinkedProperties = mergePropertyLookupRecords(Array.isArray(linkedPropertyRecords) ? linkedPropertyRecords : []);
      const normalizedLookupProperties = mergePropertyLookupRecords(Array.isArray(allPropertyRecords) ? allPropertyRecords : []);
      setLinkedProperties(normalizedLinkedProperties);
      setWorkspacePropertyLookupRecords(mergePropertyLookupRecords(normalizedLookupProperties, normalizedLinkedProperties));
      setIsAddPropertyOpen(false);
      success(
        propertyModalMode === "edit" ? "Property updated" : "Property created",
        propertyModalMode === "edit" ? "Property details have been updated." : "Property has been created and linked."
      );
    },
    [effectiveJobId, loadedPropertyId, plugin, propertyModalMode, relatedInquiryId, relatedRecordsAccountId, relatedRecordsAccountType, selectedWorkspacePropertyId, success]
  );

  // Contact logs
  useEffect(() => {
    let cancelled = false;
    const normalizedContactId = toText(contactLogsContactId);
    if (!isRelatedDataTabMounted) return undefined;
    if (!plugin || !isSdkReady || !normalizedContactId) {
      setContactLogs([]); setIsContactLogsLoading(false); setContactLogsError(""); return undefined;
    }
    setIsContactLogsLoading(true); setContactLogsError("");
    fetchContactLogsForDetails({ plugin, contactId: normalizedContactId })
      .then((rows) => { if (cancelled) return; setContactLogs(Array.isArray(rows) ? rows : []); })
      .catch((loadError) => { if (cancelled) return; console.error("[JobDetails] Failed to load contact logs", loadError); setContactLogs([]); setContactLogsError(loadError?.message || "Unable to load contact logs."); })
      .finally(() => { if (cancelled) return; setIsContactLogsLoading(false); });
    return () => { cancelled = true; };
  }, [contactLogsContactId, isRelatedDataTabMounted, isSdkReady, plugin]);

  // Related inquiry record
  useEffect(() => {
    if (!isSdkReady || !plugin || !relatedInquiryId) { setRelatedInquiryRecord(null); return; }
    let cancelled = false;
    fetchInquiryAccountContextById({ plugin, inquiryId: relatedInquiryId })
      .then((record) => { if (cancelled) return; setRelatedInquiryRecord(record || null); })
      .catch((loadError) => { if (cancelled) return; console.error("[JobDetailsBlank] Failed loading related inquiry details", loadError); setRelatedInquiryRecord(null); });
    return () => { cancelled = true; };
  }, [isSdkReady, plugin, relatedInquiryId]);

  // Activities + materials subscription
  useEffect(() => {
    if (!isSdkReady || !plugin || !effectiveJobId) {
      setJobActivities([]); setJobMaterials([]); setIsWorkspaceSectionsLoading(false); setWorkspaceSectionsError(""); return;
    }
    let cancelled = false;
    setIsWorkspaceSectionsLoading(true); setWorkspaceSectionsError("");
    Promise.all([
      fetchActivitiesByJobId({ plugin, jobId: effectiveJobId }),
      fetchMaterialsByJobId({ plugin, jobId: effectiveJobId }),
    ]).then(([activities, materials]) => {
      if (cancelled) return;
      setJobActivities(Array.isArray(activities) ? activities : []);
      setJobMaterials(Array.isArray(materials) ? materials : []);
    }).catch((loadError) => {
      if (cancelled) return;
      console.error("[JobDetailsBlank] Failed loading job workspace sections", loadError);
      setJobActivities([]); setJobMaterials([]);
      setWorkspaceSectionsError(loadError?.message || "Unable to load activities and materials.");
    }).finally(() => { if (cancelled) return; setIsWorkspaceSectionsLoading(false); });

    const unsubscribeActivities = subscribeActivitiesByJobId({ plugin, jobId: effectiveJobId, onChange: (records) => { if (cancelled) return; setJobActivities(Array.isArray(records) ? records : []); }, onError: (streamError) => { if (cancelled) return; console.error("[JobDetailsBlank] Activities subscription failed", streamError); } });
    const unsubscribeMaterials = subscribeMaterialsByJobId({ plugin, jobId: effectiveJobId, onChange: (records) => { if (cancelled) return; setJobMaterials(Array.isArray(records) ? records : []); }, onError: (streamError) => { if (cancelled) return; console.error("[JobDetailsBlank] Materials subscription failed", streamError); } });

    return () => { cancelled = true; unsubscribeActivities?.(); unsubscribeMaterials?.(); };
  }, [effectiveJobId, isSdkReady, plugin]);

  return {
    ...modalActions,
    handleCopyFieldValue,
    handleCopyUid,
    handleCreateCallback,
    handleDuplicateJob,
    handleEmailJob,
    handlePrintJobSheet,
    handleRecordEmailAction,
    handleSavePopupComments,
    handleSaveProperty,
    handleToggleRelatedInquiryLink,
    toggleMenu,
  };
}
