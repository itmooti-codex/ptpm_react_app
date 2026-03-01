import { cx } from "../../lib/cx.js";

export function InputField({
  label,
  className = "",
  inputClassName = "",
  inputRef,
  ...props
}) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="type-label text-slate-600">{label}</span> : null}
      <input
        ref={inputRef}
        className={cx(
          "mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400",
          inputClassName
        )}
        {...props}
      />
    </label>
  );
}
