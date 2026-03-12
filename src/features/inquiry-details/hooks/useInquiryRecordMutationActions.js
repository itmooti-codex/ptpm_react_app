import { useCallback } from "react";
import { updateCompanyFieldsById, updateContactFieldsById, updateInquiryFieldsById } from "../../../modules/job-records/exports/api.js";
import { INQUIRY_DETAILS_EDIT_EMPTY_FORM } from "../components/InquiryDetailsEditModal.jsx";
import {
  normalizeServiceInquiryId,
  toNullableText,
  toUnixSeconds,
} from "../shared/inquiryDetailsFormatting.js";

export function useInquiryRecordMutationActions({
  plugin,
  navigate,
  error,
  success,
  trackRecentActivity,
  inquiryNumericId,
  safeUid,
  refreshResolvedInquiry,
  popupCommentDrafts,
  contactPopupComment,
  companyPopupComment,
  inquiryContactId,
  inquiryCompanyId,
  isSavingPopupComment,
  setIsSavingPopupComment,
  setIsPopupCommentModalOpen,
  setIsMoreOpen,
  setIsDeleteRecordModalOpen,
  isDeletingRecord,
  setIsDeletingRecord,
  selectedServiceProviderId,
  isAllocatingServiceProvider,
  setIsAllocatingServiceProvider,
  selectedInquiryTakenById,
  isSavingInquiryTakenBy,
  setIsSavingInquiryTakenBy,
  inquiryDetailsInitialForm,
  setInquiryDetailsForm,
  setIsInquiryDetailsModalOpen,
  isSavingInquiryDetails,
  setIsSavingInquiryDetails,
  inquiryDetailsForm,
}) {
  const handleSavePopupComments = useCallback(async () => {
    if (isSavingPopupComment) return;

    const nextContactComment = String(popupCommentDrafts?.contact ?? "").trim();
    const nextCompanyComment = String(popupCommentDrafts?.company ?? "").trim();
    const contactChanged = nextContactComment !== contactPopupComment;
    const companyChanged = nextCompanyComment !== companyPopupComment;

    if (!contactChanged && !companyChanged) {
      setIsPopupCommentModalOpen(false);
      return;
    }

    try {
      setIsSavingPopupComment(true);

      if (contactChanged) {
        if (!inquiryContactId) {
          throw new Error("Primary contact is missing.");
        }
        await updateContactFieldsById({
          plugin,
          contactId: inquiryContactId,
          payload: {
            popup_comment: nextContactComment || null,
          },
        });
      }

      if (companyChanged) {
        if (!inquiryCompanyId) {
          throw new Error("Company is missing.");
        }
        await updateCompanyFieldsById({
          plugin,
          companyId: inquiryCompanyId,
          payload: {
            popup_comment: nextCompanyComment || null,
          },
        });
      }

      success("Saved", "Popup comment updated.");
      setIsPopupCommentModalOpen(false);
      await refreshResolvedInquiry();
    } catch (saveError) {
      console.error("[InquiryDetails] Popup comment save failed", saveError);
      error("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally {
      setIsSavingPopupComment(false);
    }
  }, [
    companyPopupComment,
    contactPopupComment,
    error,
    inquiryCompanyId,
    inquiryContactId,
    isSavingPopupComment,
    plugin,
    popupCommentDrafts,
    refreshResolvedInquiry,
    setIsPopupCommentModalOpen,
    setIsSavingPopupComment,
    success,
  ]);

  const handleDeleteRecord = useCallback(() => {
    setIsMoreOpen(false);
    setIsDeleteRecordModalOpen(true);
    trackRecentActivity({
      action: "Opened cancel inquiry modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: String(inquiryNumericId || "").trim(),
        inquiry_uid: String(safeUid || "").trim(),
      },
    });
  }, [
    inquiryNumericId,
    safeUid,
    setIsDeleteRecordModalOpen,
    setIsMoreOpen,
    trackRecentActivity,
  ]);

  const handleCloseDeleteRecordModal = useCallback(() => {
    if (isDeletingRecord) return;
    setIsDeleteRecordModalOpen(false);
  }, [isDeletingRecord, setIsDeleteRecordModalOpen]);

  const handleConfirmDeleteRecord = useCallback(async () => {
    if (isDeletingRecord) return;
    if (!plugin || !inquiryNumericId) {
      error("Delete failed", "Inquiry context is not ready.");
      return;
    }

    setIsDeletingRecord(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          inquiry_status: "Cancelled",
        },
      });
      trackRecentActivity({
        action: "Cancelled inquiry",
        path: "/",
        pageType: "dashboard",
        pageName: "Dashboard",
        metadata: {
          inquiry_id: String(inquiryNumericId || "").trim(),
          inquiry_uid: String(safeUid || "").trim(),
        },
      });
      success("Record cancelled", "Inquiry status was updated to Cancelled.");
      setIsDeleteRecordModalOpen(false);
      navigate("/");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed cancelling inquiry", deleteError);
      error("Delete failed", deleteError?.message || "Unable to cancel inquiry.");
    } finally {
      setIsDeletingRecord(false);
    }
  }, [
    error,
    inquiryNumericId,
    isDeletingRecord,
    navigate,
    plugin,
    safeUid,
    setIsDeleteRecordModalOpen,
    setIsDeletingRecord,
    success,
    trackRecentActivity,
  ]);

  const handleConfirmServiceProviderAllocation = useCallback(async () => {
    if (isAllocatingServiceProvider) return;
    if (!plugin || !inquiryNumericId) {
      error("Allocation failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = String(selectedServiceProviderId || "").trim();
    if (!providerId) {
      error("Allocation failed", "Select a service provider first.");
      return;
    }

    setIsAllocatingServiceProvider(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          service_provider_id: providerId,
          Service_Provider_ID: providerId,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Allocated service provider",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: String(inquiryNumericId || "").trim(),
          inquiry_uid: String(safeUid || "").trim(),
          service_provider_id: providerId,
        },
      });
      success("Service provider allocated", "Deal was updated with selected service provider.");
    } catch (allocationError) {
      console.error("[InquiryDetails] Service provider allocation failed", allocationError);
      error("Allocation failed", allocationError?.message || "Unable to allocate service provider.");
    } finally {
      setIsAllocatingServiceProvider(false);
    }
  }, [
    error,
    inquiryNumericId,
    isAllocatingServiceProvider,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    selectedServiceProviderId,
    setIsAllocatingServiceProvider,
    success,
    trackRecentActivity,
  ]);

  const handleConfirmInquiryTakenBy = useCallback(async () => {
    if (isSavingInquiryTakenBy) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = String(selectedInquiryTakenById || "").trim();
    if (!providerId) {
      error("Save failed", "Select admin first.");
      return;
    }

    setIsSavingInquiryTakenBy(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          Inquiry_Taken_By_id: providerId,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Updated inquiry taken by",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: String(inquiryNumericId || "").trim(),
          inquiry_uid: String(safeUid || "").trim(),
          inquiry_taken_by_id: providerId,
        },
      });
      success("Inquiry taken by updated", "Inquiry was updated with selected admin.");
    } catch (saveError) {
      console.error("[InquiryDetails] Inquiry taken by update failed", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry taken by.");
    } finally {
      setIsSavingInquiryTakenBy(false);
    }
  }, [
    error,
    inquiryNumericId,
    isSavingInquiryTakenBy,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    selectedInquiryTakenById,
    setIsSavingInquiryTakenBy,
    success,
    trackRecentActivity,
  ]);

  const handleOpenInquiryDetailsEditor = useCallback(() => {
    setInquiryDetailsForm({
      ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
      ...(inquiryDetailsInitialForm || {}),
    });
    setIsInquiryDetailsModalOpen(true);
    trackRecentActivity({
      action: "Opened inquiry edit modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: String(inquiryNumericId || "").trim(),
        inquiry_uid: String(safeUid || "").trim(),
      },
    });
  }, [
    inquiryDetailsInitialForm,
    inquiryNumericId,
    safeUid,
    setInquiryDetailsForm,
    setIsInquiryDetailsModalOpen,
    trackRecentActivity,
  ]);

  const handleCloseInquiryDetailsEditor = useCallback(() => {
    if (isSavingInquiryDetails) return;
    setIsInquiryDetailsModalOpen(false);
  }, [isSavingInquiryDetails, setIsInquiryDetailsModalOpen]);

  const handleSaveInquiryDetails = useCallback(async () => {
    if (isSavingInquiryDetails) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }

    const normalizedServiceInquiryId = normalizeServiceInquiryId(
      inquiryDetailsForm.service_inquiry_id
    );
    const payload = {
      inquiry_status: toNullableText(inquiryDetailsForm.inquiry_status),
      inquiry_source: toNullableText(inquiryDetailsForm.inquiry_source),
      type: toNullableText(inquiryDetailsForm.type),
      service_inquiry_id: normalizedServiceInquiryId
        ? /^\d+$/.test(normalizedServiceInquiryId)
          ? Number.parseInt(normalizedServiceInquiryId, 10)
          : normalizedServiceInquiryId
        : null,
      how_can_we_help: toNullableText(inquiryDetailsForm.how_can_we_help),
      how_did_you_hear: toNullableText(inquiryDetailsForm.how_did_you_hear),
      other: toNullableText(inquiryDetailsForm.other),
      admin_notes: toNullableText(inquiryDetailsForm.admin_notes),
      client_notes: toNullableText(inquiryDetailsForm.client_notes),
      date_job_required_by: toUnixSeconds(inquiryDetailsForm.date_job_required_by),
      renovations: toNullableText(inquiryDetailsForm.renovations),
      resident_availability: toNullableText(inquiryDetailsForm.resident_availability),
      noise_signs_options_as_text: toNullableText(
        inquiryDetailsForm.noise_signs_options_as_text
      ),
      pest_active_times_options_as_text: toNullableText(
        inquiryDetailsForm.pest_active_times_options_as_text
      ),
      pest_location_options_as_text: toNullableText(
        inquiryDetailsForm.pest_location_options_as_text
      ),
    };

    setIsSavingInquiryDetails(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload,
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Inquiry details were updated.");
      setIsInquiryDetailsModalOpen(false);
    } catch (saveError) {
      console.error("[InquiryDetails] Failed to update inquiry details", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry details.");
    } finally {
      setIsSavingInquiryDetails(false);
    }
  }, [
    error,
    inquiryDetailsForm.admin_notes,
    inquiryDetailsForm.client_notes,
    inquiryDetailsForm.date_job_required_by,
    inquiryDetailsForm.how_can_we_help,
    inquiryDetailsForm.how_did_you_hear,
    inquiryDetailsForm.inquiry_source,
    inquiryDetailsForm.inquiry_status,
    inquiryDetailsForm.noise_signs_options_as_text,
    inquiryDetailsForm.other,
    inquiryDetailsForm.pest_active_times_options_as_text,
    inquiryDetailsForm.pest_location_options_as_text,
    inquiryDetailsForm.renovations,
    inquiryDetailsForm.resident_availability,
    inquiryDetailsForm.service_inquiry_id,
    inquiryDetailsForm.type,
    inquiryNumericId,
    isSavingInquiryDetails,
    plugin,
    refreshResolvedInquiry,
    setIsInquiryDetailsModalOpen,
    setIsSavingInquiryDetails,
    success,
  ]);

  return {
    handleSavePopupComments,
    handleDeleteRecord,
    handleCloseDeleteRecordModal,
    handleConfirmDeleteRecord,
    handleConfirmServiceProviderAllocation,
    handleConfirmInquiryTakenBy,
    handleOpenInquiryDetailsEditor,
    handleCloseInquiryDetailsEditor,
    handleSaveInquiryDetails,
  };
}
