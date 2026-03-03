import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { useAnnouncements } from "../../../shared/hooks/useAnnouncements.js";

function notificationTypeClass(type) {
  return String(type || "").toLowerCase() === "action required"
    ? "bg-orange-100 text-orange-700"
    : "bg-sky-100 text-sky-700";
}

export function NotificationsPage() {
  const [onlyUnread, setOnlyUnread] = useState(false);
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

  const visibleNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const readMatches = onlyUnread ? !item.read : true;
      return readMatches;
    });
  }, [notifications, onlyUnread]);

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
            <span className="text-slate-600">Notifications</span>
          </nav>

          <div className="mb-4 rounded-xl border border-[#d7e2f1] bg-gradient-to-r from-[#003882] to-[#0b4d9a] p-5 text-white shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">Notifications</div>
            <h1 className="mt-1 text-2xl font-semibold">All Announcements</h1>
            <p className="mt-1 text-sm text-white/85">Stay updated with recent announcements.</p>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300"
                    checked={onlyUnread}
                    onChange={(event) => setOnlyUnread(event.target.checked)}
                  />
                  Only unread
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-[#003882] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={markAllAsRead}
                  disabled={!unreadCount || isMarkingAll}
                >
                  {isMarkingAll ? "Marking..." : "Mark all as read"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              <span>{visibleNotifications.length} notification(s)</span>
              <span>{unreadCount} unread</span>
            </div>

            <div className="max-h-[68dvh] overflow-auto p-2">
              {isNotifLoading ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Loading notifications...
                </div>
              ) : notificationError ? (
                <div className="py-12 text-center text-sm text-red-500">
                  Unable to load notifications right now.
                </div>
              ) : visibleNotifications.length ? (
                <ul className="space-y-1">
                  {visibleNotifications.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(item)}
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
                        <p className="mt-0.5 text-xs text-slate-600">{item.message || "-"}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-12 text-center text-sm text-slate-400">
                  No notifications found.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
