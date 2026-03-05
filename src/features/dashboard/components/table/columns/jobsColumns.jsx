import { JobDirectStatusBadge, JobDirectIconActionButton } from "@modules/job-workspace/public/components.js";
import { ClientCell } from "../ClientCell.jsx";
import { resolveStatusStyle } from "@shared/constants/statusStyles.js";

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function getJobsColumns({
  onView,
  onAddTask,
  onDelete,
  isBatchMode,
  sortOrder = "desc",
  onToggleSortOrder,
}) {
  const cols = [];

  if (isBatchMode) {
    cols.push({
      key: "_select",
      header: "",
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row, { selectedIds, onToggleSelect }) => (
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-slate-300 text-[#003882] focus:ring-[#003882]"
          checked={selectedIds?.includes(row.uid || row.id)}
          onChange={() => onToggleSelect?.(row.uid || row.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    });
  }

  cols.push(
    {
      key: "id",
      header: "id",
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row) => (
        <button
          type="button"
          className="uid-link hover:brightness-90"
          onClick={() => onView?.(row)}
        >
          {row.uid || "—"}
        </button>
      ),
    },
    {
      key: "date",
      header: (
        <button
          type="button"
          className="flex items-center gap-1 uppercase tracking-wide hover:text-slate-800"
          onClick={onToggleSortOrder}
        >
          Date
          <span aria-label={sortOrder === "desc" ? "newest first" : "oldest first"}>
            {sortOrder === "desc" ? "↓" : "↑"}
          </span>
        </button>
      ),
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row) => <span>{row.date ?? "—"}</span>,
    },
    {
      key: "client",
      header: "Client",
      thClass: "w-[1%]",
      render: (row) => (
        <ClientCell
          name={row.clientName}
          phone={row.phone}
          email={row.email}
          address={row.address}
        />
      ),
    },
    {
      key: "jobNumber",
      header: "Job #",
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row) => <span className="uid-text">{row.jobNumber ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row) => (
        <JobDirectStatusBadge
          label={row.status}
          style={resolveStatusStyle(row.status)}
        />
      ),
    },
    {
      key: "serviceProvider",
      header: "Service Provider",
      thClass: "w-[1%]",
      tdClass: "whitespace-nowrap",
      render: (row) => <span>{row.serviceProvider ?? "—"}</span>,
    },
    {
      key: "_actions",
      header: "Actions",
      thClass: "w-[1%] text-right",
      tdClass: "whitespace-nowrap text-right",
      render: (row) => (
        <div className="flex w-full items-center justify-end gap-1">
          <JobDirectIconActionButton title="View" onClick={() => onView?.(row)}>
            <EyeIcon />
          </JobDirectIconActionButton>
          <JobDirectIconActionButton title="Add Task" onClick={() => onAddTask?.(row)}>
            <TaskIcon />
          </JobDirectIconActionButton>
          <JobDirectIconActionButton variant="danger" title="Delete" onClick={() => onDelete?.(row)}>
            <TrashIcon />
          </JobDirectIconActionButton>
        </div>
      ),
    }
  );

  return cols;
}
