import { MemoChatPanel } from "@shared/components/ui/MemoChatPanel.jsx";
import { TrashActionIcon as TrashIcon } from "@modules/details-workspace/exports/components.js";

export function InquiryFloatingWidgets({
  areFloatingWidgetsVisible,
  setAreFloatingWidgetsVisible,
  hasPopupCommentsSection,
  memos,
  setIsPopupCommentModalOpen,
  isMemoChatOpen,
  hasMemoContext,
  isMemosLoading,
  memosError,
  currentUserId,
  resolveMemoAuthor,
  sendingReplyPostId,
  memoReplyDrafts,
  handleChangeMemoReplyDraft,
  handleSendMemoReply,
  setMemoDeleteTarget,
  memoText,
  setMemoText,
  isPostingMemo,
  handleSendMemo,
  memoFile,
  memoFileInputRef,
  handleMemoFileChange,
  handleClearMemoFile,
  memoFocusRequest,
  setIsMemoChatOpen,
}) {
  return (
    <>
      <button
        type="button"
        className="pointer-events-auto fixed bottom-[144px] right-[-2px] z-[61] inline-flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-slate-300/90 bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition hover:bg-slate-50"
        onClick={() => setAreFloatingWidgetsVisible((previous) => !previous)}
        aria-label={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
        title={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
      >
        {(hasPopupCommentsSection || memos.length) ? (
          <span className="absolute -top-1 right-[20px] inline-flex h-2 w-2 rounded-full bg-red-500" />
        ) : null}
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          aria-hidden="true"
          className="-translate-x-[8px]"
        >
          {areFloatingWidgetsVisible ? (
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </button>
      <div
        className={`fixed bottom-5 right-6 z-[60] flex flex-col items-end gap-3 transition-all duration-200 ${
          areFloatingWidgetsVisible
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-4 opacity-0"
        }`}
      >
        <button
          type="button"
          className={`pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-700 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.35)] transition ${
            hasPopupCommentsSection ? "hover:bg-red-700" : "cursor-not-allowed opacity-45"
          }`}
          onClick={() => {
            if (!hasPopupCommentsSection) return;
            setIsPopupCommentModalOpen(true);
          }}
          disabled={!hasPopupCommentsSection}
          aria-label="Open popup comments"
          title={hasPopupCommentsSection ? "Popup comments" : "Popup comments unavailable"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              d="M12 7.25V13.25"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.1" r="1.25" fill="currentColor" />
          </svg>
        </button>

        {isMemoChatOpen ? (
          <MemoChatPanel
            title="Memos"
            contextDescription="Memo thread for this inquiry."
            hasMemoContext={hasMemoContext}
            isLoading={isMemosLoading}
            errorMessage={memosError}
            memos={memos}
            currentUserId={currentUserId}
            resolveMemoAuthor={resolveMemoAuthor}
            sendingReplyPostId={sendingReplyPostId}
            memoReplyDrafts={memoReplyDrafts}
            onChangeReplyDraft={handleChangeMemoReplyDraft}
            onSendReply={handleSendMemoReply}
            onDeleteItem={setMemoDeleteTarget}
            memoText={memoText}
            onMemoTextChange={setMemoText}
            isPostingMemo={isPostingMemo}
            onSendMemo={handleSendMemo}
            memoFile={memoFile}
            memoFileInputRef={memoFileInputRef}
            onMemoFileChange={handleMemoFileChange}
            onAttachClick={() => memoFileInputRef.current?.click()}
            onClearMemoFile={handleClearMemoFile}
            focusMemoId={memoFocusRequest.memoId}
            focusRequestKey={memoFocusRequest.key}
            onClose={() => setIsMemoChatOpen(false)}
            unavailableMessage="Memos are available when the inquiry is linked."
            emptyMessage="No memos yet. Start the thread with a quick update or attachment."
            DeleteIcon={TrashIcon}
          />
        ) : null}

        <button
          type="button"
          className="pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#003882] text-white shadow-[0_10px_24px_rgba(0,56,130,0.35)] transition hover:bg-[#0A4A9E]"
          onClick={() => setIsMemoChatOpen((previous) => !previous)}
          aria-label={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
          title={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
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
          {memos.length ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {memos.length > 99 ? "99+" : memos.length}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}
