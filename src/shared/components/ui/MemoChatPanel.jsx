import { useEffect, useMemo, useRef, useState } from "react";
import { toText } from "../../utils/formatters.js";
import { MemoChatFooter } from "./MemoChatFooter.jsx";
import { MemoChatMemoList } from "./MemoChatMemoList.jsx";
import { getMemoActivityKey } from "./memoChatUtils.js";

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
  focusMemoId = "",
  focusRequestKey = 0,
}) {
  const scrollRef = useRef(null);
  const memoCardRefs = useRef({});
  const replyInputRefs = useRef({});
  const highlightTimeoutRef = useRef(null);
  const [collapsedRepliesByMemoId, setCollapsedRepliesByMemoId] = useState({});
  const [highlightMemoId, setHighlightMemoId] = useState("");
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

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const targetMemoId = toText(focusMemoId);
    if (!hasMemoContext || !targetMemoId || !focusRequestKey) return undefined;

    const timeoutId = window.setTimeout(() => {
      const targetCard = memoCardRefs.current?.[targetMemoId];
      const targetReplyInput = replyInputRefs.current?.[targetMemoId];
      targetCard?.scrollIntoView?.({
        behavior: hasScrolledRef.current ? "smooth" : "auto",
        block: "center",
      });
      targetReplyInput?.focus?.();
      if (typeof targetReplyInput?.setSelectionRange === "function") {
        const cursorPosition = String(targetReplyInput.value || "").length;
        targetReplyInput.setSelectionRange(cursorPosition, cursorPosition);
      }
      setHighlightMemoId(targetMemoId);
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightMemoId((current) => (current === targetMemoId ? "" : current));
      }, 2200);
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [focusMemoId, focusRequestKey, hasMemoContext]);

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
        <MemoChatMemoList
          hasMemoContext={hasMemoContext}
          isLoading={isLoading}
          errorMessage={errorMessage}
          memos={memos}
          currentUserId={currentUserId}
          resolveMemoAuthor={resolveMemoAuthor}
          sendingReplyPostId={sendingReplyPostId}
          memoReplyDrafts={memoReplyDrafts}
          onChangeReplyDraft={onChangeReplyDraft}
          onSendReply={onSendReply}
          onDeleteItem={onDeleteItem}
          collapsedRepliesByMemoId={collapsedRepliesByMemoId}
          setCollapsedRepliesByMemoId={setCollapsedRepliesByMemoId}
          highlightMemoId={highlightMemoId}
          memoCardRefs={memoCardRefs}
          replyInputRefs={replyInputRefs}
          unavailableMessage={unavailableMessage}
          emptyMessage={emptyMessage}
          DeleteIcon={DeleteIcon}
        />
      </div>

      <MemoChatFooter
        hasMemoContext={hasMemoContext}
        memoText={memoText}
        onMemoTextChange={onMemoTextChange}
        isPostingMemo={isPostingMemo}
        onSendMemo={onSendMemo}
        memoFile={memoFile}
        memoFileInputRef={memoFileInputRef}
        onMemoFileChange={onMemoFileChange}
        onAttachClick={onAttachClick}
        onClearMemoFile={onClearMemoFile}
      />
    </section>
  );
}
