import { Button } from "../../../shared/components/ui/Button.jsx";
import { DashboardCalendar } from "./calendar/DashboardCalendar.jsx";
import { DashboardTabsNav } from "./tabs/DashboardTabsNav.jsx";
import { AppliedFilterChips } from "./filters/AppliedFilterChips.jsx";
import { DashboardTable } from "./table/DashboardTable.jsx";
import { DashboardPagination } from "./pagination/DashboardPagination.jsx";
import { CALENDAR_TABS } from "../constants/tabs.js";

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardContent({
  activeTab,
  onTabChange,
  tabCounts,
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
  isBatchMode,
  batchSelectedIds,
  onBatchSelectionChange,
  onOpenTaskModal,
  onDeleteInquiry,
  onViewInquiry,
  sidebarOpen,
  onToggleSidebar,
  sortOrder = "desc",
  onToggleSortOrder,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar row */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        {!sidebarOpen && (
          <Button variant="ghost" size="sm" onClick={onToggleSidebar} title="Show filters">
            <FilterIcon />
            <span>Filters</span>
          </Button>
        )}
        {sidebarOpen && (
          <Button variant="ghost" size="sm" onClick={onToggleSidebar} title="Hide filters">
            <FilterIcon />
            <span>Hide Filters</span>
          </Button>
        )}
      </div>

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
