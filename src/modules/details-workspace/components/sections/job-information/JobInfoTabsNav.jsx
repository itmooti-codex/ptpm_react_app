import { JOB_INFO_TABS } from "../../../constants/navigation.js";
import {
  AppointmentsTabIcon,
  OverviewTabIcon,
} from "../../icons/WorkspaceIcons.jsx";

export function JobInfoTabsNav({
  activeTab,
  onTabChange,
  appointmentCount = 0,
}) {
  return (
    <div className="border-b border-slate-300 bg-white pt-4">
      <div className="inline-flex items-center">
        {JOB_INFO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`inline-flex items-center gap-2 px-6 py-3 ${
              activeTab === tab.id ? "border-b-2 border-sky-900 text-sky-900" : "text-neutral-700"
            }`}
            onClick={() => onTabChange(tab.id)}
            data-tab={tab.id}
          >
            {tab.id === "appointments" ? (
              <AppointmentsTabIcon className="h-4 w-4" />
            ) : (
              <OverviewTabIcon className="h-3 w-3" />
            )}
            {tab.label}
            {tab.id === "appointments" ? (
              <span className="rounded-[10px] bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {String(appointmentCount || 0).padStart(2, "0")}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
