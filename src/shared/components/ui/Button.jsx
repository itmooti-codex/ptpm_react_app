import { cx } from "../../lib/cx.js";

const VARIANT = {
  primary: "bg-brand-primary text-white border border-brand-primary",
  secondary: "bg-white text-brand-primary border border-brand-primary",
  ghost: "bg-transparent text-slate-700 border border-transparent",
  outline: "bg-white text-slate-700 border border-slate-300",
};

const SIZE = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
};

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
