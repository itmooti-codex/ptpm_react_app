import { useEffect } from "react";
import { toText } from "@shared/utils/formatters.js";

export function useInquiryScreenUiEffects({
  accountBindingKey,
  companyPopupComment,
  contactPopupComment,
  hasAnyPopupComment,
  inquiryCompanyId,
  inquiryContactId,
  inquiryDetailsForm,
  inquiryNumericId,
  inquiryTakenByFallbackRecord,
  inquiryTakenByIdResolved,
  inquiryTakenByPrefillLabel,
  inquiryTakenBySelectedLookupRecord,
  isContextLoading,
  isInquiryDetailsModalOpen,
  isInquiryEditPestService,
  isMoreOpen,
  isQuickInquiryBookingMode,
  linkedInquiryJobIdFromRecord,
  moreMenuRef,
  previousAccountBindingKeyRef,
  previousVisibleWorkspaceTabsKeyRef,
  popupCommentAutoShownRef,
  safeUid,
  serviceProviderIdResolved,
  serviceProviderPrefillLabel,
  setActiveWorkspaceTab,
  setInquiryDetailsForm,
  setInquiryTakenBySearch,
  setIsApplyingSameAsContactProperty,
  setIsInquiryEditPestAccordionOpen,
  setIsMoreOpen,
  setIsPopupCommentModalOpen,
  setIsPropertySameAsContact,
  setIsQuickInquiryBookingModalOpen,
  setLinkedJobSelectionOverride,
  setMountedWorkspaceTabs,
  setPopupCommentDrafts,
  setRelatedJobIdByUid,
  setSelectedInquiryTakenById,
  setSelectedServiceProviderId,
  setServiceProviderSearch,
  shouldShowInquiryEditOther,
  useListSelectionReset = true,
  setOptimisticListSelectionByField,
  setRemovingListTagKeys,
  listSelectionDesiredRef,
  listSelectionSyncingRef,
}) {
  useEffect(() => {
    setPopupCommentDrafts({
      contact: contactPopupComment,
      company: companyPopupComment,
    });
  }, [companyPopupComment, contactPopupComment, inquiryCompanyId, inquiryContactId, setPopupCommentDrafts]);

  useEffect(() => {
    const currentUid = toText(safeUid);
    if (!currentUid || isContextLoading) return;
    if (!hasAnyPopupComment) return;
    if (popupCommentAutoShownRef.current?.[currentUid]) return;
    popupCommentAutoShownRef.current[currentUid] = true;
    setIsPopupCommentModalOpen(true);
  }, [hasAnyPopupComment, isContextLoading, popupCommentAutoShownRef, safeUid, setIsPopupCommentModalOpen]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onDocumentClick = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [isMoreOpen, moreMenuRef, setIsMoreOpen]);

  useEffect(() => {
    if (isQuickInquiryBookingMode) {
      setIsQuickInquiryBookingModalOpen(true);
    }
  }, [isQuickInquiryBookingMode, setIsQuickInquiryBookingModalOpen]);

  useEffect(() => {
    if (!accountBindingKey) return;
    if (!previousAccountBindingKeyRef.current) {
      previousAccountBindingKeyRef.current = accountBindingKey;
      return;
    }
    if (previousAccountBindingKeyRef.current === accountBindingKey) return;
    previousAccountBindingKeyRef.current = accountBindingKey;
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
  }, [
    accountBindingKey,
    previousAccountBindingKeyRef,
    setIsApplyingSameAsContactProperty,
    setIsPropertySameAsContact,
  ]);

  useEffect(() => {
    previousVisibleWorkspaceTabsKeyRef.current = "";
    previousAccountBindingKeyRef.current = "";
    setMountedWorkspaceTabs({ "related-records": true });
    setActiveWorkspaceTab("related-records");
  }, [previousAccountBindingKeyRef, previousVisibleWorkspaceTabsKeyRef, safeUid, setActiveWorkspaceTab, setMountedWorkspaceTabs]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    if (!shouldShowInquiryEditOther && toText(inquiryDetailsForm.other)) {
      setInquiryDetailsForm((previous) => ({ ...previous, other: "" }));
    }
  }, [
    inquiryDetailsForm.other,
    isInquiryDetailsModalOpen,
    setInquiryDetailsForm,
    shouldShowInquiryEditOther,
  ]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    setIsInquiryEditPestAccordionOpen(isInquiryEditPestService);
  }, [isInquiryDetailsModalOpen, isInquiryEditPestService, setIsInquiryEditPestAccordionOpen]);

  useEffect(() => {
    const currentId = toText(serviceProviderIdResolved);
    setSelectedServiceProviderId(currentId);
    setServiceProviderSearch(currentId ? serviceProviderPrefillLabel : "");
  }, [
    serviceProviderIdResolved,
    serviceProviderPrefillLabel,
    setSelectedServiceProviderId,
    setServiceProviderSearch,
  ]);

  useEffect(() => {
    const currentId = toText(
      inquiryTakenBySelectedLookupRecord?.id ||
        inquiryTakenByFallbackRecord?.id ||
        inquiryTakenByIdResolved
    );
    setSelectedInquiryTakenById(currentId);
    setInquiryTakenBySearch(currentId ? inquiryTakenByPrefillLabel : "");
  }, [
    inquiryTakenByFallbackRecord?.id,
    inquiryTakenByIdResolved,
    inquiryTakenByPrefillLabel,
    inquiryTakenBySelectedLookupRecord?.id,
    setInquiryTakenBySearch,
    setSelectedInquiryTakenById,
  ]);

  useEffect(() => {
    setLinkedJobSelectionOverride(undefined);
  }, [linkedInquiryJobIdFromRecord, safeUid, setLinkedJobSelectionOverride]);

  useEffect(() => {
    setRelatedJobIdByUid({});
  }, [safeUid, setRelatedJobIdByUid]);

  useEffect(() => {
    if (!useListSelectionReset) return;
    setOptimisticListSelectionByField({});
    setRemovingListTagKeys({});
    listSelectionDesiredRef.current = {};
    listSelectionSyncingRef.current = {};
  }, [
    inquiryNumericId,
    listSelectionDesiredRef,
    listSelectionSyncingRef,
    setOptimisticListSelectionByField,
    setRemovingListTagKeys,
    useListSelectionReset,
  ]);
}
