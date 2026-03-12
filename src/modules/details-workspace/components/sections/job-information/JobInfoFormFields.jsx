import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M16.3311 15.5156L12.7242 11.9095C13.7696 10.6544 14.2909 9.04453 14.1797 7.41486C14.0684 5.7852 13.3331 4.26116 12.1268 3.15979C10.9205 2.05843 9.33603 1.46453 7.70299 1.50164C6.06995 1.53875 4.51409 2.20402 3.35906 3.35906C2.20402 4.51409 1.53875 6.06995 1.50164 7.70299C1.46453 9.33603 2.05843 10.9205 3.15979 12.1268C4.26116 13.3331 5.7852 14.0684 7.41486 14.1797C9.04453 14.2909 10.6544 13.7696 11.9095 12.7242L15.5156 16.3311C15.5692 16.3847 15.6328 16.4271 15.7027 16.4561C15.7727 16.4851 15.8477 16.5 15.9234 16.5C15.9991 16.5 16.0741 16.4851 16.144 16.4561C16.214 16.4271 16.2776 16.3847 16.3311 16.3311C16.3847 16.2776 16.4271 16.214 16.4561 16.144C16.4851 16.0741 16.5 15.9991 16.5 15.9234C16.5 15.8477 16.4851 15.7727 16.4561 15.7027C16.4271 15.6328 16.3847 15.5692 16.3311 15.5156Z"
        fill="#78829D"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M5 2.5V4.5M13 2.5V4.5M3.5 7.5H14.5M4 3.5H14C14.5523 3.5 15 3.94772 15 4.5V14C15 14.5523 14.5523 15 14 15H4C3.44772 15 3 14.5523 3 14V4.5C3 3.94772 3.44772 3.5 4 3.5Z"
        stroke="#94A3B8"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 9l6 6 6-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FieldLabel({ children }) {
  return <div className="text-sm font-medium leading-4 text-neutral-700">{children}</div>;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenizeQuery(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesSearchQuery(searchText = "", query = "") {
  const normalizedSearchText = normalizeText(searchText);
  const queryTokens = tokenizeQuery(query);
  if (!queryTokens.length) return true;
  return queryTokens.every((token) => normalizedSearchText.includes(token));
}

export function SearchInput({ label, placeholder, defaultValue, field }) {
  return (
    <div className="w-full">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="relative mt-2 w-full">
        <input
          type="text"
          data-field={field}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-3 inline-flex items-center rounded-md px-2 text-slate-400"
          aria-label={`Search ${label || "field"}`}
        >
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}

export function SelectInput({
  label,
  field,
  options = [],
  defaultValue = "",
  value,
  onChange,
  customValueClass = "",
  customSelectClass = "",
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || "");

  useEffect(() => {
    if (isControlled) return;
    setInternalValue(defaultValue || "");
  }, [defaultValue, isControlled]);

  const selectedValue = isControlled ? value : internalValue;

  return (
    <div className="w-full">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="relative mt-2">
        <select
          data-field={field}
          value={selectedValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (!isControlled) setInternalValue(nextValue);
            onChange?.(nextValue);
          }}
          className={`w-full appearance-none rounded border border-slate-300 bg-white px-2.5 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400 ${customValueClass} ${customSelectClass}`}
        >
          <option value="" disabled>
            Select
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400">
          <ChevronDownIcon />
        </span>
      </div>
    </div>
  );
}

export function DateInput({ label, field }) {
  return (
    <div className="w-full">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-2">
        <input
          type="text"
          data-field={field}
          placeholder="dd/mm/yyyy"
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-10 text-sm text-slate-600 outline-none focus:border-slate-400"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <CalendarIcon />
        </span>
      </div>
    </div>
  );
}

export function ColorMappedSelectInput({
  label,
  field,
  options = [],
  defaultValue = "",
  value,
  onChange,
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);

  useEffect(() => {
    if (isControlled) return;
    setInternalValue(defaultValue || "");
  }, [defaultValue, isControlled]);

  const selectedValue = isControlled ? value : internalValue;

  const selectedOption = options.find((option) => String(option.value) === String(selectedValue));
  const selectStyle = selectedOption
    ? {
        color: selectedOption.color,
        backgroundColor: selectedOption.backgroundColor,
        borderColor: selectedOption.color,
      }
    : undefined;

  return (
    <div className="w-full">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="relative mt-2">
        <select
          data-field={field}
          value={selectedValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (!isControlled) setInternalValue(nextValue);
            onChange?.(nextValue);
          }}
          className="w-full appearance-none rounded border border-slate-300 bg-white px-2.5 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
          style={selectStyle}
        >
          <option value="" disabled>
            Select
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{ color: option.color, backgroundColor: option.backgroundColor }}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-slate-400">
          <ChevronDownIcon />
        </span>
      </div>
    </div>
  );
}

