import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
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
  fetchAppointmentsByInquiryUid,
  updateAppointmentRecord,
} from "../../../sdk/jobDirectSdk.js";
import {
  CheckActionIcon as CheckIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import { useRenderWindow } from "../../primitives/JobDirectTable.jsx";

function FieldLabel({ children }) {
  return <div className="text-sm font-medium leading-4 text-neutral-700">{children}</div>;
}

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

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 9l6 6 6-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function SelectInput({
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

function ColorMappedSelectInput({
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

function SearchDropdownInput({
  label,
  field,
  value,
  placeholder,
  items = [],
  onValueChange,
  onSelect,
  onAdd,
  hideAddAction = false,
  emptyText,
  addButtonLabel,
  rootData,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const query = normalizeText(value);
    if (!query) return items;
    return items.filter((item) => {
      const searchText = [item.label, item.meta, item.id].map(normalizeText).join(" ");
      return searchText.includes(query);
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
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-3 inline-flex items-center rounded-md px-2 text-slate-400"
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

function normalizeAppointmentValue(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveAppointmentMappedOption(options = [], rawValue = "") {
  const target = normalizeAppointmentValue(rawValue);
  if (!target) return null;

  return (
    options.find((option) => normalizeAppointmentValue(option.value) === target) ||
    options.find((option) => normalizeAppointmentValue(option.label) === target) ||
    options.find((option) => normalizeAppointmentValue(option.code) === target) ||
    null
  );
}

function getAppointmentEventColorValue(record = {}) {
  const candidates = [
    record?.event_color,
    record?.Event_Color,
    record?.event_colour,
    record?.Event_Colour,
    record?.google_calendar_event_color,
    record?.Google_Calendar_Event_Color,
    record?.google_calendar_color,
    record?.Google_Calendar_Color,
  ];
  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function parseAppointmentDateInputToUnix(value = "") {
  const text = String(value || "").trim();
  if (!text) return null;

  const isoLocal = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (isoLocal) {
    const year = Number.parseInt(isoLocal[1], 10);
    const month = Number.parseInt(isoLocal[2], 10);
    const day = Number.parseInt(isoLocal[3], 10);
    const hour = Number.parseInt(isoLocal[4], 10);
    const minute = Number.parseInt(isoLocal[5], 10);
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / 1000);
  }

  const withTime = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (!withTime) return null;

  const day = Number.parseInt(withTime[1], 10);
  const month = Number.parseInt(withTime[2], 10);
  const year = Number.parseInt(withTime[3], 10);
  const hour = Number.parseInt(withTime[4] || "0", 10);
  const minute = Number.parseInt(withTime[5] || "0", 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function formatAppointmentUnix(value = "") {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const text = String(value || "").trim();
    return text || "-";
  }

  const asMs = String(Math.trunc(Math.abs(numeric))).length <= 10 ? numeric * 1000 : numeric;
  const date = new Date(asMs);
  if (Number.isNaN(date.getTime())) return "-";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function formatAppointmentDuration(hours = "", minutes = "") {
  const hh = String(hours || "0").trim();
  const mm = String(minutes || "0").trim();
  if (!hh && !mm) return "-";
  return `${hh || "0"}h ${mm || "0"}m`;
}

export function AppointmentTabSection({
  plugin,
  jobData,
  preloadedLookupData,
  onCountChange,
  inquiryRecordId = "",
  inquiryUid = "",
  highlightAppointmentId = "",
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
  const emptyForm = useMemo(
    () => ({
      status: "",
      type: "select none",
      title: "",
      start_time: "",
      end_time: "",
      description: "",
      location_id: "",
      host_id: "",
      primary_guest_contact_id: "",
      event_color: "",
      duration_hours: "0",
      duration_minutes: "0",
    }),
    []
  );

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
  const inquiryUidValue = useMemo(
    () => String(inquiryUid || "").trim(),
    [inquiryUid]
  );
  const dealId = useMemo(
    () => normalizeIdValue(inquiryRecordId),
    [inquiryRecordId, normalizeIdValue]
  );

  const [form, setForm] = useState(emptyForm);
  const [locationQuery, setLocationQuery] = useState("");
  const [hostQuery, setHostQuery] = useState("");
  const [guestQuery, setGuestQuery] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
    if (!plugin || jobId || !inquiryUidValue) return undefined;

    let isActive = true;
    fetchAppointmentsByInquiryUid({ plugin, inquiryUid: inquiryUidValue })
      .then((records) => {
        if (!isActive) return;
        storeActions.replaceEntityCollection("appointments", records || []);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading inquiry appointments", fetchError);
        storeActions.replaceEntityCollection("appointments", []);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, jobId, inquiryUidValue, storeActions]);

  const locationItems = useMemo(
    () =>
      (properties || []).map((record) => {
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
      }),
    [properties]
  );

  const hostItems = useMemo(
    () =>
      (serviceProviders || []).map((record) => {
        const id = String(record?.id || record?.ID || "").trim();
        const label =
          [
            record?.first_name || record?.Contact_Information_First_Name,
            record?.last_name || record?.Contact_Information_Last_Name,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          record?.email ||
          record?.contact_information_email ||
          record?.Contact_Information_Email ||
          record?.sms_number ||
          record?.contact_information_sms_number ||
          record?.Contact_Information_SMS_Number ||
          record?.unique_id ||
          record?.Unique_ID ||
          (id ? `Provider #${id}` : "Service Provider");
        return {
          id,
          label,
          meta: [
            record?.email || record?.contact_information_email || record?.Contact_Information_Email,
            record?.sms_number ||
              record?.contact_information_sms_number ||
              record?.Contact_Information_SMS_Number,
            record?.unique_id || record?.Unique_ID,
          ]
            .filter(Boolean)
            .join(" | "),
        };
      }),
    [serviceProviders]
  );

  const guestItems = useMemo(
    () =>
      (contacts || []).map((record) => {
        const id = String(record?.id || record?.ID || record?.Contact_ID || "").trim();
        const label =
          [record?.first_name || record?.First_Name, record?.last_name || record?.Last_Name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          record?.email ||
          record?.Email ||
          record?.sms_number ||
          record?.SMS_Number ||
          (id ? `Contact #${id}` : "Contact");
        return {
          id,
          label,
          meta: [
            record?.email || record?.Email,
            record?.sms_number || record?.SMS_Number,
            record?.office_phone || record?.Office_Phone,
          ]
            .filter(Boolean)
            .join(" | "),
        };
      }),
    [contacts]
  );

  const handleFieldChange = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setLocationQuery("");
    setHostQuery("");
    setGuestQuery("");
  };

  const handleCreateAppointment = async () => {
    if (!plugin) {
      error("Create failed", "SDK is still initializing. Please try again.");
      return;
    }
    const hasInquiryContext = Boolean(inquiryUidValue || dealId);
    if (!jobId && !hasInquiryContext) {
      error("Create failed", "Appointment context is missing. Refresh and try again.");
      return;
    }
    if (hasInquiryContext && !dealId) {
      error("Create failed", "Inquiry ID is missing. Refresh and try again.");
      return;
    }
    if (!form.status || !form.location_id || !form.host_id || !form.primary_guest_contact_id) {
      error("Create failed", "Select status, location, host, and primary guest.");
      return;
    }

    const startTime = parseAppointmentDateInputToUnix(form.start_time);
    const endTime = parseAppointmentDateInputToUnix(form.end_time);
    if (form.start_time && startTime === null) {
      error("Create failed", "Start time must be in dd/mm/yyyy or dd/mm/yyyy hh:mm format.");
      return;
    }
    if (form.end_time && endTime === null) {
      error("Create failed", "End time must be in dd/mm/yyyy or dd/mm/yyyy hh:mm format.");
      return;
    }
    if (startTime !== null && endTime !== null && endTime < startTime) {
      error("Create failed", "End time cannot be before start time.");
      return;
    }

    const guestId = normalizeIdValue(form.primary_guest_contact_id);
    const isInquiryType = normalizeAppointmentValue(form.type) === "inquiry";
    const shouldAttachInquiry = hasInquiryContext || isInquiryType;
    const payload = {
      status: form.status,
      type: form.type,
      title: String(form.title || "").trim(),
      start_time: startTime,
      end_time: endTime,
      description: String(form.description || "").trim(),
      location_id: normalizeIdValue(form.location_id),
      host_id: normalizeIdValue(form.host_id),
      primary_guest_id: guestId,
      event_color: form.event_color,
      duration_hours: String(form.duration_hours || "0").trim(),
      duration_minutes: String(form.duration_minutes || "0").trim(),
      job_id: jobId ? normalizeIdValue(jobId) : "",
      inquiry_id: shouldAttachInquiry ? dealId || "" : "",
    };

    setIsCreating(true);
    try {
      const createdRecord = await createAppointmentRecord({ plugin, payload });
      storeActions.upsertEntityRecord("appointments", createdRecord, { idField: "id" });
      const createdAppointmentId = String(createdRecord?.id || createdRecord?.ID || "").trim();
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.APPOINTMENT_SCHEDULED,
        quoteJobId: String(jobId || "").trim(),
        inquiryId: String(dealId || "").trim(),
        serviceProviderId: String(form.host_id || "").trim(),
        focusId: createdAppointmentId,
        dedupeEntityId: createdAppointmentId || `${jobId}:${dealId}:${form.title}`,
        title: "Appointment scheduled",
        content: String(form.title || "").trim() || "A new appointment was scheduled.",
        logContext: "job-direct:AppointmentTabSection:handleCreateAppointment",
      });
      success("Appointment created", "Appointment was added successfully.");
      resetForm();
    } catch (createError) {
      console.error("[JobDirect] Failed creating appointment", createError);
      error("Create failed", createError?.message || "Unable to create appointment.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleMarkComplete = async (record) => {
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
  };

  const confirmDeleteAppointment = async () => {
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
      success("Appointment deleted", "Appointment was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting appointment", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete appointment.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusOption = (value) =>
    resolveAppointmentMappedOption(APPOINTMENT_STATUS_OPTIONS, value);
  const getEventOption = (value) =>
    resolveAppointmentMappedOption(APPOINTMENT_EVENT_COLOR_OPTIONS, value);

  return (
    <div
      data-job-section="job-section-appointment"
      className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]"
    >
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>

          <ColorMappedSelectInput
            label="Appointment Status"
            field="status"
            options={APPOINTMENT_STATUS_OPTIONS}
            value={form.status}
            onChange={(value) => handleFieldChange("status", value)}
          />
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="w-full">
              <FieldLabel>End Time</FieldLabel>
              <input
                type="datetime-local"
                data-field="end_time"
                value={form.end_time}
                onChange={(event) => handleFieldChange("end_time", event.target.value)}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
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
            value={locationQuery}
            placeholder="Search property name or address"
            items={locationItems}
            onValueChange={(value) => {
              setLocationQuery(value);
              handleFieldChange("location_id", "");
            }}
            onSelect={(item) => {
              setLocationQuery(item?.label || "");
              handleFieldChange("location_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText="No properties found."
          />

          <SearchDropdownInput
            label="Host"
            field="host_id"
            value={hostQuery}
            placeholder="Search service provider"
            items={hostItems}
            onValueChange={(value) => {
              setHostQuery(value);
              handleFieldChange("host_id", "");
            }}
            onSelect={(item) => {
              setHostQuery(item?.label || "");
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
            value={guestQuery}
            placeholder="Search contact"
            items={guestItems}
            onValueChange={(value) => {
              setGuestQuery(value);
              handleFieldChange("primary_guest_contact_id", "");
            }}
            onSelect={(item) => {
              setGuestQuery(item?.label || "");
              handleFieldChange("primary_guest_contact_id", String(item?.id || "").trim());
            }}
            hideAddAction
            emptyText="No contacts found."
          />

          <div className="border-t border-slate-200 pt-4">
            <div className="text-base font-bold leading-4 text-neutral-700">Google Calendar</div>
          </div>
          <ColorMappedSelectInput
            label="Event Color"
            field="event_color"
            options={APPOINTMENT_EVENT_COLOR_OPTIONS}
            value={form.event_color}
            onChange={(value) => handleFieldChange("event_color", value)}
          />
        </Card>
        <Button
          id="create-appointment"
          className="w-full justify-center bg-[#003882] text-white hover:bg-[#003882]"
          variant="primary"
          onClick={handleCreateAppointment}
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create Appointment"}
        </Button>
      </div>

      <Card className="min-w-0 space-y-4">
        <div className="text-base font-bold leading-4 text-neutral-700">Appointments</div>
        <div className="w-full max-w-full overflow-x-auto">
          <table id="appointments-table" className="w-full min-w-[900px] table-fixed text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="w-[120px] px-2 py-2">Status</th>
                <th className="w-[200px] px-2 py-2">Start - End</th>
                <th className="w-[110px] px-2 py-2">Duration</th>
                <th className="w-[180px] px-2 py-2">Location</th>
                <th className="w-[140px] px-2 py-2">Host</th>
                <th className="w-[140px] px-2 py-2">Guest</th>
                <th className="w-[110px] px-2 py-2">Event Color</th>
                <th className="w-[150px] px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!visibleAppointments.length ? (
                <tr>
                  <td className="px-2 py-3 text-slate-400" colSpan={8}>
                    No appointments added yet.
                  </td>
                </tr>
              ) : (
                visibleAppointments.map((record) => {
                    const recordId = String(record?.id || "").trim();
                    const statusOption = getStatusOption(record?.status);
                    const rawEventColor = getAppointmentEventColorValue(record);
                    const eventOption = getEventOption(rawEventColor);
                    const statusLabel = statusOption?.label || String(record?.status || "").trim() || "-";
                    const eventLabel = eventOption?.label || rawEventColor || "-";
                    const isCompleted = normalizeAppointmentValue(statusLabel) === "completed";
                    const locationName =
                      String(record?.location_name || "").trim() ||
                      locationItems.find((item) => String(item.id) === String(record?.location_id || "").trim())?.label ||
                      "-";
                    const hostName =
                      [record?.host_first_name, record?.host_last_name].filter(Boolean).join(" ").trim() ||
                      hostItems.find((item) => String(item.id) === String(record?.host_id || "").trim())?.label ||
                      (String(record?.host_id || "").trim()
                        ? `Provider #${String(record?.host_id || "").trim()}`
                        : "-");
                    const guestName =
                      [record?.primary_guest_first_name, record?.primary_guest_last_name]
                        .filter(Boolean)
                        .join(" ")
                        .trim() ||
                      guestItems.find(
                        (item) =>
                          String(item.id) === String(record?.primary_guest_contact_id || "").trim()
                      )?.label ||
                      "-";
                    const isHighlighted =
                      Boolean(normalizedHighlightAppointmentId) &&
                      recordId === normalizedHighlightAppointmentId;

                    return (
                      <tr
                        key={recordId}
                        className={`border-b border-slate-100 last:border-b-0 ${
                          isHighlighted ? "bg-amber-50" : ""
                        }`}
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
                          {formatAppointmentDuration(
                            record?.duration_hours,
                            record?.duration_minutes
                          )}
                        </td>
                        <td className="px-2 py-3 text-slate-800">{locationName}</td>
                        <td className="px-2 py-3 text-slate-800">{hostName}</td>
                        <td className="px-2 py-3 text-slate-800">{guestName}</td>
                        <td className="px-2 py-3">
                          <span
                            className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium"
                            style={
                              eventOption
                                ? {
                                    color: eventOption.color,
                                    backgroundColor: eventOption.backgroundColor,
                                  }
                                : undefined
                            }
                          >
                            {eventLabel}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center justify-end gap-2">
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
          <div className="text-xs text-slate-500">
            Showing all {appointments.length} appointments.
          </div>
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
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
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
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this appointment?
        </p>
      </Modal>
    </div>
  );
}
