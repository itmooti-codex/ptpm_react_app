import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAnnouncements } from "../hooks/useAnnouncements.js";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile.js";
import appLogo from "../../assets/logo.webp";

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 17H9m6 0a3 3 0 01-6 0m6 0H5.5a1 1 0 01-.8-1.6L6 13.5V10a6 6 0 1112 0v3.5l1.3 1.9a1 1 0 01-.8 1.6H15z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PossumLogo() {
  return (
    <img
      src={appLogo}
      alt="Peter the Possum & Bird Man"
      className="h-6 w-6 rounded object-cover"
    />
  );
}

function notificationTypeClass(type) {
  return String(type || "").toLowerCase() === "action required"
    ? "bg-orange-100 text-orange-700"
    : "bg-sky-100 text-sky-700";
}

export function GlobalTopHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const {
    notifications,
    unreadCount,
    isNotifLoading,
    notificationError,
    markingById,
    isMarkingAll,
    markAllAsRead,
    openNotification,
  } = useAnnouncements();
  const { profile, displayName } = useCurrentUserProfile();

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const fullName =
    String(displayName || "").trim() ||
    `${String(profile?.firstName || "").trim()} ${String(profile?.lastName || "").trim()}`
      .trim() ||
    "User";
  const initials = (() => {
    const first = String(profile?.firstName || "").trim();
    const last = String(profile?.lastName || "").trim();
    if (first || last) {
      return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase().trim();
    }
    return String(fullName).slice(0, 2).toUpperCase().trim();
  })();

  const visibleNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const readMatches = onlyUnread ? !item.read : true;
      return readMatches;
    });
  }, [notifications, onlyUnread]);

  const latestVisibleNotifications = useMemo(
    () => visibleNotifications.slice(0, 10),
    [visibleNotifications]
  );

  const handleClickNotification = async (item) => {
    if (!item?.id) return;
    await openNotification(item);
  };

  const profileMenuItems = [
    { key: "profile", label: "Profile", path: "/profile" },
    { key: "settings", label: "Settings", path: "/settings" },
    { key: "logout", label: "Logout", path: "/" },
  ];

  return (
    <header className="h-11 border-b border-[#0a2f66] bg-gradient-to-r from-[#003882] to-[#0b4d9a] px-4 text-white">
      <div className="mx-auto flex h-full w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/10"
            onClick={() => navigate("/")}
            aria-label="Go to dashboard"
          >
            <PossumLogo />
            <span className="text-sm font-semibold text-white">
              Peter the Possum &amp; Bird Man
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div ref={notifRef} className="relative">
            <button
              type="button"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-white/30 text-white hover:bg-white/10"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[#ffb300] px-1 text-[10px] font-semibold text-[#1f2937]">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {isNotifOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#003882] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={markAllAsRead}
                    disabled={!unreadCount || isMarkingAll}
                  >
                    {isMarkingAll ? "Marking..." : "Mark all as read"}
                  </button>
                </div>

                <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300"
                      checked={onlyUnread}
                      onChange={(event) => setOnlyUnread(event.target.checked)}
                    />
                    Only unread
                  </label>
                </div>

                <div className="max-h-[540px] overflow-auto p-2">
                  {isNotifLoading ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      Loading notifications...
                    </div>
                  ) : notificationError ? (
                    <div className="py-8 text-center text-sm text-red-500">
                      Unable to load notifications right now.
                    </div>
                  ) : latestVisibleNotifications.length ? (
                    <ul className="space-y-1">
                      {latestVisibleNotifications.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleClickNotification(item)}
                            disabled={Boolean(markingById[item.id])}
                            className={`w-full rounded border px-3 py-2 text-left ${
                              item.read
                                ? "border-transparent bg-slate-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${notificationTypeClass(
                                  item.type
                                )}`}
                              >
                                {item.type}
                              </span>
                              <span className="text-[11px] text-slate-500">{item.timeLabel}</span>
                            </div>
                            <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                            <p className="mt-0.5 line-clamp-3 text-xs text-slate-600">
                              {item.message || "-"}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No notifications found.
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-xs font-medium text-[#003882] hover:bg-slate-50"
                    onClick={() => {
                      setIsNotifOpen(false);
                      navigate("/notifications");
                    }}
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded px-2 py-1 hover:underline hover:decoration-white/80 hover:underline-offset-2"
              onClick={() => setIsProfileOpen((prev) => !prev)}
            >
              {profile?.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={fullName}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                  {initials || "U"}
                </span>
              )}
              <span className="text-xs text-white">
                Hello, <span className="font-semibold">{fullName}</span>
              </span>
              <ChevronDownIcon className="text-white/80" />
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 min-w-[170px] rounded border border-slate-200 bg-white py-1 shadow-lg">
                {profileMenuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      location.pathname === item.path
                        ? "bg-slate-50 font-medium text-[#003882]"
                        : "text-slate-700"
                    }`}
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate(item.path);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
