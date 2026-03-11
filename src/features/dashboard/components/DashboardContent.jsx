import { DashboardCalendar } from "./calendar/DashboardCalendar.jsx";
import { DashboardTabsNav } from "./tabs/DashboardTabsNav.jsx";
import { AppliedFilterChips } from "./filters/AppliedFilterChips.jsx";
import { DashboardTable } from "./table/DashboardTable.jsx";
import { DashboardPagination } from "./pagination/DashboardPagination.jsx";
import { CALENDAR_TABS } from "../constants/tabs.js";

export function DashboardContent({
  activeTab,
  onTabChange,
  tabCounts,
  onEnableBatchDelete,
  onSelectBatchAction,
  isBatchMode,
  batchSelectedCount = 0,
  onBatchDeleteClick,
  onPrintCurrentTable,
  onExportCurrentTable,
  onExportServiceProviders,
  calendarData,
  selectedDateFrom,
  selectedDateTo,
  onSelectCalendarRange,
  onClearCalendarRange,
  activeChips,
  onRemoveChip,
  currentPage,
  onPageChange,
  pageSize = 25,
  onPageSizeChange,
  rows = [],
  totalCount = 0,
  totalPages = 1,
  isLoading = false,
  batchSelectedIds,
  onBatchSelectionChange,
  onOpenTaskModal,
  onDeleteInquiry,
  onViewInquiry,
  sortOrder = "desc",
  onToggleSortOrder,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Calendar */}
      {CALENDAR_TABS.has(activeTab) && (
        <DashboardCalendar
          calendarData={calendarData}
          selectedDateFrom={selectedDateFrom}
          selectedDateTo={selectedDateTo}
          onSelectRange={onSelectCalendarRange}
          onClearRange={onClearCalendarRange}
        />
      )}

      {/* Tabs */}
      <DashboardTabsNav
        activeTab={activeTab}
        tabCounts={tabCounts}
        onTabChange={onTabChange}
        onEnableBatchDelete={onEnableBatchDelete}
        onSelectBatchAction={onSelectBatchAction}
        isBatchMode={isBatchMode}
        batchSelectedCount={batchSelectedCount}
        onBatchDeleteClick={onBatchDeleteClick}
        onPrintCurrentTable={onPrintCurrentTable}
        onExportCurrentTable={onExportCurrentTable}
        onExportServiceProviders={onExportServiceProviders}
      />

      {/* Applied filter chips */}
      {activeChips.length > 0 && (
        <div className="border-b border-slate-100 bg-white px-4 py-2">
          <AppliedFilterChips chips={activeChips} onRemove={onRemoveChip} />
        </div>
      )}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <DashboardTable
          activeTab={activeTab}
          rows={rows}
          isLoading={isLoading}
          isBatchMode={isBatchMode}
          batchSelectedIds={batchSelectedIds}
          onBatchSelectionChange={onBatchSelectionChange}
          onOpenTaskModal={onOpenTaskModal}
          onDeleteInquiry={onDeleteInquiry}
          onViewInquiry={onViewInquiry}
          sortOrder={sortOrder}
          onToggleSortOrder={onToggleSortOrder}
        />
      </div>

      {/* Pagination */}
      <DashboardPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
