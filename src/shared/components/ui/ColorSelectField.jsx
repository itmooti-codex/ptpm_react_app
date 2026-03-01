import { cx } from "../../lib/cx.js";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveColorOption(options = [], value = "") {
  const selectedKey = normalize(value);
  if (!selectedKey) return null;

  return (
    options.find((option) => normalize(option?.value) === selectedKey) ||
    options.find((option) => normalize(option?.label) === selectedKey) ||
    null
  );
}

export function ColorSelectField({
  label,
  options = [],
  className = "",
  selectClassName = "",
  placeholder = "Select",
  ...props
}) {
  const selectedValue = props?.value;
  const selectedOption = resolveColorOption(options, selectedValue);
  const selectedStyle =
    selectedOption?.color || selectedOption?.backgroundColor
      ? {
          color: selectedOption?.color || undefined,
          backgroundColor: selectedOption?.backgroundColor || undefined,
          borderColor: selectedOption?.color || undefined,
        }
      : undefined;

  return (
    <label className={cx("block", className)}>
      {label ? <span className="type-label text-slate-600">{label}</span> : null}
      <select
        className={cx(
          "mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400",
          selectClassName
        )}
        style={selectedStyle}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const optionStyle =
            option?.color || option?.backgroundColor
              ? {
                  color: option?.color || undefined,
                  backgroundColor: option?.backgroundColor || undefined,
                }
              : undefined;
          return (
            <option key={option.value} value={option.value} style={optionStyle}>
              {option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
