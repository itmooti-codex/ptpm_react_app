import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GlobalTopHeader } from "@shared/layout/GlobalTopHeader.jsx";
import { Button } from "@shared/components/ui/Button.jsx";
import { useToast } from "@shared/providers/ToastProvider.jsx";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import { useUserDetail } from "../hooks/useUserDetail.js";
import { useLinkedServiceProvider } from "../hooks/useLinkedServiceProvider.js";
import { useServiceProviderOptions } from "../hooks/useServiceProviderOptions.js";
import { UserFormFields } from "../components/UserFormFields.jsx";
import { UserDetailPanel } from "../components/UserDetailPanel.jsx";
import { ServiceProviderCard } from "../components/ServiceProviderCard.jsx";
import { ServiceProviderLookup } from "../components/ServiceProviderLookup.jsx";
import { createUser } from "../api/userManagementMutations.js";
import { useAuth } from "@shared/hooks/useAuth.js";

function userToFormState(user) {
  if (!user) {
    return {
      email: "", password: "", name: "", firstName: "", lastName: "",
      role: "team_member", isActive: true,
      serviceProviderId: "", contactId: "",
    };
  }
  return {
    email: user.email || "",
    name: user.name || user.displayName || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role: user.role || "team_member",
    isActive: user.isActive !== false,
    serviceProviderId: user.serviceProviderId ? String(user.serviceProviderId) : "",
    contactId: user.contactId ? String(user.contactId) : "",
    password: "",
    currentPassword: "",
  };
}

export function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { plugin, isReady } = useVitalStatsPlugin();
  const { user: authUser } = useAuth();
  const currentUserRole = authUser?.role || "";

  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdminUser = currentUserRole === "admin" || isSuperAdmin;
  const isCreate = !userId || userId === "new";

  const { user, isLoading, isSaving, saveUser } = useUserDetail({
    userId: isCreate ? null : userId,
  });

  const { serviceProvider, isLoadingSP } = useLinkedServiceProvider({
    plugin: isReady ? plugin : null,
    serviceProviderId: isCreate ? null : user?.serviceProviderId,
  });

  const { serviceProviderOptions, isLoadingOptions } = useServiceProviderOptions({
    plugin: isReady ? plugin : null,
  });

  const [form, setForm] = useState(() => userToFormState(null));
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) setForm(userToFormState(user));
  }, [user]);

  const handleSelectSP = (sp) => {
    if (!sp) {
      setForm((prev) => ({ ...prev, serviceProviderId: "", contactId: "" }));
      return;
    }
    // Pre-fill name and email from the SP's contact info
    const [spFirst, ...spLastParts] = (sp.name || "").split(" ");
    const spLast = spLastParts.join(" ");
    setForm((prev) => ({
      ...prev,
      serviceProviderId: String(sp.id),
      contactId: String(sp.contactId || ""),
      firstName: spFirst || prev.firstName,
      lastName: spLast || prev.lastName,
      name: sp.name || prev.name,
      email: sp.email || prev.email,
    }));
  };

  const handleSave = async () => {
    const payload = {};
    if (form.name) payload.name = form.name;
    if (form.firstName) payload.firstName = form.firstName;
    if (form.lastName) payload.lastName = form.lastName;
    if (form.email) payload.email = form.email;
    if (form.role) payload.role = form.role;
    payload.isActive = form.isActive;
    if (form.password) {
      payload.password = form.password;
      if (form.currentPassword) payload.currentPassword = form.currentPassword;
    }
    if (form.serviceProviderId) {
      payload.serviceProviderId = Number(form.serviceProviderId);
    } else {
      payload.serviceProviderId = null;
    }
    if (form.contactId) {
      payload.contactId = Number(form.contactId);
    } else {
      payload.contactId = null;
    }

    if (isCreate) {
      if (!form.email || !form.password) {
        showError("Validation", "Email and password are required.");
        return;
      }
      setIsCreating(true);
      try {
        const result = await createUser({ payload });
        success("User created", `${form.email} was added to the team.`);
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

  const isBusy = isLoading || isSaving || isCreating;
  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const pageTitle = isCreate ? "Add Team Member" : (displayName || "User Details");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 font-['Inter']">
      <GlobalTopHeader />
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
          <nav className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/" className="font-medium text-[#003882] hover:underline">Dashboard</Link>
            <span>/</span>
            <Link to="/admin/users" className="font-medium text-[#003882] hover:underline">Team</Link>
            <span>/</span>
            <span className="text-slate-600">{isCreate ? "New" : displayName || userId}</span>
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
                <UserFormFields form={form} onChange={setForm} isCreate={isCreate} currentUserRole={currentUserRole} />
                <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <Button variant="ghost" size="sm" className="border border-slate-300" onClick={() => navigate("/admin/users")} disabled={isBusy}>Cancel</Button>
                  <Button variant="primary" size="sm" className="bg-[#003882]" onClick={handleSave} disabled={isBusy}>
                    {isSaving || isCreating ? "Saving..." : isCreate ? "Create User" : "Save Changes"}
                  </Button>
                </div>
              </section>

              <div className="space-y-4">
                {!isCreate ? <UserDetailPanel user={user} currentUserRole={currentUserRole} /> : null}
                {isSuperAdmin ? (
                  <ServiceProviderLookup
                    options={serviceProviderOptions}
                    isLoading={isLoadingOptions}
                    selectedId={form.serviceProviderId}
                    onSelect={handleSelectSP}
                  />
                ) : null}
                {isSuperAdmin && form.serviceProviderId && !isCreate ? (
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
