import { cx } from "../../lib/cx.js";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={cx("rounded-lg border border-slate-200 bg-white p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
