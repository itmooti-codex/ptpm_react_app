import { useEffect, useMemo, useRef, useState } from "react";
import { toString } from "./tasksModalUtils.js";

export function AssigneeSearchField({
  label,
  options,
  selectedId,
  onSelect,
  disabled = false,
  isLoading = false,
}) {
  const rootRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((item) => item.id === selectedId) || null,
    [options, selectedId]
  );
  const [query, setQuery] = useState(selectedOption?.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label || "");
  }, [selectedOption?.id, selectedOption?.label]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = toString(query).toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative block">
      <span className="type-label text-slate-600">{label}</span>
      <input
        type="text"
        value={query}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          const normalizedNext = toString(nextQuery).toLowerCase();
          const normalizedSelected = toString(selectedOption?.label).toLowerCase();
          if (selectedId && normalizedNext !== normalizedSelected) {
            onSelect("", "");
          }
        }}
        disabled={disabled}
        placeholder={isLoading ? "Loading assignees..." : "Search assignee"}
        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
      />

      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {filteredOptions.length ? (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(option.id, option.label);
                      setQuery(option.label);
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">
              {isLoading ? "Loading..." : "No assignees found."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
