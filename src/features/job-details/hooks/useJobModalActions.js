import { useCallback } from "react";
import { toText, formatActivityServiceLabel } from "@shared/utils/formatters.js";
import {
  fetchPropertyAffiliationsForDetails,
  fetchTasksForDetails,
} from "@modules/job-records/exports/api.js";
import {
  createAffiliationRecord,
  updateAffiliationRecord,
} from "@modules/details-workspace/exports/api.js";
import { toAffiliationOption } from "../shared/jobDetailsFormatting.js";

export function useJobModalActions({
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
}) {
  // Affiliation CRUD
  const openAddAffiliationModal = useCallback(({ autoSelect = false } = {}) => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!propertyId) {
      error("Add contact unavailable", "Please link a property first.");
      return;
    }
    setShouldAutoSelectNewAffiliation(Boolean(autoSelect));
    setAffiliationModalState({ open: true, initialData: null });
  }, [error, loadedPropertyId, selectedWorkspacePropertyId]);

  const handleAddAccountsContact = useCallback(() => {
    openAddAffiliationModal({ autoSelect: true });
  }, [openAddAffiliationModal]);

  const handleAffiliationSaved = useCallback(() => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!plugin || !propertyId) return;
    fetchPropertyAffiliationsForDetails({ plugin, propertyId })
      .then((records) => { setAffiliations(Array.isArray(records) ? records : []); })
      .catch((err) => { console.warn("[JobDetailsBlank] Failed to refresh affiliations after save", err); });
  }, [loadedPropertyId, plugin, selectedWorkspacePropertyId]);

  const closeAffiliationModal = useCallback(() => {
    setAffiliationModalState({ open: false, initialData: null });
  }, []);

  const saveAffiliation = useCallback(
    async (payload, meta = {}) => {
      const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
      if (!plugin) throw new Error("SDK plugin is not ready.");
      if (!propertyId) throw new Error("Property ID is missing.");

      const editId = toText(meta?.id);
      const savedAffiliation = editId
        ? await updateAffiliationRecord({ plugin, id: editId, payload })
        : await createAffiliationRecord({ plugin, payload });

      const refreshed = await fetchPropertyAffiliationsForDetails({ plugin, propertyId });
      const refreshedList = Array.isArray(refreshed) ? refreshed : [];
      setAffiliations(refreshedList);
      setAffiliationsError("");
      success(
        editId ? "Property contact updated" : "Property contact added",
        editId ? "Property contact details were updated." : "New property contact was added."
      );

      const savedAffiliationId = toText(savedAffiliation?.id || savedAffiliation?.ID || editId);
      if (!editId && shouldAutoSelectNewAffiliation && savedAffiliationId) {
        const matchedAffiliation = refreshedList.find(
          (item) => toText(item?.id || item?.ID) === savedAffiliationId
        );
        const option = toAffiliationOption(matchedAffiliation || { id: savedAffiliationId });
        setSelectedAccountsContactId(savedAffiliationId);
        setAccountsContactSearchValue(toText(option?.label || savedAffiliationId));
        setShouldAutoSelectNewAffiliation(false);
      }
    },
    [loadedPropertyId, plugin, selectedWorkspacePropertyId, shouldAutoSelectNewAffiliation]
  );

  // Property modal handlers
  const handleOpenAddPropertyModal = useCallback(() => {
    setPropertyModalMode("create");
    setIsAddPropertyOpen(true);
  }, []);

  const handleOpenEditPropertyModal = useCallback((record = null) => {
    const targetProperty = record || activeWorkspaceProperty;
    if (!targetProperty) return;
    const targetPropertyId = toText(targetProperty?.id || targetProperty?.ID || targetProperty?.Property_ID);
    if (targetPropertyId) setSelectedWorkspacePropertyId(targetPropertyId);
    setPropertyModalMode("edit");
    setIsAddPropertyOpen(true);
  }, [activeWorkspaceProperty]);

  // Uploads modal
  const handleOpenUploadsModal = useCallback(() => { setIsUploadsModalOpen(true); }, []);
  const closeUploadsModal = useCallback(() => { setIsUploadsModalOpen(false); }, []);

  // Appointment modal
  const handleOpenCreateAppointmentModal = useCallback(() => { setAppointmentModalMode("create"); setEditingAppointmentId(""); setIsAppointmentModalOpen(true); }, []);
  const handleOpenEditAppointmentModal = useCallback((record) => { setAppointmentModalMode("update"); setEditingAppointmentId(toText(record?.id || record?.ID)); setIsAppointmentModalOpen(true); }, []);
  const handleCloseAppointmentModal = useCallback(() => { setIsAppointmentModalOpen(false); setAppointmentModalMode("create"); setEditingAppointmentId(""); }, []);

  // Activity modal
  const handleOpenCreateActivityModal = useCallback(() => { setActivityModalMode("create"); setEditingActivityId(""); setIsActivityModalOpen(true); }, []);
  const handleOpenEditActivityModal = useCallback((record) => { setActivityModalMode("update"); setEditingActivityId(toText(record?.id || record?.ID)); setIsActivityModalOpen(true); }, []);
  const handleCloseActivityModal = useCallback(() => { setIsActivityModalOpen(false); setActivityModalMode("create"); setEditingActivityId(""); }, []);
  const handleActivitySaved = useCallback((savedActivity) => {
    if (!savedActivity) return;
    const savedId = toText(savedActivity?.id || savedActivity?.ID);
    if (!savedId) return;
    setJobActivities((prev) => {
      const exists = prev.some((a) => toText(a?.id || a?.ID) === savedId);
      if (exists) return prev.map((a) => toText(a?.id || a?.ID) === savedId ? { ...a, ...savedActivity } : a);
      return [...prev, savedActivity];
    });
  }, []);

  // Material modal
  const handleOpenCreateMaterialModal = useCallback(() => { setMaterialModalMode("create"); setEditingMaterialId(""); setIsMaterialModalOpen(true); }, []);
  const handleOpenEditMaterialModal = useCallback((record) => { setMaterialModalMode("update"); setEditingMaterialId(toText(record?.id || record?.ID)); setIsMaterialModalOpen(true); }, []);
  const handleCloseMaterialModal = useCallback(() => { setIsMaterialModalOpen(false); setMaterialModalMode("create"); setEditingMaterialId(""); }, []);

  // Tasks modal
  const handleOpenTasksModal = useCallback(() => {
    if (!effectiveJobId && !relatedInquiryId) return;
    setIsTasksModalOpen(true);
  }, [effectiveJobId, relatedInquiryId]);

  const handleCloseTasksModal = useCallback(() => {
    setIsTasksModalOpen(false);
    if (!plugin || (!effectiveJobId && !relatedInquiryId)) return;
    fetchTasksForDetails({ plugin, jobId: effectiveJobId, inquiryId: relatedInquiryId })
      .catch((loadError) => { console.error("[JobDetailsBlank] Failed to refresh tasks", loadError); });
  }, [effectiveJobId, plugin, relatedInquiryId]);

  return {
    closeAffiliationModal,
    closeUploadsModal,
    handleActivitySaved,
    handleAddAccountsContact,
    handleAffiliationSaved,
    handleCloseActivityModal,
    handleCloseAppointmentModal,
    handleCloseMaterialModal,
    handleCloseTasksModal,
    handleOpenAddPropertyModal,
    handleOpenCreateActivityModal,
    handleOpenCreateAppointmentModal,
    handleOpenCreateMaterialModal,
    handleOpenEditActivityModal,
    handleOpenEditAppointmentModal,
    handleOpenEditMaterialModal,
    handleOpenEditPropertyModal,
    handleOpenTasksModal,
    handleOpenUploadsModal,
    openAddAffiliationModal,
    saveAffiliation,
  };
}
