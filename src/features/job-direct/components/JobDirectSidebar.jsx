import { cx } from "../../../shared/lib/cx.js";
import { SECTION_LABELS, SECTION_ORDER } from "../constants/navigation.js";
import {
  SidebarActivitiesIcon,
  SidebarInvoiceIcon,
  SidebarJobInfoIcon,
  SidebarMaterialsIcon,
  SidebarToggleIcon,
  SidebarUploadsIcon,
} from "./icons/JobDirectIcons.jsx";

const SECTION_ICON_MAP = {
  "job-information": SidebarJobInfoIcon,
  "add-activities": SidebarActivitiesIcon,
  "add-materials": SidebarMaterialsIcon,
  uploads: SidebarUploadsIcon,
  invoice: SidebarInvoiceIcon,
};

export function JobDirectSidebar({
  activeSection,
  sidebarCollapsed,
  setSidebarCollapsed,
  onSelectSection,
  sectionOrder = SECTION_ORDER,
  sectionLabels = SECTION_LABELS,
}) {
  const resolvedSectionOrder =
    Array.isArray(sectionOrder) && sectionOrder.length > 0 ? sectionOrder : SECTION_ORDER;

  return (
    <aside
      className={cx(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      <button
        type="button"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
        onClick={() => setSidebarCollapsed((value) => !value)}
        aria-label="Toggle sidebar"
      >
        <SidebarToggleIcon className="h-6 w-6" />
      </button>

      <ul className="space-y-2">
        {resolvedSectionOrder.map((sectionId, index) => {
          const active = sectionId === activeSection;
          const Icon = SECTION_ICON_MAP[sectionId];
          return (
            <li key={sectionId}>
              <button
                type="button"
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                  active
                    ? "bg-blue-50 text-brand-primary"
                    : "text-slate-600 hover:bg-slate-50"
                )}
                onClick={() => onSelectSection(sectionId)}
              >
                <span
                  className={cx(
                    "inline-flex h-12 w-12 items-center justify-center rounded-full",
                    active ? "bg-blue-100 text-brand-secondary" : "bg-slate-100 text-slate-700"
                  )}
                >
                  {Icon ? <Icon className="h-6 w-6" /> : index + 1}
                </span>
                <span className={cx("type-subheadline-2", sidebarCollapsed && "hidden")}>
                  {sectionLabels[sectionId] || sectionId}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
