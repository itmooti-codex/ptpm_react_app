import { useMemo } from "react";
import { ChevronRightIcon } from "@shared/components/icons/index.jsx";
import { PersonAvatar } from "@shared/components/ui/PersonAvatar.jsx";
import { formatRelativeTime, getAuthorName, toText } from "@shared/utils/formatters.js";

function getMemoBodyText(record = {}) {
  return (
    toText(
      record?.post_copy ||
        record?.Post_Copy ||
        record?.comment ||
        record?.Comment ||
        record?.text ||
        record?.Text ||
        record?.content ||
        record?.Content
    ) || "-"
  );
}

function getMemoId(memo = {}, index = 0) {
  return toText(memo?.id || memo?.ID) || `memo-chat-${index}`;
}

export function JobMemosPreviewPanel({
  title = "Latest Memo",
  unavailableMessage = "Memos are available when the job record is loaded.",
  hasMemoContext = false,
  isLoading = false,
  errorMessage = "",
  memos = [],
  resolveMemoAuthor,
  onOpen,
  panelClassName = "",
}) {
  const latestMemo = useMemo(() => {
    const list = Array.isArray(memos) ? memos : [];
    return list[list.length - 1] || null;
  }, [memos]);

  const latestMemoId = useMemo(() => {
    if (!latestMemo) return "";
    return getMemoId(latestMemo, Math.max(0, (Array.isArray(memos) ? memos : []).length - 1));
  }, [latestMemo, memos]);

  const latestMemoAuthor = useMemo(() => {
    if (!latestMemo) return {};
    return (
      resolveMemoAuthor?.(
        latestMemo?.Author || {},
        latestMemo?.author_id || latestMemo?.Author_ID
      ) || {}
    );
  }, [latestMemo, resolveMemoAuthor]);

  const latestMemoAuthorName = getAuthorName(latestMemoAuthor);
  const latestMemoReplies = Array.isArray(latestMemo?.ForumComments)
    ? latestMemo.ForumComments.length
    : 0;

  return (
    <section className={`flex flex-col rounded-[4px] border border-[#003882] bg-white ${panelClassName}`}>
      <div className="flex items-center gap-3 rounded-t-[4px] border-b border-[#003882] bg-[#003882] px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-white">{title}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {!hasMemoContext ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            {unavailableMessage}
          </div>
        ) : isLoading ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Loading latest memo...
          </div>
        ) : errorMessage ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        ) : !latestMemo ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            No memos yet.
          </div>
        ) : (
          <article className="rounded border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <PersonAvatar
                name={latestMemoAuthorName}
                image={toText(latestMemoAuthor?.profile_image || latestMemoAuthor?.Profile_Image)}
                className="h-7 w-7 text-[10px]"
                initialsClassName="text-[10px]"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-xs font-semibold text-slate-800">
                    {latestMemoAuthorName}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {formatRelativeTime(latestMemo?.created_at || latestMemo?.Date_Added)}
                  </div>
                  <button
                    type="button"
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    onClick={() => onOpen?.(latestMemoId)}
                    disabled={!latestMemoId}
                    aria-label="Open memo chat"
                    title="Open memo chat"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>

                <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap pr-1 text-sm leading-5 text-slate-700">
                  {getMemoBodyText(latestMemo)}
                </p>

                {latestMemoReplies > 0 ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {latestMemoReplies} {latestMemoReplies === 1 ? "reply" : "replies"}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
