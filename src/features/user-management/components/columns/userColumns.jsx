function RoleBadge({ role }) {
  const colorMap = {
    super_admin: "bg-purple-100 text-purple-700",
    admin: "bg-sky-100 text-sky-700",
    team_member: "bg-slate-100 text-slate-600",
  };
  const label = {
    super_admin: "Super Admin",
    admin: "Admin",
    team_member: "Team Member",
  };
  const color = colorMap[role] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>
      {label[role] || role || "—"}
    </span>
  );
}

function ActiveBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
      Inactive
    </span>
  );
}

function formatDate(value) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function getUserColumns() {
  return [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <div>
          <div className="text-sm font-medium text-slate-800">
            {row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
          </div>
          <div className="text-xs text-slate-500">{row.email || ""}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: "isActive",
      label: "Status",
      render: (row) => <ActiveBadge isActive={row.isActive} />,
    },
    {
      key: "lastLoginAt",
      label: "Last Login",
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.lastLoginAt)}</span>
      ),
    },
  ];
}
