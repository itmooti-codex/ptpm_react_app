import { toText } from "../../utils/formatters.js";
import { Button } from "./Button.jsx";

export function MemoChatFooter({
  hasMemoContext,
  memoText,
  onMemoTextChange,
  isPostingMemo,
  onSendMemo,
  memoFile,
  memoFileInputRef,
  onMemoFileChange,
  onAttachClick,
  onClearMemoFile,
}) {
  const normalizedMemoText = toText(memoText);

  return (
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
  );
}
