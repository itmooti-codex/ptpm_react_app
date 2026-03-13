import { Button } from "../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { getFriendlyServiceMessage } from "../../../shared/utils/userFacingErrors.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { useDashboardPageState } from "../hooks/useDashboardPageState.js";
import { DashboardSidebar } from "../components/DashboardSidebar.jsx";
import { DashboardContent } from "../components/DashboardContent.jsx";
import { DashboardBatchDeleteModal } from "../components/modals/DashboardBatchDeleteModal.jsx";
import { TasksModal } from "@modules/details-workspace/exports/components.js";
import {
  FullPageLoader,
  FullPageError,
  ChevronRightIcon,
} from "../components/DashboardFullPageStates.jsx";

export function DashboardPage() {
  const {
    plugin,
    isBootstrapping,
    statusText,
    error,
    serviceProviders,
    isCreatingJob,

    activeTab,
    currentPage,
    setCurrentPage,
    pageSize,
    sortOrder,
    handleToggleSortOrder,
    handleTabChange,
    handlePageSizeChange,
    displayTabCounts,
    totalCount,
    totalPages,

    sidebarOpen,
    setSidebarOpen,

    searchInput,
    setSearchInput,

    rows,
    isLoading,

    filterHook,
    currentFilters,
    currentAppliedFilters,

    calendarData,
    handleSelectCalendarRange,
    handleClearCalendarRange,

    batchSelectedIds,
    setBatchSelectedIds,
    isBatchMode,
    batchDeleteModal,
    setBatchDeleteModal,
    isBatchDeleting,
    handleEnableBatchDelete,
    handleSelectBatchAction,
    handleBatchDeleteConfirm,

    taskModal,
    handleOpenTaskModal,
    handleCloseTaskModal,

    deleteTarget,
    setDeleteTarget,
    isDeletingInquiry,
    handleOpenDeleteModal,
    handleConfirmDeleteInquiry,

    handleViewRecord,
    handlePrintCurrentTable,
    handleExportCurrentTable,
    handleExportServiceProviders,
    handleApplyFilters,
    handleResetFilters,
  } = useDashboardPageState();

  if (isBootstrapping || isCreatingJob) {
    const loaderText = isCreatingJob ? "Creating job..." : statusText;
    return <FullPageLoader text={loaderText} />;
  }

  if (error) {
    const friendlyMessage = getFriendlyServiceMessage(error);
    return (
      <FullPageError
        title={friendlyMessage ? "Temporary maintenance" : "Unable to load dashboard."}
        description={friendlyMessage || "Please try refreshing the page."}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 font-['Inter']">
      <GlobalTopHeader />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <DashboardSidebar
            activeTab={activeTab}
            filters={currentFilters}
            onPatchFilter={(key, value) => filterHook.patchFilter(activeTab, key, value)}
            onToggleArrayFilter={(key, value) =>
              filterHook.toggleArrayFilter(activeTab, key, value)
            }
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            onClose={() => setSidebarOpen(false)}
            serviceProviders={serviceProviders}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardContent
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabCounts={displayTabCounts}
            onEnableBatchDelete={handleEnableBatchDelete}
            onSelectBatchAction={handleSelectBatchAction}
            isBatchMode={isBatchMode}
            batchSelectedCount={batchSelectedIds.length}
            onBatchDeleteClick={() => setBatchDeleteModal(true)}
            onPrintCurrentTable={handlePrintCurrentTable}
            onExportCurrentTable={handleExportCurrentTable}
            onExportServiceProviders={handleExportServiceProviders}
            calendarData={calendarData}
            selectedDateFrom={currentAppliedFilters?.dateFrom || ""}
            selectedDateTo={currentAppliedFilters?.dateTo || ""}
            onSelectCalendarRange={handleSelectCalendarRange}
            onClearCalendarRange={handleClearCalendarRange}
            activeChips={filterHook.getActiveChips(currentAppliedFilters, { serviceProviders })}
            onRemoveChip={(key, value) => filterHook.removeAppliedFilter(activeTab, key, value)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            rows={rows}
            totalCount={totalCount}
            totalPages={totalPages}
            isLoading={isLoading}
            batchSelectedIds={batchSelectedIds}
            onBatchSelectionChange={setBatchSelectedIds}
            onOpenTaskModal={handleOpenTaskModal}
            onDeleteInquiry={handleOpenDeleteModal}
            onViewInquiry={handleViewRecord}
            sortOrder={sortOrder}
            onToggleSortOrder={handleToggleSortOrder}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
          />
        </main>
      </div>

      {!sidebarOpen ? (
        <button
          type="button"
          className="fixed bottom-[88px] -left-3 z-[59] inline-flex h-10 w-10 items-center justify-end rounded-full border border-[#003882]/35 bg-[#003882] pr-2 text-white shadow-[0_8px_22px_rgba(0,56,130,0.28)] transition hover:bg-[#0A4A9E]"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open filters panel"
          title="Open filters panel"
        >
          <ChevronRightIcon />
        </button>
      ) : null}

      <TasksModal
        open={taskModal.open}
        contextType={taskModal.contextType || "job"}
        contextId={taskModal.contextId || ""}
        plugin={plugin}
        onClose={handleCloseTaskModal}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeletingInquiry) return;
          setDeleteTarget(null);
        }}
        title="Cancel Record?"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingInquiry}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteInquiry}
              disabled={isDeletingInquiry}
            >
              {isDeletingInquiry ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to mark this record as Cancelled?
        </p>
      </Modal>

      <DashboardBatchDeleteModal
        open={batchDeleteModal}
        count={batchSelectedIds.length}
        isProcessing={isBatchDeleting}
        onClose={() => {
          if (isBatchDeleting) return;
          setBatchDeleteModal(false);
        }}
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  );
}
