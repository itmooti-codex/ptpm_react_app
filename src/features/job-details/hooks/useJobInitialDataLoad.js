import { useEffect } from "react";
import { toText } from "@shared/utils/formatters.js";
import { pickBooleanValue } from "../shared/jobDetailsFormatting.js";
import {
  buildQuotePaymentDetailsFromJob,
  EMPTY_QUOTE_PAYMENT_DETAILS,
  JOB_INITIAL_SELECT_FIELDS,
} from "../shared/jobDetailsConstants.js";
import {
  fetchInquiryUidById,
  fetchJobTakenByValue,
  fetchSingleJobRecord,
} from "../api/jobDetailsDataApi.js";

export function useJobInitialDataLoad({
  effectiveJobId,
  isNewJob,
  isSdkReady,
  jobNumericId,
  plugin,
  safeUid,
  setResolvedJobId,
  s,
}) {
  // Route-change reset
  useEffect(() => {
    s.serviceProviderPrefilledRef.current = false;
    s.setAllocatedServiceProviderId("");
    s.setAllocatedJobTakenById("");
    setResolvedJobId("");
    s.setIsJobAllocationPrefillResolved(false);
    s.setIsLoadedJobTakenByMissing(false);
    s.setRelatedInquiryId("");
    s.setRelatedInquiryUid("");
    s.setLoadedJobStatus("");
    s.setIsPcaDone(false);
    s.setIsPrestartDone(false);
    s.setIsMarkComplete(false);
    s.setIsMarkCompleteConfirmOpen(false);
    s.setPendingMarkCompleteValue(false);
    s.setLoadedAccountType("");
    s.setLoadedClientEntityId("");
    s.setLoadedClientIndividualId("");
    s.setLoadedPropertyId("");
    s.setLoadedAccountsContactId("");
    s.setAccountContactRecord(null);
    s.setAccountCompanyRecord(null);
    s.setRelatedInquiryRecord(null);
    s.setLinkedProperties([]);
    s.setIsLinkedPropertiesLoading(false);
    s.setLinkedPropertiesError("");
    s.setAffiliations([]);
    s.setIsAffiliationsLoading(false);
    s.setAffiliationsError("");
    s.setWorkspacePropertyLookupRecords([]);
    s.setIsWorkspacePropertyLookupLoading(false);
    s.setWorkspacePropertyLookupError("");
    s.setWorkspacePropertySearchValue("");
    s.setSelectedWorkspacePropertyId("");
    s.setJobActivities([]);
    s.setJobMaterials([]);
    s.setIsWorkspaceSectionsLoading(false);
    s.setWorkspaceSectionsError("");
    s.setActiveWorkspaceTab("related-data");
    s.setMountedWorkspaceTabs({ "related-data": true });
    s.setIsTasksModalOpen(false);
    s.setInvoiceActiveTab("");
    s.setInvoiceActiveTabVersion(0);
    s.setIsAppointmentModalOpen(false);
    s.setAppointmentModalMode("create");
    s.setEditingAppointmentId("");
    s.setIsUploadsModalOpen(false);
    s.setIsAddPropertyOpen(false);
    s.setPropertyModalMode("create");
    s.setAffiliationModalState({ open: false, initialData: null });
    s.setShouldAutoSelectNewAffiliation(false);
    s.setIsActivityModalOpen(false);
    s.setActivityModalMode("create");
    s.setEditingActivityId("");
    s.setIsMaterialModalOpen(false);
    s.setMaterialModalMode("create");
    s.setEditingMaterialId("");
    s.setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
    s.setIsQuoteWorkflowUpdating(false);
    s.setContactLogs([]);
    s.setIsContactLogsLoading(false);
    s.setContactLogsError("");
    s.setJobEmailContactSearchValue("");
    s.setAccountsContactSearchValue("");
    s.setSelectedJobEmailContactId("");
    s.setSelectedAccountsContactId("");
    s.setIsSavingQuoteContacts(false);
    s.setCompanyLookupRecords([]);
    s.setContactLookupRecords([]);
    s.setIsCompanyLookupLoading(false);
    s.setIsContactLookupLoading(false);
    s.setContactModalState({
      open: false,
      mode: "individual",
      onSave: null,
      onModeChange: null,
      allowModeSwitch: false,
      titleVerb: "Update",
      initialValues: null,
    });
    s.setIsAccountDetailsLoading(false);
  }, [jobNumericId, safeUid]);

  // Initial job data load
  useEffect(() => {
    if (!isSdkReady || !plugin || isNewJob) {
      s.setAllocatedServiceProviderId("");
      s.setAllocatedJobTakenById("");
      setResolvedJobId("");
      s.setIsJobAllocationPrefillResolved(false);
      s.setIsLoadedJobTakenByMissing(false);
      s.setRelatedInquiryId("");
      s.setRelatedInquiryUid("");
      s.setLoadedJobStatus("");
      s.setIsPcaDone(false);
      s.setIsPrestartDone(false);
      s.setIsMarkComplete(false);
      s.setLoadedAccountType("");
      s.setLoadedClientEntityId("");
      s.setLoadedClientIndividualId("");
      s.setLoadedPropertyId("");
      s.setLoadedAccountsContactId("");
      s.setAccountContactRecord(null);
      s.setAccountCompanyRecord(null);
      s.setRelatedInquiryRecord(null);
      s.setLinkedProperties([]);
      s.setIsLinkedPropertiesLoading(false);
      s.setLinkedPropertiesError("");
      s.setAffiliations([]);
      s.setIsAffiliationsLoading(false);
      s.setAffiliationsError("");
      s.setWorkspacePropertyLookupRecords([]);
      s.setIsWorkspacePropertyLookupLoading(false);
      s.setWorkspacePropertyLookupError("");
      s.setWorkspacePropertySearchValue("");
      s.setSelectedWorkspacePropertyId("");
      s.setJobActivities([]);
      s.setJobMaterials([]);
      s.setIsWorkspaceSectionsLoading(false);
      s.setWorkspaceSectionsError("");
      s.setActiveWorkspaceTab("related-data");
      s.setMountedWorkspaceTabs({ "related-data": true });
      s.setIsTasksModalOpen(false);
      s.setInvoiceActiveTab("");
      s.setInvoiceActiveTabVersion(0);
      s.setIsAppointmentModalOpen(false);
      s.setAppointmentModalMode("create");
      s.setEditingAppointmentId("");
      s.setIsUploadsModalOpen(false);
      s.setIsAddPropertyOpen(false);
      s.setPropertyModalMode("create");
      s.setAffiliationModalState({ open: false, initialData: null });
      s.setShouldAutoSelectNewAffiliation(false);
      s.setIsActivityModalOpen(false);
      s.setActivityModalMode("create");
      s.setEditingActivityId("");
      s.setIsMaterialModalOpen(false);
      s.setMaterialModalMode("create");
      s.setEditingMaterialId("");
      s.setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
      s.setJobEmailContactSearchValue("");
      s.setAccountsContactSearchValue("");
      s.setSelectedJobEmailContactId("");
      s.setSelectedAccountsContactId("");
      s.setIsSavingQuoteContacts(false);
      s.setIsAccountDetailsLoading(false);
      return;
    }

    let cancelled = false;
    s.setIsJobAllocationPrefillResolved(false);
    const jobModel = plugin.switchTo?.("PeterpmJob");
    if (!jobModel?.query) {
      s.setAllocatedServiceProviderId("");
      s.setAllocatedJobTakenById("");
      setResolvedJobId("");
      s.setLoadedJobStatus("");
      s.setIsJobAllocationPrefillResolved(true);
      s.setIsLoadedJobTakenByMissing(false);
      s.setRelatedInquiryId("");
      s.setRelatedInquiryUid("");
      s.setIsPcaDone(false);
      s.setIsPrestartDone(false);
      s.setIsMarkComplete(false);
      s.setLoadedAccountType("");
      s.setLoadedClientEntityId("");
      s.setLoadedClientIndividualId("");
      s.setLoadedPropertyId("");
      s.setLoadedAccountsContactId("");
      s.setAccountContactRecord(null);
      s.setAccountCompanyRecord(null);
      s.setRelatedInquiryRecord(null);
      s.setLinkedProperties([]);
      s.setIsLinkedPropertiesLoading(false);
      s.setLinkedPropertiesError("");
      s.setAffiliations([]);
      s.setIsAffiliationsLoading(false);
      s.setAffiliationsError("");
      s.setWorkspacePropertyLookupRecords([]);
      s.setIsWorkspacePropertyLookupLoading(false);
      s.setWorkspacePropertyLookupError("");
      s.setWorkspacePropertySearchValue("");
      s.setSelectedWorkspacePropertyId("");
      s.setJobActivities([]);
      s.setJobMaterials([]);
      s.setIsWorkspaceSectionsLoading(false);
      s.setWorkspaceSectionsError("");
      s.setActiveWorkspaceTab("related-data");
      s.setMountedWorkspaceTabs({ "related-data": true });
      s.setIsTasksModalOpen(false);
      s.setInvoiceActiveTab("");
      s.setInvoiceActiveTabVersion(0);
      s.setIsAppointmentModalOpen(false);
      s.setAppointmentModalMode("create");
      s.setEditingAppointmentId("");
      s.setIsUploadsModalOpen(false);
      s.setIsAddPropertyOpen(false);
      s.setPropertyModalMode("create");
      s.setAffiliationModalState({ open: false, initialData: null });
      s.setShouldAutoSelectNewAffiliation(false);
      s.setIsActivityModalOpen(false);
      s.setActivityModalMode("create");
      s.setEditingActivityId("");
      s.setIsMaterialModalOpen(false);
      s.setMaterialModalMode("create");
      s.setEditingMaterialId("");
      s.setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
      s.setJobEmailContactSearchValue("");
      s.setAccountsContactSearchValue("");
      s.setSelectedJobEmailContactId("");
      s.setSelectedAccountsContactId("");
      s.setIsSavingQuoteContacts(false);
      s.setIsAccountDetailsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadInitialJobData = async () => {
      try {
        let job = null;
        if (jobNumericId) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "id",
            value: jobNumericId,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (!job && safeUid && !isNewJob) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "unique_id",
            value: safeUid,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (!job && safeUid && /^\d+$/.test(safeUid)) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "id",
            value: safeUid,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (cancelled) return;
        const resolvedId = toText(job?.id || job?.ID);
        const resolvedTakenBy = resolvedId
          ? await fetchJobTakenByValue({ jobModel, jobId: resolvedId })
          : { value: "" };
        if (cancelled) return;
        const resolvedTakenById = toText(resolvedTakenBy?.value);
        setResolvedJobId(resolvedId);
        s.setAllocatedServiceProviderId(
          toText(job?.primary_service_provider_id || job?.Primary_Service_Provider_ID)
        );
        s.setAllocatedJobTakenById(resolvedTakenById);
        const resolvedInquiryId = toText(job?.inquiry_record_id || job?.Inquiry_Record_ID);
        s.setRelatedInquiryId(resolvedInquiryId);
        const resolvedInquiryUid = resolvedInquiryId
          ? await fetchInquiryUidById({ plugin, inquiryId: resolvedInquiryId })
          : "";
        if (cancelled) return;
        s.setRelatedInquiryUid(resolvedInquiryUid);
        s.setIsPcaDone(pickBooleanValue(job, ["pca_done", "PCA_Done"]));
        s.setIsPrestartDone(pickBooleanValue(job, ["prestart_done", "Prestart_Done"]));
        s.setIsMarkComplete(pickBooleanValue(job, ["mark_complete", "Mark_Complete"]));
        s.setLoadedAccountType(toText(job?.account_type || job?.Account_Type));
        s.setLoadedClientEntityId(toText(job?.client_entity_id || job?.Client_Entity_ID));
        s.setLoadedClientIndividualId(
          toText(job?.client_individual_id || job?.Client_Individual_ID)
        );
        const resolvedPropertyId = toText(job?.property_id || job?.Property_ID);
        s.setLoadedPropertyId(resolvedPropertyId);
        s.setSelectedWorkspacePropertyId(resolvedPropertyId);
        const resolvedAccountsContactId = toText(
          job?.accounts_contact_id || job?.Accounts_Contact_ID
        );
        s.setLoadedAccountsContactId(resolvedAccountsContactId);
        s.setSelectedAccountsContactId(resolvedAccountsContactId);
        s.setQuotePaymentDetails(buildQuotePaymentDetailsFromJob(job));
        s.setAccountContactRecord(null);
        s.setAccountCompanyRecord(null);
        s.setLoadedJobStatus(toText(job?.job_status || job?.job_Status || job?.Job_Status));
        s.setIsLoadedJobTakenByMissing(Boolean(resolvedId && !resolvedTakenById));
        s.setIsJobAllocationPrefillResolved(true);
      } catch (lookupError) {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to load job data on page load", lookupError);
        s.setAllocatedServiceProviderId("");
        s.setAllocatedJobTakenById("");
        setResolvedJobId("");
        s.setLoadedJobStatus("");
        s.setIsJobAllocationPrefillResolved(true);
        s.setIsLoadedJobTakenByMissing(false);
        s.setRelatedInquiryId("");
        s.setRelatedInquiryUid("");
        s.setIsPcaDone(false);
        s.setIsPrestartDone(false);
        s.setIsMarkComplete(false);
        s.setLoadedAccountType("");
        s.setLoadedClientEntityId("");
        s.setLoadedClientIndividualId("");
        s.setLoadedPropertyId("");
        s.setLoadedAccountsContactId("");
        s.setAccountContactRecord(null);
        s.setAccountCompanyRecord(null);
        s.setRelatedInquiryRecord(null);
        s.setLinkedProperties([]);
        s.setIsLinkedPropertiesLoading(false);
        s.setLinkedPropertiesError("");
        s.setAffiliations([]);
        s.setIsAffiliationsLoading(false);
        s.setAffiliationsError("");
        s.setWorkspacePropertyLookupRecords([]);
        s.setIsWorkspacePropertyLookupLoading(false);
        s.setWorkspacePropertyLookupError("");
        s.setWorkspacePropertySearchValue("");
        s.setSelectedWorkspacePropertyId("");
        s.setJobActivities([]);
        s.setJobMaterials([]);
        s.setIsWorkspaceSectionsLoading(false);
        s.setWorkspaceSectionsError("");
        s.setActiveWorkspaceTab("related-data");
        s.setMountedWorkspaceTabs({ "related-data": true });
        s.setIsTasksModalOpen(false);
        s.setInvoiceActiveTab("");
        s.setInvoiceActiveTabVersion(0);
        s.setIsAppointmentModalOpen(false);
        s.setAppointmentModalMode("create");
        s.setEditingAppointmentId("");
        s.setIsUploadsModalOpen(false);
        s.setIsAddPropertyOpen(false);
        s.setPropertyModalMode("create");
        s.setAffiliationModalState({ open: false, initialData: null });
        s.setShouldAutoSelectNewAffiliation(false);
        s.setIsActivityModalOpen(false);
        s.setActivityModalMode("create");
        s.setEditingActivityId("");
        s.setIsMaterialModalOpen(false);
        s.setMaterialModalMode("create");
        s.setEditingMaterialId("");
        s.setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
        s.setJobEmailContactSearchValue("");
        s.setAccountsContactSearchValue("");
        s.setSelectedJobEmailContactId("");
        s.setSelectedAccountsContactId("");
        s.setIsSavingQuoteContacts(false);
        s.setIsAccountDetailsLoading(false);
      }
    };

    loadInitialJobData();

    return () => {
      cancelled = true;
    };
  }, [isNewJob, isSdkReady, jobNumericId, plugin, safeUid]);
}
