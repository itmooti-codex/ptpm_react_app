import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useAdminProviderLookup,
  useServiceProviderLookup,
} from "@modules/details-workspace/exports/hooks.js";
import { toText } from "@shared/utils/formatters.js";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import { InquiryDetailsScreenLayout } from "./InquiryDetailsScreenLayout.jsx";
import { useRelatedRecordsData } from "@modules/details-workspace/exports/hooks.js";
import { INQUIRY_WORKSPACE_TABS } from "../shared/inquiryInformationConstants.js";
import { useInquiryAccountViewModel } from "../hooks/useInquiryAccountViewModel.js";
import { useInquiryAssignmentViewModel } from "../hooks/useInquiryAssignmentViewModel.js";
import { useInquiryContactLogs } from "../hooks/useInquiryContactLogs.js";
import { useInquiryDetailsViewModel } from "../hooks/useInquiryDetailsViewModel.js";
import { useInquiryMemoThread } from "../hooks/useInquiryMemoThread.js";
import { useInquiryPropertyWorkspaceState } from "../hooks/useInquiryPropertyWorkspaceState.js";
import { useInquiryRecentActivities } from "../hooks/useInquiryRecentActivities.js";
import { useInquiryScreenActions } from "../hooks/useInquiryScreenActions.js";
import { useInquiryScreenContext } from "../hooks/useInquiryScreenContext.js";
import { useInquiryScreenDataEffects } from "../hooks/useInquiryScreenDataEffects.js";
import { useInquiryScreenUiEffects } from "../hooks/useInquiryScreenUiEffects.js";
import { useInquiryScreenUiState } from "../hooks/useInquiryScreenUiState.js";
import { useInquiryWorkspaceTabs } from "../hooks/useInquiryWorkspaceTabs.js";

