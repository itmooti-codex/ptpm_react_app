import { useEffect } from "react";
import { cx } from "../../lib/cx.js";

const CONTAINER_TONE = {
  success: "border-l-[var(--color-success)]",
  error: "border-l-[var(--color-danger)]",
  warning: "border-l-[var(--color-warning)]",
  info: "border-l-[var(--color-cool)]",
};

const DOT_TONE = {
  success: "bg-[var(--color-success)]",
  error: "bg-[var(--color-danger)]",
  warning: "bg-[var(--color-warning)]",
  info: "bg-[var(--color-cool)]",
};

const DEFAULT_TITLE = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return undefined;

    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.duration, toast.id]);

  const tone = toast.type in CONTAINER_TONE ? toast.type : "info";
  const title = toast.title || DEFAULT_TITLE[tone];

  return (
    <div
      role="status"
      className={cx(
        "pointer-events-auto rounded border border-slate-200 border-l-4 bg-white shadow-md",
        CONTAINER_TONE[tone]
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <span className={cx("mt-1 h-2.5 w-2.5 rounded-full", DOT_TONE[tone])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="type-subheadline-2 text-slate-900">{title}</div>
          {toast.description ? (
            <div className="mt-1 type-button text-slate-600">{toast.description}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="type-button rounded px-1 text-slate-400 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          X
        </button>
      </div>
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-4 z-[1200] flex justify-end px-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
