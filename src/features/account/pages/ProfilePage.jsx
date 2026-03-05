import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useCurrentUserProfile } from "../../../shared/hooks/useCurrentUserProfile.js";
import { APP_USER } from "../../../config/userConfig.js";
import { uploadMaterialFile } from "@modules/job-workspace/public/sdk.js";

const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeStateValue(value) {
  const text = toText(value);
  if (!text) return "";
  const upper = text.toUpperCase();
  if (STATE_OPTIONS.some((option) => option.value === upper)) return upper;
  const fullNameToCode = {
    "NEW SOUTH WALES": "NSW",
    QUEENSLAND: "QLD",
    VICTORIA: "VIC",
    TASMANIA: "TAS",
    "SOUTH AUSTRALIA": "SA",
    "AUSTRALIAN CAPITAL TERRITORY": "ACT",
    "NORTHERN TERRITORY": "NT",
    "WESTERN AUSTRALIA": "WA",
  };
  return fullNameToCode[upper] || "";
}

function buildInitials(displayName, firstName, lastName) {
  const safeDisplay = toText(displayName);
  if (safeDisplay) {
    const tokens = safeDisplay.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0].slice(0, 1)}${tokens[1].slice(0, 1)}`.toUpperCase();
    }
    return safeDisplay.slice(0, 2).toUpperCase();
  }
  return `${toText(firstName).slice(0, 1)}${toText(lastName).slice(0, 1)}`
    .toUpperCase()
    .trim();
}

function createFormFromProfile(profile = {}) {
  return {
    firstName: toText(profile?.firstName),
    lastName: toText(profile?.lastName),
    displayName: toText(profile?.displayName),
    email: toText(profile?.email),
    smsNumber: toText(profile?.smsNumber),
    lotNumber: toText(profile?.lotNumber),
    unitNumber: toText(profile?.unitNumber),
    address: toText(profile?.address),
    address2: toText(profile?.address2),
    city: toText(profile?.city),
    state: normalizeStateValue(profile?.state),
    zipCode: toText(profile?.zipCode),
    bio: toText(profile?.bio),
  };
}

export function ProfilePage() {
  const fileInputRef = useRef(null);
  const localPreviewRef = useRef("");
  const { success, error: showError } = useToast();
  const {
    profile,
    displayName,
    isLoadingProfile,
    isSavingProfile,
    profileError,
    updateProfile,
    getPlugin,
  } = useCurrentUserProfile();

  const [form, setForm] = useState(createFormFromProfile(profile));
  const [avatarPreview, setAvatarPreview] = useState(toText(profile?.profileImage));
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    setForm(createFormFromProfile(profile));
    setAvatarPreview(toText(profile?.profileImage));
    setPendingAvatarFile(null);
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = "";
    }
  }, [
    profile?.firstName,
    profile?.lastName,
    profile?.displayName,
    profile?.email,
    profile?.smsNumber,
    profile?.lotNumber,
    profile?.unitNumber,
    profile?.address,
    profile?.address2,
    profile?.city,
    profile?.state,
    profile?.zipCode,
    profile?.bio,
    profile?.profileImage,
  ]);

  useEffect(
    () => () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    },
    []
  );

  const fullName = useMemo(
    () =>
      toText(form.displayName) ||
      `${toText(form.firstName)} ${toText(form.lastName)}`.trim() ||
      toText(displayName) ||
      "User",
    [form.displayName, form.firstName, form.lastName, displayName]
  );

  const initials = useMemo(
    () => buildInitials(form.displayName, form.firstName, form.lastName) || "U",
    [form.displayName, form.firstName, form.lastName]
  );

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = "";
    }
    const objectUrl = URL.createObjectURL(file);
    localPreviewRef.current = objectUrl;
    setPendingAvatarFile(file);
    setAvatarPreview(objectUrl);
    if (event?.target) event.target.value = "";
  };

  const resetToProfile = () => {
    setForm(createFormFromProfile(profile));
    setPendingAvatarFile(null);
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = "";
    }
    setAvatarPreview(toText(profile?.profileImage));
  };

  const handleSave = async () => {
    const normalizedState = normalizeStateValue(form.state);
    if (!normalizedState) {
      showError("Validation failed", "State is required.");
      return;
    }

    try {
      const payload = {
        first_name: toText(form.firstName),
        last_name: toText(form.lastName),
        display_name: toText(form.displayName),
        email: toText(form.email),
        sms_number: toText(form.smsNumber),
        Bio: toText(form.bio),
        lot_number: toText(form.lotNumber),
        unit_number: toText(form.unitNumber),
        address: toText(form.address),
        address_2: toText(form.address2),
        city: toText(form.city),
        state: normalizedState,
        zip_code: toText(form.zipCode),
      };

      if (pendingAvatarFile) {
        setIsUploadingAvatar(true);
        const plugin = await getPlugin();
        const uploaded = await uploadMaterialFile({
          file: pendingAvatarFile,
          uploadPath: `profile-images/${toText(profile?.id || APP_USER?.id) || "contact"}`,
        });
        payload.profile_image = toText(uploaded?.url || uploaded?.fileObject?.link);
      }

      await updateProfile(payload);
      success("Profile saved", "Profile details were updated.");
      setPendingAvatarFile(null);
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = "";
      }
    } catch (saveError) {
      console.error("[Profile] Save failed", saveError);
      showError("Save failed", saveError?.message || "Unable to save profile right now.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const isBusy = isLoadingProfile || isSavingProfile || isUploadingAvatar;

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
              Manage your personal and address details.
            </p>
          </div>

          {profileError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Unable to load profile details. You can still edit and save.
            </div>
          ) : null}

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
                <div className="text-sm text-slate-500">{toText(form.email) || "No email set"}</div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 border-[#003882] text-[#003882]"
                  onClick={handlePickImage}
                  disabled={isBusy}
                >
                  Change Profile Image
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">Profile Details</h2>
                {isLoadingProfile ? (
                  <span className="text-xs text-slate-500">Loading...</span>
                ) : null}
              </div>

              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Basic Details
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Display Name
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.displayName}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, displayName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        SMS Number
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.smsNumber}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, smsNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        First Name
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.firstName}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, firstName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Last Name
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.lastName}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, lastName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 md:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Email
                      </span>
                      <input
                        type="email"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.email}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, email: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Address Details
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Lot Number
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.lotNumber}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, lotNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Unit Number
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.unitNumber}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, unitNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 md:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Address
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.address}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, address: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 md:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Address 2
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.address2}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, address2: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        City
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.city}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, city: event.target.value }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        State
                      </span>
                      <select
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.state}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, state: event.target.value }))
                        }
                      >
                        <option value="">Select state</option>
                        {STATE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Zip Code
                      </span>
                      <input
                        type="text"
                        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                        value={form.zipCode}
                        onChange={(event) =>
                          setForm((previous) => ({ ...previous, zipCode: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    About
                  </h3>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Bio
                    </span>
                    <textarea
                      rows={4}
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
                      value={form.bio}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, bio: event.target.value }))
                      }
                    />
                  </label>
                </section>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-slate-300"
                  onClick={resetToProfile}
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
                  {isSavingProfile || isUploadingAvatar ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
