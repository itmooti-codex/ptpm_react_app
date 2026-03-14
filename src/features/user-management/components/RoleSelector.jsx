export function RoleSelector({ roles = [], value = "", onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="type-label text-slate-600">Role</span>
      <select
        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">No role assigned</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.role || `Role ${role.id}`}
          </option>
        ))}
      </select>
    </label>
  );
}
