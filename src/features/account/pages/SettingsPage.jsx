import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useCurrentUserProfile } from "../../../shared/hooks/useCurrentUserProfile.js";

function normalizeBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  return text === "true" || text === "1" || text === "yes";
}

function createDefaultSettings() {
  return {
    pauseAllNotification: true,
    quotesJobs: true,
    inquiries: true,
    memosComments: true,
    extras: true,
  };
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#003882]" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      aria-pressed={checked}
      disabled={disabled}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SettingRow({ title, description, checked, onChange, disabled = false }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div>
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function SettingsPage() {
  const { success, error: showError } = useToast();
  const { profile, isLoadingProfile, isSavingProfile, updateProfile } = useCurrentUserProfile();
  const [settings, setSettings] = useState(createDefaultSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings({
      pauseAllNotification: normalizeBoolean(profile?.pauseAllNotification),
      quotesJobs: normalizeBoolean(profile?.quotesJobs, true),
      inquiries: normalizeBoolean(profile?.inquiries, true),
      memosComments: normalizeBoolean(profile?.memosComments, true),
      extras: normalizeBoolean(profile?.extras, true),
    });
  }, [
    profile?.pauseAllNotification,
    profile?.quotesJobs,
    profile?.inquiries,
    profile?.memosComments,
    profile?.extras,
  ]);

  const setSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: Boolean(value),
    }));
  };

  const handleSavePreferences = async () => {
    try {
      await updateProfile({
        Pause_All_Notification: Boolean(settings.pauseAllNotification),
        Quotes_Jobs: Boolean(settings.quotesJobs),
        Inquiries: Boolean(settings.inquiries),
        Memos_Comments: Boolean(settings.memosComments),
        Extras: Boolean(settings.extras),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      success("Settings saved", "Notification preferences were updated.");
    } catch (saveError) {
      showError("Save failed", saveError?.message || "Unable to save settings.");
    }
  };

  const handleResetDefaults = async () => {
    const defaults = createDefaultSettings();
    setSettings(defaults);
    try {
      await updateProfile({
        Pause_All_Notification: true,
        Quotes_Jobs: true,
        Inquiries: true,
        Memos_Comments: true,
        Extras: true,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      success("Defaults restored", "All notification settings were reset to true.");
    } catch (saveError) {
      showError("Reset failed", saveError?.message || "Unable to reset settings.");
    }
  };

  const pauseEnabled = Boolean(settings.pauseAllNotification);
  const isBusy = isLoadingProfile || isSavingProfile;

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
            <span className="text-slate-600">Settings</span>
          </nav>

          <div className="mb-4 rounded-xl border border-[#d7e2f1] bg-gradient-to-r from-[#003882] to-[#0b4d9a] p-5 text-white shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">Settings</div>
            <h1 className="mt-1 text-2xl font-semibold">Workspace Preferences</h1>
            <p className="mt-1 text-sm text-white/85">
              Configure which announcement groups should be visible.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Announcement Preferences</h2>
                {saved ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Saved
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                <SettingRow
                  title="Pause all notifications"
                  description="Stops notification fetching entirely."
                  checked={settings.pauseAllNotification}
                  onChange={(value) => setSetting("pauseAllNotification", value)}
                  disabled={isBusy}
                />
                <SettingRow
                  title="Quotes / Jobs"
                  description='Show announcements with type "Quote/Job".'
                  checked={settings.quotesJobs}
                  onChange={(value) => setSetting("quotesJobs", value)}
                  disabled={isBusy || pauseEnabled}
                />
                <SettingRow
                  title="Inquiries"
                  description='Show announcements with type "Inquiry".'
                  checked={settings.inquiries}
                  onChange={(value) => setSetting("inquiries", value)}
                  disabled={isBusy || pauseEnabled}
                />
                <SettingRow
                  title="Memos / Comments"
                  description='Show announcements with type "Post" and "Comment".'
                  checked={settings.memosComments}
                  onChange={(value) => setSetting("memosComments", value)}
                  disabled={isBusy || pauseEnabled}
                />
                <SettingRow
                  title="Extras"
                  description="Show all other announcement types (activities, appointments, uploads, materials, tasks, etc.)."
                  checked={settings.extras}
                  onChange={(value) => setSetting("extras", value)}
                  disabled={isBusy || pauseEnabled}
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-slate-300"
                  onClick={handleResetDefaults}
                  disabled={isBusy}
                >
                  Reset Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#003882]"
                  onClick={handleSavePreferences}
                  disabled={isBusy}
                >
                  {isSavingProfile ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">Password &amp; Security</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update credentials and strengthen account security.
                </p>
                <div className="mt-4 space-y-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Current Password
                    </span>
                    <input
                      type="password"
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                      placeholder="Enter current password"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      New Password
                    </span>
                    <input
                      type="password"
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                      placeholder="Enter new password"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Confirm Password
                    </span>
                    <input
                      type="password"
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                      placeholder="Re-enter new password"
                    />
                  </label>
                </div>
                <Button variant="secondary" size="sm" className="mt-4 border-[#003882] text-[#003882]">
                  Update Password
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
