import { cx } from "../../lib/cx.js";

export function TextareaField({
  label,
  rows = 3,
  className = "",
  textareaClassName = "",
  ...props
}) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="type-label text-slate-600">{label}</span> : null}
      <textarea
        rows={rows}
        className={cx(
          "mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400",
          textareaClassName
        )}
        {...props}
      />
    </label>
  );
}
