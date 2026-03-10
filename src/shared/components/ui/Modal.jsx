import { Button } from "./Button.jsx";
import { cx } from "../../lib/cx.js";

export function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = "max-w-2xl",
  zIndexClass = "z-[80]",
  footer,
  closeOnBackdrop = true,
}) {
  if (!open) return null;

  return (
    <div
      className={cx("fixed inset-0 flex items-center justify-center bg-black/40 px-4", zIndexClass)}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        className={cx("w-full rounded-lg bg-white p-6 shadow-xl", widthClass)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="type-subheadline text-slate-800">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            X
          </Button>
        </div>

        <div>{children}</div>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
