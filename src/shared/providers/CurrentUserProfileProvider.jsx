import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_USER } from "../../config/userConfig.js";
import { ensureVitalStatsPlugin } from "@platform/vitalstats/bootstrap.js";
import { toText } from "../utils/formatters.js";

export const CurrentUserProfileContext = createContext(null);

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function normalizeBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return text === "true" || text === "1" || text === "yes";
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(result);
}

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const firstArray = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const firstArray = Object.values(payload.payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  return [];
}

function readField(record, keys = []) {
  if (!record) return "";
  for (const key of keys) {
    if (record?.[key] != null) return record[key];
    if (record?.data?.[key] != null) return record.data[key];
    if (record?._data?.[key] != null) return record._data[key];
  }
  return "";
}

function normalizeProfileRecord(record) {
  return {
    id: toText(readField(record, ["id", "ID", "Contact_ID"])),
    firstName: toText(readField(record, ["First_Name", "first_name", "FirstName"])),
    lastName: toText(readField(record, ["Last_Name", "last_name", "LastName"])),
    email: toText(readField(record, ["Email", "email"])),
    smsNumber: toText(readField(record, ["SMS_Number", "sms_number", "Sms_Number"])),
    profileImage: toText(readField(record, ["Profile_Image", "profile_image", "ProfileImage"])),
    displayName: toText(readField(record, ["Display_Name", "display_name", "DisplayName"])),
    bio: toText(readField(record, ["Bio", "bio"])),
    lotNumber: toText(readField(record, ["Lot_Number", "lot_number"])),
    unitNumber: toText(readField(record, ["Unit_Number", "unit_number"])),
    address: toText(readField(record, ["Address", "address"])),
    address2: toText(readField(record, ["Address_2", "address_2"])),
    city: toText(readField(record, ["City", "city"])),
    state: toText(readField(record, ["State", "state"])),
    zipCode: toText(readField(record, ["Zip_Code", "zip_code", "postal_code"])),
    pauseAllNotification: normalizeBoolean(
      readField(record, ["Pause_All_Notification", "pause_all_notification"])
    ),
    quotesJobs: normalizeBoolean(readField(record, ["Quotes_Jobs", "quotes_jobs"]), true),
    inquiries: normalizeBoolean(readField(record, ["Inquiries", "inquiries"]), true),
    memosComments: normalizeBoolean(
      readField(record, ["Memos_Comments", "memos_comments"]),
      true
    ),
    extras: normalizeBoolean(readField(record, ["Extras", "extras"]), true),
    approvalByAdmin: normalizeBoolean(
      readField(record, ["Approval_By_Admin", "approval_by_admin"])
    ),
  };
}

function getDisplayName(profile) {
  const display = toText(profile?.displayName);
  if (display) return display;
  return `${toText(profile?.firstName)} ${toText(profile?.lastName)}`.trim();
}

