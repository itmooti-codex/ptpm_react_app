import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { APP_USER } from "../../../config/userConfig.js";

function buildInitials(firstName, lastName) {
  return `${String(firstName || "").slice(0, 1)}${String(lastName || "").slice(0, 1)}`
    .toUpperCase()
    .trim();
}

export function ProfilePage() {
  const fileInputRef = useRef(null);
  const [firstName, setFirstName] = useState(APP_USER.firstName || "");
  const [lastName, setLastName] = useState(APP_USER.lastName || "");
  const [email, setEmail] = useState("andrew.test@possumman.com.au");
  const [phone, setPhone] = useState("+61 420 908 066");
  const [bio, setBio] = useState(
    "Operations and scheduling lead focused on smooth inquiry-to-job handover."
  );
  const [avatarPreview, setAvatarPreview] = useState(APP_USER.profileImage || "");
  const [publicProfile, setPublicProfile] = useState(true);
  const [showContactEmail, setShowContactEmail] = useState(false);
  const [showSavedHint, setShowSavedHint] = useState(false);

  const fullName = useMemo(
    () => `${firstName} ${lastName}`.trim() || "Unnamed User",
    [firstName, lastName]
  );

  const initials = useMemo(() => buildInitials(firstName, lastName) || "U", [firstName, lastName]);

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
  };

  const handleSave = () => {
    setShowSavedHint(true);
    setTimeout(() => setShowSavedHint(false), 1800);
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
            <span className="text-slate-600">Profile</span>
          </nav>

          <div className="mb-4 rounded-xl border border-[#d7e2f1] bg-gradient-to-r from-[#003882] to-[#0b4d9a] p-5 text-white shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">Profile</div>
            <h1 className="mt-1 text-2xl font-semibold">Your Account Profile</h1>
            <p className="mt-1 text-sm text-white/85">
              Manage your personal details and profile presentation.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col items-center text-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={fullName}
                    className="h-28 w-28 rounded-full object-cover ring-4 ring-[#dce8f8]"
                  />
                ) : (
                  <div className="inline-flex h-28 w-28 items-center justify-center rounded-full bg-[#e8f0fb] text-3xl font-semibold text-[#003882]">
                    {initials}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />

                <div className="mt-3 text-lg font-semibold text-slate-800">{fullName}</div>
                <div className="text-sm text-slate-500">{email || "No email set"}</div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 border-[#003882] text-[#003882]"
                  onClick={handlePickImage}
                >
                  Change Profile Image
                </Button>
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                <label className="flex items-center justify-between text-sm text-slate-700">
                  <span>Public profile card</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={publicProfile}
                    onChange={(event) => setPublicProfile(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-slate-700">
                  <span>Show contact email</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={showContactEmail}
                    onChange={(event) => setShowContactEmail(event.target.checked)}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Basic Details</h2>
                {showSavedHint ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Saved (local)
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    First Name
                  </span>
                  <input
                    type="text"
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last Name
                  </span>
                  <input
                    type="text"
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </span>
                  <input
                    type="email"
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Mobile
                  </span>
                  <input
                    type="text"
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Time Zone
                  </span>
                  <select className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none">
                    <option>Australia/Melbourne</option>
                    <option>Australia/Sydney</option>
                    <option>Australia/Brisbane</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Bio
                  </span>
                  <textarea
                    rows={4}
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" className="border border-slate-300">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" className="bg-[#003882]" onClick={handleSave}>
                  Save Profile
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
