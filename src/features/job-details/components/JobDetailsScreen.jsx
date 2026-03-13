import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toText } from "@shared/utils/formatters.js";
import { isCompanyAccountType } from "@shared/utils/accountTypeUtils.js";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useVitalStatsPlugin } from "@platform/vitalstats/useVitalStatsPlugin.js";
import {
  useServiceProviderLookup,
  useAdminProviderLookup,
} from "@modules/details-workspace/exports/hooks.js";
import { useRelatedRecordsData } from "@modules/details-workspace/exports/hooks.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { JobDetailsBodySection } from "./JobDetailsBodySection.jsx";
import { useJobDetailsRouteContext } from "../hooks/useJobDetailsRouteContext.js";
import { useJobScreenUiState } from "../hooks/useJobScreenUiState.js";
import { useJobInitialDataLoad } from "../hooks/useJobInitialDataLoad.js";
import { useJobAccountDetails } from "../hooks/useJobAccountDetails.js";
import { useJobServiceProviderAllocation } from "../hooks/useJobServiceProviderAllocation.js";
import { useJobWorkspaceProperty } from "../hooks/useJobWorkspaceProperty.js";
import { useJobMemoSystem } from "../hooks/useJobMemoSystem.js";
import { useJobQuoteWorkflow } from "../hooks/useJobQuoteWorkflow.js";
import { useJobBooleanToggles } from "../hooks/useJobBooleanToggles.js";
import { useJobAccountEditor } from "../hooks/useJobAccountEditor.js";
import { useJobScreenDerivedData } from "../hooks/useJobScreenDerivedData.js";
import { useJobScreenActions } from "../hooks/useJobScreenActions.js";
import { useJobScreenSyncEffects } from "../hooks/useJobScreenSyncEffects.js";

