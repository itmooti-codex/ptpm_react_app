import { useCallback, useEffect, useMemo, useState } from "react";
import { toText } from "@shared/utils/formatters.js";

export function useRenderWindow(rows, { threshold = 160, pageSize = 120 } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalCount = safeRows.length;
  const shouldWindow = totalCount > threshold;
  const [visibleCount, setVisibleCount] = useState(() =>
    shouldWindow ? Math.min(pageSize, totalCount) : totalCount
  );

  useEffect(() => {
    if (!shouldWindow) {
      setVisibleCount(totalCount);
      return;
    }
    setVisibleCount((previous) => {
      const minVisible = Math.min(pageSize, totalCount);
      if (previous < minVisible) return minVisible;
      if (previous > totalCount) return totalCount;
      return previous;
    });
  }, [pageSize, shouldWindow, totalCount]);

  const visibleRows = useMemo(
    () => (shouldWindow ? safeRows.slice(0, visibleCount) : safeRows),
    [safeRows, shouldWindow, visibleCount]
  );

  const hasMore = shouldWindow && visibleCount < totalCount;
  const remainingCount = hasMore ? totalCount - visibleCount : 0;
  const showMore = useCallback(() => {
    if (!shouldWindow) return;
    setVisibleCount((previous) => Math.min(totalCount, previous + pageSize));
  }, [pageSize, shouldWindow, totalCount]);

  return {
    hasMore,
    remainingCount,
    shouldWindow,
    showMore,
    totalCount,
    visibleCount,
    visibleRows,
  };
}

export function resolveStatusStyle(value, options = []) {
  const normalized = toText(value).toLowerCase();
  if (!normalized || !Array.isArray(options)) return null;
  const match = options.find(
    (option) => toText(option?.value).toLowerCase() === normalized
  );
  if (!match) return null;
  return {
    color: match.color,
    backgroundColor: match.backgroundColor,
    borderColor: match.color,
  };
}

export function JobDirectTable({
  minWidthClass = "min-w-[920px]",
  className = "",
  children,
}) {
  const tableClassName = `w-full ${minWidthClass} text-left text-sm text-slate-600 ${className}`.trim();
  return (
    <div className="w-full overflow-x-auto">
      <table className={tableClassName}>{children}</table>
    </div>
  );
}

export function JobDirectEmptyTableRow({ colSpan, message }) {
  return (
    <tr>
      <td className="px-2 py-3 text-slate-400" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

export function JobDirectStatusBadge({ label, style, className = "" }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${className}`.trim()}
      style={style || undefined}
    >
      {toText(label) || "-"}
    </span>
  );
}

export function JobDirectIconActionButton({
  variant = "neutral",
  className = "",
  ...props
}) {
  const variantClass =
    variant === "danger"
      ? "text-rose-600 hover:border-rose-300 hover:text-rose-700"
      : variant === "success"
        ? "text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
        : "text-slate-600 hover:border-slate-400 hover:text-slate-800";

  return (
    <button
      type="button"
      className={`inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white ${variantClass} disabled:cursor-not-allowed disabled:opacity-40 ${className}`.trim()}
      {...props}
    />
  );
}
