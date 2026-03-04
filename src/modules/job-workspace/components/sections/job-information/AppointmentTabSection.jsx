import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import { buildLookupDisplayLabel } from "../../../../../shared/utils/lookupLabel.js";
import {
  APPOINTMENT_DURATION_HOURS_OPTIONS,
  APPOINTMENT_DURATION_MINUTES_OPTIONS,
  APPOINTMENT_EVENT_COLOR_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
} from "../../../constants/options.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../../hooks/useJobDirectStore.jsx";
import { useServiceProviderLookupData } from "../../../hooks/useServiceProviderLookupData.js";
import {
  selectAppointments,
  selectContacts,
  selectProperties,
} from "../../../state/selectors.js";
import {
  createAppointmentRecord,
  deleteAppointmentRecord,
  fetchAppointmentsByJobId,
  fetchAppointmentsByInquiryUid,
  updateAppointmentRecord,
} from "../../../sdk/core/runtime.js";
import {
  EditActionIcon as EditIcon,
  CheckActionIcon as CheckIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import { useRenderWindow } from "../../primitives/JobDirectTable.jsx";
import {
  ColorMappedSelectInput,
  SearchDropdownInput,
  SelectInput,
} from "./JobInfoFormFields.jsx";
import {
  buildGoogleMapSearchUrl,
  buildLocationMapQuery,
  formatAppointmentDuration,
  formatAppointmentUnix,
  getAppointmentEventColorValue,
  normalizeAppointmentValue,
  parseAppointmentDateInputToUnix,
  parseLookupIdentity,
  resolveAppointmentMappedOption,
  toTelHref,
  toText,
} from "./appointmentTabHelpers.js";

function FieldLabel({ children }) {
  return <div className="text-sm font-medium leading-4 text-neutral-700">{children}</div>;
}

function PhoneIcon() {
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

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon() {
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

function TableContactActions({ email = "", phone = "", mapQuery = "" }) {
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

export function AppointmentTabSection({
  plugin,
  jobData,
  preloadedLookupData,
  onCountChange,
  inquiryRecordId = "",
  inquiryUid = "",
  highlightAppointmentId = "",
  draft = null,
  onDraftChange = null,
  onResetDraft = null,
  prefillContext = null,
  mode = "",
  editingAppointmentId = "",
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const appointments = useJobDirectSelector(selectAppointments);
  const properties = useJobDirectSelector(selectProperties);
  const contacts = useJobDirectSelector(selectContacts);
  const { serviceProviders, isLookupLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookupData(plugin, {
      initialProviders: preloadedLookupData?.serviceProviders || [],
      skipInitialFetch: true,
    });

  const normalizeTextValue = useCallback((value) => String(value || "").trim(), []);
  const defaultEventColor = useMemo(
    () => String(APPOINTMENT_EVENT_COLOR_OPTIONS[0]?.value || "1").trim(),
    []
  );
  const emptyForm = useMemo(
    () => ({
      status: "New",
      type: "select none",
      title: "",
      start_time: "",
      description: "",
      location_id: "",
      host_id: "",
      primary_guest_contact_id: "",
      event_color: defaultEventColor,
      duration_hours: "0",
      duration_minutes: "0",
    }),
    [defaultEventColor]
  );
  const buildEmptyDraftState = useCallback(
    () => ({
      form: { ...emptyForm },
      locationQuery: "",
      hostQuery: "",
      guestQuery: "",
      editingAppointmentId: "",
    }),
    [emptyForm]
  );
  const normalizeDraftState = useCallback(
    (value) => {
      const base = buildEmptyDraftState();
      if (!value || typeof value !== "object") return base;

      const hasWrappedForm = value.form && typeof value.form === "object";
      const sourceForm = hasWrappedForm ? value.form : value;
      const next = {
        ...base,
        ...(hasWrappedForm
          ? {
              locationQuery: normalizeTextValue(value.locationQuery),
              hostQuery: normalizeTextValue(value.hostQuery),
              guestQuery: normalizeTextValue(value.guestQuery),
              editingAppointmentId: normalizeTextValue(
                value.editingAppointmentId || value.editingId
              ),
            }
          : {}),
      };

      next.form = {
        ...base.form,
        status: normalizeTextValue(sourceForm.status) || "New",
        type: normalizeTextValue(sourceForm.type) || "select none",
        title: normalizeTextValue(sourceForm.title),
        start_time: normalizeTextValue(sourceForm.start_time),
        description: normalizeTextValue(sourceForm.description),
        location_id: normalizeTextValue(sourceForm.location_id),
        host_id: normalizeTextValue(sourceForm.host_id),
        primary_guest_contact_id: normalizeTextValue(
          sourceForm.primary_guest_contact_id || sourceForm.primary_guest_id
        ),
        event_color: normalizeTextValue(sourceForm.event_color) || defaultEventColor,
        duration_hours: normalizeTextValue(sourceForm.duration_hours) || "0",
        duration_minutes: normalizeTextValue(sourceForm.duration_minutes) || "0",
      };
      return next;
    },
    [buildEmptyDraftState, defaultEventColor, normalizeTextValue]
  );

  const [draftState, setDraftState] = useState(() => normalizeDraftState(draft));
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const sectionRef = useRef(null);
  const lastDraftJsonRef = useRef(JSON.stringify(normalizeDraftState(draft)));

  const normalizeIdValue = useCallback((value) => {
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
    return text;
  }, []);

  const normalizedHighlightAppointmentId = useMemo(() => {
    const value = normalizeIdValue(highlightAppointmentId);
    return value == null ? "" : String(value).trim();
  }, [highlightAppointmentId, normalizeIdValue]);

  const jobId = useMemo(
    () => normalizeIdValue(jobData?.id || jobData?.ID || ""),
    [jobData, normalizeIdValue]
  );
  const inquiryUidValue = useMemo(() => String(inquiryUid || "").trim(), [inquiryUid]);
  const dealId = useMemo(
    () => normalizeIdValue(inquiryRecordId),
    [inquiryRecordId, normalizeIdValue]
  );

  const forcedMode = normalizeTextValue(mode).toLowerCase();
  const resolvedEditingId =
    forcedMode === "create"
      ? ""
      : normalizeTextValue(editingAppointmentId || draftState.editingAppointmentId);
  const isEditMode = forcedMode === "update" || Boolean(resolvedEditingId);
  const form = draftState.form;

  const normalizedPrefill = useMemo(
    () => ({
      locationId: normalizeTextValue(prefillContext?.locationId),
      locationLabel: normalizeTextValue(prefillContext?.locationLabel),
      hostId: normalizeTextValue(prefillContext?.hostId),
      hostLabel: normalizeTextValue(prefillContext?.hostLabel),
      guestId: normalizeTextValue(prefillContext?.guestId),
      guestLabel: normalizeTextValue(prefillContext?.guestLabel),
      title: normalizeTextValue(prefillContext?.title),
      description: normalizeTextValue(prefillContext?.description),
    }),
    [prefillContext, normalizeTextValue]
  );

  const applyPrefillToState = useCallback(
    (state) => {
      const next = {
        ...state,
        form: { ...state.form },
      };
      let changed = false;

      if (!normalizeTextValue(next.form.location_id) && normalizedPrefill.locationId) {
        next.form.location_id = normalizedPrefill.locationId;
        if (!normalizeTextValue(next.locationQuery)) {
          next.locationQuery =
            normalizedPrefill.locationLabel || `Property #${normalizedPrefill.locationId}`;
        }
        changed = true;
      }

      if (!normalizeTextValue(next.form.host_id) && normalizedPrefill.hostId) {
        next.form.host_id = normalizedPrefill.hostId;
        if (!normalizeTextValue(next.hostQuery)) {
          next.hostQuery = normalizedPrefill.hostLabel || `Provider #${normalizedPrefill.hostId}`;
        }
        changed = true;
      }

      if (
        !normalizeTextValue(next.form.primary_guest_contact_id) &&
        normalizedPrefill.guestId
      ) {
        next.form.primary_guest_contact_id = normalizedPrefill.guestId;
        if (!normalizeTextValue(next.guestQuery)) {
          next.guestQuery = normalizedPrefill.guestLabel || `Contact #${normalizedPrefill.guestId}`;
        }
        changed = true;
      }

      if (!normalizeTextValue(next.form.title) && normalizedPrefill.title) {
        next.form.title = normalizedPrefill.title;
        changed = true;
      }

      if (!normalizeTextValue(next.form.description) && normalizedPrefill.description) {
        next.form.description = normalizedPrefill.description;
        changed = true;
      }

      return changed ? next : state;
    },
    [normalizeTextValue, normalizedPrefill]
  );

  const {
    hasMore: hasMoreAppointments,
    remainingCount: remainingAppointmentsCount,
    showMore: showMoreAppointments,
    shouldWindow: isAppointmentsWindowed,
    visibleRows: visibleAppointments,
  } = useRenderWindow(appointments, {
    threshold: 180,
    pageSize: 120,
  });

  useEffect(() => {
    onCountChange?.(appointments.length);
  }, [appointments.length, onCountChange]);

  useEffect(() => {
    if (draft === undefined || draft === null) return;
    const normalized = normalizeDraftState(draft);
    const nextJson = JSON.stringify(normalized);
    if (nextJson === lastDraftJsonRef.current) return;
    lastDraftJsonRef.current = nextJson;
    setDraftState(normalized);
  }, [draft, normalizeDraftState]);

  useEffect(() => {
    const nextJson = JSON.stringify(draftState);
    if (nextJson === lastDraftJsonRef.current) return;
    lastDraftJsonRef.current = nextJson;
    onDraftChange?.(draftState);
  }, [draftState, onDraftChange]);

  useEffect(() => {
    setDraftState((previous) => {
      const activeEditing =
        forcedMode === "create"
          ? ""
          : normalizeTextValue(editingAppointmentId || previous.editingAppointmentId);
      if (activeEditing) return previous;
      return applyPrefillToState(previous);
    });
  }, [applyPrefillToState, editingAppointmentId, forcedMode, normalizeTextValue]);

  useEffect(() => {
    if (!normalizedHighlightAppointmentId || !hasMoreAppointments) return;
    const hasVisibleHighlightedRow = visibleAppointments.some(
      (record) =>
        String(record?.id || record?.ID || "").trim() === normalizedHighlightAppointmentId
    );
    if (hasVisibleHighlightedRow) return;
    showMoreAppointments();
  }, [
    normalizedHighlightAppointmentId,
    hasMoreAppointments,
    visibleAppointments,
    showMoreAppointments,
  ]);

  useEffect(() => {
    if (!normalizedHighlightAppointmentId) return;
    const timeoutId = window.setTimeout(() => {
      const root = sectionRef.current;
      if (!root) return;
      const matches = Array.from(root.querySelectorAll('[data-ann-kind="appointment"]'));
      const target = matches.find(
        (node) =>
          String(node?.getAttribute("data-ann-id") || "").trim() ===
          normalizedHighlightAppointmentId
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedHighlightAppointmentId, visibleAppointments.length]);

  useEffect(() => {
    if (!plugin) return undefined;

    const hasJobContext = jobId !== null && jobId !== undefined && String(jobId).trim() !== "";
    const hasInquiryContext = !hasJobContext && Boolean(inquiryUidValue);
    if (!hasJobContext && !hasInquiryContext) return undefined;

    let isActive = true;
    const request = hasJobContext
      ? fetchAppointmentsByJobId({ plugin, jobId })
      : fetchAppointmentsByInquiryUid({ plugin, inquiryUid: inquiryUidValue });

    request
      .then((records) => {
        if (!isActive) return;
        storeActions.replaceEntityCollection("appointments", records || []);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        const contextLabel = hasJobContext ? "job" : "inquiry";
        console.error(`[JobDirect] Failed loading ${contextLabel} appointments`, fetchError);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, jobId, inquiryUidValue, storeActions]);

  const locationItems = useMemo(() => {
    const mapped = (properties || []).map((record) => {
      const id = String(record?.id || record?.ID || record?.Property_ID || "").trim();
      const label =
        String(record?.property_name || record?.Property_Name || "").trim() ||
        String(record?.unique_id || record?.Unique_ID || "").trim() ||
        (id ? `Property #${id}` : "Property");
      return {
        id,
        label,
        meta: [
          record?.unique_id || record?.Unique_ID,
          record?.address_1 || record?.address || record?.Address_1 || record?.Address,
          record?.suburb_town || record?.city || record?.Suburb_Town || record?.City,
          record?.state || record?.State,
          record?.postal_code || record?.zip_code || record?.Postal_Code || record?.Zip_Code,
        ]
          .filter(Boolean)
          .join(" | "),
      };
    });

    if (
      normalizedPrefill.locationId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.locationId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.locationId,
        label: normalizedPrefill.locationLabel || `Property #${normalizedPrefill.locationId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [properties, normalizedPrefill, normalizeTextValue]);

  const hostItems = useMemo(() => {
    const mapped = (serviceProviders || []).map((record) => {
      const info = record?.Contact_Information || record?.contact_information || {};
      const id = String(record?.id || record?.ID || "").trim();
      const firstName =
        record?.first_name || record?.Contact_Information_First_Name || info?.first_name || info?.First_Name;
      const lastName =
        record?.last_name || record?.Contact_Information_Last_Name || info?.last_name || info?.Last_Name;
      const email =
        record?.email ||
        record?.contact_information_email ||
        record?.Contact_Information_Email ||
        info?.email ||
        info?.Email;
      const mobile =
        record?.sms_number ||
        record?.contact_information_sms_number ||
        record?.Contact_Information_SMS_Number ||
        info?.sms_number ||
        info?.SMS_Number;

      return {
        id,
        label: buildLookupDisplayLabel(
          [firstName, lastName].filter(Boolean).join(" ").trim(),
          email,
          mobile,
          record?.unique_id || record?.Unique_ID || (id ? `Provider #${id}` : "Service Provider")
        ),
        meta: [email, mobile, record?.unique_id || record?.Unique_ID].filter(Boolean).join(" | "),
      };
    });

    if (
      normalizedPrefill.hostId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.hostId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.hostId,
        label: normalizedPrefill.hostLabel || `Provider #${normalizedPrefill.hostId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [serviceProviders, normalizedPrefill, normalizeTextValue]);

  const guestItems = useMemo(() => {
    const mapped = (contacts || []).map((record) => {
      const id = String(record?.id || record?.ID || record?.Contact_ID || "").trim();
      const firstName = record?.first_name || record?.First_Name;
      const lastName = record?.last_name || record?.Last_Name;
      const email = record?.email || record?.Email;
      const mobile =
        record?.sms_number ||
        record?.SMS_Number ||
        record?.office_phone ||
        record?.Office_Phone;

      return {
        id,
        label: buildLookupDisplayLabel(
          [firstName, lastName].filter(Boolean).join(" ").trim(),
          email,
          mobile,
          id ? `Contact #${id}` : "Contact"
        ),
        meta: [email, mobile].filter(Boolean).join(" | "),
      };
    });

    if (
      normalizedPrefill.guestId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.guestId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.guestId,
        label: normalizedPrefill.guestLabel || `Contact #${normalizedPrefill.guestId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [contacts, normalizedPrefill, normalizeTextValue]);

  const locationItemById = useMemo(() => {
    const next = new Map();
    locationItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [locationItems]);

  const hostItemById = useMemo(() => {
    const next = new Map();
    hostItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [hostItems]);

  const guestItemById = useMemo(() => {
    const next = new Map();
    guestItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [guestItems]);

  const shouldAutoReplaceHostQuery = useCallback(
    (currentQuery, hostId, resolvedLabel) => {
      const current = normalizeTextValue(currentQuery);
      const id = normalizeTextValue(hostId);
      const next = normalizeTextValue(resolvedLabel);
      if (!id || !next) return false;
      if (!current) return true;
      if (current === next) return false;
      if (current === id) return true;
      if (
        current === normalizeTextValue(`Provider #${id}`) ||
        current === normalizeTextValue(`Provider#${id}`) ||
        (current.startsWith("provider") && current.includes(id))
      ) {
        return true;
      }
      return false;
    },
    [normalizeTextValue]
  );

  useEffect(() => {
    const selectedHostId = normalizeTextValue(form.host_id);
    if (!selectedHostId) return;
    const matchedHost = hostItems.find(
      (item) => normalizeTextValue(item.id) === selectedHostId
    );
    const resolvedHostLabel = matchedHost?.label || "";
    if (!resolvedHostLabel) return;

    setDraftState((previous) => {
      if (
        !shouldAutoReplaceHostQuery(
          previous.hostQuery,
          selectedHostId,
          resolvedHostLabel
        )
      ) {
        return previous;
      }
      return {
        ...previous,
        hostQuery: resolvedHostLabel,
      };
    });
  }, [form.host_id, hostItems, normalizeTextValue, shouldAutoReplaceHostQuery]);

  const resetForm = useCallback(
    ({ notifyParent = true } = {}) => {
      const base = buildEmptyDraftState();
      const next = applyPrefillToState(base);
      setDraftState(next);
      if (notifyParent) onResetDraft?.();
    },
    [applyPrefillToState, buildEmptyDraftState, onResetDraft]
  );

  const handleFieldChange = useCallback((field, value) => {
    setDraftState((previous) => ({
      ...previous,
      form: {
        ...previous.form,
        [field]: value,
      },
    }));
  }, []);

  const parseUnixValue = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (String(Math.trunc(Math.abs(numeric))).length <= 10) {
      return Math.trunc(numeric);
    }
    return Math.trunc(numeric / 1000);
  }, []);

  const formatDateTimeLocalInput = useCallback(
    (value) => {
      const unix = parseUnixValue(value);
      if (unix === null) return "";
      const date = new Date(unix * 1000);
      if (Number.isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hour}:${minute}`;
    },
    [parseUnixValue]
  );

  const deriveDurationFromRecord = useCallback(
    (record) => {
      const rawHours = normalizeTextValue(record?.duration_hours);
      const rawMinutes = normalizeTextValue(record?.duration_minutes);
      if (rawHours || rawMinutes) {
        return {
          hours: rawHours || "0",
          minutes: rawMinutes || "0",
        };
      }

      const start = parseUnixValue(record?.start_time);
      const end = parseUnixValue(record?.end_time);
      if (start == null || end == null || end <= start) {
        return {
          hours: "0",
          minutes: "0",
        };
      }

      const totalMinutes = Math.floor((end - start) / 60);
      return {
        hours: String(Math.floor(totalMinutes / 60)),
        minutes: String(totalMinutes % 60),
      };
    },
    [normalizeTextValue, parseUnixValue]
  );

  const resolveLocationLabel = useCallback(
    (record) =>
      normalizeTextValue(record?.location_name) ||
      locationItems.find(
        (item) => normalizeTextValue(item.id) === normalizeTextValue(record?.location_id)
      )?.label ||
      "",
    [locationItems, normalizeTextValue]
  );

  const resolveHostLabel = useCallback(
    (record) =>
      [record?.host_first_name, record?.host_last_name].filter(Boolean).join(" ").trim() ||
      hostItems.find(
        (item) => normalizeTextValue(item.id) === normalizeTextValue(record?.host_id)
      )?.label ||
      "",
    [hostItems, normalizeTextValue]
  );

  const resolveGuestLabel = useCallback(
    (record) =>
      [record?.primary_guest_first_name, record?.primary_guest_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      guestItems.find(
        (item) =>
          normalizeTextValue(item.id) ===
          normalizeTextValue(record?.primary_guest_contact_id || record?.primary_guest_id)
      )?.label ||
      "",
    [guestItems, normalizeTextValue]
  );

  const startEditing = useCallback(
    (record) => {
      const appointmentId = normalizeTextValue(record?.id || record?.ID);
      if (!appointmentId) return;
      const duration = deriveDurationFromRecord(record);
      setDraftState({
        form: {
          ...emptyForm,
          status:
            normalizeTextValue(
              resolveAppointmentMappedOption(APPOINTMENT_STATUS_OPTIONS, record?.status)?.value
            ) ||
            normalizeTextValue(record?.status) ||
            "New",
          type: normalizeTextValue(record?.type) || "select none",
          title: normalizeTextValue(record?.title),
          start_time: formatDateTimeLocalInput(record?.start_time),
          description: normalizeTextValue(record?.description),
          location_id: normalizeTextValue(record?.location_id),
          host_id: normalizeTextValue(record?.host_id),
          primary_guest_contact_id: normalizeTextValue(
            record?.primary_guest_contact_id || record?.primary_guest_id
          ),
          event_color:
            normalizeTextValue(getAppointmentEventColorValue(record)) || defaultEventColor,
          duration_hours: duration.hours,
          duration_minutes: duration.minutes,
        },
        locationQuery: resolveLocationLabel(record),
        hostQuery: resolveHostLabel(record),
        guestQuery: resolveGuestLabel(record),
        editingAppointmentId: appointmentId,
      });
    },
    [
      defaultEventColor,
      deriveDurationFromRecord,
      emptyForm,
      formatDateTimeLocalInput,
      normalizeTextValue,
      resolveGuestLabel,
      resolveHostLabel,
      resolveLocationLabel,
    ]
  );

  const computeDurationMinutes = useCallback(() => {
    const hours = Number.parseInt(normalizeTextValue(form.duration_hours) || "0", 10);
    const minutes = Number.parseInt(normalizeTextValue(form.duration_minutes) || "0", 10);
    const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
    return safeHours * 60 + safeMinutes;
  }, [form.duration_hours, form.duration_minutes, normalizeTextValue]);

  const handleSubmitAppointment = useCallback(async () => {
    if (!plugin) {
      error(isEditMode ? "Update failed" : "Create failed", "SDK is still initializing. Please try again.");
      return;
    }

    const hasInquiryContext = Boolean(inquiryUidValue || dealId);
    if (!jobId && !hasInquiryContext) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Appointment context is missing. Refresh and try again."
      );
      return;
    }
    if (hasInquiryContext && !dealId) {
      error(isEditMode ? "Update failed" : "Create failed", "Inquiry ID is missing. Refresh and try again.");
      return;
    }

    if (!form.location_id || !form.host_id || !form.primary_guest_contact_id) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Select location, host, and primary guest."
      );
      return;
    }

    const startTime = parseAppointmentDateInputToUnix(form.start_time);
    if (!form.start_time || startTime === null) {
      error(
        isEditMode ? "Update failed" : "Create failed",
        "Start time is required in a valid date/time format."
      );
      return;
    }

    const durationMinutes = computeDurationMinutes();
    const endTime = startTime + durationMinutes * 60;
    const isInquiryType = normalizeAppointmentValue(form.type) === "inquiry";
    const shouldAttachInquiry = hasInquiryContext || isInquiryType;
    const statusValue = isEditMode
      ? normalizeTextValue(form.status) || "New"
      : "New";

    const payload = {
      status: statusValue,
      type: form.type,
      title: normalizeTextValue(form.title),
      start_time: startTime,
      end_time: endTime,
      description: normalizeTextValue(form.description),
      location_id: normalizeIdValue(form.location_id),
      host_id: normalizeIdValue(form.host_id),
      primary_guest_id: normalizeIdValue(form.primary_guest_contact_id),
      event_color: normalizeTextValue(form.event_color) || defaultEventColor,
      duration_hours: normalizeTextValue(form.duration_hours) || "0",
      duration_minutes: normalizeTextValue(form.duration_minutes) || "0",
      job_id: jobId ? normalizeIdValue(jobId) : "",
      inquiry_id: shouldAttachInquiry ? dealId || "" : "",
    };

    setIsCreating(true);
    try {
      if (isEditMode) {
        const targetId = normalizeTextValue(resolvedEditingId);
        if (!targetId) {
          error("Update failed", "Appointment ID is missing.");
          return;
        }
        const updatedRecord = await updateAppointmentRecord({
          plugin,
          id: targetId,
          payload,
        });
        storeActions.upsertEntityRecord("appointments", updatedRecord, { idField: "id" });
        success("Appointment updated", "Appointment changes were saved.");
      } else {
        const createdRecord = await createAppointmentRecord({ plugin, payload });
        storeActions.upsertEntityRecord("appointments", createdRecord, { idField: "id" });
        const createdAppointmentId = normalizeTextValue(createdRecord?.id || createdRecord?.ID);
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_SCHEDULED,
          quoteJobId: String(jobId || "").trim(),
          inquiryId: String(dealId || "").trim(),
          serviceProviderId: normalizeTextValue(form.host_id),
          focusId: createdAppointmentId,
          dedupeEntityId: createdAppointmentId || `${jobId}:${dealId}:${form.title}`,
          title: "Appointment scheduled",
          content: normalizeTextValue(form.title) || "A new appointment was scheduled.",
          logContext: "job-direct:AppointmentTabSection:handleSubmitAppointment",
        });
        success("Appointment created", "Appointment was added successfully.");
      }
      resetForm();
    } catch (submitError) {
      console.error(
        `[JobDirect] Failed ${isEditMode ? "updating" : "creating"} appointment`,
        submitError
      );
      error(
        isEditMode ? "Update failed" : "Create failed",
        submitError?.message || `Unable to ${isEditMode ? "update" : "create"} appointment.`
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    computeDurationMinutes,
    dealId,
    defaultEventColor,
    error,
    form,
    inquiryUidValue,
    isEditMode,
    jobId,
    normalizeIdValue,
    normalizeTextValue,
    plugin,
    resetForm,
    resolvedEditingId,
    storeActions,
    success,
  ]);

  const handleMarkComplete = useCallback(
    async (record) => {
      const appointmentId = String(record?.id || "").trim();
      if (!plugin || !appointmentId) return;
      setUpdatingId(appointmentId);
      try {
        const updatedRecord = await updateAppointmentRecord({
          plugin,
          id: appointmentId,
          payload: {
            status: "Completed",
          },
        });
        storeActions.upsertEntityRecord("appointments", updatedRecord, { idField: "id" });
        if (normalizeTextValue(resolvedEditingId) === appointmentId) {
          setDraftState((previous) => ({
            ...previous,
            form: { ...previous.form, status: "Completed" },
          }));
        }
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_COMPLETED,
          quoteJobId: String(jobId || "").trim(),
          inquiryId: String(dealId || "").trim(),
          focusId: appointmentId,
          dedupeEntityId: `${appointmentId}:completed`,
          title: "Appointment completed",
          content: String(record?.title || "").trim() || "An appointment was marked as completed.",
          logContext: "job-direct:AppointmentTabSection:handleMarkComplete",
        });
        success("Appointment updated", "Appointment marked as completed.");
      } catch (updateError) {
        console.error("[JobDirect] Failed updating appointment", updateError);
        error("Update failed", updateError?.message || "Unable to update appointment.");
      } finally {
        setUpdatingId("");
      }
    },
    [dealId, error, jobId, normalizeTextValue, plugin, resolvedEditingId, storeActions, success]
  );

  const confirmDeleteAppointment = useCallback(async () => {
    const appointmentId = String(deleteTarget?.id || "").trim();
    if (!plugin || !appointmentId || isDeleting) return;
    setIsDeleting(true);
    try {
      const deletedId = await deleteAppointmentRecord({ plugin, id: appointmentId });
      const normalizedDeletedId = String(deletedId || "").trim();
      const nextAppointments = Array.isArray(appointments)
        ? appointments.filter(
            (record) => String(record?.id || record?.ID || "").trim() !== normalizedDeletedId
          )
        : [];
      storeActions.replaceEntityCollection("appointments", nextAppointments);
      if (normalizeTextValue(resolvedEditingId) === appointmentId) {
        resetForm({ notifyParent: false });
      }
      success("Appointment deleted", "Appointment was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting appointment", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete appointment.");
    } finally {
      setIsDeleting(false);
    }
  }, [
    appointments,
    deleteTarget,
    error,
    isDeleting,
    normalizeTextValue,
    plugin,
    resetForm,
    resolvedEditingId,
    storeActions,
    success,
  ]);

  const getStatusOption = useCallback(
    (value) => resolveAppointmentMappedOption(APPOINTMENT_STATUS_OPTIONS, value),
    []
  );
  const getEventOption = useCallback(
    (value) => resolveAppointmentMappedOption(APPOINTMENT_EVENT_COLOR_OPTIONS, value),
    []
  );

  return (
    <div
      ref={sectionRef}
      data-job-section="job-section-appointment"
      className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]"
    >
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>

          {isEditMode ? (
            <ColorMappedSelectInput
              label="Appointment Status"
              field="status"
              options={APPOINTMENT_STATUS_OPTIONS}
              value={form.status}
              onChange={(value) => handleFieldChange("status", value)}
            />
          ) : null}

          <SelectInput
            label="Type"
            field="type"
            options={APPOINTMENT_TYPE_OPTIONS}
            value={form.type}
            onChange={(value) => handleFieldChange("type", value)}
          />

          <div className="w-full">
            <FieldLabel>Title</FieldLabel>
            <input
              type="text"
              data-field="title"
              value={form.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="w-full">
            <FieldLabel>Start Time</FieldLabel>
            <input
              type="datetime-local"
              data-field="start_time"
              value={form.start_time}
              onChange={(event) => handleFieldChange("start_time", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Duration Hours"
              field="duration_hours"
              options={APPOINTMENT_DURATION_HOURS_OPTIONS}
              value={form.duration_hours}
              onChange={(value) => handleFieldChange("duration_hours", value)}
            />
            <SelectInput
              label="Duration Minutes"
              field="duration_minutes"
              options={APPOINTMENT_DURATION_MINUTES_OPTIONS}
              value={form.duration_minutes}
              onChange={(value) => handleFieldChange("duration_minutes", value)}
            />
          </div>

          <div className="w-full">
            <FieldLabel>Description</FieldLabel>
            <textarea
              rows={6}
              data-field="description"
              value={form.description}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <SearchDropdownInput
            label="Location"
            field="location_id"
            value={draftState.locationQuery}
            placeholder="Search property name or address"
            items={locationItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, locationQuery: value }));
              handleFieldChange("location_id", "");
            }}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                locationQuery: item?.label || "",
              }));
              handleFieldChange("location_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText="No properties found."
          />

          <SearchDropdownInput
            label="Host"
            field="host_id"
            value={draftState.hostQuery}
            placeholder="Search service provider"
            items={hostItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, hostQuery: value }));
              handleFieldChange("host_id", "");
            }}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                hostQuery: item?.label || "",
              }));
              handleFieldChange("host_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText={
              isServiceProviderLookupLoading
                ? "Loading service providers..."
                : "No service providers found."
            }
          />

          <SearchDropdownInput
            label="Primary Guest"
            field="primary_guest_contact_id"
            value={draftState.guestQuery}
            placeholder="Search contact"
            items={guestItems}
            onValueChange={(value) => {
              setDraftState((previous) => ({ ...previous, guestQuery: value }));
              handleFieldChange("primary_guest_contact_id", "");
            }}
            onSelect={(item) => {
              setDraftState((previous) => ({
                ...previous,
                guestQuery: item?.label || "",
              }));
              handleFieldChange("primary_guest_contact_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText="No contacts found."
          />
        </Card>

        <div className="flex gap-2">
          <Button
            id="create-appointment"
            className="w-full justify-center bg-[#003882] text-white hover:bg-[#003882]"
            variant="primary"
            onClick={handleSubmitAppointment}
            disabled={isCreating}
          >
            {isCreating
              ? isEditMode
                ? "Updating..."
                : "Creating..."
              : isEditMode
                ? "Update Appointment"
                : "Create Appointment"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => resetForm()}
            disabled={isCreating}
          >
            {isEditMode ? "Cancel Edit" : "Reset"}
          </Button>
        </div>
      </div>

      <Card className="min-w-0 space-y-4">
        <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>
        <div className="w-full max-w-full overflow-x-auto">
          <table id="appointments-table" className="w-full min-w-[1180px] table-fixed text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="w-[120px] px-2 py-2">Status</th>
                <th className="w-[200px] px-2 py-2">Start - End</th>
                <th className="w-[110px] px-2 py-2">Duration</th>
                <th className="w-[230px] px-2 py-2">Location</th>
                <th className="w-[180px] px-2 py-2">Host</th>
                <th className="w-[180px] px-2 py-2">Guest</th>
                <th className="w-[160px] px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!visibleAppointments.length ? (
                <tr>
                  <td className="px-2 py-3 text-slate-400" colSpan={7}>
                    No appointments added yet.
                  </td>
                </tr>
              ) : (
                visibleAppointments.map((record) => {
                  const recordId = String(record?.id || record?.ID || "").trim();
                  const statusOption = getStatusOption(record?.status);
                  const rawEventColor = getAppointmentEventColorValue(record);
                  const eventOption = getEventOption(rawEventColor);
                  const statusLabel =
                    statusOption?.label || String(record?.status || "").trim() || "-";
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
                    String(record?.location_name || "").trim() ||
                    toText(locationLookup?.label) ||
                    "-";
                  const locationMapQuery = buildLocationMapQuery(locationName, locationLookup?.meta);
                  const hostName =
                    [record?.host_first_name, record?.host_last_name].filter(Boolean).join(" ").trim() ||
                    hostLookupDetails.name ||
                    (hostId
                      ? `Provider #${hostId}`
                      : "-");
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
                    Boolean(normalizedHighlightAppointmentId) &&
                    recordId === normalizedHighlightAppointmentId;
                  const rowTintStyle =
                    !isHighlighted && eventOption?.backgroundColor
                      ? { backgroundColor: eventOption.backgroundColor }
                      : undefined;

                  return (
                    <tr
                      key={recordId}
                      data-ann-kind="appointment"
                      data-ann-id={recordId}
                      data-ann-highlighted={isHighlighted ? "true" : "false"}
                      className={`border-b border-slate-100 last:border-b-0 ${
                        isHighlighted ? "bg-amber-50" : ""
                      }`}
                      style={rowTintStyle}
                    >
                      <td className="px-2 py-3">
                        <span
                          className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium"
                          style={
                            statusOption
                              ? {
                                  color: statusOption.color,
                                  backgroundColor: statusOption.backgroundColor,
                                }
                              : undefined
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-800">
                        {`${formatAppointmentUnix(record?.start_time)} - ${formatAppointmentUnix(
                          record?.end_time
                        )}`}
                      </td>
                      <td className="px-2 py-3 text-slate-800">
                        {formatAppointmentDuration(record?.duration_hours, record?.duration_minutes)}
                      </td>
                      <td className="px-2 py-3 align-top text-slate-800">
                        <div className="min-w-0 max-w-[230px]">
                          <div className="truncate font-medium" title={locationName}>
                            {locationName}
                          </div>
                          <TableContactActions mapQuery={locationMapQuery} />
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-slate-800">
                        <div className="min-w-0 max-w-[180px]">
                          <div className="truncate font-medium" title={hostName}>
                            {hostName}
                          </div>
                          <TableContactActions email={hostEmail} phone={hostPhone} />
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-slate-800">
                        <div className="min-w-0 max-w-[180px]">
                          <div className="truncate font-medium" title={guestName}>
                            {guestName}
                          </div>
                          <TableContactActions email={guestEmail} phone={guestPhone} />
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => startEditing(record)}
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
                })
              )}
            </tbody>
          </table>
        </div>
        {hasMoreAppointments ? (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {visibleAppointments.length} of {appointments.length} appointments
            </span>
            <Button type="button" variant="outline" onClick={showMoreAppointments}>
              Load {Math.min(remainingAppointmentsCount, 120)} more
            </Button>
          </div>
        ) : isAppointmentsWindowed ? (
          <div className="text-xs text-slate-500">Showing all {appointments.length} appointments.</div>
        ) : null}
      </Card>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Appointment"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteAppointment}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this appointment?</p>
      </Modal>
    </div>
  );
}
