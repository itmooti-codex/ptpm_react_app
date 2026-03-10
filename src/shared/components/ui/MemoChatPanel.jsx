import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx.js";
import {
  formatFileSize,
  formatRelativeTime,
  getAuthorName,
  getMemoFileMeta,
  toText,
} from "../../utils/formatters.js";
import { Button } from "./Button.jsx";
import { PersonAvatar } from "./PersonAvatar.jsx";

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

function getMemoActivityKey(memos = []) {
  const list = Array.isArray(memos) ? memos : [];
  const lastMemo = list[list.length - 1] || null;
  const replies = Array.isArray(lastMemo?.ForumComments) ? lastMemo.ForumComments : [];
  const lastReply = replies[replies.length - 1] || null;
  return [
    list.length,
    toText(lastMemo?.id || lastMemo?.ID),
    replies.length,
    toText(lastReply?.id || lastReply?.ID),
  ].join(":");
}

function EmptyState({ title, description, tone = "neutral" }) {
  const toneClassName =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white/85 text-slate-600";

  return (
    <div className={cx("rounded-[22px] border px-4 py-4 shadow-sm backdrop-blur", toneClassName)}>
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
            tone === "error"
              ? "border-red-200 bg-white text-red-500"
              : "border-slate-200 bg-slate-50 text-[#003882]"
          )}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M5.5 8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 16 16H9l-3.5 2v-2A2.5 2.5 0 0 1 3 13.5v-5A2.5 2.5 0 0 1 5.5 8.5Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M7.75 9.75h8.5M7.75 12.25h5.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-xs leading-5">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({ meta }) {
  if (!meta?.link) return null;

  return (
    <a
      href={meta.link}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#003882] shadow-sm transition hover:bg-white"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
        <path
          d="M8.25 12.75 13.8 7.2a2.8 2.8 0 1 1 3.96 3.96l-7.25 7.25a4.2 4.2 0 0 1-5.94-5.94l7.25-7.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="max-w-[220px] truncate">
        {meta.name || "View attachment"}
        {meta.size ? ` (${formatFileSize(meta.size)})` : ""}
      </span>
    </a>
  );
}

