import { cx } from "../../lib/cx.js";

export function CheckboxField({ label, className = "", ...props }) {
  return (
    <label className={cx("inline-flex items-center gap-2 text-sm text-slate-600", className)}>
      <input type="checkbox" className="h-4 w-4 accent-brand-primary" {...props} />
      <span>{label}</span>
    </label>
  );
}