export function SearchDropdownInput({
  label,
  field,
  value,
  placeholder,
  items = [],
  onValueChange,
  onSelect,
  onAdd,
  onSearchQueryChange = null,
  searchDebounceMs = 250,
  minSearchLength = 2,
  hideAddAction = false,
  emptyText,
  addButtonLabel,
  closeOnSelect = true,
  autoConfirmOnClose = false,
  rootData,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const hasValue = Boolean(String(value || "").trim());
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;

  const filteredItems = useMemo(() => {
    const query = String(value || "");
    if (!tokenizeQuery(query).length) return items;
    return items.filter((item) => {
      const searchText = [
        item.label,
        item.meta,
        item.id,
        item.first_name,
        item.last_name,
        item.firstName,
        item.lastName,
        item.full_name,
        item.fullName,
        item.name,
        item.searchText,
        Array.isArray(item.searchTokens) ? item.searchTokens.join(" ") : item.searchTokens,
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
      return matchesSearchQuery(searchText, query);
    });
  }, [items, value]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      if (autoConfirmOnClose && typeof onAddRef.current === "function") {
        onAddRef.current();
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [autoConfirmOnClose, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (typeof onSearchQueryChange !== "function") return undefined;
    const normalizedQuery = String(value || "").trim();
    if (normalizedQuery.length < Math.max(0, Number(minSearchLength) || 0)) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      Promise.resolve(onSearchQueryChange(normalizedQuery)).catch((searchError) => {
        console.error("[JobDirect] Lookup search callback failed", searchError);
      });
    }, Math.max(0, Number(searchDebounceMs) || 0));
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, minSearchLength, onSearchQueryChange, searchDebounceMs, value]);

  const shouldRenderAddAction = !hideAddAction && typeof onAdd === "function";

  return (
    <div ref={rootRef} className="w-full" {...rootData}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="relative mt-2 w-full">
        <input
          type="text"
          data-field={field}
          value={value}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            onValueChange(event.target.value);
            setIsOpen(true);
          }}
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-14 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
        {hasValue ? (
          <button
            type="button"
            className="absolute inset-y-0 right-8 inline-flex items-center rounded-md px-1.5 text-slate-400 hover:text-slate-600"
            aria-label={`Clear ${label || "field"} search`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onValueChange("");
              setIsOpen(true);
            }}
          >
            <ClearIcon />
          </button>
        ) : null}
        <button
          type="button"
          className="absolute inset-y-0 right-2 inline-flex items-center rounded-md px-1.5 text-slate-400"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={`Search ${label || "field"}`}
        >
          <SearchIcon />
        </button>

        {isOpen ? (
          <div className="absolute z-30 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-56 overflow-y-auto py-1">
              {filteredItems.length ? (
                filteredItems.map((item, index) => (
                  <li key={`${field || "lookup"}-${item.id || item.label || "item"}-${index}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs text-neutral-700"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(item);
                        setIsOpen(!closeOnSelect);
                      }}
                    >
                      <span>{item.label}</span>
                      {item.meta ? <span className="text-[11px] text-slate-500">{item.meta}</span> : null}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-xs text-slate-400">{emptyText || "No records found."}</li>
              )}
            </ul>
            {shouldRenderAddAction ? (
              <div className="border-t border-slate-200 p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onAdd?.();
                    setIsOpen(false);
                  }}
                >
                  {addButtonLabel || "Add New"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
