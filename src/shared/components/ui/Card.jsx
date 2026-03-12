import { cx } from "../../lib/cx.js";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={cx("rounded-[4px] border border-[#003882] bg-white p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
