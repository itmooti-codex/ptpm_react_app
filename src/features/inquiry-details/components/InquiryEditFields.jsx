import { useMemo } from "react";
import { toText } from "@shared/utils/formatters.js";
import {
  parseListSelectionValue,
  serializeListSelectionValue,
} from "../shared/inquiryInformationHelpers.js";

export function InquiryEditTextArea({
  label,
  field,
  value,
  onChange,
  placeholder = "",
  rows = 4,
}) {
  return (
    <label className="block">
      <span className="type-label text-slate-600">{label}</span>
      <textarea
        data-field={field}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
    </label>
  );
}

export function InquiryEditListSelectionField({
  label,
  field,
  value,
  options = [],
  onChange,
}) {
  const selectedValues = useMemo(
    () => parseListSelectionValue(value, options),
    [value, options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionLabelByKey = useMemo(() => {
    const map = new Map();
    options.forEach((option) => {
      const key = toText(option?.code || option?.value);
      if (!key) return;
      map.set(key, option?.label || option?.value || option?.code);
    });
    return map;
  }, [options]);

  const toggleOption = (optionKey) => {
    const key = toText(optionKey);
    if (!key) return;
    const nextValues = selectedSet.has(key)
      ? selectedValues.filter((item) => item !== key)
      : [...selectedValues, key];
    onChange?.(serializeListSelectionValue(nextValues));
  };

  return (
    <div className="w-full">
      <span className="type-label text-slate-600">{label}</span>
      <input type="hidden" data-field={field} value={toText(value)} readOnly />
      <div className="mt-2 rounded border border-slate-300 bg-white p-2">
        <div className="mb-2 flex min-h-7 flex-wrap gap-1">
          {selectedValues.map((key) => (
            <span
              key={`${field}-selected-${key}`}
              className="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
            >
              {optionLabelByKey.get(key) || key}
            </span>
          ))}
        </div>
        <div className="max-h-32 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionKey = toText(option?.code || option?.value);
              const isSelected = selectedSet.has(optionKey);
              return (
                <button
                  key={`${field}-option-${optionKey}`}
                  type="button"
                  onClick={() => toggleOption(optionKey)}
                  className={`rounded border px-2 py-1 text-xs transition ${
                    isSelected
                      ? "border-sky-700 bg-sky-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {option?.label || option?.value || option?.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
