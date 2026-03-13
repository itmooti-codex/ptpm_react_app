import { useEffect, useMemo, useState } from "react";
import appLogo from "../assets/logo.webp";
import { ensureVitalStatsPlugin } from "../platform/vitalstats/bootstrap.js";
import {
  clearSelectedDemoUserId,
  getConfiguredDemoUserIds,
  getCurrentUserId,
  getSelectedDemoUserId,
  setSelectedDemoUserId,
} from "../config/userConfig.js";
import { toText } from "../shared/utils/formatters.js";

function normalizeContactId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    return new Promise((resolve, reject) => {
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
          subscription?.unsubscribe?.();
        },
      });
    });
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

function getUserLabel(record = {}) {
  const displayName = toText(record?.displayName);
  if (displayName) return displayName;
  const fullName = [toText(record?.firstName), toText(record?.lastName)].filter(Boolean).join(" ");
  return fullName || `User ${toText(record?.id)}`;
}

async function fetchDemoUserContact(plugin, userId) {
  const query = plugin.switchTo("PeterpmContact").query().fromGraphql(`
    query calcContacts($id: PeterpmContactID!) {
      calcContacts(query: [{ where: { id: $id } }]) {
        Contact_ID: field(arg: ["id"])
        Unique_ID: field(arg: ["unique_id"])
        Profile_Image: field(arg: ["profile_image"])
        Display_Name: field(arg: ["display_name"])
        First_Name: field(arg: ["first_name"])
        Last_Name: field(arg: ["last_name"])
        Email: field(arg: ["email"])
        SMS_Number: field(arg: ["sms_number"])
      }
    }
  `);
  const result = await toPromiseLike(
    query.fetchDirect({ variables: { id: normalizeContactId(userId) } })
  );
  const row = extractRows(result)?.[0] || {};

  return {
    id: toText(row?.Contact_ID || userId),
    uniqueId: toText(row?.Unique_ID),
    profileImage: toText(row?.Profile_Image),
    displayName: toText(row?.Display_Name),
    firstName: toText(row?.First_Name),
    lastName: toText(row?.Last_Name),
    email: toText(row?.Email),
    smsNumber: toText(row?.SMS_Number),
  };
}

function DemoUserCard({ user, selected, onSelect }) {
  const label = getUserLabel(user);
  const initials = [toText(user?.firstName), toText(user?.lastName)]
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect?.(user)}
      className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-[#003882] bg-[#edf4ff] shadow-sm"
          : "border-slate-200 bg-white hover:border-[#9ab8e8] hover:bg-slate-50"
      }`}
    >
      {user?.profileImage ? (
        <img
          src={user.profileImage}
          alt={label}
          className="h-14 w-14 rounded-full border border-slate-200 object-cover"
        />
      ) : (
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
          {initials || "U"}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
        {user?.email ? (
          <span className="mt-1 block truncate text-xs text-slate-500">{user.email}</span>
        ) : user?.smsNumber ? (
          <span className="mt-1 block truncate text-xs text-slate-500">{user.smsNumber}</span>
        ) : null}
      </span>
      <span className="text-xs font-semibold text-[#003882]">{selected ? "Selected" : "Use"}</span>
    </button>
  );
}

export function DemoUserGate({ children }) {
  const demoUserIds = useMemo(() => getConfiguredDemoUserIds(), []);
  const isPublicQuoteRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/quote/");
  const [selectedUserId, setSelectedUserIdState] = useState(() => {
    const stored = getSelectedDemoUserId();
    return demoUserIds.includes(stored) ? stored : "";
  });
  const [demoUsers, setDemoUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadingError, setLoadingError] = useState("");

  useEffect(() => {
    if (!demoUserIds.length || isPublicQuoteRoute || selectedUserId) return;

    let isActive = true;
    setIsLoadingUsers(true);
    setLoadingError("");

    ensureVitalStatsPlugin()
      .then((plugin) =>
        Promise.allSettled(demoUserIds.map((userId) => fetchDemoUserContact(plugin, userId)))
      )
      .then((results) => {
        if (!isActive) return;

        const loadedUsers = results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((record) => toText(record?.id));

        if (!loadedUsers.length) {
          setLoadingError("Unable to load demo users.");
        }

        setDemoUsers(loadedUsers);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[DemoUserGate] Failed loading demo users", error);
        setLoadingError(error?.message || "Unable to load demo users.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingUsers(false);
      });

    return () => {
      isActive = false;
    };
  }, [demoUserIds, isPublicQuoteRoute, selectedUserId]);

  useEffect(() => {
    if (!demoUserIds.length || isPublicQuoteRoute) return;
    if (selectedUserId && !demoUserIds.includes(selectedUserId)) {
      clearSelectedDemoUserId();
      setSelectedUserIdState("");
    }
  }, [demoUserIds, isPublicQuoteRoute, selectedUserId]);

  const handleSelectUser = (user) => {
    const nextUserId = setSelectedDemoUserId(user?.id);
    setSelectedUserIdState(nextUserId);
  };

  const shouldBypassGate = !demoUserIds.length || isPublicQuoteRoute;

  if (shouldBypassGate) {
    const fallbackUserId = getCurrentUserId();
    return typeof children === "function" ? children(fallbackUserId) : children;
  }

  if (selectedUserId) {
    return typeof children === "function" ? children(selectedUserId) : children;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-[#cfe0f7] bg-white shadow-[0_24px_70px_rgba(0,56,130,0.14)]">
          <div className="border-b border-[#d9e7fb] bg-[linear-gradient(135deg,#003882_0%,#0b4d9a_100%)] px-6 py-6 text-white">
            <div className="flex items-center gap-4">
              <img
                src={appLogo}
                alt="Peter the Possum & Bird Man"
                className="h-14 w-14 rounded-2xl border border-white/20 object-cover"
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  Demo Access
                </div>
                <h1 className="mt-1 text-2xl font-semibold">Choose a demo user</h1>
                <p className="mt-1 text-sm text-white/80">
                  This browser will stay signed in as the selected contact until you switch again.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {isLoadingUsers ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
                  Loading demo users...
                </div>
              </div>
            ) : loadingError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                {loadingError}
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {demoUsers.map((user) => (
                    <DemoUserCard
                      key={user.id}
                      user={user}
                      selected={false}
                      onSelect={handleSelectUser}
                    />
                  ))}
                </div>

                {!demoUsers.length ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No demo users were loaded from `VITE_DEMO_USER_IDS`.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
