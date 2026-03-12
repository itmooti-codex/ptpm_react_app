import { useCallback } from "react";
import { createLinkedJobForInquiry, updateInquiryFieldsById } from "../../../modules/job-records/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import {
  mergePropertyCollectionsIfChanged,
  normalizePropertyLookupRecord,
  resolvePropertyLookupLabel,
} from "@modules/details-workspace/exports/api.js";
import { toText } from "@shared/utils/formatters.js";
import { fetchJobUniqueIdById } from "../api/inquiryRelatedRecordsApi.js";

export function useInquiryQuickWorkflowActions({
  dismiss,
  update,
  toast,
  error,
  success,
  navigate,
  plugin,
  inquiry,
  inquiryNumericId,
  inquiryPropertyId,
  safeUid,
  currentActivityPath,
  trackRecentActivity,
  refreshResolvedInquiry,
  quickInquirySavingToastIdRef,
  propertySearchManualEditRef,
  quoteCreateDraft,
  setAreFloatingWidgetsVisible,
  setIsQuickInquiryBookingModalOpen,
  setResolvedInquiry,
  setSelectedPropertyId,
  setPropertyLookupRecords,
  setLinkedProperties,
  setPropertySearchQuery,
  setIsPropertySameAsContact,
  setIsCreatingCallback,
  setQuoteCreateDraft,
  setIsCreateQuoteModalOpen,
  setIsOpeningQuoteJob,
  setIsCreatingQuote,
  setLinkedJobSelectionOverride,
  setRelatedRecordsRefreshKey,
  openMemoPreview,
  activeRelatedProperty,
  serviceProviderIdResolved,
  selectedServiceProviderId,
  selectedInquiryTakenById,
  inquiryTakenByStoredId,
  inquiryTakenByIdResolved,
  quoteJobIdFromRecord,
  hasLinkedQuoteJob,
  isCreatingCallback,
  isCreatingQuote,
  isOpeningQuoteJob,
}) {
  const dismissQuickInquirySavingToast = useCallback(() => {
    const toastId = toText(quickInquirySavingToastIdRef.current);
    if (!toastId) return;
    dismiss(toastId);
    quickInquirySavingToastIdRef.current = "";
  }, [dismiss, quickInquirySavingToastIdRef]);

  const handleCloseQuickInquiryBookingModal = useCallback(() => {
    setIsQuickInquiryBookingModalOpen(false);
  }, [setIsQuickInquiryBookingModalOpen]);

  const handleQuickInquiryBookingSavingStart = useCallback(
    (optimisticPatch = {}) => {
      setIsQuickInquiryBookingModalOpen(false);
      setResolvedInquiry((previous) => {
        const base = previous && typeof previous === "object" ? previous : {};
        const next = {
          ...base,
          ...(optimisticPatch && typeof optimisticPatch === "object" ? optimisticPatch : {}),
        };
        if (!toText(next?.id) && inquiryNumericId) {
          next.id = inquiryNumericId;
        }
        const currentSafeUid = toText(safeUid);
        if (
          !toText(next?.unique_id) &&
          currentSafeUid &&
          currentSafeUid.toLowerCase() !== "new"
        ) {
          next.unique_id = currentSafeUid;
        }
        if (!toText(next?.inquiry_status)) {
          next.inquiry_status = "New Inquiry";
        }
        return next;
      });
      dismissQuickInquirySavingToast();
      quickInquirySavingToastIdRef.current = toast({
        type: "info",
        title: "Saving inquiry...",
        description: "Please wait while details are being saved.",
        duration: 0,
      });
    },
    [
      dismissQuickInquirySavingToast,
      inquiryNumericId,
      quickInquirySavingToastIdRef,
      safeUid,
      setIsQuickInquiryBookingModalOpen,
      setResolvedInquiry,
      toast,
    ]
  );

  const handleQuickInquiryBookingSaved = useCallback(
    async (savedContext = {}) => {
      const savedPropertyId = normalizePropertyId(
        savedContext?.propertyId || savedContext?.property_id
      );
      const savedPropertyRecordValue =
        savedContext?.propertyRecord && typeof savedContext.propertyRecord === "object"
          ? savedContext.propertyRecord
          : savedContext?.property_record &&
              typeof savedContext.property_record === "object"
            ? savedContext.property_record
            : null;
      const savedPropertyRecord = savedPropertyRecordValue
        ? normalizePropertyLookupRecord({
            ...savedPropertyRecordValue,
            id:
              savedPropertyId ||
              savedPropertyRecordValue?.id ||
              savedPropertyRecordValue?.ID ||
              "",
          })
        : null;

      if (savedPropertyId) {
        setSelectedPropertyId(savedPropertyId);
      }
      if (savedPropertyRecord) {
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [savedPropertyRecord])
        );
        setLinkedProperties((previous) =>
          mergePropertyCollectionsIfChanged(Array.isArray(previous) ? previous : [], [
            savedPropertyRecord,
          ])
        );
        const nextPropertyLabel = resolvePropertyLookupLabel(savedPropertyRecord);
        if (nextPropertyLabel) {
          propertySearchManualEditRef.current = false;
          setPropertySearchQuery(nextPropertyLabel);
        }
      }
      if (savedContext?.isPropertySameAsContact || savedContext?.property_same_as_contact) {
        setIsPropertySameAsContact(true);
      }

      try {
        await refreshResolvedInquiry();
        dismissQuickInquirySavingToast();
        success("Inquiry saved", "Quick inquiry details were saved.");
      } catch (refreshError) {
        dismissQuickInquirySavingToast();
        error("Refresh failed", refreshError?.message || "Inquiry saved but refresh failed.");
      }
    },
    [
      dismissQuickInquirySavingToast,
      error,
      propertySearchManualEditRef,
      refreshResolvedInquiry,
      setIsPropertySameAsContact,
      setLinkedProperties,
      setPropertyLookupRecords,
      setPropertySearchQuery,
      setSelectedPropertyId,
      success,
    ]
  );

  const handleQuickInquiryBookingSavingProgress = useCallback(
    (message) => {
      const toastId = toText(quickInquirySavingToastIdRef.current);
      if (!toastId || !message) return;
      update(toastId, {
        type: "info",
        title: message,
        description: "Please wait...",
        duration: 0,
      });
    },
    [quickInquirySavingToastIdRef, update]
  );

  const handleQuickInquiryBookingError = useCallback(
    (saveError) => {
      dismissQuickInquirySavingToast();
      setIsQuickInquiryBookingModalOpen(true);
      error("Create failed", saveError?.message || "Unable to create inquiry.");
    },
    [dismissQuickInquirySavingToast, error, setIsQuickInquiryBookingModalOpen]
  );

  const handleQuickView = useCallback(() => {
    trackRecentActivity({
      action: "Opened quick view",
      path: currentActivityPath,
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
    setIsQuickInquiryBookingModalOpen(true);
  }, [
    currentActivityPath,
    inquiryNumericId,
    safeUid,
    setIsQuickInquiryBookingModalOpen,
    trackRecentActivity,
  ]);

  const handleCreateCallback = useCallback(async () => {
    if (isCreatingCallback) return;
    if (!plugin || !inquiryNumericId) {
      error("Create callback failed", "Inquiry context is not ready.");
      return;
    }
    setIsCreatingCallback(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          call_back: true,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Created call back",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
        },
      });
      success("Callback created", "Callback request was marked on this inquiry.");
    } catch (saveError) {
      console.error("[InquiryDetails] Failed creating callback", saveError);
      error("Create callback failed", saveError?.message || "Unable to create callback.");
    } finally {
      setIsCreatingCallback(false);
    }
  }, [
    error,
    inquiryNumericId,
    isCreatingCallback,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    setIsCreatingCallback,
    success,
    trackRecentActivity,
  ]);

  const handleOpenCreateQuoteModal = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setQuoteCreateDraft({
      quote_date: `${year}-${month}-${day}`,
      follow_up_date: "",
    });
    setIsCreateQuoteModalOpen(true);
    trackRecentActivity({
      action: "Opened create quote/job modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [
    inquiryNumericId,
    safeUid,
    setIsCreateQuoteModalOpen,
    setQuoteCreateDraft,
    trackRecentActivity,
  ]);

  const handleQuoteJobAction = useCallback(async () => {
    if (isCreatingQuote || isOpeningQuoteJob) return;
    if (!hasLinkedQuoteJob) {
      handleOpenCreateQuoteModal();
      return;
    }
    const linkedJobValue = toText(quoteJobIdFromRecord);
    if (!linkedJobValue) {
      handleOpenCreateQuoteModal();
      return;
    }

    setIsOpeningQuoteJob(true);
    try {
      let targetUid = "";
      if (plugin?.switchTo) {
        targetUid = await fetchJobUniqueIdById({ plugin, jobId: linkedJobValue });
      }
      const resolvedUid = toText(targetUid || linkedJobValue);
      if (!resolvedUid) {
        error("Open failed", "Unable to resolve quote/job record.");
        return;
      }
      trackRecentActivity({
        action: "Opened quote/job",
        path: `/job-details/${encodeURIComponent(resolvedUid)}`,
        pageType: "job-details",
        pageName: "Job Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          job_uid: resolvedUid,
          job_id: linkedJobValue,
        },
      });
      navigate(`/job-details/${encodeURIComponent(resolvedUid)}`);
    } catch (openError) {
      console.error("[InquiryDetails] Failed opening quote/job details", openError);
      error("Open failed", openError?.message || "Unable to open quote/job.");
    } finally {
      setIsOpeningQuoteJob(false);
    }
  }, [
    error,
    handleOpenCreateQuoteModal,
    hasLinkedQuoteJob,
    inquiryNumericId,
    isCreatingQuote,
    isOpeningQuoteJob,
    navigate,
    plugin,
    quoteJobIdFromRecord,
    safeUid,
    setIsOpeningQuoteJob,
    trackRecentActivity,
  ]);

  const handleCloseCreateQuoteModal = useCallback(() => {
    if (isCreatingQuote) return;
    setIsCreateQuoteModalOpen(false);
  }, [isCreatingQuote, setIsCreateQuoteModalOpen]);

  const handleConfirmCreateQuote = useCallback(async () => {
    if (isCreatingQuote) return;
    if (!plugin || !inquiryNumericId) {
      error("Create failed", "Inquiry context is not ready.");
      return;
    }

    const providerId = toText(serviceProviderIdResolved || selectedServiceProviderId);
    const inquiryTakenById = toText(
      selectedInquiryTakenById || inquiryTakenByStoredId || inquiryTakenByIdResolved
    );
    const propertyId = normalizePropertyId(activeRelatedProperty?.id || inquiryPropertyId);

    setIsCreatingQuote(true);
    setIsCreateQuoteModalOpen(false);
    const createQuoteToastId = toast({
      type: "info",
      title: "Creating quote...",
      description: "Setting up quote record.",
      duration: 0,
    });
    try {
      const inquiryPayload = {
        ...(inquiry || {}),
        id: inquiryNumericId,
        ID: inquiryNumericId,
        property_id: propertyId || null,
        Property_ID: propertyId || null,
      };
      if (providerId) {
        inquiryPayload.service_provider_id = providerId;
        inquiryPayload.Service_Provider_ID = providerId;
      }
      update(createQuoteToastId, {
        type: "info",
        title: "Creating job record...",
        description: "Linking inquiry to new job.",
        duration: 0,
      });
      const createdJob = await createLinkedJobForInquiry({
        plugin,
        inquiry: inquiryPayload,
        serviceProviderId: providerId || null,
        inquiryTakenById: inquiryTakenById || null,
        quoteDate: quoteCreateDraft.quote_date,
      });
      const createdJobId = toText(createdJob?.id || createdJob?.ID);
      if (createdJobId) {
        setLinkedJobSelectionOverride(createdJobId);
      }
      update(createQuoteToastId, {
        type: "info",
        title: "Refreshing inquiry...",
        description: "Loading updated details.",
        duration: 0,
      });
      await refreshResolvedInquiry();
      setRelatedRecordsRefreshKey((previous) => previous + 1);
      dismiss(createQuoteToastId);
      trackRecentActivity({
        action: "Created quote/job",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          job_id: toText(createdJob?.id || createdJob?.ID),
          job_uid: toText(createdJob?.unique_id || createdJob?.Unique_ID),
        },
      });
      success(
        "Quote created",
        `Quote ${toText(createdJob?.unique_id || createdJob?.Unique_ID) || ""} created.`
      );
    } catch (createError) {
      dismiss(createQuoteToastId);
      console.error("[InquiryDetails] Create quote failed", createError);
      error("Create failed", createError?.message || "Unable to create quote.");
    } finally {
      setIsCreatingQuote(false);
    }
  }, [
    activeRelatedProperty?.id,
    dismiss,
    error,
    inquiry,
    inquiryNumericId,
    inquiryPropertyId,
    inquiryTakenByIdResolved,
    inquiryTakenByStoredId,
    isCreatingQuote,
    plugin,
    quoteCreateDraft.quote_date,
    refreshResolvedInquiry,
    safeUid,
    selectedInquiryTakenById,
    selectedServiceProviderId,
    serviceProviderIdResolved,
    setIsCreateQuoteModalOpen,
    setIsCreatingQuote,
    setLinkedJobSelectionOverride,
    setRelatedRecordsRefreshKey,
    success,
    toast,
    trackRecentActivity,
    update,
  ]);

  const handleOpenMemoPreview = useCallback(
    (memoId) => {
      setAreFloatingWidgetsVisible(true);
      openMemoPreview(memoId);
    },
    [openMemoPreview, setAreFloatingWidgetsVisible]
  );

  return {
    handleCloseQuickInquiryBookingModal,
    handleQuickInquiryBookingSavingStart,
    handleQuickInquiryBookingSaved,
    handleQuickInquiryBookingSavingProgress,
    handleQuickInquiryBookingError,
    handleQuickView,
    handleCreateCallback,
    handleOpenCreateQuoteModal,
    handleQuoteJobAction,
    handleCloseCreateQuoteModal,
    handleConfirmCreateQuote,
    handleOpenMemoPreview,
  };
}
