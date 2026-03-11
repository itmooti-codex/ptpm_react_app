import { useEffect, useRef, useState } from "react";
import { TAB_IDS, TAB_LABELS, TAB_LIST } from "../../constants/tabs.js";

function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.09 2.31A1.5 1.5 0 0 0 3.6 3.78l-.01.04C3.01 7.02 4.12 12.07 8.7 16.65c4.58 4.58 9.63 5.69 12.83 5.12l.04-.01a1.5 1.5 0 0 0 1.17-1.49v-3.08a1.5 1.5 0 0 0-1.15-1.46l-3.15-.72a1.5 1.5 0 0 0-1.54.56l-1.18 1.57a12.04 12.04 0 0 1-5.55-5.55l1.57-1.18a1.5 1.5 0 0 0 .56-1.54l-.72-3.15A1.5 1.5 0 0 0 10.1 4.5H6.5c-.47 0-.91.2-1.21.5l-.2-.69Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardTabsNav({
  activeTab,
  tabCounts = {},
  onTabChange,
  onEnableBatchDelete,
  onSelectBatchAction,
  isBatchMode = false,
  batchSelectedCount = 0,
  onBatchDeleteClick,
  onPrintCurrentTable,
  onExportCurrentTable,
  onExportServiceProviders,
}) {
  const [openMenu, setOpenMenu] = useState("");
  const printRef = useRef(null);
  const batchRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (event) => {
      const target = event?.target;
      if (printRef.current && printRef.current.contains(target)) return;
      if (batchRef.current && batchRef.current.contains(target)) return;
      setOpenMenu("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const printItems = [
    { label: "Print List", onClick: () => onPrintCurrentTable?.() },
    { label: "Ecoaccess Report (XLSX)", onClick: () => onExportCurrentTable?.() },
    { label: "Service Provider List (XLSX)", onClick: () => onExportServiceProviders?.() },
  ];
  const batchItems = [
    { label: "Jobs To Check", onClick: () => onSelectBatchAction?.("jobs-to-check") },
    { label: "Email List to Serviceman", onClick: () => {} },
    {
      label: "List Unpaid Invoices",
      onClick: () => onSelectBatchAction?.("list-unpaid-invoices"),
    },
    {
      label: "List Part Payments",
      onClick: () => onSelectBatchAction?.("list-part-payments"),
    },
    { label: "Delete Selected", danger: true, onClick: () => onEnableBatchDelete?.() },
  ];

  const DropdownMenu = ({ items = [] }) => (
    <div className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          type="button"
          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 ${
            item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"
          }`}
          onClick={() => {
            item.onClick?.();
            setOpenMenu("");
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex items-end justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-end gap-0 overflow-x-auto">
        {TAB_LIST.map((tabId) => {
          const isActive = activeTab === tabId;
          const isUrgent = tabId === TAB_IDS.URGENT_CALLS;
          const count = tabCounts[tabId] ?? 0;

          return (
            <button
              key={tabId}
              type="button"
              onClick={() => onTabChange(tabId)}
              className={[
                "relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-b-2 border-[#003882] text-[#003882]"
                  : "border-b-2 border-transparent text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {isUrgent && (
                <span className="text-rose-500">
                  <PhoneIcon />
                </span>
              )}
              <span>{TAB_LABELS[tabId]}</span>
              <span
                className={[
                  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  isUrgent
                    ? "bg-rose-100 text-rose-700"
                    : isActive
                      ? "bg-[#003882] text-white"
                      : "bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-1 flex shrink-0 items-center gap-2">
        <div ref={printRef} className="relative">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            onClick={() => setOpenMenu((previous) => (previous === "print" ? "" : "print"))}
          >
            Print
            <span className="text-slate-500">▾</span>
          </button>
          {openMenu === "print" ? <DropdownMenu items={printItems} /> : null}
        </div>

        <div ref={batchRef} className="relative">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            onClick={() => setOpenMenu((previous) => (previous === "batch" ? "" : "batch"))}
          >
            Batch Actions
            <span className="text-slate-500">▾</span>
          </button>
          {openMenu === "batch" ? <DropdownMenu items={batchItems} /> : null}
        </div>

        {isBatchMode && batchSelectedCount > 0 ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
            onClick={onBatchDeleteClick}
          >
            Delete ({batchSelectedCount})
          </button>
        ) : null}
      </div>
    </div>
  );
}
