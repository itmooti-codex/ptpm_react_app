import { useState } from "react";
import { Link } from "react-router-dom";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#003882]" : "bg-slate-300"
      }`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SettingRow({ title, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function SettingsPage() {
  const [inquiryPush, setInquiryPush] = useState(true);
  const [taskReminder, setTaskReminder] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [compactTables, setCompactTables] = useState(false);
  const [quickPreview, setQuickPreview] = useState(true);
  const [defaultLanding, setDefaultLanding] = useState("Dashboard");
  const [dateFormat, setDateFormat] = useState("DD/MM/YY");
  const [saved, setSaved] = useState(false);

  const handleSavePreferences = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

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
              Configure notifications, behavior, and account security controls.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
                {saved ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Saved (local)
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                <SettingRow
                  title="Inquiry updates"
                  description="Receive notifications when inquiry status changes."
                  checked={inquiryPush}
                  onChange={setInquiryPush}
                />
                <SettingRow
                  title="Task reminders"
                  description="Alert before due tasks and overdue task events."
                  checked={taskReminder}
                  onChange={setTaskReminder}
                />
                <SettingRow
                  title="Payment alerts"
                  description="Notify when invoices become overdue or paid."
                  checked={paymentAlerts}
                  onChange={setPaymentAlerts}
                />
                <SettingRow
                  title="Weekly digest"
                  description="Send one summary digest every Monday morning."
                  checked={weeklyDigest}
                  onChange={setWeeklyDigest}
                />
              </div>

              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-600">
                Display Preferences
              </h3>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Default Landing Page
                  </span>
                  <select
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={defaultLanding}
                    onChange={(event) => setDefaultLanding(event.target.value)}
                  >
                    <option>Dashboard</option>
                    <option>Job Direct</option>
                    <option>Calendar</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Date Format
                  </span>
                  <select
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={dateFormat}
                    onChange={(event) => setDateFormat(event.target.value)}
                  >
                    <option>DD/MM/YY</option>
                    <option>MM/DD/YY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 space-y-2">
                <SettingRow
                  title="Compact table density"
                  description="Reduce row height and spacing in tables."
                  checked={compactTables}
                  onChange={setCompactTables}
                />
                <SettingRow
                  title="Quick preview in lists"
                  description="Enable lightweight detail preview on hover."
                  checked={quickPreview}
                  onChange={setQuickPreview}
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" className="border border-slate-300">
                  Reset Defaults
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#003882]"
                  onClick={handleSavePreferences}
                >
                  Save Preferences
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

              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-700">
                  Danger Zone
                </h3>
                <p className="mt-1 text-sm text-rose-700/90">
                  Disable account notifications temporarily or request account deactivation.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-300 text-rose-700 hover:bg-rose-100"
                  >
                    Pause Notifications
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-300 text-rose-700 hover:bg-rose-100"
                  >
                    Request Deactivation
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
