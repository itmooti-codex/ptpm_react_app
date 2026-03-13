import { MAX_RECORDS } from "./recentActivitiesConstants.js";
import { useRecentActivities } from "./useRecentActivities.js";
import { RecentActivitiesDockItem } from "./RecentActivitiesDockItem.jsx";

export function RecentActivitiesDock() {
  const { isOpen, setIsOpen, activities, isSyncing } = useRecentActivities();

  return (
    <div className="pointer-events-none fixed bottom-6 left-0 z-[58] flex items-end">
      <button
        type="button"
        className={`pointer-events-auto mb-3 inline-flex h-10 items-center rounded-r-xl border border-l-0 border-[#003882]/35 bg-[#003882] text-white shadow-[0_8px_22px_rgba(0,56,130,0.28)] transition hover:bg-[#0A4A9E] ${
          isOpen ? "gap-2 px-2.5 text-[11px] font-semibold tracking-wide" : "w-9 justify-center px-0"
        }`}
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? "Close recent activities panel" : "Open recent activities panel"}
        title={isOpen ? "Close recent activities panel" : "Open recent activities panel"}
      >
        {isOpen ? <span className="text-[11px]">Recent Activities</span> : null}
        <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold leading-none text-white">
          {Math.min(activities.length, MAX_RECORDS)}
        </span>
      </button>

      {isOpen ? (
        <section className="pointer-events-auto ml-2 flex h-[380px] w-[280px] max-w-[84vw] flex-col overflow-hidden rounded-r-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.2)]">
          <header className="flex items-center justify-between bg-[#003882] px-3 py-2 text-white">
            <div className="text-sm font-semibold">Recent Activities</div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/30 text-white hover:bg-white/10"
              onClick={() => setIsOpen(false)}
              aria-label="Close recent activities panel"
              title="Close"
            >
              ✕
            </button>
          </header>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
            <span>Latest {MAX_RECORDS}</span>
            <span>{isSyncing ? "Syncing..." : "Ready"}</span>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50 p-2">
            {!activities.length ? (
              <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                No recent activities yet.
              </div>
            ) : (
              activities.slice(0, MAX_RECORDS).map((item) => (
                <RecentActivitiesDockItem key={item?.id || item?.timestamp} item={item} />
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
