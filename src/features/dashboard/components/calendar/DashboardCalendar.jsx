import { useMemo, useState } from "react";

const PERIOD_MODES = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function cloneDate(value) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function addDays(baseDate, delta) {
  const next = cloneDate(baseDate);
  next.setDate(next.getDate() + delta);
  return next;
}

function addWeeks(baseDate, delta) {
  return addDays(baseDate, delta * 7);
}

function addMonths(baseDate, delta) {
  const next = cloneDate(baseDate);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function addYears(baseDate, delta) {
  const next = cloneDate(baseDate);
  next.setFullYear(next.getFullYear() + delta);
  return next;
}

function startOfWeek(date) {
  const next = cloneDate(date);
  const day = next.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diffToMonday);
  return next;
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  const next = cloneDate(date);
  next.setDate(1);
  return next;
}

function endOfMonth(date) {
  const next = startOfMonth(date);
  next.setMonth(next.getMonth() + 1);
  next.setDate(0);
  return next;
}

function startOfYear(date) {
  const next = cloneDate(date);
  next.setMonth(0, 1);
  return next;
}

function endOfYear(date) {
  const next = startOfYear(date);
  next.setFullYear(next.getFullYear() + 1);
  next.setDate(0);
  return next;
}

function periodRange(mode, date) {
  const anchor = cloneDate(date);
  if (mode === "week") {
    return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
  }
  if (mode === "month") {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  if (mode === "year") {
    return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
  return { start: anchor, end: anchor };
}

function shiftByMode(mode, date, delta) {
  if (mode === "week") return addWeeks(date, delta);
  if (mode === "month") return addMonths(date, delta);
  if (mode === "year") return addYears(date, delta);
  return addDays(date, delta);
}

function labelForPeriod(mode, start, end) {
  if (mode === "day") {
    return {
      label: `${DAY_LABELS[start.getDay()]} ${String(start.getDate()).padStart(2, "0")}`,
      subLabel: `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`,
    };
  }
  if (mode === "week") {
    return {
      label: `${String(start.getDate()).padStart(2, "0")} ${MONTH_LABELS[start.getMonth()]} - ${String(end.getDate()).padStart(2, "0")} ${MONTH_LABELS[end.getMonth()]}`,
      subLabel: `${start.getFullYear()}`,
    };
  }
  if (mode === "month") {
    return {
      label: `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`,
      subLabel: "Full month",
    };
  }
  return {
    label: `${start.getFullYear()}`,
    subLabel: "Full year",
  };
}

function sumCountsInRange(calendarData, startDate, endDate) {
  let cursor = cloneDate(startDate);
  const end = cloneDate(endDate);
  let total = 0;
  while (cursor <= end) {
    total += Number(calendarData[toIso(cursor)] || 0);
    cursor = addDays(cursor, 1);
  }
  return total;
}

function buildPeriodItems(mode, anchorDate, calendarData, before = 8, after = 8) {
  const items = [];
  for (let offset = -before; offset <= after; offset += 1) {
    const shifted = shiftByMode(mode, anchorDate, offset);
    const { start, end } = periodRange(mode, shifted);
    const { label, subLabel } = labelForPeriod(mode, start, end);
    items.push({
      key: `${mode}-${toIso(start)}-${toIso(end)}`,
      start,
      end,
      label,
      subLabel,
      count: sumCountsInRange(calendarData, start, end),
    });
  }
  return items;
}

export function DashboardCalendar({
  calendarData = {},
  selectedDateFrom = "",
  selectedDateTo = "",
  onSelectRange,
  onClearRange,
}) {
  const [mode, setMode] = useState("day");
  const [anchorDate, setAnchorDate] = useState(() => cloneDate(new Date()));
  const [windowSize, setWindowSize] = useState(8);
  const today = cloneDate(new Date());

  const selectedRangeKey = useMemo(() => {
    const from = fromIso(selectedDateFrom);
    const to = fromIso(selectedDateTo);
    if (!from || !to) return "";
    return `${toIso(from)}-${toIso(to)}`;
  }, [selectedDateFrom, selectedDateTo]);

  const periods = useMemo(
    () => buildPeriodItems(mode, anchorDate, calendarData, windowSize, windowSize),
    [mode, anchorDate, calendarData, windowSize]
  );

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setAnchorDate(cloneDate(new Date()));
    setWindowSize(8);
  };

  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5">
          {PERIOD_MODES.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModeChange(item.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  active ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setAnchorDate((prev) => shiftByMode(mode, prev, -1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setAnchorDate(cloneDate(new Date()));
              setWindowSize(8);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setAnchorDate((prev) => shiftByMode(mode, prev, 1))}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setWindowSize((prev) => Math.min(prev + 6, 42))}
          >
            More
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => onClearRange?.()}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-2">
          {periods.map((period) => {
            const key = `${toIso(period.start)}-${toIso(period.end)}`;
            const isSelected = selectedRangeKey === key;
            const containsToday = today >= period.start && today <= period.end;
            return (
              <button
                key={period.key}
                type="button"
                onClick={() =>
                  onSelectRange?.({
                    dateFrom: toIso(period.start),
                    dateTo: toIso(period.end),
                    mode,
                  })
                }
                className={`flex min-w-[130px] flex-col items-start rounded border px-3 py-2 text-left ${
                  isSelected
                    ? "border-[#003882] bg-[#e6eef8]"
                    : containsToday
                      ? "border-sky-300 bg-sky-50 hover:bg-sky-100"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <span className="text-xs font-semibold text-slate-800">{period.label}</span>
                <span className="text-[11px] text-slate-500">{period.subLabel}</span>
                <div className="mt-1 flex w-full items-center justify-between gap-2">
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-700">
                    {period.count}
                  </span>
                  {containsToday ? (
                    <span className="inline-flex items-center rounded-full border border-sky-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                      Today
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
