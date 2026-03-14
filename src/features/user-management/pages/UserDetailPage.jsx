import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GlobalTopHeader } from "@shared/layout/GlobalTopHeader.jsx";
import { Button } from "@shared/components/ui/Button.jsx";
import { useToast } from "@shared/providers/ToastProvider.jsx";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import { useUserDetail } from "../hooks/useUserDetail.js";
import { useRoles } from "../hooks/useRoles.js";
import { useLinkedServiceProvider } from "../hooks/useLinkedServiceProvider.js";
import { UserFormFields } from "../components/UserFormFields.jsx";
import { UserDetailPanel } from "../components/UserDetailPanel.jsx";
import { ServiceProviderCard } from "../components/ServiceProviderCard.jsx";
import { createUser } from "../api/userManagementMutations.js";

function userToFormState(user) {
  if (!user) {
    return {
      first_name: "",
      last_name: "",
      email: "",
      login: "",
      password: "",
      cell_phone: "",
      telephone: "",
      role_id: "",
      language: "",
      timezone: "",
      business_name: "",
      business_address: "",
      business_city: "",
      business_state: "",
      business_country: "",
      business_zip_postal: "",
      email_from_name: "",
      reply_to_email: "",
    };
  }
  return {
    first_name: user.firstName || "",
    last_name: user.lastName || "",
    email: user.email || "",
    login: user.login || "",
    cell_phone: user.cellPhone || "",
    telephone: user.telephone || "",
    role_id: user.roleId || "",
    language: user.language || "",
    timezone: user.timezone || "",
    business_name: user.businessName || "",
    business_address: user.businessAddress || "",
    business_city: user.businessCity || "",
    business_state: user.businessState || "",
    business_country: user.businessCountry || "",
    business_zip_postal: user.businessZip || "",
    email_from_name: user.emailFromName || "",
    reply_to_email: user.replyToEmail || "",
  };
}

export function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { plugin, isReady } = useVitalStatsPlugin();

  const isCreate = !userId || userId === "new";
  const resolvedPlugin = isReady ? plugin : null;

  const { user, isLoading, isSaving, saveUser } = useUserDetail({
    plugin: resolvedPlugin,
    userId: isCreate ? null : userId,
  });
  const { roles, isLoadingRoles } = useRoles({ plugin: resolvedPlugin });
  const { serviceProvider, isLoadingSP } = useLinkedServiceProvider({
    plugin: resolvedPlugin,
    userId: isCreate ? null : userId,
  });

  const [form, setForm] = useState(() => userToFormState(null));
  const [isCreating, setIsCreating] = useState(false);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setForm(userToFormState(user));
    }
  }, [user]);

  const handleSave = async () => {
    // Build payload — strip empty strings to avoid overwriting with blanks
    const payload = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === "password" && !isCreate) continue;
      if (value !== "") {
        payload[key] = value;
      }
    }

    if (isCreate) {
      if (!payload.first_name || !payload.email) {
        showError("Validation", "First name and email are required.");
        return;
      }
      setIsCreating(true);
      try {
        const result = await createUser({ plugin, payload });
        success("User created", `User ${payload.first_name} was created successfully.`);
        navigate(`/admin/users/${result.id}`, { replace: true });
      } catch (err) {
        showError("Create failed", err?.message || "Unable to create user.");
      } finally {
        setIsCreating(false);
      }
    } else {
      try {
        await saveUser(payload);
        success("Saved", "User details were updated.");
      } catch (err) {
        showError("Save failed", err?.message || "Unable to save changes.");
      }
    }
  };

  const isBusy = isLoading || isSaving || isCreating || isLoadingRoles;
  const pageTitle = isCreate ? "Add Team Member" : (user?.fullName || "User Details");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 font-['Inter']">
      <GlobalTopHeader />

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
          <nav className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/" className="font-medium text-[#003882] hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link to="/admin/users" className="font-medium text-[#003882] hover:underline">
              Team
            </Link>
            <span>/</span>
            <span className="text-slate-600">{isCreate ? "New" : user?.fullName || userId}</span>
          </nav>

          <div className="mb-4 rounded-xl border border-[#d7e2f1] bg-gradient-to-r from-[#003882] to-[#0b4d9a] p-5 text-white shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">
              {isCreate ? "New User" : "Edit User"}
            </div>
            <h1 className="mt-1 text-2xl font-semibold">{pageTitle}</h1>
          </div>

          {isLoading && !isCreate ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
              <p className="mt-2 text-sm text-slate-500">Loading user details...</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <UserFormFields
                  form={form}
                  onChange={setForm}
                  roles={roles}
                  isCreate={isCreate}
                />

                <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border border-slate-300"
                    onClick={() => navigate("/admin/users")}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-[#003882]"
                    onClick={handleSave}
                    disabled={isBusy}
                  >
                    {isSaving || isCreating
                      ? "Saving..."
                      : isCreate
                        ? "Create User"
                        : "Save Changes"}
                  </Button>
                </div>
              </section>

              <div className="space-y-4">
                {!isCreate ? <UserDetailPanel user={user} /> : null}
                {!isCreate ? (
                  <ServiceProviderCard serviceProvider={serviceProvider} isLoading={isLoadingSP} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
