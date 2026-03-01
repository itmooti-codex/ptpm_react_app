import { cx } from "../../lib/cx.js";

export function SelectField({
  label,
  options = [],
  className = "",
  selectClassName = "",
  ...props
}) {
  return (
    <label className={cx("block", className)}>
      {label ? <span className="type-label text-slate-600">{label}</span> : null}
      <select
        className={cx(
          "mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400",
          selectClassName
        )}
        {...props}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