export function JobDetailsScreen() {
  const { success, error } = useToast();
  const { plugin, isReady: isSdkReady } = useVitalStatsPlugin();
  const { uid = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const route = useJobDetailsRouteContext({ location, uid });
  const s = useJobScreenUiState();

  const { records: serviceProviderLookup, isLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookup({ plugin, isSdkReady });
  const { records: jobTakenByLookup, isLoading: isJobTakenByLookupLoading } =
    useAdminProviderLookup({ plugin, isSdkReady });

  useJobInitialDataLoad({
    effectiveJobId: route.effectiveJobId,
    isNewJob: route.isNewJob,
    isSdkReady,
    jobNumericId: route.jobNumericId,
    plugin,
    safeUid: route.safeUid,
    setResolvedJobId: route.setResolvedJobId,
    s,
  });

  const { searchCompaniesInDatabase, searchContactsInDatabase } = useJobAccountDetails({
    effectiveJobId: route.effectiveJobId,
    isSdkReady,
    loadedAccountType: s.loadedAccountType,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    loadedPropertyId: s.loadedPropertyId,
    plugin,
    relatedInquiryId: s.relatedInquiryId,
    setAccountContactRecord: s.setAccountContactRecord,
    setAccountCompanyRecord: s.setAccountCompanyRecord,
    setIsAccountDetailsLoading: s.setIsAccountDetailsLoading,
    setLinkedProperties: s.setLinkedProperties,
    setLoadedPropertyId: s.setLoadedPropertyId,
    setSelectedWorkspacePropertyId: s.setSelectedWorkspacePropertyId,
    setWorkspacePropertyLookupRecords: s.setWorkspacePropertyLookupRecords,
    setCompanyLookupRecords: s.setCompanyLookupRecords,
    setContactLookupRecords: s.setContactLookupRecords,
    setIsCompanyLookupLoading: s.setIsCompanyLookupLoading,
    setIsContactLookupLoading: s.setIsContactLookupLoading,
  });

  const spAlloc = useJobServiceProviderAllocation({
    allocatedJobTakenById: s.allocatedJobTakenById,
    allocatedServiceProviderId: s.allocatedServiceProviderId,
    configuredAdminProviderId: route.configuredAdminProviderId,
    effectiveJobId: route.effectiveJobId,
    error,
    isAllocatingServiceProvider: s.isAllocatingServiceProvider,
    isJobAllocationPrefillResolved: s.isJobAllocationPrefillResolved,
    isLoadedJobTakenByMissing: s.isLoadedJobTakenByMissing,
    isNewJob: route.isNewJob,
    isSavingJobTakenBy: s.isSavingJobTakenBy,
    isSdkReady,
    jobTakenByAutofillRef: s.jobTakenByAutofillRef,
    jobTakenByLookup,
    plugin,
    selectedJobTakenById: s.selectedJobTakenById,
    selectedServiceProviderId: s.selectedServiceProviderId,
    serviceProviderLookup,
    serviceProviderPrefilledRef: s.serviceProviderPrefilledRef,
    serviceProviderSearch: s.serviceProviderSearch,
    setAllocatedJobTakenById: s.setAllocatedJobTakenById,
    setAllocatedServiceProviderId: s.setAllocatedServiceProviderId,
    setIsAllocatingServiceProvider: s.setIsAllocatingServiceProvider,
    setIsLoadedJobTakenByMissing: s.setIsLoadedJobTakenByMissing,
    setIsSavingJobTakenBy: s.setIsSavingJobTakenBy,
    setJobTakenBySearch: s.setJobTakenBySearch,
    setSelectedJobTakenById: s.setSelectedJobTakenById,
    setSelectedServiceProviderId: s.setSelectedServiceProviderId,
    setServiceProviderSearch: s.setServiceProviderSearch,
    success,
  });

  const normalizedAccountType = toText(s.loadedAccountType).toLowerCase();
  const isQuoteCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const relatedRecordsAccountType =
    isQuoteCompanyAccount || (toText(s.loadedClientEntityId) && !toText(s.loadedClientIndividualId))
      ? "Company"
      : "Contact";
  const relatedRecordsAccountId =
    relatedRecordsAccountType === "Company"
      ? toText(s.loadedClientEntityId || s.loadedClientIndividualId)
      : toText(s.loadedClientIndividualId || s.loadedClientEntityId);

  const wsProperty = useJobWorkspaceProperty({
    effectiveJobId: route.effectiveJobId,
    error,
    isSdkReady,
    linkedProperties: s.linkedProperties,
    loadedPropertyId: s.loadedPropertyId,
    plugin,
    relatedInquiryId: s.relatedInquiryId,
    relatedRecordsAccountId,
    relatedRecordsAccountType,
    selectedWorkspacePropertyId: s.selectedWorkspacePropertyId,
    setAffiliations: s.setAffiliations,
    setAffiliationsError: s.setAffiliationsError,
    setAffiliationsLoading: s.setIsAffiliationsLoading,
    setIsAddPropertyOpen: s.setIsAddPropertyOpen,
    setIsLinkedPropertiesLoading: s.setIsLinkedPropertiesLoading,
    setIsWorkspacePropertyLookupLoading: s.setIsWorkspacePropertyLookupLoading,
    setLinkedProperties: s.setLinkedProperties,
    setLinkedPropertiesError: s.setLinkedPropertiesError,
    setLoadedPropertyId: s.setLoadedPropertyId,
    setMountedWorkspaceTabs: s.setMountedWorkspaceTabs,
    setSelectedWorkspacePropertyId: s.setSelectedWorkspacePropertyId,
    setWorkspacePropertyLookupError: s.setWorkspacePropertyLookupError,
    setWorkspacePropertyLookupRecords: s.setWorkspacePropertyLookupRecords,
    setWorkspacePropertySearchValue: s.setWorkspacePropertySearchValue,
    success,
    workspacePropertyLookupRecords: s.workspacePropertyLookupRecords,
    activeWorkspaceTab: s.activeWorkspaceTab,
  });

  const relatedRecords = useRelatedRecordsData({
    plugin,
    accountType: relatedRecordsAccountType,
    accountId: relatedRecordsAccountId,
  });

  const derivedFull = useJobScreenDerivedData({
    accountCompanyRecord: s.accountCompanyRecord,
    accountContactRecord: s.accountContactRecord,
    activeWorkspaceProperty: wsProperty.activeWorkspaceProperty,
    affiliations: s.affiliations,
    allocatedServiceProviderId: s.allocatedServiceProviderId,
    companyLookupRecords: s.companyLookupRecords,
    contactLookupRecords: s.contactLookupRecords,
    effectiveJobId: route.effectiveJobId,
    isNewJob: route.isNewJob,
    jobActivities: s.jobActivities,
    jobMaterials: s.jobMaterials,
    jobTakenByPrefillLabel: spAlloc.jobTakenByPrefillLabel,
    jobTakenBySearch: s.jobTakenBySearch,
    loadedAccountType: s.loadedAccountType,
    loadedAccountsContactId: s.loadedAccountsContactId,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    loadedJobStatus: s.loadedJobStatus,
    loadedPropertyId: s.loadedPropertyId,
    quotePaymentDetails: s.quotePaymentDetails,
    relatedInquiryId: s.relatedInquiryId,
    relatedInquiryRecord: s.relatedInquiryRecord,
    relatedInquiryUid: s.relatedInquiryUid,
    relatedRecords,
    routeJobStatus: route.routeJobStatus,
    safeUid: route.safeUid,
    selectedAccountsContactId: s.selectedAccountsContactId,
    selectedJobEmailContactId: s.selectedJobEmailContactId,
    selectedServiceProviderId: s.selectedServiceProviderId,
    selectedWorkspacePropertyId: s.selectedWorkspacePropertyId,
    serviceProviderItems: spAlloc.serviceProviderItems,
    serviceProviderSearch: s.serviceProviderSearch,
    workspacePropertyLookupRecords: s.workspacePropertyLookupRecords,
    workspacePropertySearchValue: s.workspacePropertySearchValue,
  });

  const quoteWorkflow = useJobQuoteWorkflow({
    accountsContactSearchValue: s.accountsContactSearchValue,
    effectiveJobId: route.effectiveJobId,
    error,
    isCompanyAccount: derivedFull.isCompanyAccount,
    isQuoteWorkflowUpdating: s.isQuoteWorkflowUpdating,
    isSavingQuoteContacts: s.isSavingQuoteContacts,
    isSdkReady,
    loadedAccountType: s.loadedAccountType,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    plugin,
    quotePaymentDetails: s.quotePaymentDetails,
    selectedAccountsContactId: s.selectedAccountsContactId,
    selectedJobEmailContactId: s.selectedJobEmailContactId,
    setIsQuoteWorkflowUpdating: s.setIsQuoteWorkflowUpdating,
    setIsSavingQuoteContacts: s.setIsSavingQuoteContacts,
    setLoadedAccountType: s.setLoadedAccountType,
    setLoadedAccountsContactId: s.setLoadedAccountsContactId,
    setLoadedClientEntityId: s.setLoadedClientEntityId,
    setLoadedClientIndividualId: s.setLoadedClientIndividualId,
    setLoadedJobStatus: s.setLoadedJobStatus,
    setQuotePaymentDetails: s.setQuotePaymentDetails,
    success,
  });

  const boolToggles = useJobBooleanToggles({
    effectiveJobId: route.effectiveJobId,
    error,
    isMarkComplete: s.isMarkComplete,
    isPcaDone: s.isPcaDone,
    isPrestartDone: s.isPrestartDone,
    isSavingMarkComplete: s.isSavingMarkComplete,
    isSavingPcaDone: s.isSavingPcaDone,
    isSavingPrestartDone: s.isSavingPrestartDone,
    isSdkReady,
    pendingMarkCompleteValue: s.pendingMarkCompleteValue,
    plugin,
    setIsMarkComplete: s.setIsMarkComplete,
    setIsMarkCompleteConfirmOpen: s.setIsMarkCompleteConfirmOpen,
    setIsPcaDone: s.setIsPcaDone,
    setIsPrestartDone: s.setIsPrestartDone,
    setIsSavingMarkComplete: s.setIsSavingMarkComplete,
    setIsSavingPcaDone: s.setIsSavingPcaDone,
    setIsSavingPrestartDone: s.setIsSavingPrestartDone,
    setPendingMarkCompleteValue: s.setPendingMarkCompleteValue,
    success,
  });

  const openContactDetailsModal = useCallback(
    ({ mode = "individual", onSave = null, onModeChange = null, allowModeSwitch = false, titleVerb = "Add", initialValues = null } = {}) => {
      s.setContactModalState({
        open: true, mode,
        onSave: typeof onSave === "function" ? onSave : null,
        onModeChange: typeof onModeChange === "function" ? onModeChange : null,
        allowModeSwitch: Boolean(allowModeSwitch),
        titleVerb: toText(titleVerb) || "Add",
        initialValues: initialValues && typeof initialValues === "object" ? { ...initialValues } : null,
      });
    }, []
  );

  const accountEditor = useJobAccountEditor({
    accountCompany: derivedFull.accountCompany,
    accountCompanyPrimary: derivedFull.accountCompanyPrimary,
    accountPrimaryContact: derivedFull.accountPrimaryContact,
    effectiveJobId: route.effectiveJobId,
    isCompanyAccount: derivedFull.isCompanyAccount,
    loadedAccountType: s.loadedAccountType,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    openContactDetailsModal,
    plugin,
    searchCompaniesInDatabase,
    searchContactsInDatabase,
    setContactModalState: s.setContactModalState,
    setJobEmailContactSearchValue: s.setJobEmailContactSearchValue,
    setLoadedAccountType: s.setLoadedAccountType,
    setLoadedClientEntityId: s.setLoadedClientEntityId,
    setLoadedClientIndividualId: s.setLoadedClientIndividualId,
    setSelectedJobEmailContactId: s.setSelectedJobEmailContactId,
    success,
  });

  const memoSystem = useJobMemoSystem({
    currentUserId: derivedFull.currentUserId,
    effectiveJobId: route.effectiveJobId,
    error,
    hasMemoContext: derivedFull.hasMemoContext,
    isMemoChatOpen: s.isMemoChatOpen,
    isSdkReady,
    plugin,
    relatedInquiryId: s.relatedInquiryId,
    resolveMemoAuthor: derivedFull.resolveMemoAuthor,
    safeUid: route.safeUid,
    success,
    isDeletingMemoItem: s.isDeletingMemoItem,
    isPostingMemo: s.isPostingMemo,
    memoDeleteTarget: s.memoDeleteTarget,
    memoFile: s.memoFile,
    memoFileInputRef: s.memoFileInputRef,
    memoReplyDrafts: s.memoReplyDrafts,
    memoText: s.memoText,
    memos: s.memos,
    sendingReplyPostId: s.sendingReplyPostId,
    setAreFloatingWidgetsVisible: s.setAreFloatingWidgetsVisible,
    setIsDeletingMemoItem: s.setIsDeletingMemoItem,
    setIsMemoChatOpen: s.setIsMemoChatOpen,
    setIsMemosLoading: s.setIsMemosLoading,
    setIsPostingMemo: s.setIsPostingMemo,
    setMemoDeleteTarget: s.setMemoDeleteTarget,
    setMemoFile: s.setMemoFile,
    setMemoFocusRequest: s.setMemoFocusRequest,
    setMemoReplyDrafts: s.setMemoReplyDrafts,
    setMemoText: s.setMemoText,
    setMemos: s.setMemos,
    setMemosError: s.setMemosError,
    setSendingReplyPostId: s.setSendingReplyPostId,
  });

  const isRelatedDataTabMounted = Boolean(s.mountedWorkspaceTabs["related-data"]);

  const actions = useJobScreenActions({
    accountsContactItems: derivedFull.accountsContactItems,
    activeWorkspaceProperty: wsProperty.activeWorkspaceProperty,
    effectiveJobId: route.effectiveJobId,
    error,
    isCreatingCallback: s.isCreatingCallback,
    isDuplicatingJob: s.isDuplicatingJob,
    isNewJob: route.isNewJob,
    isRecordingEmailAction: s.isRecordingEmailAction,
    isRelatedDataTabMounted,
    isSavingLinkedInquiry: s.isSavingLinkedInquiry,
    isSavingPopupComment: s.isSavingPopupComment,
    isSdkReady,
    isSendingJobUpdate: s.isSendingJobUpdate,
    loadedPropertyId: s.loadedPropertyId,
    navigate,
    plugin,
    relatedInquiryId: s.relatedInquiryId,
    relatedRecordsAccountId,
    relatedRecordsAccountType,
    safeUid: route.safeUid,
    shouldAutoSelectNewAffiliation: s.shouldAutoSelectNewAffiliation,
    success,
    contactLogsContactId: derivedFull.contactLogsContactId,
    contactPopupComment: derivedFull.contactPopupComment,
    companyPopupComment: derivedFull.companyPopupComment,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    popupCommentDrafts: s.popupCommentDrafts,
    selectedAccountsContactId: s.selectedAccountsContactId,
    selectedWorkspacePropertyId: s.selectedWorkspacePropertyId,
    propertyModalMode: s.propertyModalMode,
    setAccountsContactSearchValue: s.setAccountsContactSearchValue,
    setActiveWorkspaceTab: s.setActiveWorkspaceTab,
    setAffiliationModalState: s.setAffiliationModalState,
    setAffiliations: s.setAffiliations,
    setAffiliationsError: s.setAffiliationsError,
    setContactLogs: s.setContactLogs,
    setContactLogsError: s.setContactLogsError,
    setEditingActivityId: s.setEditingActivityId,
    setEditingAppointmentId: s.setEditingAppointmentId,
    setEditingMaterialId: s.setEditingMaterialId,
    setInvoiceActiveTab: s.setInvoiceActiveTab,
    setInvoiceActiveTabVersion: s.setInvoiceActiveTabVersion,
    setIsAccountDetailsLoading: s.setIsAccountDetailsLoading,
    setIsActivityModalOpen: s.setIsActivityModalOpen,
    setIsAddPropertyOpen: s.setIsAddPropertyOpen,
    setIsAppointmentModalOpen: s.setIsAppointmentModalOpen,
    setIsCreatingCallback: s.setIsCreatingCallback,
    setIsDuplicatingJob: s.setIsDuplicatingJob,
    setIsContactLogsLoading: s.setIsContactLogsLoading,
    setIsMaterialModalOpen: s.setIsMaterialModalOpen,
    setIsPopupCommentModalOpen: s.setIsPopupCommentModalOpen,
    setIsRecordingEmailAction: s.setIsRecordingEmailAction,
    setIsSavingLinkedInquiry: s.setIsSavingLinkedInquiry,
    setIsSavingPopupComment: s.setIsSavingPopupComment,
    setIsSendingJobUpdate: s.setIsSendingJobUpdate,
    setIsTasksModalOpen: s.setIsTasksModalOpen,
    setIsUploadsModalOpen: s.setIsUploadsModalOpen,
    setJobActivities: s.setJobActivities,
    setJobMaterials: s.setJobMaterials,
    setIsWorkspaceSectionsLoading: s.setIsWorkspaceSectionsLoading,
    setWorkspaceSectionsError: s.setWorkspaceSectionsError,
    setLinkedProperties: s.setLinkedProperties,
    setLoadedPropertyId: s.setLoadedPropertyId,
    setOpenMenu: s.setOpenMenu,
    setPopupCommentDrafts: s.setPopupCommentDrafts,
    setPropertyModalMode: s.setPropertyModalMode,
    setActivityModalMode: s.setActivityModalMode,
    setAppointmentModalMode: s.setAppointmentModalMode,
    setMaterialModalMode: s.setMaterialModalMode,
    setRelatedInquiryId: s.setRelatedInquiryId,
    setRelatedInquiryRecord: s.setRelatedInquiryRecord,
    setRelatedInquiryUid: s.setRelatedInquiryUid,
    setSelectedAccountsContactId: s.setSelectedAccountsContactId,
    setSelectedWorkspacePropertyId: s.setSelectedWorkspacePropertyId,
    setShouldAutoSelectNewAffiliation: s.setShouldAutoSelectNewAffiliation,
    setWorkspacePropertyLookupRecords: s.setWorkspacePropertyLookupRecords,
    workspacePropertyLookupRecords: s.workspacePropertyLookupRecords,
  });

  useJobScreenSyncEffects({
    accountsContactItems: derivedFull.accountsContactItems,
    isQuoteCompanyAccount: derivedFull.isQuoteCompanyAccount,
    jobEmailFallbackLabel: derivedFull.jobEmailFallbackLabel,
    jobEmailItems: derivedFull.jobEmailItems,
    loadedAccountsContactId: s.loadedAccountsContactId,
    loadedClientEntityId: s.loadedClientEntityId,
    loadedClientIndividualId: s.loadedClientIndividualId,
    menuRootRef: s.menuRootRef,
    openMenu: s.openMenu,
    selectedAccountsContactId: s.selectedAccountsContactId,
    selectedJobEmailContactId: s.selectedJobEmailContactId,
    setAccountsContactSearchValue: s.setAccountsContactSearchValue,
    setJobEmailContactSearchValue: s.setJobEmailContactSearchValue,
    setOpenMenu: s.setOpenMenu,
    setSelectedAccountsContactId: s.setSelectedAccountsContactId,
    setSelectedJobEmailContactId: s.setSelectedJobEmailContactId,
  });

  const handlePrintJobSheet = useCallback(() => {
    actions.handlePrintJobSheet(derivedFull.quoteHeaderData, s.jobActivities);
  }, [actions.handlePrintJobSheet, derivedFull.quoteHeaderData, s.jobActivities]);

  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']" data-page="job-details">
      <GlobalTopHeader />
      <JobDetailsBodySection
        accountEditor={accountEditor}
        actions={actions}
        boolToggles={boolToggles}
        derivedFull={derivedFull}
        handlePrintJobSheet={handlePrintJobSheet}
        isJobTakenByLookupLoading={isJobTakenByLookupLoading}
        isServiceProviderLookupLoading={isServiceProviderLookupLoading}
        memoSystem={memoSystem}
        navigate={navigate}
        openContactDetailsModal={openContactDetailsModal}
        plugin={plugin}
        quoteWorkflow={quoteWorkflow}
        relatedRecords={relatedRecords}
        relatedRecordsAccountId={relatedRecordsAccountId}
        relatedRecordsAccountType={relatedRecordsAccountType}
        route={route}
        s={s}
        searchCompaniesInDatabase={searchCompaniesInDatabase}
        searchContactsInDatabase={searchContactsInDatabase}
        spAlloc={spAlloc}
        wsProperty={wsProperty}
      />
    </main>
  );
}
