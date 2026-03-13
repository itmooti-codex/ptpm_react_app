import { toText } from "@shared/utils/formatters.js";
import {
  buildGoogleMapSearchUrl,
  buildLocationMapQuery,
  formatAppointmentDuration,
  formatAppointmentUnix,
  getAppointmentEventColorValue,
  normalizeAppointmentValue,
  parseLookupIdentity,
  toTelHref,
} from "./appointmentTabHelpers.js";

export function FieldLabel({ children }) {
  return <div className="text-sm font-medium leading-4 text-neutral-700">{children}</div>;
}

export function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.09 2.31A1.5 1.5 0 0 0 3.6 3.78l-.01.04C3.01 7.02 4.12 12.07 8.7 16.65c4.58 4.58 9.63 5.69 12.83 5.12l.04-.01a1.5 1.5 0 0 0 1.17-1.49v-3.08a1.5 1.5 0 0 0-1.15-1.46l-3.15-.72a1.5 1.5 0 0 0-1.54.56l-1.18 1.57a12.04 12.04 0 0 1-5.55-5.55l1.57-1.18a1.5 1.5 0 0 0 .56-1.54l-.72-3.15A1.5 1.5 0 0 0 10.1 4.5H6.5c-.47 0-.91.2-1.21.5l-.2-.69Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function applyBackgroundOpacity(colorValue, opacityValue = 1) {
  const color = toText(colorValue);
  if (!color) return "";
  const opacity = Number(opacityValue);
  if (!Number.isFinite(opacity) || opacity >= 1) return color;
  const safeOpacity = Math.max(0, Math.min(1, opacity));

  const hexMatch = color.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const raw = hexMatch[1];
    const expanded =
      raw.length === 3
        ? raw
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : raw;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
  }

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (channels.length >= 3) {
      const red = Number.parseFloat(channels[0]);
      const green = Number.parseFloat(channels[1]);
      const blue = Number.parseFloat(channels[2]);
      if (Number.isFinite(red) && Number.isFinite(green) && Number.isFinite(blue)) {
        return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
      }
    }
  }

  return color;
}

