import { useEffect, useRef, useState } from "react";

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M7 7l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DropdownMenu({ items, onClose }) {
  return (
    <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 ${
            item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"
          }`}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function HeaderDropdownButton({ label, items, variant = "default" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const baseClass =
    variant === "danger"
      ? "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700"
      : "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10";

  return (
    <div ref={ref} className="relative">
      <button type="button" className={baseClass} onClick={() => setOpen((prev) => !prev)}>
        {label}
        <ChevronDownIcon />
      </button>
      {open ? <DropdownMenu items={items} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

export function DashboardHeader({
  onEnableBatchDelete,
  isBatchMode = false,
  batchSelectedCount = 0,
  onBatchDeleteClick,
  onCreateInquiry,
  onCreateJob,
  onPrintCurrentTable,
  onExportCurrentTable,
  onExportServiceProviders,
}) {
  const createItems = [
    { label: "New Inquiry", onClick: () => onCreateInquiry?.() },
    { label: "New Quote/Job", onClick: () => onCreateJob?.() },
  ];

  const printItems = [
    { label: "Print List", onClick: () => onPrintCurrentTable?.() },
    { label: "Ecoaccess Report (XLSX)", onClick: () => onExportCurrentTable?.() },
    { label: "Service Provider List (XLSX)", onClick: () => onExportServiceProviders?.() },
  ];

  const batchItems = [
    { label: "Jobs To Check", onClick: () => {} },
    { label: "Email List to Serviceman", onClick: () => {} },
    { label: "List Unpaid Invoices", onClick: () => {} },
    { label: "List Part Payments", onClick: () => {} },
    { label: "Delete Selected", danger: true, onClick: () => onEnableBatchDelete?.() },
  ];

  return (
    <header className="flex h-14 items-center justify-end gap-2 bg-[#003882] px-4 text-white shadow-sm">
      <HeaderDropdownButton label="Create" items={createItems} />
      <HeaderDropdownButton label="Print" items={printItems} />
      <HeaderDropdownButton label="Batch Actions" items={batchItems} />

      {isBatchMode && batchSelectedCount > 0 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          onClick={onBatchDeleteClick}
        >
          <TrashIcon />
          Delete ({batchSelectedCount})
        </button>
      ) : null}
    </header>
  );
}
