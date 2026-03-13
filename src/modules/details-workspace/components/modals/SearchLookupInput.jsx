import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { matchesSearchQuery, tokenizeQuery } from "./propertyAffiliationUtils.js";

export function SearchLookupInput({
  label,
  value,
  placeholder,
  items = [],
  onValueChange,
  onSelect,
  onAdd,
  onSearchQueryChange = null,
  searchDebounceMs = 250,
  minSearchLength = 2,
  addLabel,
  emptyText,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const hasValue = Boolean(String(value || "").trim());

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
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || disabled) return undefined;
    if (typeof onSearchQueryChange !== "function") return undefined;
    const normalizedQuery = String(value || "").trim();
    if (normalizedQuery.length < Math.max(0, Number(minSearchLength) || 0)) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      Promise.resolve(onSearchQueryChange(normalizedQuery)).catch((searchError) => {
        console.error("[JobDirect] Affiliation lookup search failed", searchError);
      });
    }, Math.max(0, Number(searchDebounceMs) || 0));
    return () => window.clearTimeout(timeoutId);
  }, [
    disabled,
    isOpen,
    minSearchLength,
    onSearchQueryChange,
    searchDebounceMs,
    value,
  ]);

  return (
    <div ref={rootRef} className="w-full">
      <div className="mb-1 text-sm font-medium leading-4 text-neutral-700">{label}</div>
      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(event) => {
            onValueChange(event.target.value);
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-14 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {hasValue ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onValueChange("");
              if (!disabled) setIsOpen(true);
            }}
            disabled={disabled}
            className="absolute inset-y-0 right-7 inline-flex items-center px-1 text-slate-400 hover:text-slate-600 disabled:opacity-40"
            aria-label={`Clear ${label} search`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setIsOpen((previous) => !previous);
          }}
          disabled={disabled}
          className="absolute inset-y-0 right-2 inline-flex items-center px-1 text-slate-400 disabled:opacity-40"
          aria-label={`Open ${label} lookup`}
        >
          ▾
        </button>

        {isOpen ? (
          <div className="absolute z-40 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredItems.length ? (
                filteredItems.map((item, index) => (
                  <li key={`${item.id || item.label || "item"}-${index}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-slate-50"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(item);
                        setIsOpen(false);
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
                {addLabel || "Add New"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
