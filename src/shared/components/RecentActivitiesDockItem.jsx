import { useCallback } from "react";
import { isDeleteLikeActivityAction } from "./recentActivitiesUtils.js";
import { toText } from "../utils/formatters.js";

export function RecentActivitiesDockItem({ item }) {
  const id = toText(item?.id);
  const action = toText(item?.action) || "Activity";
  const pageName = toText(item?.page_name) || "App";
  const path = toText(item?.path);
  const stamp = Number(item?.timestamp || 0);
  const isDeleteLike = isDeleteLikeActivityAction(action);
  const canNavigate = Boolean(path) && !isDeleteLike;

  const handleClick = useCallback(() => {
    if (!path || isDeleteLike) return;
    window.open(path, "_blank", "noopener,noreferrer");
  }, [path, isDeleteLike]);

  return (
    <button
      key={id || `${action}-${stamp}`}
      type="button"
      className="w-full rounded border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-sky-300 hover:bg-sky-50"
      onClick={handleClick}
      disabled={!canNavigate}
      title={
        isDeleteLike
          ? "Deleted/cancelled records are not navigable."
          : path || "Path unavailable"
      }
    >
      <div className="truncate text-[12px] font-semibold text-slate-800">{action}</div>
      <div className="truncate text-[11px] text-[#003882]">{pageName}</div>
      <div className="truncate text-[10px] text-slate-500">{path || "Path unavailable"}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">
        {stamp ? new Date(stamp).toLocaleString() : "Just now"}
      </div>
    </button>
  );
}