export function MemoChatPanel({
  title = "Memos",
  contextDescription = "",
  hasMemoContext,
  isLoading,
  errorMessage,
  memos = [],
  currentUserId = "",
  resolveMemoAuthor,
  sendingReplyPostId = "",
  memoReplyDrafts = {},
  onChangeReplyDraft,
  onSendReply,
  onDeleteItem,
  memoText = "",
  onMemoTextChange,
  isPostingMemo,
  onSendMemo,
  memoFile = null,
  memoFileInputRef,
  onMemoFileChange,
  onAttachClick,
  onClearMemoFile,
  onClose,
  unavailableMessage = "Memos are unavailable here.",
  emptyMessage = "No memos yet.",
  DeleteIcon,
}) {
  const scrollRef = useRef(null);
  const [collapsedRepliesByMemoId, setCollapsedRepliesByMemoId] = useState({});
  const totalReplies = useMemo(
    () =>
      (Array.isArray(memos) ? memos : []).reduce((count, memo) => {
        const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
        return count + replies.length;
      }, 0),
    [memos]
  );
  const activityKey = useMemo(() => getMemoActivityKey(memos), [memos]);
  const hasScrolledRef = useRef(false);
  const normalizedMemoText = toText(memoText);

  useEffect(() => {
    if (!hasMemoContext || !scrollRef.current) return;
    const viewport = scrollRef.current;
    const behavior = hasScrolledRef.current ? "smooth" : "auto";
    hasScrolledRef.current = true;
    requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  }, [activityKey, hasMemoContext]);

  useEffect(() => {
    setCollapsedRepliesByMemoId((previous) => {
      const next = {};
      (Array.isArray(memos) ? memos : []).forEach((memo, memoIndex) => {
        const memoId = toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`;
        if (previous?.[memoId]) next[memoId] = true;
      });
      return next;
    });
  }, [memos]);

  const headerMeta = !hasMemoContext
    ? contextDescription || unavailableMessage
    : `${memos.length} ${memos.length === 1 ? "memo" : "memos"}${
        totalReplies ? ` • ${totalReplies} ${totalReplies === 1 ? "reply" : "replies"}` : ""
      }`;

  return (
    <section className="pointer-events-auto flex w-[430px] max-w-[94vw] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <header className="relative overflow-hidden border-b border-[#1b4f99] bg-[linear-gradient(135deg,#003882_0%,#0a4a9e_72%,#4d86cf_100%)] px-4 py-3.5 text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/20">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                <path
                  d="M20 6.5v7A3.5 3.5 0 0 1 16.5 17H9l-4 3v-3A3.5 3.5 0 0 1 1.5 13.5v-7A3.5 3.5 0 0 1 5 3h11.5A3.5 3.5 0 0 1 20 6.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.5 8.5h8M6.5 11.5h6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-[0.01em]">{title}</div>
              <div className="truncate text-[11px] text-white/80">{headerMeta}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMemoContext ? (
              <span className="rounded-full bg-white/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                Thread
              </span>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/16"
              onClick={onClose}
              aria-label="Close memos chat"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-[320px] max-h-[56vh] space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,#eef4ff_0%,rgba(238,244,255,0)_38%),linear-gradient(180deg,#f7f9fc_0%,#eef3f8_100%)] px-3 py-3.5 sm:min-h-[380px]"
      >
        {!hasMemoContext ? (
          <EmptyState title="Memos unavailable" description={unavailableMessage} />
        ) : isLoading ? (
          <EmptyState
            title="Loading conversation"
            description="Fetching the latest memo thread."
          />
        ) : errorMessage ? (
          <EmptyState
            tone="error"
            title="Unable to load memos"
            description={errorMessage}
          />
        ) : !memos.length ? (
          <EmptyState title="Start the conversation" description={emptyMessage} />
        ) : (
          memos.map((memo, memoIndex) => {
            const memoId = toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`;
            const memoAuthor = resolveMemoAuthor?.(
              memo?.Author || {},
              memo?.author_id || memo?.Author_ID
            ) || {};
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
              >
                <article
                  className={cx(
                    "w-full max-w-[92%] rounded-[22px] border p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
                    memoIsMine
                      ? "border-[#bfd6ff] bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)]"
                      : "border-white/80 bg-white/92"
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
                            const replyAuthor = resolveMemoAuthor?.(
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
          })
        )}
      </div>

      <footer className="border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur">
        <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <textarea
            className="min-h-[74px] w-full resize-none bg-transparent text-[13px] leading-5 text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Write a memo..."
            value={memoText}
            onChange={(event) => onMemoTextChange?.(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onSendMemo?.();
              }
            }}
            disabled={!hasMemoContext || isPostingMemo}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl !border-slate-200 !bg-white !px-3 !py-1.5 !text-[11px] !text-slate-700"
                onClick={onAttachClick}
                disabled={!hasMemoContext || isPostingMemo}
              >
                Attach file
              </Button>
              <input
                ref={memoFileInputRef}
                type="file"
                className="hidden"
                onChange={onMemoFileChange}
              />
              {memoFile ? (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                    <path
                      d="M8.25 12.75 13.8 7.2a2.8 2.8 0 1 1 3.96 3.96l-7.25 7.25a4.2 4.2 0 0 1-5.94-5.94l7.25-7.25"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="max-w-[180px] truncate">{memoFile.name}</span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                    onClick={onClearMemoFile}
                    aria-label="Remove attachment"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400">Ctrl/Cmd + Enter to send</span>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl !bg-[#003882] !px-3.5 !py-2 !text-[11px] !text-white hover:!bg-[#0A4A9E] disabled:!border-transparent disabled:!bg-slate-300 disabled:!text-slate-500"
              onClick={onSendMemo}
              disabled={!hasMemoContext || isPostingMemo || (!normalizedMemoText && !memoFile)}
            >
              {isPostingMemo ? "Posting..." : "Send memo"}
            </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}
