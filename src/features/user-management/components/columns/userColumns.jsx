import { formatUnixDate } from "@shared/api/dashboardCore.js";

function StatusBadge({ status }) {
  const colorMap = {
    Active: "bg-emerald-100 text-emerald-700",
    Archived: "bg-slate-100 text-slate-600",
    Offline: "bg-amber-100 text-amber-700",
  };
  const color = colorMap[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>
      {status || "Unknown"}
    </span>
  );
}

export function getUserColumns() {
  return [
    {
      key: "fullName",
      label: "Name",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.profileImage ? (
            <img
              src={row.profileImage}
              alt={row.fullName}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
              {(row.firstName || "").slice(0, 1)}
              {(row.lastName || "").slice(0, 1)}
            </span>
          )}
          <div>
            <div className="text-sm font-medium text-slate-800">{row.fullName || "—"}</div>
            <div className="text-xs text-slate-500">{row.login || ""}</div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (row) => (
        <span className="text-sm text-slate-700">{row.email || "—"}</span>
      ),
    },
    {
      key: "roleName",
      label: "Role",
      render: (row) => (
        <span className="text-sm text-slate-700">{row.roleName || "—"}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "lastLogin",
      label: "Last Login",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastLogin ? formatUnixDate(row.lastLogin) : "Never"}
        </span>
      ),
    },
  ];
}