export function InquiryDetailsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid = "" } = useParams();
  const { toast, update, success, error, dismiss } = useToast();
  const { plugin, isReady: isSdkReady } = useVitalStatsPlugin();
  const screenState = useInquiryScreenUiState();
  const safeUid = useMemo(() => String(uid || "").trim(), [uid]);
  const isQuickInquiryBookingMode = useMemo(
    () =>
      safeUid.toLowerCase() === "new" ||
      String(location?.pathname || "").toLowerCase().replace(/\/+$/, "") === "/inquiry-details/new",
    [location?.pathname, safeUid]
  );
  const hasUid = Boolean(safeUid) && !isQuickInquiryBookingMode;
  const configuredAdminProviderId = useMemo(
    () => String(import.meta.env.VITE_APP_USER_ADMIN_ID || "").trim(),
    []
  );

  const { records: serviceProviderLookup, isLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookup({ plugin, isSdkReady });
  const { records: inquiryTakenByLookup, isLoading: isInquiryTakenByLookupLoading } =
    useAdminProviderLookup({ plugin, isSdkReady });

  const screenContext = useInquiryScreenContext({
    isContextLoading: screenState.isContextLoading,
    isQuickInquiryBookingMode,
    linkedJobSelectionOverride: screenState.linkedJobSelectionOverride,
    location,
    resolvedInquiry: screenState.resolvedInquiry,
    safeUid,
    serviceProviderFallback: screenState.serviceProviderFallback,
  });

  const { trackRecentActivity } = useInquiryRecentActivities({
    plugin,
    configuredAdminProviderId,
    currentUserContactId: screenContext.currentAdminContactId,
    currentActivityPath: screenContext.currentActivityPath,
    inquiryId: screenContext.inquiryNumericId,
    inquiryUid: safeUid,
  });

  const accountView = useInquiryAccountViewModel({
    inquiry: screenContext.inquiry,
    inquiryAccountType: screenContext.inquiryAccountType,
    inquiryBodyCorpCompany: screenContext.inquiryBodyCorpCompany,
    inquiryCompany: screenContext.inquiryCompany,
    inquiryCompanyId: screenContext.inquiryCompanyId,
    inquiryCompanyPrimaryPerson: screenContext.inquiryCompanyPrimaryPerson,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryPrimaryContact: screenContext.inquiryPrimaryContact,
    isCompanyAccount: screenContext.isCompanyAccount,
    safeUid,
  });

  const relatedRecordsData = useRelatedRecordsData({
    plugin,
    accountType: screenContext.relatedRecordsAccountType,
    accountId: screenContext.relatedRecordsAccountId,
    refreshKey: screenState.relatedRecordsRefreshKey,
  });
  const filteredRelatedDeals = useMemo(() => {
    const currentInquiryId = toText(screenContext.inquiryNumericId);
    const currentInquiryUid = toText(safeUid);
    return (Array.isArray(relatedRecordsData.relatedDeals) ? relatedRecordsData.relatedDeals : []).filter(
      (deal) => {
        const dealId = toText(deal?.id || deal?.ID);
        const dealUid = toText(deal?.unique_id || deal?.Unique_ID);
        if (currentInquiryId && dealId && dealId === currentInquiryId) return false;
        if (currentInquiryUid && dealUid && dealUid === currentInquiryUid) return false;
        return true;
      }
    );
  }, [relatedRecordsData.relatedDeals, safeUid, screenContext.inquiryNumericId]);

  const isRelatedDataTabMounted = Boolean(screenState.mountedWorkspaceTabs["related-records"]);
  const contactLogsData = useInquiryContactLogs({
    plugin,
    isSdkReady,
    contactLogsContactId: screenContext.contactLogsContactId,
    enabled: isRelatedDataTabMounted,
  });

  const memoThread = useInquiryMemoThread({
    plugin,
    isSdkReady,
    hasMemoContext: screenContext.hasMemoContext,
    inquiryId: screenContext.inquiryNumericId,
    inquiryUid: safeUid,
    linkedJobId: screenContext.linkedInquiryJobIdFromRecord,
    currentUserId: screenContext.currentUserId,
    resolveMemoAuthor: screenContext.resolveMemoAuthor,
    onError: error,
    onSuccess: success,
  });

  const propertyWorkspace = useInquiryPropertyWorkspaceState({
    plugin,
    inquiry: screenContext.inquiry,
    safeUid,
    hasUid,
    relatedJobs: relatedRecordsData.relatedJobs,
    relatedRecordsAccountId: screenContext.relatedRecordsAccountId,
    relatedRecordsAccountType: screenContext.relatedRecordsAccountType,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryPrimaryContact: screenContext.inquiryPrimaryContact,
    inquiryCompanyId: screenContext.inquiryCompanyId,
    inquiryCompany: screenContext.inquiryCompany,
    inquiryCompanyPrimaryPerson: screenContext.inquiryCompanyPrimaryPerson,
    serviceProviderLookup,
    inquiryTakenByLookup,
    sameAsContactPropertySource: accountView.sameAsContactPropertySource,
  });

  const visibleWorkspaceTabs = useInquiryWorkspaceTabs({
    activeWorkspaceTab: screenState.activeWorkspaceTab,
    previousVisibleWorkspaceTabsKeyRef: screenState.previousVisibleWorkspaceTabsKeyRef,
    setActiveWorkspaceTab: screenState.setActiveWorkspaceTab,
    setMountedWorkspaceTabs: screenState.setMountedWorkspaceTabs,
    visibleWorkspaceTabs: INQUIRY_WORKSPACE_TABS,
  });

  const detailsView = useInquiryDetailsViewModel({
    activeRelatedProperty: propertyWorkspace.activeRelatedProperty,
    hasUid,
    inquiry: screenContext.inquiry,
    inquiryAccountType: screenContext.inquiryAccountType,
    inquiryCompany: screenContext.inquiryCompany,
    inquiryCompanyId: screenContext.inquiryCompanyId,
    inquiryCompanyPrimaryPerson: screenContext.inquiryCompanyPrimaryPerson,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryDetailsForm: screenState.inquiryDetailsForm,
    inquiryNumericId: screenContext.inquiryNumericId,
    inquiryPrimaryContact: screenContext.inquiryPrimaryContact,
    inquiryPropertyId: propertyWorkspace.inquiryPropertyId,
    inquiryPropertyRecord: propertyWorkspace.inquiryPropertyRecord,
    inquiryServiceOptions: screenState.inquiryServiceOptions,
    isContextLoading: screenState.isContextLoading,
    isInquiryDetailsModalOpen: screenState.isInquiryDetailsModalOpen,
    isPropertySameAsContact: propertyWorkspace.isPropertySameAsContact,
    isSdkReady,
    optimisticListSelectionByField: screenState.optimisticListSelectionByField,
    resolvedInquiry: screenState.resolvedInquiry,
    safeUid,
    serviceInquiryLabelById: screenState.serviceInquiryLabelById,
    serviceInquiryName: screenState.serviceInquiryName,
  });

  const assignmentView = useInquiryAssignmentViewModel({
    activeRelatedProperty: propertyWorkspace.activeRelatedProperty,
    configuredAdminProviderId,
    inquiry: screenContext.inquiry,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryPrimaryContact: screenContext.inquiryPrimaryContact,
    inquiryTakenByFallback: screenState.inquiryTakenByFallback,
    inquiryTakenByLookup,
    safeUid,
    serviceInquiryName: screenState.serviceInquiryName,
    serviceProvider: screenContext.serviceProvider,
    serviceProviderContact: screenContext.serviceProviderContact,
    serviceProviderFallbackRecord: screenContext.serviceProviderFallbackRecord,
    serviceProviderFallbackContact: screenContext.serviceProviderFallbackContact,
    serviceProviderLookup,
  });

  useInquiryScreenUiEffects({
    accountBindingKey: accountView.accountBindingKey,
    companyPopupComment: screenContext.companyPopupComment,
    contactPopupComment: screenContext.contactPopupComment,
    hasAnyPopupComment: screenContext.hasAnyPopupComment,
    inquiryCompanyId: screenContext.inquiryCompanyId,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryDetailsForm: screenState.inquiryDetailsForm,
    inquiryNumericId: screenContext.inquiryNumericId,
    inquiryTakenByFallbackRecord: assignmentView.inquiryTakenByFallbackRecord,
    inquiryTakenByIdResolved: assignmentView.inquiryTakenByIdResolved,
    inquiryTakenByPrefillLabel: assignmentView.inquiryTakenByPrefillLabel,
    inquiryTakenBySelectedLookupRecord: assignmentView.inquiryTakenBySelectedLookupRecord,
    isContextLoading: screenState.isContextLoading,
    isInquiryDetailsModalOpen: screenState.isInquiryDetailsModalOpen,
    isInquiryEditPestService: detailsView.isInquiryEditPestService,
    isMoreOpen: screenState.isMoreOpen,
    isQuickInquiryBookingMode,
    linkedInquiryJobIdFromRecord: screenContext.linkedInquiryJobIdFromRecord,
    moreMenuRef: screenState.moreMenuRef,
    previousAccountBindingKeyRef: screenState.previousAccountBindingKeyRef,
    previousVisibleWorkspaceTabsKeyRef: screenState.previousVisibleWorkspaceTabsKeyRef,
    popupCommentAutoShownRef: screenState.popupCommentAutoShownRef,
    safeUid,
    serviceProviderIdResolved: assignmentView.serviceProviderIdResolved,
    serviceProviderPrefillLabel: assignmentView.serviceProviderPrefillLabel,
    setActiveWorkspaceTab: screenState.setActiveWorkspaceTab,
    setInquiryDetailsForm: screenState.setInquiryDetailsForm,
    setInquiryTakenBySearch: screenState.setInquiryTakenBySearch,
    setIsApplyingSameAsContactProperty: propertyWorkspace.setIsApplyingSameAsContactProperty,
    setIsInquiryEditPestAccordionOpen: screenState.setIsInquiryEditPestAccordionOpen,
    setIsMoreOpen: screenState.setIsMoreOpen,
    setIsPopupCommentModalOpen: screenState.setIsPopupCommentModalOpen,
    setIsPropertySameAsContact: propertyWorkspace.setIsPropertySameAsContact,
    setIsQuickInquiryBookingModalOpen: screenState.setIsQuickInquiryBookingModalOpen,
    setLinkedJobSelectionOverride: screenState.setLinkedJobSelectionOverride,
    setMountedWorkspaceTabs: screenState.setMountedWorkspaceTabs,
    setPopupCommentDrafts: screenState.setPopupCommentDrafts,
    setRelatedJobIdByUid: screenState.setRelatedJobIdByUid,
    setSelectedInquiryTakenById: screenState.setSelectedInquiryTakenById,
    setSelectedServiceProviderId: screenState.setSelectedServiceProviderId,
    setServiceProviderSearch: screenState.setServiceProviderSearch,
    shouldShowInquiryEditOther: detailsView.shouldShowInquiryEditOther,
    setOptimisticListSelectionByField: screenState.setOptimisticListSelectionByField,
    setRemovingListTagKeys: screenState.setRemovingListTagKeys,
    listSelectionDesiredRef: screenState.listSelectionDesiredRef,
    listSelectionSyncingRef: screenState.listSelectionSyncingRef,
  });

  const { refreshResolvedInquiry } = useInquiryScreenDataEffects({
    configuredAdminProviderId,
    error,
    hasServiceProviderRelationDetails: assignmentView.hasServiceProviderRelationDetails,
    hasUid,
    inquiryDetailsForm: screenState.inquiryDetailsForm,
    inquiryNumericId: screenContext.inquiryNumericId,
    inquiryTakenByAutofillRef: screenState.inquiryTakenByAutofillRef,
    inquiryTakenByIdResolved: assignmentView.inquiryTakenByIdResolved,
    inquiryTakenByLookup,
    inquiryTakenByStoredId: assignmentView.inquiryTakenByStoredId,
    isInquiryDetailsModalOpen: screenState.isInquiryDetailsModalOpen,
    isQuickInquiryBookingMode,
    isQuickInquiryProvisioning: screenState.isQuickInquiryProvisioning,
    isSdkReady,
    navigate,
    plugin,
    quickInquiryProvisioningRequestedRef: screenState.quickInquiryProvisioningRequestedRef,
    relatedJobIdByUid: screenState.relatedJobIdByUid,
    relatedJobsForDisplay: propertyWorkspace.relatedJobsForDisplay,
    safeUid,
    serviceProviderIdResolved: assignmentView.serviceProviderIdResolved,
    serviceInquiryLabelById: screenState.serviceInquiryLabelById,
    setInquiryServiceOptions: screenState.setInquiryServiceOptions,
    setInquiryTakenByFallback: screenState.setInquiryTakenByFallback,
    setIsContextLoading: screenState.setIsContextLoading,
    setIsInquiryServiceLookupLoading: screenState.setIsInquiryServiceLookupLoading,
    setIsQuickInquiryProvisioning: screenState.setIsQuickInquiryProvisioning,
    setRelatedJobIdByUid: screenState.setRelatedJobIdByUid,
    setResolvedInquiry: screenState.setResolvedInquiry,
    setServiceInquiryLabelById: screenState.setServiceInquiryLabelById,
    setServiceInquiryName: screenState.setServiceInquiryName,
    setServiceProviderFallback: screenState.setServiceProviderFallback,
    statusServiceInquiryId: detailsView.statusServiceInquiryId,
    trackRecentActivity,
  });

  const actions = useInquiryScreenActions({
    activeRelatedProperty: propertyWorkspace.activeRelatedProperty,
    accountEditorCompanyInitialValues: accountView.accountEditorCompanyInitialValues,
    accountEditorContactInitialValues: accountView.accountEditorContactInitialValues,
    companyPopupComment: screenContext.companyPopupComment,
    contactPopupComment: screenContext.contactPopupComment,
    currentActivityPath: screenContext.currentActivityPath,
    dismiss,
    error,
    hasLinkedQuoteJob: screenContext.hasLinkedQuoteJob,
    inquiry: screenContext.inquiry,
    inquiryCompany: screenContext.inquiryCompany,
    inquiryCompanyId: screenContext.inquiryCompanyId,
    inquiryContactId: screenContext.inquiryContactId,
    inquiryDetailsForm: screenState.inquiryDetailsForm,
    inquiryDetailsInitialForm: detailsView.inquiryDetailsInitialForm,
    inquiryNumericId: screenContext.inquiryNumericId,
    inquiryPrimaryContact: screenContext.inquiryPrimaryContact,
    inquiryPropertyId: propertyWorkspace.inquiryPropertyId,
    inquiryTakenByIdResolved: assignmentView.inquiryTakenByIdResolved,
    inquiryTakenByStoredId: assignmentView.inquiryTakenByStoredId,
    isAllocatingServiceProvider: screenState.isAllocatingServiceProvider,
    isCompanyAccount: screenContext.isCompanyAccount,
    isCreatingCallback: screenState.isCreatingCallback,
    isCreatingQuote: screenState.isCreatingQuote,
    isDeletingRecord: screenState.isDeletingRecord,
    isOpeningQuoteJob: screenState.isOpeningQuoteJob,
    isSavingInquiryDetails: screenState.isSavingInquiryDetails,
    isSavingInquiryTakenBy: screenState.isSavingInquiryTakenBy,
    isSavingLinkedJob: screenState.isSavingLinkedJob,
    isSavingPopupComment: screenState.isSavingPopupComment,
    linkedPropertiesSorted: propertyWorkspace.linkedPropertiesSorted,
    listSelectionDesiredRef: screenState.listSelectionDesiredRef,
    listSelectionSyncingRef: screenState.listSelectionSyncingRef,
    navigate,
    openMemoPreview: memoThread.openMemoPreview,
    optimisticListSelectionByField: screenState.optimisticListSelectionByField,
    plugin,
    popupCommentDrafts: screenState.popupCommentDrafts,
    propertyLookupRecords: propertyWorkspace.propertyLookupRecords,
    propertyModalState: propertyWorkspace.propertyModalState,
    propertySearchManualEditRef: propertyWorkspace.propertySearchManualEditRef,
    quickInquirySavingToastIdRef: screenState.quickInquirySavingToastIdRef,
    quoteCreateDraft: screenState.quoteCreateDraft,
    quoteJobIdFromRecord: screenContext.quoteJobIdFromRecord,
    refreshResolvedInquiry,
    relatedJobIdByUid: screenState.relatedJobIdByUid,
    removingListTagKeys: screenState.removingListTagKeys,
    safeUid,
    sameAsContactPropertySource: accountView.sameAsContactPropertySource,
    selectedInquiryTakenById: screenState.selectedInquiryTakenById,
    selectedRelatedJobId: screenContext.selectedRelatedJobId,
    selectedServiceProviderId: screenState.selectedServiceProviderId,
    serviceProviderIdResolved: assignmentView.serviceProviderIdResolved,
    setAppointmentModalDraft: propertyWorkspace.setAppointmentModalDraft,
    setAppointmentModalEditingId: propertyWorkspace.setAppointmentModalEditingId,
    setAppointmentModalMode: propertyWorkspace.setAppointmentModalMode,
    setAreFloatingWidgetsVisible: screenState.setAreFloatingWidgetsVisible,
    setContactModalState: screenState.setContactModalState,
    setInquiryDetailsForm: screenState.setInquiryDetailsForm,
    setIsAllocatingServiceProvider: screenState.setIsAllocatingServiceProvider,
    setIsAppointmentModalOpen: propertyWorkspace.setIsAppointmentModalOpen,
    setIsCreateQuoteModalOpen: screenState.setIsCreateQuoteModalOpen,
    setIsCreatingCallback: screenState.setIsCreatingCallback,
    setIsCreatingQuote: screenState.setIsCreatingQuote,
    setIsDeleteRecordModalOpen: screenState.setIsDeleteRecordModalOpen,
    setIsDeletingRecord: screenState.setIsDeletingRecord,
    setIsInquiryDetailsModalOpen: screenState.setIsInquiryDetailsModalOpen,
    setIsOpeningQuoteJob: screenState.setIsOpeningQuoteJob,
    setIsPopupCommentModalOpen: screenState.setIsPopupCommentModalOpen,
    setIsPropertySameAsContact: propertyWorkspace.setIsPropertySameAsContact,
    setIsQuickInquiryBookingModalOpen: screenState.setIsQuickInquiryBookingModalOpen,
    setIsSavingInquiryDetails: screenState.setIsSavingInquiryDetails,
    setIsSavingInquiryTakenBy: screenState.setIsSavingInquiryTakenBy,
    setIsSavingLinkedJob: screenState.setIsSavingLinkedJob,
    setIsSavingPopupComment: screenState.setIsSavingPopupComment,
    setIsTasksModalOpen: screenState.setIsTasksModalOpen,
    setIsUploadsModalOpen: propertyWorkspace.setIsUploadsModalOpen,
    setLinkedJobSelectionOverride: screenState.setLinkedJobSelectionOverride,
    setLinkedProperties: propertyWorkspace.setLinkedProperties,
    setOptimisticListSelectionByField: screenState.setOptimisticListSelectionByField,
    setPropertyLookupRecords: propertyWorkspace.setPropertyLookupRecords,
    setPropertyModalState: propertyWorkspace.setPropertyModalState,
    setPropertySearchQuery: propertyWorkspace.setPropertySearchQuery,
    setQuoteCreateDraft: screenState.setQuoteCreateDraft,
    setRelatedJobIdByUid: screenState.setRelatedJobIdByUid,
    setRelatedRecordsRefreshKey: screenState.setRelatedRecordsRefreshKey,
    setRemovingListTagKeys: screenState.setRemovingListTagKeys,
    setResolvedInquiry: screenState.setResolvedInquiry,
    setSelectedPropertyId: propertyWorkspace.setSelectedPropertyId,
    setIsApplyingSameAsContactProperty: propertyWorkspace.setIsApplyingSameAsContactProperty,
    setIsMoreOpen: screenState.setIsMoreOpen,
    success,
    toast,
    trackRecentActivity,
    update,
  });

  return (
    <InquiryDetailsScreenLayout
      actions={actions}
      accountView={accountView}
      assignmentView={{
        ...assignmentView,
        inquiryTakenByLookup,
        inquiryTakenBySearchItems: assignmentView.inquiryTakenBySearchItems,
        isInquiryTakenByLookupLoading,
        isServiceProviderLookupLoading,
        serviceProviderLookup,
        serviceProviderSearchItems: assignmentView.serviceProviderSearchItems,
      }}
      configuredAdminProviderId={configuredAdminProviderId}
      detailsView={detailsView}
      flags={{ hasUid, isQuickInquiryBookingMode, safeUid }}
      memoThread={memoThread}
      plugin={plugin}
      propertyWorkspace={propertyWorkspace}
      relatedRecords={{
        ...relatedRecordsData,
        contactLogs: contactLogsData.contactLogs,
        contactLogsError: contactLogsData.contactLogsError,
        filteredRelatedDeals,
        isContactLogsLoading: contactLogsData.isContactLogsLoading,
        isRelatedRecordsLoading: relatedRecordsData.isLoading,
        relatedRecordsError: relatedRecordsData.error,
      }}
      screenContext={screenContext}
      screenState={screenState}
      visibleWorkspaceTabs={visibleWorkspaceTabs}
    />
  );
}
