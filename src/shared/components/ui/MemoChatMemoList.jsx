import { cx } from "../../lib/cx.js";
import {
  formatRelativeTime,
  getAuthorName,
  getMemoFileMeta,
  toText,
} from "../../utils/formatters.js";
import { Button } from "./Button.jsx";
import { PersonAvatar } from "./PersonAvatar.jsx";
import { AttachmentChip, EmptyState } from "./MemoChatEmptyState.jsx";
import { getMemoBodyText } from "./memoChatUtils.js";

export function MemoChatMemoList({
  hasMemoContext,
  isLoading,
  errorMessage,
  memos,
  currentUserId,
  resolveMemoAuthor,
  sendingReplyPostId,
  memoReplyDrafts,
  onChangeReplyDraft,
  onSendReply,
  onDeleteItem,
  collapsedRepliesByMemoId,
  setCollapsedRepliesByMemoId,
  highlightMemoId,
  memoCardRefs,
  replyInputRefs,
  unavailableMessage,
  emptyMessage,
  DeleteIcon,
}) {
  if (!hasMemoContext) {
    return <EmptyState title="Memos unavailable" description={unavailableMessage} />;
  }
  if (isLoading) {
    return (
      <EmptyState
        title="Loading conversation"
        description="Fetching the latest memo thread."
      />
    );
  }
  if (errorMessage) {
    return (
      <EmptyState
        tone="error"
        title="Unable to load memos"
        description={errorMessage}
      />
    );
  }
  if (!memos.length) {
    return <EmptyState title="Start the conversation" description={emptyMessage} />;
  }

  return memos.map((memo, memoIndex) => {
    const memoId = toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`;
    const memoAuthor =
      resolveMemoAuthor?.(memo?.Author || {}, memo?.author_id || memo?.Author_ID) || {};
    const memoIsMine =
      Boolean(currentUserId) && toText(memo?.author_id || memoAuthor?.id) === currentUserId;
    const memoAuthorName = getAuthorName(memoAuthor);
    const memoFileMeta = getMemoFileMeta(memo?.file || memo?.File);
    const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
    const repliesCollapsed = Boolean(collapsedRepliesByMemoId?.[memoId]);
    const isReplySending = sendingReplyPostId === memoId;
    const replyDraftValue = String(memoReplyDrafts?.[memoId] ?? "");
    const replyDraftText = toText(memoReplyDrafts?.[memoId]);

    return (
      <div
        key={memoId}
        className={cx("flex", memoIsMine ? "justify-end" : "justify-start")}
        ref={(node) => {
          if (node) {
            memoCardRefs.current[memoId] = node;
            return;
          }
          delete memoCardRefs.current[memoId];
        }}
      >
        <article
          className={cx(
            "w-full max-w-[92%] rounded-[22px] border p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-shadow duration-200",
            memoIsMine
              ? "border-[#bfd6ff] bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]"
              : "border-white/80 bg-white/92",
            highlightMemoId === memoId
              ? "ring-2 ring-[#0A4A9E] ring-offset-2 ring-offset-[#eef3f8] shadow-[0_0_0_1px_rgba(10,74,158,0.18),0_18px_32px_rgba(10,74,158,0.18)]"
              : ""
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <PersonAvatar
                name={memoAuthorName}
                image={toText(memoAuthor?.profile_image || memoAuthor?.Profile_Image)}
                className="h-8 w-8 text-[10px] ring-1 ring-black/5"
                initialsClassName="text-[10px]"
              />
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-slate-800">
                  {memoAuthorName}
                </div>
                <div className="text-[10px] text-slate-500">
                  {formatRelativeTime(memo?.created_at || memo?.Date_Added)}
                </div>
              </div>
            </div>
            {memoIsMine && DeleteIcon ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-red-600 transition hover:bg-red-50"
                onClick={() => onDeleteItem?.({ type: "post", id: memoId })}
                title="Delete memo"
                aria-label="Delete memo"
              >
                <DeleteIcon />
              </button>
            ) : null}
          </div>

          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-slate-700">
            {getMemoBodyText(memo)}
          </p>

          <AttachmentChip meta={memoFileMeta} />

          {replies.length ? (
            <div className="mt-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:bg-slate-200/90"
                onClick={() =>
                  setCollapsedRepliesByMemoId((previous) => ({
                    ...(previous || {}),
                    [memoId]: !Boolean(previous?.[memoId]),
                  }))
                }
                aria-expanded={!repliesCollapsed}
                aria-label={repliesCollapsed ? "Expand replies" : "Collapse replies"}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#003882] shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    aria-hidden="true"
                    className={cx(
                      "transition-transform",
                      repliesCollapsed ? "-rotate-90" : "rotate-0"
                    )}
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>
                  {repliesCollapsed ? "Show" : "Hide"} {replies.length}{" "}
                  {replies.length === 1 ? "reply" : "replies"}
                </span>
              </button>

              {!repliesCollapsed ? (
                <div className="mt-2 space-y-2 border-l-2 border-slate-200/80 pl-3">
                  {replies.map((reply, replyIndex) => {
                    const replyId =
                      toText(reply?.id || reply?.ID) || `${memoId}-reply-${replyIndex}`;
                    const replyAuthor =
                      resolveMemoAuthor?.(
                        reply?.Author || {},
                        reply?.author_id || reply?.Author_ID
                      ) || {};
                    const replyIsMine =
                      Boolean(currentUserId) &&
                      toText(reply?.author_id || replyAuthor?.id) === currentUserId;
                    const replyAuthorName = getAuthorName(replyAuthor);

                    return (
                      <div
                        key={replyId}
                        className={cx(
                          "rounded-[18px] border px-2.5 py-2 shadow-sm",
                          replyIsMine
                            ? "border-[#cadeff] bg-white/85"
                            : "border-slate-200 bg-slate-50/92"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <PersonAvatar
                              name={replyAuthorName}
                              image={toText(
                                replyAuthor?.profile_image || replyAuthor?.Profile_Image
                              )}
                              className="h-6 w-6 text-[9px] ring-1 ring-black/5"
                              initialsClassName="text-[9px]"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[10px] font-semibold text-slate-700">
                                {replyAuthorName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {formatRelativeTime(reply?.created_at)}
                              </div>
                            </div>
                          </div>
                          {replyIsMine && DeleteIcon ? (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white/75 text-red-600 transition hover:bg-red-50"
                              onClick={() => onDeleteItem?.({ type: "comment", id: replyId })}
                              title="Delete reply"
                              aria-label="Delete reply"
                            >
                              <DeleteIcon />
                            </button>
                          ) : null}
                        </div>

                        <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-5 text-slate-700">
                          {getMemoBodyText(reply)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 rounded-[18px] border border-slate-200/80 bg-white/75 p-2.5 shadow-inner">
            <textarea
              ref={(node) => {
                if (node) {
                  replyInputRefs.current[memoId] = node;
                  return;
                }
                delete replyInputRefs.current[memoId];
              }}
              className="min-h-[48px] w-full resize-none bg-transparent text-[12px] leading-5 text-slate-700 outline-none placeholder:text-slate-400"
              placeholder={`Reply to ${memoAuthorName}...`}
              value={replyDraftValue}
              onChange={(event) => onChangeReplyDraft?.(memoId, event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onSendReply?.(memoId);
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">Ctrl/Cmd + Enter to send</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl !bg-[#003882] !px-3 !py-1.5 !text-[11px] !text-white hover:!bg-[#0A4A9E] disabled:!border-transparent disabled:!bg-slate-300 disabled:!text-slate-500"
                disabled={!replyDraftText || Boolean(sendingReplyPostId)}
                onClick={() => onSendReply?.(memoId)}
              >
                {isReplySending ? "Sending..." : "Reply"}
              </Button>
            </div>
          </div>
        </article>
      </div>
    );
  });
}
