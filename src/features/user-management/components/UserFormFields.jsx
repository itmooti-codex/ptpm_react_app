import { InputField } from "@shared/components/ui/InputField.jsx";
import { SelectField } from "@shared/components/ui/SelectField.jsx";
import { ADMIN_ROLE_OPTIONS } from "../constants/userManagementConstants.js";

export function UserFormFields({ form, onChange, isCreate = false, currentUserRole = "" }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdmin = currentUserRole === "admin" || isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-700">Personal Information</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="First Name" value={form.firstName || ""} onChange={set("firstName")} />
          <InputField label="Last Name" value={form.lastName || ""} onChange={set("lastName")} />
          <InputField label="Display Name" value={form.name || ""} onChange={set("name")} />
        </div>
      </fieldset>

      {/* Account Settings — admin-only fields */}
      {isAdmin ? (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-700">Account Settings</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField label="Email" type="email" value={form.email || ""} onChange={set("email")} />
            {isCreate ? (
              <InputField label="Password" type="password" value={form.password || ""} onChange={set("password")} />
            ) : null}
            {isSuperAdmin ? (
              <SelectField label="Role" value={form.role || ""} onChange={set("role")} options={ADMIN_ROLE_OPTIONS} />
            ) : null}
            {isSuperAdmin ? (
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={form.isActive !== false}
                    onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {/* Change Password */}
      {!isCreate ? (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-slate-700">Change Password</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {!isSuperAdmin ? (
              <InputField
                label="Current Password"
                type="password"
                value={form.currentPassword || ""}
                onChange={set("currentPassword")}
                placeholder="Enter current password"
              />
            ) : null}
            <InputField
              label="New Password"
              type="password"
              value={form.password || ""}
              onChange={set("password")}
              placeholder="Leave blank to keep current"
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
