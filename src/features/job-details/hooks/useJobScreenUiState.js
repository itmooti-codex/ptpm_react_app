import { useRef, useState } from "react";
import { EMPTY_QUOTE_PAYMENT_DETAILS } from "../shared/jobDetailsConstants.js";

export function useJobScreenUiState() {
  const [serviceProviderSearch, setServiceProviderSearch] = useState("");
  const [jobTakenBySearch, setJobTakenBySearch] = useState("");
  const [allocatedServiceProviderId, setAllocatedServiceProviderId] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [companyLookupRecords, setCompanyLookupRecords] = useState([]);
  const [contactLookupRecords, setContactLookupRecords] = useState([]);
  const [isCompanyLookupLoading, setIsCompanyLookupLoading] = useState(false);
  const [isContactLookupLoading, setIsContactLookupLoading] = useState(false);
  const [jobEmailContactSearchValue, setJobEmailContactSearchValue] = useState("");
  const [accountsContactSearchValue, setAccountsContactSearchValue] = useState("");
  const [selectedJobEmailContactId, setSelectedJobEmailContactId] = useState("");
  const [selectedAccountsContactId, setSelectedAccountsContactId] = useState("");
  const [isSavingQuoteContacts, setIsSavingQuoteContacts] = useState(false);
  const [allocatedJobTakenById, setAllocatedJobTakenById] = useState("");
  const [selectedJobTakenById, setSelectedJobTakenById] = useState("");
  const [isSavingJobTakenBy, setIsSavingJobTakenBy] = useState(false);
  const [isJobAllocationPrefillResolved, setIsJobAllocationPrefillResolved] = useState(false);
  const [isLoadedJobTakenByMissing, setIsLoadedJobTakenByMissing] = useState(false);
  const [relatedInquiryId, setRelatedInquiryId] = useState("");
  const [relatedInquiryUid, setRelatedInquiryUid] = useState("");
  const [isSavingLinkedInquiry, setIsSavingLinkedInquiry] = useState(false);
  const [loadedJobStatus, setLoadedJobStatus] = useState("");
  const [openMenu, setOpenMenu] = useState("");
  const [activeEmailGroup, setActiveEmailGroup] = useState("general");
  const [isPcaDone, setIsPcaDone] = useState(false);
  const [isPrestartDone, setIsPrestartDone] = useState(false);
  const [isMarkComplete, setIsMarkComplete] = useState(false);
  const [isSavingPcaDone, setIsSavingPcaDone] = useState(false);
  const [isSavingPrestartDone, setIsSavingPrestartDone] = useState(false);
  const [isSavingMarkComplete, setIsSavingMarkComplete] = useState(false);
  const [isMarkCompleteConfirmOpen, setIsMarkCompleteConfirmOpen] = useState(false);
  const [pendingMarkCompleteValue, setPendingMarkCompleteValue] = useState(false);
  const [loadedAccountType, setLoadedAccountType] = useState("");
  const [loadedClientEntityId, setLoadedClientEntityId] = useState("");
  const [loadedClientIndividualId, setLoadedClientIndividualId] = useState("");
  const [loadedPropertyId, setLoadedPropertyId] = useState("");
  const [loadedAccountsContactId, setLoadedAccountsContactId] = useState("");
  const [accountContactRecord, setAccountContactRecord] = useState(null);
  const [accountCompanyRecord, setAccountCompanyRecord] = useState(null);
  const [relatedInquiryRecord, setRelatedInquiryRecord] = useState(null);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [isLinkedPropertiesLoading, setIsLinkedPropertiesLoading] = useState(false);
  const [linkedPropertiesError, setLinkedPropertiesError] = useState("");
  const [affiliations, setAffiliations] = useState([]);
  const [isAffiliationsLoading, setIsAffiliationsLoading] = useState(false);
  const [affiliationsError, setAffiliationsError] = useState("");
  const [workspacePropertyLookupRecords, setWorkspacePropertyLookupRecords] = useState([]);
  const [isWorkspacePropertyLookupLoading, setIsWorkspacePropertyLookupLoading] = useState(false);
  const [workspacePropertyLookupError, setWorkspacePropertyLookupError] = useState("");
  const [workspacePropertySearchValue, setWorkspacePropertySearchValue] = useState("");
  const [selectedWorkspacePropertyId, setSelectedWorkspacePropertyId] = useState("");
  const [jobActivities, setJobActivities] = useState([]);
  const [jobMaterials, setJobMaterials] = useState([]);
  const [isWorkspaceSectionsLoading, setIsWorkspaceSectionsLoading] = useState(false);
  const [workspaceSectionsError, setWorkspaceSectionsError] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("related-data");
  const [mountedWorkspaceTabs, setMountedWorkspaceTabs] = useState(() => ({
    "related-data": true,
  }));
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [invoiceActiveTab, setInvoiceActiveTab] = useState("");
  const [invoiceActiveTabVersion, setInvoiceActiveTabVersion] = useState(0);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState("create");
  const [editingAppointmentId, setEditingAppointmentId] = useState("");
  const [isUploadsModalOpen, setIsUploadsModalOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [propertyModalMode, setPropertyModalMode] = useState("create");
  const [affiliationModalState, setAffiliationModalState] = useState({
    open: false,
    initialData: null,
  });
  const [shouldAutoSelectNewAffiliation, setShouldAutoSelectNewAffiliation] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityModalMode, setActivityModalMode] = useState("create");
  const [editingActivityId, setEditingActivityId] = useState("");
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialModalMode, setMaterialModalMode] = useState("create");
  const [editingMaterialId, setEditingMaterialId] = useState("");
  const [quotePaymentDetails, setQuotePaymentDetails] = useState(EMPTY_QUOTE_PAYMENT_DETAILS);
  const [isQuoteWorkflowUpdating, setIsQuoteWorkflowUpdating] = useState(false);
  const [isDuplicatingJob, setIsDuplicatingJob] = useState(false);
  const [isCreatingCallback, setIsCreatingCallback] = useState(false);
  const [isAccountDetailsLoading, setIsAccountDetailsLoading] = useState(false);
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
    onModeChange: null,
    allowModeSwitch: false,
    titleVerb: "Update",
    initialValues: null,
  });
  const [contactLogs, setContactLogs] = useState([]);
  const [isContactLogsLoading, setIsContactLogsLoading] = useState(false);
  const [contactLogsError, setContactLogsError] = useState("");
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [areFloatingWidgetsVisible, setAreFloatingWidgetsVisible] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [memoFocusRequest, setMemoFocusRequest] = useState({ memoId: "", key: 0 });
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const [isSendingJobUpdate, setIsSendingJobUpdate] = useState(false);
  const [isRecordingEmailAction, setIsRecordingEmailAction] = useState(false);
  const memoFileInputRef = useRef(null);
  const menuRootRef = useRef(null);
  const serviceProviderPrefilledRef = useRef(false);
  const jobTakenByAutofillRef = useRef(new Set());

  return {
    serviceProviderSearch, setServiceProviderSearch,
    jobTakenBySearch, setJobTakenBySearch,
    allocatedServiceProviderId, setAllocatedServiceProviderId,
    selectedServiceProviderId, setSelectedServiceProviderId,
    isAllocatingServiceProvider, setIsAllocatingServiceProvider,
    companyLookupRecords, setCompanyLookupRecords,
    contactLookupRecords, setContactLookupRecords,
    isCompanyLookupLoading, setIsCompanyLookupLoading,
    isContactLookupLoading, setIsContactLookupLoading,
    jobEmailContactSearchValue, setJobEmailContactSearchValue,
    accountsContactSearchValue, setAccountsContactSearchValue,
    selectedJobEmailContactId, setSelectedJobEmailContactId,
    selectedAccountsContactId, setSelectedAccountsContactId,
    isSavingQuoteContacts, setIsSavingQuoteContacts,
    allocatedJobTakenById, setAllocatedJobTakenById,
    selectedJobTakenById, setSelectedJobTakenById,
    isSavingJobTakenBy, setIsSavingJobTakenBy,
    isJobAllocationPrefillResolved, setIsJobAllocationPrefillResolved,
    isLoadedJobTakenByMissing, setIsLoadedJobTakenByMissing,
    relatedInquiryId, setRelatedInquiryId,
    relatedInquiryUid, setRelatedInquiryUid,
    isSavingLinkedInquiry, setIsSavingLinkedInquiry,
    loadedJobStatus, setLoadedJobStatus,
    openMenu, setOpenMenu,
    activeEmailGroup, setActiveEmailGroup,
    isPcaDone, setIsPcaDone,
    isPrestartDone, setIsPrestartDone,
    isMarkComplete, setIsMarkComplete,
    isSavingPcaDone, setIsSavingPcaDone,
    isSavingPrestartDone, setIsSavingPrestartDone,
    isSavingMarkComplete, setIsSavingMarkComplete,
    isMarkCompleteConfirmOpen, setIsMarkCompleteConfirmOpen,
    pendingMarkCompleteValue, setPendingMarkCompleteValue,
    loadedAccountType, setLoadedAccountType,
    loadedClientEntityId, setLoadedClientEntityId,
    loadedClientIndividualId, setLoadedClientIndividualId,
    loadedPropertyId, setLoadedPropertyId,
    loadedAccountsContactId, setLoadedAccountsContactId,
    accountContactRecord, setAccountContactRecord,
    accountCompanyRecord, setAccountCompanyRecord,
    relatedInquiryRecord, setRelatedInquiryRecord,
    linkedProperties, setLinkedProperties,
    isLinkedPropertiesLoading, setIsLinkedPropertiesLoading,
    linkedPropertiesError, setLinkedPropertiesError,
    affiliations, setAffiliations,
    isAffiliationsLoading, setIsAffiliationsLoading,
    affiliationsError, setAffiliationsError,
    workspacePropertyLookupRecords, setWorkspacePropertyLookupRecords,
    isWorkspacePropertyLookupLoading, setIsWorkspacePropertyLookupLoading,
    workspacePropertyLookupError, setWorkspacePropertyLookupError,
    workspacePropertySearchValue, setWorkspacePropertySearchValue,
    selectedWorkspacePropertyId, setSelectedWorkspacePropertyId,
    jobActivities, setJobActivities,
    jobMaterials, setJobMaterials,
    isWorkspaceSectionsLoading, setIsWorkspaceSectionsLoading,
    workspaceSectionsError, setWorkspaceSectionsError,
    activeWorkspaceTab, setActiveWorkspaceTab,
    mountedWorkspaceTabs, setMountedWorkspaceTabs,
    isTasksModalOpen, setIsTasksModalOpen,
    invoiceActiveTab, setInvoiceActiveTab,
    invoiceActiveTabVersion, setInvoiceActiveTabVersion,
    isAppointmentModalOpen, setIsAppointmentModalOpen,
    appointmentModalMode, setAppointmentModalMode,
    editingAppointmentId, setEditingAppointmentId,
    isUploadsModalOpen, setIsUploadsModalOpen,
    isAddPropertyOpen, setIsAddPropertyOpen,
    propertyModalMode, setPropertyModalMode,
    affiliationModalState, setAffiliationModalState,
    shouldAutoSelectNewAffiliation, setShouldAutoSelectNewAffiliation,
    isActivityModalOpen, setIsActivityModalOpen,
    activityModalMode, setActivityModalMode,
    editingActivityId, setEditingActivityId,
    isMaterialModalOpen, setIsMaterialModalOpen,
    materialModalMode, setMaterialModalMode,
    editingMaterialId, setEditingMaterialId,
    quotePaymentDetails, setQuotePaymentDetails,
    isQuoteWorkflowUpdating, setIsQuoteWorkflowUpdating,
    isDuplicatingJob, setIsDuplicatingJob,
    isCreatingCallback, setIsCreatingCallback,
    isAccountDetailsLoading, setIsAccountDetailsLoading,
    contactModalState, setContactModalState,
    contactLogs, setContactLogs,
    isContactLogsLoading, setIsContactLogsLoading,
    contactLogsError, setContactLogsError,
    memos, setMemos,
    isMemosLoading, setIsMemosLoading,
    memosError, setMemosError,
    memoText, setMemoText,
    isMemoChatOpen, setIsMemoChatOpen,
    areFloatingWidgetsVisible, setAreFloatingWidgetsVisible,
    memoFile, setMemoFile,
    memoReplyDrafts, setMemoReplyDrafts,
    isPostingMemo, setIsPostingMemo,
    sendingReplyPostId, setSendingReplyPostId,
    memoDeleteTarget, setMemoDeleteTarget,
    memoFocusRequest, setMemoFocusRequest,
    isDeletingMemoItem, setIsDeletingMemoItem,
    popupCommentDrafts, setPopupCommentDrafts,
    isPopupCommentModalOpen, setIsPopupCommentModalOpen,
    isSavingPopupComment, setIsSavingPopupComment,
    isSendingJobUpdate, setIsSendingJobUpdate,
    isRecordingEmailAction, setIsRecordingEmailAction,
    memoFileInputRef,
    menuRootRef,
    serviceProviderPrefilledRef,
    jobTakenByAutofillRef,
  };
}
