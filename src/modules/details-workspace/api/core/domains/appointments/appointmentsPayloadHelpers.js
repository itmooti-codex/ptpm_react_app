import { normalizeIdentifier } from "../shared/sharedHelpers.js";

export function normalizeAppointmentRecord(rawAppointment = {}) {
  const hostContact = rawAppointment?.Host?.Contact_Information || {};
  const primaryGuest = rawAppointment?.Primary_Guest || {};
  const location = rawAppointment?.Location || {};

  return {
    id: String(rawAppointment?.id || rawAppointment?.ID || "").trim(),
    status: String(rawAppointment?.status || rawAppointment?.Status || "").trim(),
    type: String(rawAppointment?.type || rawAppointment?.Type || "").trim(),
    title: String(rawAppointment?.title || rawAppointment?.Title || "").trim(),
    description: String(
      rawAppointment?.description || rawAppointment?.Description || ""
    ).trim(),
    start_time:
      rawAppointment?.start_time || rawAppointment?.Start_Time || rawAppointment?.startTime || "",
    end_time:
      rawAppointment?.end_time || rawAppointment?.End_Time || rawAppointment?.endTime || "",
    duration_hours: String(
      rawAppointment?.duration_hours || rawAppointment?.Duration_Hours || "0"
    ).trim(),
    duration_minutes: String(
      rawAppointment?.duration_minutes || rawAppointment?.Duration_Minutes || "0"
    ).trim(),
    event_color: String(
      rawAppointment?.event_color ||
        rawAppointment?.Event_Color ||
        rawAppointment?.event_colour ||
        rawAppointment?.Event_Colour ||
        rawAppointment?.google_calendar_event_color ||
        rawAppointment?.Google_Calendar_Event_Color ||
        rawAppointment?.google_calendar_color ||
        rawAppointment?.Google_Calendar_Color ||
        ""
    ).trim(),
    job_id: String(rawAppointment?.job_id || rawAppointment?.Job_ID || "").trim(),
    inquiry_id: String(rawAppointment?.inquiry_id || rawAppointment?.Inquiry_ID || "").trim(),
    location_id: String(
      rawAppointment?.location_id || rawAppointment?.Location_ID || ""
    ).trim(),
    host_id: String(rawAppointment?.host_id || rawAppointment?.Host_ID || "").trim(),
    primary_guest_contact_id: String(
      rawAppointment?.primary_guest_contact_id ||
        rawAppointment?.primary_guest_id ||
        rawAppointment?.Primary_Guest_Contact_ID ||
        rawAppointment?.Primary_Guest_ID ||
        ""
    ).trim(),
    location_name: String(
      rawAppointment?.Location_Property_Name ||
        rawAppointment?.location_property_name ||
        location?.property_name ||
        location?.Property_Name ||
        ""
    ).trim(),
    host_first_name: String(
      rawAppointment?.Host_Contact_Information_First_Name ||
        rawAppointment?.Host_First_Name ||
        rawAppointment?.host_first_name ||
        rawAppointment?.contact_first_name ||
        rawAppointment?.Contact_First_Name ||
        rawAppointment?.host_contact_information_first_name ||
        hostContact?.first_name ||
        hostContact?.First_Name ||
        ""
    ).trim(),
    host_last_name: String(
      rawAppointment?.Host_Contact_Information_Last_Name ||
        rawAppointment?.Host_Last_Name ||
        rawAppointment?.host_last_name ||
        rawAppointment?.contact_last_name ||
        rawAppointment?.Contact_Last_Name ||
        rawAppointment?.host_contact_information_last_name ||
        hostContact?.last_name ||
        hostContact?.Last_Name ||
        ""
    ).trim(),
    primary_guest_first_name: String(
      rawAppointment?.Primary_Guest_First_Name ||
        rawAppointment?.primary_guest_first_name ||
        primaryGuest?.first_name ||
        primaryGuest?.First_Name ||
        ""
    ).trim(),
    primary_guest_last_name: String(
      rawAppointment?.Primary_Guest_Last_Name ||
        rawAppointment?.primary_guest_last_name ||
        primaryGuest?.last_name ||
        primaryGuest?.Last_Name ||
        ""
    ).trim(),
  };
}

export function normalizeAppointmentMutationPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = { ...source };
  const colorValue = String(
    source?.event_colour ??
      source?.event_color ??
      source?.Event_Colour ??
      source?.Event_Color ??
      ""
  ).trim();

  delete next.event_color;
  delete next.Event_Color;

  if (
    Object.prototype.hasOwnProperty.call(source, "event_colour") ||
    Object.prototype.hasOwnProperty.call(source, "event_color") ||
    Object.prototype.hasOwnProperty.call(source, "Event_Colour") ||
    Object.prototype.hasOwnProperty.call(source, "Event_Color")
  ) {
    next.event_colour = colorValue;
  }

  const primaryGuestValue = normalizeIdentifier(
    source?.primary_guest_id ??
      source?.Primary_Guest_ID ??
      source?.primary_guest_contact_id ??
      source?.Primary_Guest_Contact_ID
  );
  delete next.primary_guest_contact_id;
  delete next.Primary_Guest_Contact_ID;
  if (
    Object.prototype.hasOwnProperty.call(source, "primary_guest_id") ||
    Object.prototype.hasOwnProperty.call(source, "Primary_Guest_ID") ||
    Object.prototype.hasOwnProperty.call(source, "primary_guest_contact_id") ||
    Object.prototype.hasOwnProperty.call(source, "Primary_Guest_Contact_ID")
  ) {
    next.primary_guest_id = primaryGuestValue;
  }

  return next;
}
