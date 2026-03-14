import { formatUnixDate } from "@shared/api/dashboardCore.js";

export function UserDetailPanel({ user }) {
  if (!user) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Account Details</h3>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">User ID</dt>
          <dd className="text-slate-700">{user.id}</dd>
        </div>
        {user.uniqueId ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Unique ID</dt>
            <dd className="font-mono text-slate-700">{user.uniqueId}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Last Login</dt>
          <dd className="text-slate-700">{user.lastLogin ? formatUnixDate(user.lastLogin) : "Never"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Last Activity</dt>
          <dd className="text-slate-700">{user.lastActivity ? formatUnixDate(user.lastActivity) : "None"}</dd>
        </div>
        {user.roleName ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Role</dt>
            <dd className="text-slate-700">{user.roleName}</dd>
          </div>
        ) : null}
        {user.language ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Language</dt>
            <dd className="text-slate-700">{user.language}</dd>
          </div>
        ) : null}
        {user.timezone ? (
          <div className="flex justify-between">
            <dt className="font-medium text-slate-500">Timezone</dt>
            <dd className="text-slate-700">{user.timezone}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