export function CurrentUserProfileProvider({ children }) {
  const [profile, setProfile] = useState({
    id: toText(APP_USER?.id),
    firstName: "",
    lastName: "",
    email: "",
    smsNumber: "",
    profileImage: "",
    displayName: "",
    bio: "",
    lotNumber: "",
    unitNumber: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    pauseAllNotification: false,
    quotesJobs: true,
    inquiries: true,
    memosComments: true,
    extras: true,
    approvalByAdmin: false,
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const pluginRef = useRef(null);

  const getPlugin = useCallback(async () => {
    const existing =
      pluginRef.current ||
      window.getVitalStatsPlugin?.() ||
      window.__ptpmVitalStatsPlugin ||
      window.tempPlugin ||
      window.plugin ||
      null;
    if (existing) {
      pluginRef.current = existing;
      return existing;
    }
    const initialized = await ensureVitalStatsPlugin();
    pluginRef.current = initialized;
    return initialized;
  }, []);

  const fetchProfile = useCallback(async () => {
    const contactId = normalizeId(APP_USER?.id);
    if (!contactId) return null;

    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const plugin = await getPlugin();
      const query = plugin.switchTo("PeterpmContact").query().fromGraphql(`
        query calcContacts($id: PeterpmContactID!) {
          calcContacts(query: [{ where: { id: $id } }]) {
            id: field(arg: ["id"])
            First_Name: field(arg: ["first_name"])
            Last_Name: field(arg: ["last_name"])
            Email: field(arg: ["email"])
            SMS_Number: field(arg: ["sms_number"])
            Profile_Image: field(arg: ["profile_image"])
            Display_Name: field(arg: ["display_name"])
            Bio: field(arg: ["Bio"])
            Lot_Number: field(arg: ["lot_number"])
            Unit_Number: field(arg: ["unit_number"])
            Address: field(arg: ["address"])
            Address_2: field(arg: ["address_2"])
            City: field(arg: ["city"])
            State: field(arg: ["state"])
            Zip_Code: field(arg: ["zip_code"])
            Pause_All_Notification: field(arg: ["Pause_All_Notification"])
            Quotes_Jobs: field(arg: ["Quotes_Jobs"])
            Inquiries: field(arg: ["Inquiries"])
            Memos_Comments: field(arg: ["Memos_Comments"])
            Extras: field(arg: ["Extras"])
            Approval_By_Admin: field(arg: ["Approval_By_Admin"])
          }
        }
      `);
      const result = await toPromiseLike(query.fetchDirect({ variables: { id: contactId } }));
      const row = extractRows(result)?.[0] || null;
      const normalized = row ? normalizeProfileRecord(row) : null;
      if (normalized) {
        setProfile((previous) => ({
          ...previous,
          ...normalized,
          id: normalized.id || previous.id || toText(APP_USER?.id),
        }));
      }
      return normalized;
    } catch (error) {
      console.error("[Profile] Failed to fetch current user profile", error);
      setProfileError(error);
      return null;
    } finally {
      setIsLoadingProfile(false);
    }
  }, [getPlugin]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (patch = {}) => {
      const contactId = normalizeId(APP_USER?.id);
      if (!contactId) throw new Error("Current user ID is missing.");
      const payload = patch && typeof patch === "object" ? patch : {};
      if (!Object.keys(payload).length) return profile;

      setIsSavingProfile(true);
      setProfileError(null);
      try {
        const plugin = await getPlugin();
        const model = plugin.switchTo("PeterpmContact");
        const mutation = await model.mutation();
        mutation.update((query) => query.where("id", contactId).set(payload));
        const result = await toPromiseLike(mutation.execute(true));
        if (!result || result?.isCancelling) {
          throw new Error("Profile update was cancelled.");
        }

        const next = {
          ...profile,
          ...(payload.first_name != null ? { firstName: toText(payload.first_name) } : {}),
          ...(payload.last_name != null ? { lastName: toText(payload.last_name) } : {}),
          ...(payload.email != null ? { email: toText(payload.email) } : {}),
          ...(payload.sms_number != null ? { smsNumber: toText(payload.sms_number) } : {}),
          ...(payload.profile_image != null ? { profileImage: toText(payload.profile_image) } : {}),
          ...(payload.display_name != null ? { displayName: toText(payload.display_name) } : {}),
          ...(payload.Bio != null ? { bio: toText(payload.Bio) } : {}),
          ...(payload.lot_number != null ? { lotNumber: toText(payload.lot_number) } : {}),
          ...(payload.unit_number != null ? { unitNumber: toText(payload.unit_number) } : {}),
          ...(payload.address != null ? { address: toText(payload.address) } : {}),
          ...(payload.address_2 != null ? { address2: toText(payload.address_2) } : {}),
          ...(payload.city != null ? { city: toText(payload.city) } : {}),
          ...(payload.state != null ? { state: toText(payload.state) } : {}),
          ...(payload.zip_code != null ? { zipCode: toText(payload.zip_code) } : {}),
          ...(payload.Pause_All_Notification != null
            ? { pauseAllNotification: normalizeBoolean(payload.Pause_All_Notification) }
            : {}),
          ...(payload.Quotes_Jobs != null
            ? { quotesJobs: normalizeBoolean(payload.Quotes_Jobs, true) }
            : {}),
          ...(payload.Inquiries != null
            ? { inquiries: normalizeBoolean(payload.Inquiries, true) }
            : {}),
          ...(payload.Memos_Comments != null
            ? { memosComments: normalizeBoolean(payload.Memos_Comments, true) }
            : {}),
          ...(payload.Extras != null
            ? { extras: normalizeBoolean(payload.Extras, true) }
            : {}),
          ...(payload.Approval_By_Admin != null
            ? { approvalByAdmin: normalizeBoolean(payload.Approval_By_Admin) }
            : {}),
        };
        setProfile(next);
        return next;
      } catch (error) {
        console.error("[Profile] Failed to update current user profile", error);
        setProfileError(error);
        throw error;
      } finally {
        setIsSavingProfile(false);
      }
    },
    [getPlugin, profile]
  );

  const value = useMemo(
    () => ({
      profile,
      displayName: getDisplayName(profile),
      isLoadingProfile,
      isSavingProfile,
      profileError,
      refreshProfile: fetchProfile,
      updateProfile,
      getPlugin,
    }),
    [profile, isLoadingProfile, isSavingProfile, profileError, fetchProfile, updateProfile, getPlugin]
  );

  return (
    <CurrentUserProfileContext.Provider value={value}>
      {children}
    </CurrentUserProfileContext.Provider>
  );
}
