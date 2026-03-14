import { InputField } from "@shared/components/ui/InputField.jsx";
import { SelectField } from "@shared/components/ui/SelectField.jsx";
import { LANGUAGE_OPTIONS } from "../constants/userManagementConstants.js";

export function UserFormFields({ form, onChange, roles = [], isCreate = false }) {
  const set = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.role || `Role ${r.id}` }));

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-700">Personal Information</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="First Name" value={form.first_name || ""} onChange={set("first_name")} />
          <InputField label="Last Name" value={form.last_name || ""} onChange={set("last_name")} />
          <InputField label="Email" type="email" value={form.email || ""} onChange={set("email")} />
          <InputField label="Cell Phone" value={form.cell_phone || ""} onChange={set("cell_phone")} />
          <InputField label="Telephone" value={form.telephone || ""} onChange={set("telephone")} />
        </div>
      </fieldset>

      {/* Account Settings */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-700">Account Settings</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="Login" value={form.login || ""} onChange={set("login")} />
          {isCreate ? (
            <InputField label="Password" type="password" value={form.password || ""} onChange={set("password")} />
          ) : null}
          <SelectField label="Role" value={form.role_id || ""} onChange={set("role_id")} options={roleOptions} />
          <SelectField
            label="Language"
            value={form.language || ""}
            onChange={set("language")}
            options={LANGUAGE_OPTIONS}
          />
          <InputField label="Timezone" value={form.timezone || ""} onChange={set("timezone")} />
        </div>
      </fieldset>

      {/* Business Information */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-700">Business Information</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="Business Name" value={form.business_name || ""} onChange={set("business_name")} />
          <InputField label="Address" value={form.business_address || ""} onChange={set("business_address")} />
          <InputField label="City" value={form.business_city || ""} onChange={set("business_city")} />
          <InputField label="State" value={form.business_state || ""} onChange={set("business_state")} />
          <InputField label="Country" value={form.business_country || ""} onChange={set("business_country")} />
          <InputField label="Zip / Postal" value={form.business_zip_postal || ""} onChange={set("business_zip_postal")} />
        </div>
      </fieldset>

      {/* Email Settings */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-700">Email Settings</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField label="Email From Name" value={form.email_from_name || ""} onChange={set("email_from_name")} />
          <InputField label="Reply-To Email" type="email" value={form.reply_to_email || ""} onChange={set("reply_to_email")} />
        </div>
      </fieldset>
    </div>
  );
}
