import {
  STATUS_COLORS,
  WORKLOAD_COLORS,
} from "../constants/userManagementConstants.js";

export function ServiceProviderCard({ serviceProvider, isLoading }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Linked Service Provider</h3>
        <p className="mt-2 text-xs text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!serviceProvider) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Linked Service Provider</h3>
        <p className="mt-2 text-xs text-slate-400">No service provider linked to this user.</p>
      </div>
    );
  }

  const sp = serviceProvider;
  const name = [sp.contactFirstName, sp.contactLastName].filter(Boolean).join(" ") || "—";
  const statusColor = STATUS_COLORS[sp.status] || "bg-slate-100 text-slate-600";
  const workloadColor = WORKLOAD_COLORS[sp.workloadCapacity] || "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Linked Service Provider</h3>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          {sp.profileImage ? (
            <img src={sp.profileImage} alt={name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
              {(sp.contactFirstName || "").slice(0, 1)}
              {(sp.contactLastName || "").slice(0, 1)}
            </span>
          )}
          <div>
            <div className="text-sm font-medium text-slate-800">{name}</div>
            <div className="text-xs text-slate-500">{sp.type || "—"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>
            {sp.status || "Unknown"}
          </span>
          {sp.workloadCapacity ? (
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${workloadColor}`}>
              {sp.workloadCapacity}
            </span>
          ) : null}
        </div>

        <dl className="space-y-1 text-xs">
          {sp.workEmail ? (
            <div className="flex gap-2">
              <dt className="font-medium text-slate-500">Work Email</dt>
              <dd className="text-slate-700">{sp.workEmail}</dd>
            </div>
          ) : null}
          {sp.mobileNumber ? (
            <div className="flex gap-2">
              <dt className="font-medium text-slate-500">Mobile</dt>
              <dd className="text-slate-700">{sp.mobileNumber}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
