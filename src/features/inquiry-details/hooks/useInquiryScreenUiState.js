import { useRef, useState } from "react";
import { INQUIRY_DETAILS_EDIT_EMPTY_FORM } from "../components/InquiryDetailsEditModal.jsx";

export function useInquiryScreenUiState() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
    onModeChange: null,
    allowModeSwitch: false,
    titleVerb: "Add",
    initialValues: null,
  });
  const [resolvedInquiry, setResolvedInquiry] = useState(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [serviceInquiryName, setServiceInquiryName] = useState("");
  const [serviceProviderFallback, setServiceProviderFallback] = useState(null);
  const [serviceProviderSearch, setServiceProviderSearch] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [isSavingLinkedJob, setIsSavingLinkedJob] = useState(false);
  const [linkedJobSelectionOverride, setLinkedJobSelectionOverride] = useState(undefined);
  const [relatedJobIdByUid, setRelatedJobIdByUid] = useState({});
  const [relatedRecordsRefreshKey, setRelatedRecordsRefreshKey] = useState(0);
  const [inquiryTakenByFallback, setInquiryTakenByFallback] = useState(null);
  const [inquiryTakenBySearch, setInquiryTakenBySearch] = useState("");
  const [selectedInquiryTakenById, setSelectedInquiryTakenById] = useState("");
  const [isSavingInquiryTakenBy, setIsSavingInquiryTakenBy] = useState(false);
  const [isCreatingCallback, setIsCreatingCallback] = useState(false);
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isOpeningQuoteJob, setIsOpeningQuoteJob] = useState(false);
  const [quoteCreateDraft, setQuoteCreateDraft] = useState({ quote_date: "" });
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isQuickInquiryBookingModalOpen, setIsQuickInquiryBookingModalOpen] = useState(false);
  const [isQuickInquiryProvisioning, setIsQuickInquiryProvisioning] = useState(false);
  const [isInquiryDetailsModalOpen, setIsInquiryDetailsModalOpen] = useState(false);
  const [isSavingInquiryDetails, setIsSavingInquiryDetails] = useState(false);
  const [isInquiryEditPestAccordionOpen, setIsInquiryEditPestAccordionOpen] = useState(false);
  const [removingListTagKeys, setRemovingListTagKeys] = useState({});
  const [optimisticListSelectionByField, setOptimisticListSelectionByField] = useState({});
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("related-records");
  const [mountedWorkspaceTabs, setMountedWorkspaceTabs] = useState(() => ({
    "related-records": true,
  }));
  const [areFloatingWidgetsVisible, setAreFloatingWidgetsVisible] = useState(false);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const [inquiryDetailsForm, setInquiryDetailsForm] = useState({
    ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
  });
  const [inquiryServiceOptions, setInquiryServiceOptions] = useState([]);
  const [serviceInquiryLabelById, setServiceInquiryLabelById] = useState({});
  const [isInquiryServiceLookupLoading, setIsInquiryServiceLookupLoading] = useState(false);
  const moreMenuRef = useRef(null);
  const inquiryTakenByAutofillRef = useRef(new Set());
  const listSelectionDesiredRef = useRef({});
  const listSelectionSyncingRef = useRef({});
  const previousVisibleWorkspaceTabsKeyRef = useRef("");
  const previousAccountBindingKeyRef = useRef("");
  const popupCommentAutoShownRef = useRef({});
  const quickInquiryProvisioningRequestedRef = useRef(false);
  const quickInquirySavingToastIdRef = useRef("");

  return {
    isMoreOpen,
    setIsMoreOpen,
    isTasksModalOpen,
    setIsTasksModalOpen,
    contactModalState,
    setContactModalState,
    resolvedInquiry,
    setResolvedInquiry,
    isContextLoading,
    setIsContextLoading,
    serviceInquiryName,
    setServiceInquiryName,
    serviceProviderFallback,
    setServiceProviderFallback,
    serviceProviderSearch,
    setServiceProviderSearch,
    selectedServiceProviderId,
    setSelectedServiceProviderId,
    isAllocatingServiceProvider,
    setIsAllocatingServiceProvider,
    isSavingLinkedJob,
    setIsSavingLinkedJob,
    linkedJobSelectionOverride,
    setLinkedJobSelectionOverride,
    relatedJobIdByUid,
    setRelatedJobIdByUid,
    relatedRecordsRefreshKey,
    setRelatedRecordsRefreshKey,
    inquiryTakenByFallback,
    setInquiryTakenByFallback,
    inquiryTakenBySearch,
    setInquiryTakenBySearch,
    selectedInquiryTakenById,
    setSelectedInquiryTakenById,
    isSavingInquiryTakenBy,
    setIsSavingInquiryTakenBy,
    isCreatingCallback,
    setIsCreatingCallback,
    isCreateQuoteModalOpen,
    setIsCreateQuoteModalOpen,
    isCreatingQuote,
    setIsCreatingQuote,
    isOpeningQuoteJob,
    setIsOpeningQuoteJob,
    quoteCreateDraft,
    setQuoteCreateDraft,
    isDeleteRecordModalOpen,
    setIsDeleteRecordModalOpen,
    isDeletingRecord,
    setIsDeletingRecord,
    isQuickInquiryBookingModalOpen,
    setIsQuickInquiryBookingModalOpen,
    isQuickInquiryProvisioning,
    setIsQuickInquiryProvisioning,
    isInquiryDetailsModalOpen,
    setIsInquiryDetailsModalOpen,
    isSavingInquiryDetails,
    setIsSavingInquiryDetails,
    isInquiryEditPestAccordionOpen,
    setIsInquiryEditPestAccordionOpen,
    removingListTagKeys,
    setRemovingListTagKeys,
    optimisticListSelectionByField,
    setOptimisticListSelectionByField,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    mountedWorkspaceTabs,
    setMountedWorkspaceTabs,
    areFloatingWidgetsVisible,
    setAreFloatingWidgetsVisible,
    popupCommentDrafts,
    setPopupCommentDrafts,
    isPopupCommentModalOpen,
    setIsPopupCommentModalOpen,
    isSavingPopupComment,
    setIsSavingPopupComment,
    inquiryDetailsForm,
    setInquiryDetailsForm,
    inquiryServiceOptions,
    setInquiryServiceOptions,
    serviceInquiryLabelById,
    setServiceInquiryLabelById,
    isInquiryServiceLookupLoading,
    setIsInquiryServiceLookupLoading,
    moreMenuRef,
    inquiryTakenByAutofillRef,
    listSelectionDesiredRef,
    listSelectionSyncingRef,
    previousVisibleWorkspaceTabsKeyRef,
    previousAccountBindingKeyRef,
    popupCommentAutoShownRef,
    quickInquiryProvisioningRequestedRef,
    quickInquirySavingToastIdRef,
  };
}