export function AppointmentTableRow({
  record,
  normalizedHighlightAppointmentId,
  normalizedEventRowTintOpacity,
  locationItemById,
  hostItemById,
  guestItemById,
  getStatusOption,
  getEventOption,
  updatingId,
  isDeleting,
  isTableOnlyLayout,
  onRequestEdit,
  buildDraftFromRecord,
  startEditing,
  handleMarkComplete,
  setDeleteTarget,
  EditIcon,
  CheckIcon,
  TrashIcon,
}) {
  const recordId = String(record?.id || record?.ID || "").trim();
  const statusOption = getStatusOption(record?.status);
  const rawEventColor = getAppointmentEventColorValue(record);
  const eventOption = getEventOption(rawEventColor);
  const statusLabel = statusOption?.label || String(record?.status || "").trim() || "-";
  const isCompleted = normalizeAppointmentValue(statusLabel) === "completed";
  const locationId = toText(record?.location_id);
  const hostId = toText(record?.host_id);
  const guestId = toText(record?.primary_guest_contact_id || record?.primary_guest_id);
  const locationLookup = locationItemById.get(locationId);
  const hostLookup = hostItemById.get(hostId);
  const guestLookup = guestItemById.get(guestId);
  const hostLookupDetails = parseLookupIdentity(hostLookup?.label, hostLookup?.meta);
  const guestLookupDetails = parseLookupIdentity(guestLookup?.label, guestLookup?.meta);
  const locationName =
    String(record?.location_name || "").trim() || toText(locationLookup?.label) || "-";
  const locationMapQuery = buildLocationMapQuery(locationName, locationLookup?.meta);
  const hostName =
    [record?.host_first_name, record?.host_last_name].filter(Boolean).join(" ").trim() ||
    hostLookupDetails.name ||
    (hostId ? `Provider #${hostId}` : "-");
  const hostEmail = hostLookupDetails.email;
  const hostPhone = hostLookupDetails.phone;
  const guestName =
    [record?.primary_guest_first_name, record?.primary_guest_last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    guestLookupDetails.name ||
    "-";
  const guestEmail = guestLookupDetails.email;
  const guestPhone = guestLookupDetails.phone;
  const isHighlighted =
    Boolean(normalizedHighlightAppointmentId) && recordId === normalizedHighlightAppointmentId;
  const rowTintColor = !isHighlighted
    ? applyBackgroundOpacity(eventOption?.backgroundColor, normalizedEventRowTintOpacity)
    : "";
  const rowTintStyle = rowTintColor ? { backgroundColor: rowTintColor } : undefined;

  return (
    <tr
      key={recordId}
      data-ann-kind="appointment"
      data-ann-id={recordId}
      data-ann-highlighted={isHighlighted ? "true" : "false"}
      className={`border-b border-slate-100 last:border-b-0 ${isHighlighted ? "bg-amber-50" : ""}`}
      style={rowTintStyle}
    >
      <td className="px-2 py-3">
        <span
          className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium"
          style={
            statusOption
              ? { color: statusOption.color, backgroundColor: statusOption.backgroundColor }
              : undefined
          }
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-2 py-3 text-slate-800">
        {`${formatAppointmentUnix(record?.start_time)} - ${formatAppointmentUnix(record?.end_time)}`}
      </td>
      <td className="px-2 py-3 text-slate-800">
        {formatAppointmentDuration(record?.duration_hours, record?.duration_minutes)}
      </td>
      <td className="px-2 py-3 align-top text-slate-800">
        <div className="min-w-0 max-w-[230px]">
          <div className="truncate font-medium" title={locationName}>{locationName}</div>
          <TableContactActions mapQuery={locationMapQuery} />
        </div>
      </td>
      <td className="px-2 py-3 align-top text-slate-800">
        <div className="min-w-0 max-w-[180px]">
          <div className="truncate font-medium" title={hostName}>{hostName}</div>
          <TableContactActions email={hostEmail} phone={hostPhone} />
        </div>
      </td>
      <td className="px-2 py-3 align-top text-slate-800">
        <div className="min-w-0 max-w-[180px]">
          <div className="truncate font-medium" title={guestName}>{guestName}</div>
          <TableContactActions email={guestEmail} phone={guestPhone} />
        </div>
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (isTableOnlyLayout && typeof onRequestEdit === "function") {
                const nextDraftState = buildDraftFromRecord(record);
                onRequestEdit(record, nextDraftState);
                return;
              }
              startEditing(record);
            }}
            disabled={updatingId === recordId || isDeleting}
            aria-label="Edit appointment"
            title="Edit"
          >
            <EditIcon />
          </button>
          {!isCompleted ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => handleMarkComplete(record)}
              disabled={updatingId === recordId || isDeleting}
              aria-label="Mark appointment complete"
              title="Complete"
            >
              {updatingId === recordId ? (
                <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              ) : (
                <CheckIcon />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setDeleteTarget(record)}
            aria-label="Delete appointment"
            title="Delete"
            disabled={updatingId === recordId || isDeleting}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function TableContactActions({ email = "", phone = "", mapQuery = "" }) {
  const emailText = toText(email);
  const phoneText = toText(phone);
  const telHref = toTelHref(phoneText);
  const mapHref = buildGoogleMapSearchUrl(mapQuery);
  if (!emailText && !telHref && !mapHref) return null;

  return (
    <div className="mt-1 flex items-center gap-2 text-slate-500">
      {emailText ? (
        <a
          href={`mailto:${emailText}`}
          title={emailText}
          className="inline-flex items-center hover:text-[#003882]"
          onClick={(event) => event.stopPropagation()}
        >
          <MailIcon />
        </a>
      ) : null}
      {telHref ? (
        <a
          href={telHref}
          title={phoneText}
          className="inline-flex items-center hover:text-[#003882]"
          onClick={(event) => event.stopPropagation()}
        >
          <PhoneIcon />
        </a>
      ) : null}
      {mapHref ? (
        <a
          href={mapHref}
          title={toText(mapQuery)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center hover:text-[#003882]"
          onClick={(event) => event.stopPropagation()}
        >
          <MapPinIcon />
        </a>
      ) : null}
    </div>
  );
}
