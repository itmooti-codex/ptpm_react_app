function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function UserDetailPanel({ user, currentUserRole = "" }) {
  if (!user) return null;

  const isSuperAdmin = currentUserRole === "super_admin";

  const roleLabel = {
    super_admin: "Super Admin",
    admin: "Admin",
    team_member: "Team Member",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Account Details</h3>
      <dl className="mt-3 space-y-2 text-xs">
        {isSuperAdmin ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">User ID</dt>
            <dd className="text-slate-700">{user.id}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Role</dt>
          <dd className="text-slate-700">{roleLabel[user.role] || user.role || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Status</dt>
          <dd className="text-slate-700">{user.isActive ? "Active" : "Inactive"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Last Login</dt>
          <dd className="text-slate-700">{formatDate(user.lastLoginAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Created</dt>
          <dd className="text-slate-700">{formatDate(user.createdAt)}</dd>
        </div>
        {isSuperAdmin && user.serviceProviderId ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Service Provider ID</dt>
            <dd className="font-mono text-slate-700">{user.serviceProviderId}</dd>
          </div>
        ) : null}
        {isSuperAdmin && user.contactId ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Contact ID</dt>
            <dd className="font-mono text-slate-700">{user.contactId}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
