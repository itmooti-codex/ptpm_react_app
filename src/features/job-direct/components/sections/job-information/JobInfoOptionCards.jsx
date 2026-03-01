import { EditActionIcon as EditIcon } from "../../icons/ActionIcons.jsx";
import {
  buildInquiryLink,
  buildPropertyMapLink,
  normalizeInquiryId,
  normalizePropertyId,
} from "./jobInfoUtils.js";

export function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22C12 22 19 16.5 19 10.5C19 6.35786 15.866 3 12 3C8.13401 3 5 6.35786 5 10.5C5 16.5 12 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function StarIcon({ active = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L14.78 8.63L21 9.54L16.5 13.93L17.56 20.14L12 17.22L6.44 20.14L7.5 13.93L3 9.54L9.22 8.63L12 3Z"
        fill={active ? "#F59E0B" : "#CBD5E1"}
        stroke={active ? "#D97706" : "#94A3B8"}
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function AccordionBlock({ title, isOpen, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-[color:var(--color-light)] px-4 py-2.5 text-left hover:bg-[#eaf0f7]"
      >
        <span className="text-sm font-semibold text-neutral-700">{title}</span>
        <span
          className={`inline-block text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}

export function InquiryOptionCard({
  deal,
  isSelected,
  onSelect,
  radioName = "linked-inquiry",
  readOnly = false,
}) {
  const dealId = normalizeInquiryId(deal?.id);
  const inquiryLink = buildInquiryLink(deal?.unique_id);

  return (
    <div
      className={`w-full rounded border px-3 py-2 text-left ${
        isSelected
          ? "border-sky-700 bg-sky-50"
          : "border-slate-300 bg-white hover:border-slate-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {deal?.unique_id ? (
            <a
              href={inquiryLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
            >
              {deal.unique_id}
            </a>
          ) : (
            <div className="text-xs font-medium text-slate-500">No UID</div>
          )}
          <div className="mt-1 text-sm font-semibold text-neutral-700">
            {deal?.deal_name || "Untitled Deal"}
          </div>
        </div>
        <input
          type="radio"
          name={radioName}
          className="mt-0.5 h-4 w-4 accent-[#003882]"
          checked={isSelected}
          onChange={() => {
            if (readOnly || !dealId || typeof onSelect !== "function") return;
            onSelect(dealId);
          }}
          disabled={readOnly || !dealId}
          aria-label={`Select inquiry ${deal?.unique_id || deal?.deal_name || "record"}`}
        />
      </div>
    </div>
  );
}

export function PropertyOptionCard({
  property,
  isSelected,
  onSelect,
  radioName = "linked-property",
  readOnly = false,
  onEdit,
}) {
  const propertyId = normalizePropertyId(property?.id);
  const mapLink = buildPropertyMapLink(property);

  return (
    <div
      className={`w-full rounded border px-3 py-2 text-left ${
        isSelected
          ? "border-sky-700 bg-sky-50"
          : "border-slate-300 bg-white hover:border-slate-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">
            {property?.unique_id || "No Property UID"}
          </div>
          <div className="mt-1 text-sm font-semibold text-neutral-700">
            {property?.property_name || "Untitled Property"}
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <input
            type="radio"
            name={radioName}
            className="h-4 w-4 accent-[#003882]"
            checked={isSelected}
            onChange={() => {
              if (readOnly || !propertyId || typeof onSelect !== "function") return;
              onSelect(propertyId);
            }}
            disabled={readOnly || !propertyId}
            aria-label={`Select property ${property?.unique_id || property?.property_name || "record"}`}
          />
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!mapLink}
            onClick={() => {
              if (!mapLink) return;
              window.open(mapLink, "_blank", "noopener,noreferrer");
            }}
            aria-label={`Open map for ${property?.property_name || property?.unique_id || "property"}`}
            title="Open in Google Maps"
          >
            <MapPinIcon />
          </button>
          {typeof onEdit === "function" ? (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
              onClick={() => onEdit(property)}
              aria-label={`Edit ${property?.property_name || property?.unique_id || "property"}`}
              title="Edit Property"
            >
              <EditIcon />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
