import { useCallback, useState } from "react";
import {
  cancelDashboardRecord,
  cancelDashboardRecordsByUniqueIds,
} from "../api/dashboardApi.js";
import { TAB_IDS } from "../constants/tabs.js";

export function useDashboardRecordActions({
  plugin,
  activeTab,
  setActiveTab,
  setCurrentPage,
  setTabCounts,
  filterHook,
  success,
  showError,
}) {
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeletingInquiry, setIsDeletingInquiry] = useState(false);

  const handleOpenDeleteModal = useCallback((row) => {
    if (!row?.id) return;
    setDeleteTarget({
      ...row,
      tabId: activeTab,
    });
  }, [activeTab]);

  const handleConfirmDeleteInquiry = useCallback(async () => {
    if (!plugin || !deleteTarget?.id || isDeletingInquiry) return;
    setIsDeletingInquiry(true);
    // For combined tabs, use the record's own type to determine the correct model.
    const effectiveTabId = deleteTarget.recordType === "inquiry"
      ? TAB_IDS.INQUIRY
      : deleteTarget.tabId;
    try {
      await cancelDashboardRecord({
        plugin,
        tabId: effectiveTabId,
        recordId: deleteTarget.id,
      });
      success("Record cancelled", "Status has been updated to Cancelled.");
      setDeleteTarget(null);
      setTabCounts((prev) => ({
        ...prev,
        [deleteTarget.tabId]: Math.max(0, (prev?.[deleteTarget.tabId] ?? 0) - 1),
      }));
    } catch (deleteError) {
      console.error("[Dashboard] Failed to cancel record", deleteError);
      showError(
        "Delete failed",
        deleteError?.message || "Unable to cancel record."
      );
    } finally {
      setIsDeletingInquiry(false);
    }
  }, [plugin, deleteTarget, isDeletingInquiry, success, showError, setTabCounts]);

  const handleEnableBatchDelete = useCallback(() => {
    setIsBatchMode(true);
    setBatchSelectedIds([]);
  }, []);

  const handleSelectBatchAction = useCallback((actionId) => {
    const normalizedActionId = String(actionId || "").trim();
    if (!normalizedActionId) return;

    if (normalizedActionId === "jobs-to-check") {
      setActiveTab(TAB_IDS.JOBS);
      filterHook.applyPresetFilters(TAB_IDS.JOBS, {
        queryPreset: "jobs-to-check",
      });
      setCurrentPage(1);
      setBatchSelectedIds([]);
      setIsBatchMode(false);
      return;
    }

    if (normalizedActionId === "list-unpaid-invoices") {
      setActiveTab(TAB_IDS.PAYMENT);
      filterHook.applyPresetFilters(TAB_IDS.PAYMENT, {
        queryPreset: "list-unpaid-invoices",
      });
      setCurrentPage(1);
      setBatchSelectedIds([]);
      setIsBatchMode(false);
      return;
    }

    if (normalizedActionId === "list-part-payments") {
      setActiveTab(TAB_IDS.PAYMENT);
      filterHook.applyPresetFilters(TAB_IDS.PAYMENT, {
        queryPreset: "list-part-payments",
      });
      setCurrentPage(1);
      setBatchSelectedIds([]);
      setIsBatchMode(false);
    }
  }, [filterHook, setActiveTab, setCurrentPage]);

  const handleBatchDeleteConfirm = useCallback(() => {
    if (!plugin || !batchSelectedIds.length || isBatchDeleting) return;
    setIsBatchDeleting(true);
    cancelDashboardRecordsByUniqueIds({
      plugin,
      tabId: activeTab,
      uniqueIds: batchSelectedIds,
    })
      .then(({ cancelled }) => {
        success("Records cancelled", `${cancelled || 0} record(s) were marked as Cancelled.`);
        setBatchDeleteModal(false);
        setBatchSelectedIds([]);
        setIsBatchMode(false);
        setTabCounts((prev) => ({
          ...prev,
          [activeTab]: Math.max(0, (prev?.[activeTab] ?? 0) - batchSelectedIds.length),
        }));
      })
      .catch((batchError) => {
        console.error("[Dashboard] Failed batch cancel", batchError);
        showError("Batch delete failed", batchError?.message || "Unable to cancel selected records.");
      })
      .finally(() => setIsBatchDeleting(false));
  }, [
    plugin,
    batchSelectedIds,
    isBatchDeleting,
    activeTab,
    success,
    showError,
    setTabCounts,
  ]);

  return {
    // Single delete
    deleteTarget,
    setDeleteTarget,
    isDeletingInquiry,
    handleOpenDeleteModal,
    handleConfirmDeleteInquiry,

    // Batch
    batchSelectedIds,
    setBatchSelectedIds,
    isBatchMode,
    setIsBatchMode,
    batchDeleteModal,
    setBatchDeleteModal,
    isBatchDeleting,
    handleEnableBatchDelete,
    handleSelectBatchAction,
    handleBatchDeleteConfirm,
  };
}
