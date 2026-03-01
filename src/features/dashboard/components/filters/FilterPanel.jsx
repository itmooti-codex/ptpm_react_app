import { useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { TAB_STATUS_OPTIONS, ACCOUNT_TYPE_OPTIONS, SOURCE_OPTIONS, PAYMENT_ONLY_TABS } from "../../constants/tabs.js";
import { FilterCollapsibleSection } from "./FilterCollapsibleSection.jsx";

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-slate-700">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-slate-300 text-[#003882] focus:ring-[#003882]"
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function FilterInput({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:border-[#003882] focus:outline-none"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FilterDateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type="date"
        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 focus:border-[#003882] focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const SP_DEFAULT_VISIBLE = 5;

// Multi-select searchable checkbox list for service providers
function ServiceProviderSelect({ serviceProviders, selectedIds, onToggle }) {
  const [search, setSearch] = useState("");

  const isSearching = search.trim().length > 0;
  const filtered = isSearching
    ? serviceProviders.filter((sp) => {
        const q = search.toLowerCase();
        // Match if any word in the name starts with the typed query
        return sp.name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q));
      })
    : serviceProviders;

  // Without search: surface selected to top, then show up to 5 total
  const visible = isSearching
    ? filtered
    : [
        ...filtered.filter((sp) => selectedIds.includes(sp.id)),
        ...filtered.filter((sp) => !selectedIds.includes(sp.id)),
      ].slice(0, SP_DEFAULT_VISIBLE);

  return (
    <div>
      <input
        type="text"
        className="mb-1.5 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:border-[#003882] focus:outline-none"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="space-y-0.5">
        {visible.length === 0 && (
          <p className="py-1 text-xs text-slate-400">No providers found</p>
        )}
        {visible.map((sp) => (
          <label
            key={sp.id}
            className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-[#003882] focus:ring-[#003882]"
              checked={selectedIds.includes(sp.id)}
              onChange={() => onToggle(sp.id)}
            />
            <span className="truncate">{sp.name}</span>
          </label>
        ))}
        {!isSearching && serviceProviders.length > SP_DEFAULT_VISIBLE && (
          <p className="pt-0.5 text-xs text-slate-400">
            Type to search all {serviceProviders.length} providers
          </p>
        )}
      </div>
    </div>
  );
}

export function FilterPanel({
  activeTab,
  filters,
  onPatchFilter,
  onToggleArrayFilter,
  onApply,
  onReset,
  onClose,
  serviceProviders = [],
}) {
  const statusOptions = TAB_STATUS_OPTIONS[activeTab] || [];
  const showPaymentFilters = PAYMENT_ONLY_TABS.has(activeTab);

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">Filters</span>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-700"
          onClick={onClose}
          aria-label="Close filters"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {statusOptions.length > 0 && (
          <FilterCollapsibleSection title="Status">
            <div className="space-y-1 pt-1">
              {statusOptions.map((status) => (
                <FilterCheckbox
                  key={status}
                  label={status}
                  checked={filters.statuses.includes(status)}
                  onChange={() => onToggleArrayFilter("statuses", status)}
                />
              ))}
            </div>
          </FilterCollapsibleSection>
        )}

        <FilterCollapsibleSection title="Service Provider" defaultOpen={false}>
          <div className="pt-1">
            <ServiceProviderSelect
              serviceProviders={serviceProviders}
              selectedIds={filters.serviceProviders}
              onToggle={(id) => onToggleArrayFilter("serviceProviders", id)}
            />
          </div>
        </FilterCollapsibleSection>

        <FilterCollapsibleSection title="Account Name" defaultOpen={false}>
          <div className="pt-1">
            <FilterInput
              placeholder="Search contact or company..."
              value={filters.accountName}
              onChange={(v) => onPatchFilter("accountName", v)}
            />
          </div>
        </FilterCollapsibleSection>

        <FilterCollapsibleSection title="Address" defaultOpen={false}>
          <div className="pt-1">
            <FilterInput
              placeholder="Search property name..."
              value={filters.address}
              onChange={(v) => onPatchFilter("address", v)}
            />
          </div>
        </FilterCollapsibleSection>

        <FilterCollapsibleSection title="Account Type" defaultOpen={false}>
          <div className="space-y-1 pt-1">
            {ACCOUNT_TYPE_OPTIONS.map((type) => (
              <FilterCheckbox
                key={type}
                label={type}
                checked={filters.accountTypes.includes(type)}
                onChange={() => onToggleArrayFilter("accountTypes", type)}
              />
            ))}
          </div>
        </FilterCollapsibleSection>

        <FilterCollapsibleSection title="Source" defaultOpen={false}>
          <div className="space-y-1 pt-1">
            {SOURCE_OPTIONS.map((src) => (
              <FilterCheckbox
                key={src}
                label={src}
                checked={filters.sources.includes(src)}
                onChange={() => onToggleArrayFilter("sources", src)}
              />
            ))}
          </div>
        </FilterCollapsibleSection>

        <FilterCollapsibleSection title="Date Range" defaultOpen={false}>
          <div className="space-y-2 pt-1">
            <FilterDateInput
              label="From"
              value={filters.dateFrom}
              onChange={(v) => onPatchFilter("dateFrom", v)}
            />
            <FilterDateInput
              label="To"
              value={filters.dateTo}
              onChange={(v) => onPatchFilter("dateTo", v)}
            />
          </div>
        </FilterCollapsibleSection>

        {showPaymentFilters && (
          <FilterCollapsibleSection title="Invoice & Payment" defaultOpen={false}>
            <div className="space-y-2 pt-1">
              <FilterInput
                placeholder="Quote number..."
                value={filters.quoteNumber}
                onChange={(v) => onPatchFilter("quoteNumber", v)}
              />
              <FilterInput
                placeholder="Invoice number..."
                value={filters.invoiceNumber}
                onChange={(v) => onPatchFilter("invoiceNumber", v)}
              />
            </div>
          </FilterCollapsibleSection>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-200 px-4 py-3">
        <Button variant="ghost" className="flex-1" onClick={onReset}>
          Reset
        </Button>
        <Button variant="primary" className="flex-1" onClick={onApply}>
          Apply
        </Button>
      </div>
    </aside>
  );
}
