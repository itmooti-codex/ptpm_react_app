import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  ColorMappedSelectInput,
  SearchDropdownInput,
  SelectInput,
} from "../../../job-direct/components/sections/job-information/JobInfoFormFields.jsx";
import { AppointmentTabSection } from "../../../job-direct/components/sections/job-information/AppointmentTabSection.jsx";
import { PropertyTabSection } from "../../../job-direct/components/sections/job-information/PropertyTabSection.jsx";
import { ServiceProviderTabSection } from "../../../job-direct/components/sections/job-information/ServiceProviderTabSection.jsx";
import { useLinkedPropertiesData } from "../../../job-direct/components/sections/job-information/useLinkedPropertiesData.js";
import { normalizePropertyId } from "../../../job-direct/components/sections/job-information/jobInfoUtils.js";
import { useContactEntityLookupData } from "../../../job-direct/hooks/useContactEntityLookupData.js";
import { usePropertyLookupData } from "../../../job-direct/hooks/usePropertyLookupData.js";
import {
  createCompanyRecord,
  createContactRecord,
  createPropertyRecord,
  fetchServicesForActivities,
  updatePropertyRecord,
} from "../../../job-direct/sdk/jobDirectSdk.js";
import { extractRecords } from "../../../job-direct/sdk/utils/sdkResponseUtils.js";

const INQUIRY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "request", label: "Request Details" },
  { id: "pipeline", label: "Deal Pipeline" },
  { id: "notes", label: "Notes" },
  { id: "service-provider", label: "Service Provider" },
  { id: "property", label: "Property" },
  { id: "appointments", label: "Appointment" },
];

const INQUIRY_STATUS_OPTIONS = [
  { code: "209", value: "New Inquiry", label: "New Inquiry", color: "#d81b60", backgroundColor: "#f7d1df" },
  { code: "801", value: "Not Allocated", label: "Not Allocated", color: "#d81b60", backgroundColor: "#f7d1df" },
  { code: "609", value: "Contact Client", label: "Contact Client", color: "#ab47bc", backgroundColor: "#eedaf2" },
  { code: "208", value: "Contact For Site Visit", label: "Contact For Site Visit", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  { code: "207", value: "Site Visit Scheduled", label: "Site Visit Scheduled", color: "#ffb300", backgroundColor: "#fff0cc" },
  {
    code: "206",
    value: "Site Visit to be Re-Scheduled",
    label: "Site Visit to be Re-Scheduled",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  { code: "205", value: "Generate Quote", label: "Generate Quote", color: "#00acc1", backgroundColor: "#cceef3" },
  { code: "204", value: "Quote Created", label: "Quote Created", color: "#43a047", backgroundColor: "#d9ecda" },
  { code: "506", value: "Completed", label: "Completed", color: "#43a047", backgroundColor: "#d9ecda" },
  { code: "505", value: "Cancelled", label: "Cancelled", color: "#000000", backgroundColor: "#cccccc" },
  { code: "696", value: "Expired", label: "Expired", color: "#757575", backgroundColor: "#e3e3e3" },
];

const INQUIRY_SOURCE_OPTIONS = [
  { code: "191", value: "Web Form", label: "Web Form" },
  { code: "190", value: "Phone Call", label: "Phone Call" },
  { code: "189", value: "Email", label: "Email" },
  { code: "188", value: "SMS", label: "SMS" },
];

const INQUIRY_TYPE_OPTIONS = [
  { code: "223", value: "General Inquiry", label: "General Inquiry" },
  { code: "222", value: "Service Request or Quote", label: "Service Request or Quote" },
  { code: "221", value: "Product or Service Information", label: "Product or Service Information" },
  { code: "220", value: "Customer Support or Technical Assistance", label: "Customer Support or Technical Assistance" },
  { code: "219", value: "Billing and Payment", label: "Billing and Payment" },
  { code: "218", value: "Appointment Scheduling or Rescheduling", label: "Appointment Scheduling or Rescheduling" },
  { code: "217", value: "Feedback or Suggestions", label: "Feedback or Suggestions" },
  { code: "214", value: "Complaint or Issue Reporting", label: "Complaint or Issue Reporting" },
  { code: "216", value: "Partnership or Collaboration Inquiry", label: "Partnership or Collaboration Inquiry" },
  { code: "215", value: "Job Application or Career Opportunities", label: "Job Application or Career Opportunities" },
  { code: "213", value: "Media or Press Inquiry", label: "Media or Press Inquiry" },
];

const HOW_DID_YOU_HEAR_OPTIONS = [
  { code: "187", value: "Google", label: "Google" },
  { code: "186", value: "Bing", label: "Bing" },
  { code: "185", value: "Facebook", label: "Facebook" },
  { code: "184", value: "Yellow Pages", label: "Yellow Pages" },
  { code: "183", value: "Referral", label: "Referral" },
  { code: "182", value: "Car Signage", label: "Car Signage" },
  { code: "181", value: "Returning Customers", label: "Returning Customers" },
  { code: "180", value: "Other", label: "Other" },
];

const SALES_STAGE_OPTIONS = [
  { code: "11", value: "New Lead", label: "New Lead" },
  { code: "12", value: "Qualified Prospect", label: "Qualified Prospect" },
  { code: "13", value: "Visit Scheduled", label: "Visit Scheduled" },
  { code: "14", value: "Consideration", label: "Consideration" },
  { code: "15", value: "Committed", label: "Committed" },
  { code: "16", value: "Closed - Won", label: "Closed - Won" },
  { code: "17", value: "Closed - Lost", label: "Closed - Lost" },
];

const RECENT_ACTIVITY_OPTIONS = [
  {
    code: "20",
    value: "Active more than a month ago",
    label: "Active more than a month ago",
    color: "#e64a19",
    backgroundColor: "#fadbd1",
  },
  {
    code: "19",
    value: "Active in the last month",
    label: "Active in the last month",
    color: "#fdd835",
    backgroundColor: "#fff7d7",
  },
  {
    code: "18",
    value: "Active in the last week",
    label: "Active in the last week",
    color: "#689f38",
    backgroundColor: "#e1ecd7",
  },
];

const NOISE_SIGN_OPTIONS = [
  { code: "768", value: "Fighting", label: "Fighting" },
  { code: "767", value: "Walking", label: "Walking" },
  { code: "766", value: "Heavy", label: "Heavy" },
  { code: "765", value: "Footsteps", label: "Footsteps" },
  { code: "764", value: "Running", label: "Running" },
  { code: "763", value: "Scurrying", label: "Scurrying" },
  { code: "762", value: "Thumping", label: "Thumping" },
  { code: "761", value: "Hissing", label: "Hissing" },
  { code: "760", value: "Shuffle", label: "Shuffle" },
  { code: "759", value: "Scratching", label: "Scratching" },
  { code: "758", value: "Can hear coming & going", label: "Can hear coming & going" },
  { code: "757", value: "Movement", label: "Movement" },
  { code: "756", value: "Gnawing", label: "Gnawing" },
  { code: "755", value: "Rolling", label: "Rolling" },
  { code: "754", value: "Dragging", label: "Dragging" },
  { code: "753", value: "Squeaking", label: "Squeaking" },
  { code: "752", value: "Galloping", label: "Galloping" },
  { code: "751", value: "Poss Pee", label: "Poss Pee" },
  { code: "750", value: "Fast", label: "Fast" },
  { code: "749", value: "Slow", label: "Slow" },
  { code: "748", value: "Bad Smell", label: "Bad Smell" },
];

const PEST_LOCATION_OPTIONS = [
  { code: "735", value: "Upper Ceiling", label: "Upper Ceiling" },
  { code: "734", value: "Between floors", label: "Between floors" },
  { code: "733", value: "In Walls", label: "In Walls" },
  { code: "732", value: "In House", label: "In House" },
  { code: "731", value: "Chimney", label: "Chimney" },
  { code: "730", value: "Garage", label: "Garage" },
  { code: "729", value: "Kitchen", label: "Kitchen" },
  { code: "728", value: "Hand Catch", label: "Hand Catch" },
  { code: "727", value: "On roof", label: "On roof" },
  { code: "726", value: "Underneath House", label: "Underneath House" },
  { code: "725", value: "Under Solar Panels", label: "Under Solar Panels" },
];

const PEST_ACTIVE_TIME_OPTIONS = [
  { code: "747", value: "Dawn", label: "Dawn" },
  { code: "746", value: "Dusk", label: "Dusk" },
  { code: "745", value: "Dusk & Dawn", label: "Dusk & Dawn" },
  { code: "744", value: "During Day", label: "During Day" },
  { code: "743", value: "Middle of night", label: "Middle of night" },
  { code: "742", value: "Night", label: "Night" },
  { code: "741", value: "Early morning", label: "Early morning" },
  { code: "740", value: "Evening", label: "Evening" },
  { code: "739", value: "1-2 am", label: "1-2 am" },
  { code: "738", value: "3-4 am", label: "3-4 am" },
  { code: "737", value: "7 - 8 pm", label: "7 - 8 pm" },
  { code: "736", value: "7.30-10 pm", label: "7.30-10 pm" },
];

const EMPTY_FORM = {
  sales_stage: "",
  deal_value: "",
  expected_win: "",
  expected_close_date: "",
  actual_close_date: "",
  weighted_value: "",
  recent_activity: "",
  account_type: "Contact",
  client_id: "",
  company_id: "",
  service_provider_id: "",
  client_notes: "",
  property_id: "",
  inquiry_status: "New Inquiry",
  inquiry_source: "",
  type: "",
  how_did_you_hear: "",
  other: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  admin_notes: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
  renovations: "",
  resident_availability: "",
  date_job_required_by: "",
};

function TextAreaField({
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

function TabNav({ activeTab, onTabChange, appointmentCount = 0 }) {
  return (
    <div className="border-b border-slate-300 bg-white pt-4">
      <div className="inline-flex items-center">
        {INQUIRY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`inline-flex items-center gap-2 px-6 py-3 ${
              activeTab === tab.id
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="text-xs">◉</span>
            {tab.label}
            {tab.id === "appointments" ? (
              <span className="rounded-[10px] bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {String(appointmentCount || 0).padStart(2, "0")}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildContactItems(list = []) {
  return (list || []).map((item) => ({
    id: item.id,
    label:
      [item.first_name, item.last_name].filter(Boolean).join(" ").trim() ||
      item.email ||
      `Contact #${item.id}`,
    meta: [item.email, item.sms_number, item.id].filter(Boolean).join(" | "),
  }));
}

function buildCompanyItems(list = []) {
  return (list || []).map((item) => ({
    id: item.id,
    label: item.name || `Company #${item.id}`,
    meta: [item.account_type, item.primary?.email, item.id].filter(Boolean).join(" | "),
  }));
}

function toText(value) {
  return String(value || "").trim();
}

function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

function normalizeOptionValue(rawValue, options = []) {
  const text = toText(rawValue);
  if (!text) return "";
  const target = text.toLowerCase();
  const matchedOption = options.find((option) => {
    const values = [option?.value, option?.label, option?.code].map((item) =>
      toText(item).toLowerCase()
    );
    return values.includes(target);
  });
  return matchedOption ? toText(matchedOption.value) : text;
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    return new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
  }
  return Promise.resolve(result);
}

function parseListSelectionValue(value, options = []) {
  const text = toText(value);
  if (!text) return [];
  const normalizedTokens = text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => toText(item).toLowerCase())
    .filter(Boolean);
  if (!normalizedTokens.length) return [];

  const selected = [];
  normalizedTokens.forEach((token) => {
    const option = options.find((item) => {
      const candidates = [item?.code, item?.value, item?.label].map((candidate) =>
        toText(candidate).toLowerCase()
      );
      return candidates.includes(token);
    });
    if (!option) return;
    const optionKey = toText(option.code || option.value);
    if (!optionKey) return;
    if (selected.includes(optionKey)) return;
    selected.push(optionKey);
  });
  return selected;
}

function serializeListSelectionValue(selection = []) {
  const normalized = Array.from(
    new Set(
      (selection || [])
        .map((item) => toText(item))
        .filter(Boolean)
    )
  );
  if (!normalized.length) return "";
  return normalized.map((item) => `*/*${item}*/*`).join("");
}

function normalizeInitialForm(values = null) {
  if (!values || typeof values !== "object") {
    return { ...EMPTY_FORM };
  }
  const next = { ...EMPTY_FORM };
  Object.keys(EMPTY_FORM).forEach((key) => {
    next[key] = toText(values[key]);
  });
  next.sales_stage = normalizeOptionValue(next.sales_stage, SALES_STAGE_OPTIONS);
  next.recent_activity = normalizeOptionValue(next.recent_activity, RECENT_ACTIVITY_OPTIONS);
  next.inquiry_status = normalizeOptionValue(next.inquiry_status, INQUIRY_STATUS_OPTIONS);
  next.inquiry_source = normalizeOptionValue(next.inquiry_source, INQUIRY_SOURCE_OPTIONS);
  next.type = normalizeOptionValue(next.type, INQUIRY_TYPE_OPTIONS);
  next.how_did_you_hear = normalizeOptionValue(next.how_did_you_hear, HOW_DID_YOU_HEAR_OPTIONS);
  next.service_inquiry_id = normalizeServiceInquiryId(next.service_inquiry_id);
  next.renovations = toText(next.renovations);
  next.resident_availability = toText(next.resident_availability);
  next.noise_signs_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.noise_signs_options_as_text, NOISE_SIGN_OPTIONS)
  );
  next.pest_active_times_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.pest_active_times_options_as_text, PEST_ACTIVE_TIME_OPTIONS)
  );
  next.pest_location_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.pest_location_options_as_text, PEST_LOCATION_OPTIONS)
  );
  return next;
}

function ListSelectionField({ label, field, value, options = [], onChange, emptyText }) {
  const selectedValues = useMemo(
    () => parseListSelectionValue(value, options),
    [value, options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionLabelByKey = useMemo(() => {
    const map = new Map();
    options.forEach((option) => {
      const key = toText(option.code || option.value);
      if (!key) return;
      map.set(key, option.label || option.value || option.code);
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
          {selectedValues.length ? (
            selectedValues.map((key) => (
              <span
                key={`${field}-selected-${key}`}
                className="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
              >
                {optionLabelByKey.get(key) || key}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">{emptyText || "No selection"}</span>
          )}
        </div>
        <div className="max-h-32 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionKey = toText(option.code || option.value);
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
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InquiryInformationSection({
  activeTab,
  onTabChange,
  plugin,
  preloadedLookupData,
  onOpenContactDetailsModal,
  onOpenAddPropertyModal,
  onSubmitServiceProvider,
  initialValues,
  onDraftChange,
  inquiryId = "",
  inquiryUid = "",
  linkedJobId = "",
}) {
  const [form, setForm] = useState(() => normalizeInitialForm(initialValues));
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [serviceInquiryOptions, setServiceInquiryOptions] = useState([]);
  const [serviceInquiryLabelById, setServiceInquiryLabelById] = useState({});
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const { success, error } = useToast();

  const {
    contacts,
    companies,
    addContact,
    addCompany,
    isLookupLoading: isContactCompanyLoading,
  } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });
  const { properties: lookupProperties, addProperty } = usePropertyLookupData(plugin, {
    initialProperties: preloadedLookupData?.properties || [],
    skipInitialFetch: true,
  });

  const contactItems = useMemo(() => buildContactItems(contacts), [contacts]);
  const companyItems = useMemo(() => buildCompanyItems(companies), [companies]);

  useEffect(() => {
    setForm(normalizeInitialForm(initialValues));
  }, [initialValues]);

  useEffect(() => {
    const isCompanyMode = toText(form.account_type) === "Company";
    if (isCompanyMode) {
      if (contactSearch) setContactSearch("");
      const companyId = toText(form.company_id);
      if (!companyId) {
        if (companySearch) setCompanySearch("");
        return;
      }
      const matchedCompany = companyItems.find(
        (item) => toText(item?.id) === companyId
      );
      const nextCompanyLabel = toText(matchedCompany?.label);
      if (nextCompanyLabel && nextCompanyLabel !== companySearch) {
        setCompanySearch(nextCompanyLabel);
      }
      return;
    }

    if (companySearch) setCompanySearch("");
    const clientId = toText(form.client_id);
    if (!clientId) {
      if (contactSearch) setContactSearch("");
      return;
    }
    const matchedContact = contactItems.find(
      (item) => toText(item?.id) === clientId
    );
    const nextClientLabel = toText(matchedContact?.label);
    if (nextClientLabel && nextClientLabel !== contactSearch) {
      setContactSearch(nextClientLabel);
    }
  }, [
    form.account_type,
    form.client_id,
    form.company_id,
    contactItems,
    companyItems,
    contactSearch,
    companySearch,
  ]);

  useEffect(() => {
    if (!plugin?.switchTo) {
      setServiceInquiryOptions([]);
      setServiceInquiryLabelById({});
      return;
    }

    let isMounted = true;
    setIsServicesLoading(true);

    const loadServices = async () => {
      try {
        const query = plugin
          .switchTo("PeterpmService")
          .query()
          .where("service_type", "Primary")
          .deSelectAll()
          .select(["id", "service_name", "service_type"])
          .noDestroy();
        query.getOrInitQueryCalc?.();
        const response = await toPromiseLike(query.fetchDirect());
        let records = extractRecords(response);
        if (!records.length) {
          const fallback = await fetchServicesForActivities({ plugin });
          records = Array.isArray(fallback) ? fallback : [];
        }
        if (!records.length) {
          const allServicesQuery = plugin
            .switchTo("PeterpmService")
            .query()
            .deSelectAll()
            .select(["id", "service_name", "service_type"])
            .noDestroy();
          allServicesQuery.getOrInitQueryCalc?.();
          const allServicesResponse = await toPromiseLike(allServicesQuery.fetchDirect());
          records = extractRecords(allServicesResponse);
        }
        if (!isMounted) return;
        const mapped = records
          .map((record) => ({
            id: toText(record?.id || record?.ID),
            name: toText(record?.service_name || record?.Service_Name),
            type: toText(record?.service_type || record?.Service_Type),
          }))
          .filter((record) => record.id && record.name)
          .filter((record) => !record.type || record.type.toLowerCase() === "primary")
          .sort((a, b) => a.name.localeCompare(b.name));
        const labelMap = Object.fromEntries(
          mapped.map((record) => [record.id, record.name])
        );
        setServiceInquiryLabelById(labelMap);
        const options = mapped.map((record) => ({ value: record.id, label: record.name }));
        setServiceInquiryOptions(options);
      } catch (serviceError) {
        console.error("[InquiryDirect] Failed to fetch primary services", serviceError);
        if (!isMounted) return;
        setServiceInquiryOptions([]);
        setServiceInquiryLabelById({});
      } finally {
        if (!isMounted) return;
        setIsServicesLoading(false);
      }
    };

    loadServices();

    return () => {
      isMounted = false;
    };
  }, [plugin]);

  useEffect(() => {
    const selectedServiceId = normalizeServiceInquiryId(form.service_inquiry_id);
    if (!plugin?.switchTo || !selectedServiceId) return;
    if (serviceInquiryLabelById[selectedServiceId]) return;

    let isActive = true;
    const resolveServiceLabel = async () => {
      try {
        const query = plugin
          .switchTo("PeterpmService")
          .query()
          .where(
            "id",
            /^\d+$/.test(selectedServiceId)
              ? Number.parseInt(selectedServiceId, 10)
              : selectedServiceId
          )
          .deSelectAll()
          .select(["id", "service_name"])
          .limit(1)
          .noDestroy();
        query.getOrInitQueryCalc?.();
        const response = await toPromiseLike(query.fetchDirect());
        const record = extractRecords(response)?.[0] || null;
        const resolvedId = toText(record?.id || record?.ID);
        const resolvedName = toText(record?.service_name || record?.Service_Name);
        if (!isActive || !resolvedId || !resolvedName) return;
        setServiceInquiryLabelById((prev) => ({ ...prev, [resolvedId]: resolvedName }));
      } catch (_) {
        if (!isActive) return;
      }
    };

    resolveServiceLabel();
    return () => {
      isActive = false;
    };
  }, [plugin, form.service_inquiry_id, serviceInquiryLabelById]);

  useEffect(() => {
    onDraftChange?.(form);
  }, [form, onDraftChange]);

  const resolvedServiceInquiryOptions = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(form.service_inquiry_id);
    const options = [...serviceInquiryOptions];
    if (
      selectedServiceId &&
      !options.some((option) => toText(option?.value) === selectedServiceId)
    ) {
      options.unshift({
        value: selectedServiceId,
        label:
          toText(serviceInquiryLabelById[selectedServiceId]) ||
          `Service Inquiry #${selectedServiceId}`,
      });
    }
    return options;
  }, [form.service_inquiry_id, serviceInquiryOptions, serviceInquiryLabelById]);

  const isCompany = toText(form.account_type) === "Company";
  const selectedAccountId = isCompany ? toText(form.company_id) : toText(form.client_id);
  const accountType = isCompany ? "Company" : "Contact";

  const linkedPropertySource = useMemo(
    () => ({
      id: toText(linkedJobId),
      ID: toText(linkedJobId),
      property_id: toText(form.property_id),
      Property_ID: toText(form.property_id),
    }),
    [linkedJobId, form.property_id]
  );

  const {
    activeRelatedProperty,
    effectivePropertyId,
    isPropertiesLoading,
    linkedProperties,
    propertyLoadError,
    propertySearchItems,
    propertySearchQuery,
    selectedPropertyId,
    setLinkedPropertiesWithCache,
    setPropertySearchQuery,
    setSelectedPropertyId,
  } = useLinkedPropertiesData({
    plugin,
    activeJobData: linkedPropertySource,
    lookupProperties,
    addProperty,
    accountType,
    selectedAccountId,
  });

  useEffect(() => {
    const nextId = toText(effectivePropertyId);
    if (nextId === toText(form.property_id)) return;
    setForm((previous) => ({ ...previous, property_id: nextId }));
  }, [effectivePropertyId, form.property_id]);

  const handleFieldChange = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleContactType = (nextType) => {
    if (nextType === "entity") {
      setForm((prev) => ({
        ...prev,
        account_type: "Company",
        client_id: "",
      }));
      setContactSearch("");
      return;
    }
    setForm((prev) => ({
      ...prev,
      account_type: "Contact",
      company_id: "",
    }));
    setCompanySearch("");
  };

  const openAddModal = (mode) => {
    onOpenContactDetailsModal?.({
      mode,
      onSave: async (draftRecord) => {
        if (!plugin) {
          throw new Error("SDK is still initializing. Please try again.");
        }

        if (mode === "entity") {
          const companyName = toText(draftRecord?.name);
          if (!companyName) {
            throw new Error("Company name is required.");
          }

          try {
            const createdCompany = await createCompanyRecord({
              plugin,
              payload: {
                ...draftRecord,
                name: companyName,
              },
            });
            const company = addCompany({
              ...createdCompany,
              Primary_Person:
                createdCompany?.Primary_Person || draftRecord?.Primary_Person || null,
            });
            setForm((prev) => ({
              ...prev,
              account_type: "Company",
              company_id: toText(company.id),
              client_id: "",
            }));
            setCompanySearch(toText(company.name));
            setContactSearch("");
            success("Entity created", "New entity and primary contact were saved.");
            return;
          } catch (createError) {
            error("Create failed", createError?.message || "Unable to create entity.");
            throw createError;
          }
        }

        try {
          const createdContact = await createContactRecord({
            plugin,
            payload: draftRecord,
          });
          const contact = addContact(createdContact);
          setForm((prev) => ({
            ...prev,
            account_type: "Contact",
            client_id: toText(contact.id),
            company_id: "",
          }));
          setContactSearch(toText(contact.label));
          setCompanySearch("");
          success("Contact created", "New contact was saved.");
        } catch (createError) {
          error("Create failed", createError?.message || "Unable to create contact.");
          throw createError;
        }
      },
    });
  };

  const savePropertyRecord = useCallback(
    async ({ draftProperty, initialPropertyId = "" } = {}) => {
      if (!plugin) {
        throw new Error("SDK is still initializing. Please try again.");
      }

      const resolvedId = normalizePropertyId(draftProperty?.id || initialPropertyId);
      const isPersisted = /^\d+$/.test(String(resolvedId || "").trim());

      if (isPersisted) {
        return updatePropertyRecord({
          plugin,
          id: resolvedId,
          payload: draftProperty,
        });
      }

      return createPropertyRecord({
        plugin,
        payload: draftProperty,
      });
    },
    [plugin]
  );

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Account & Inquiry</div>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex gap-4" data-client-toggle>
            <button
              type="button"
              data-contact-toggle="individual"
              onClick={() => handleContactType("individual")}
              className={`rounded-xl border px-2 py-1 text-xs ${
                !isCompany
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              data-contact-toggle="entity"
              onClick={() => handleContactType("entity")}
              className={`rounded-xl border px-2 py-1 text-xs ${
                isCompany
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
            >
              Entity
            </button>
          </div>
          <input type="hidden" data-field="account_type" value={form.account_type} readOnly />
          <input type="hidden" data-field="client_id" value={form.client_id} readOnly />
          <input type="hidden" data-field="company_id" value={form.company_id} readOnly />

          {isCompany ? (
            <SearchDropdownInput
              label="Company"
              field="entity_name"
              value={companySearch}
              placeholder="Search company"
              items={companyItems}
              onValueChange={setCompanySearch}
              onSelect={(item) => {
                const nextId = toText(item?.id);
                setForm((prev) => ({
                  ...prev,
                  account_type: "Company",
                  company_id: nextId,
                  client_id: "",
                }));
                setCompanySearch(item?.label || "");
                setContactSearch("");
              }}
              onAdd={() => openAddModal("entity")}
              addButtonLabel="Add New Entity"
              emptyText={
                isContactCompanyLoading ? "Loading companies..." : "No companies found."
              }
              rootData={{ "data-search-root": "contact-entity" }}
            />
          ) : (
            <SearchDropdownInput
              label="Client"
              field="client"
              value={contactSearch}
              placeholder="Search contact"
              items={contactItems}
              onValueChange={setContactSearch}
              onSelect={(item) => {
                const nextId = toText(item?.id);
                setForm((prev) => ({
                  ...prev,
                  account_type: "Contact",
                  client_id: nextId,
                  company_id: "",
                }));
                setContactSearch(item?.label || "");
                setCompanySearch("");
              }}
              onAdd={() => openAddModal("individual")}
              addButtonLabel="Add New Contact"
              emptyText={
                isContactCompanyLoading ? "Loading contacts..." : "No contacts found."
              }
              rootData={{ "data-search-root": "contact-individual" }}
            />
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Status & Source</div>
        <div className="grid grid-cols-1 gap-4">
          <ColorMappedSelectInput
            label="Inquiry Status"
            field="inquiry_status"
            options={INQUIRY_STATUS_OPTIONS}
            value={form.inquiry_status}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, inquiry_status: nextValue }))
            }
          />
          <SelectInput
            label="Inquiry Source"
            field="inquiry_source"
            options={INQUIRY_SOURCE_OPTIONS}
            value={form.inquiry_source}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, inquiry_source: nextValue }))
            }
          />
          <SelectInput
            label="Type"
            field="type"
            options={INQUIRY_TYPE_OPTIONS}
            value={form.type}
            onChange={(nextValue) => setForm((prev) => ({ ...prev, type: nextValue }))}
          />
          <SelectInput
            label="How Did You Hear"
            field="how_did_you_hear"
            options={HOW_DID_YOU_HEAR_OPTIONS}
            value={form.how_did_you_hear}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, how_did_you_hear: nextValue }))
            }
          />
          <InputField
            label="Other"
            field="other"
            value={form.other}
            onChange={handleFieldChange("other")}
          />
        </div>
      </Card>
    </div>
  );

  const renderServiceProviderTab = () => (
    <ServiceProviderTabSection
      plugin={plugin}
      jobData={{
        id: toText(linkedJobId),
        ID: toText(linkedJobId),
        primary_service_provider_id: toText(form.service_provider_id),
        Primary_Service_Provider_ID: toText(form.service_provider_id),
      }}
      initialProviders={preloadedLookupData?.serviceProviders || []}
      onSubmitServiceProvider={onSubmitServiceProvider}
      onProviderSelectionChange={(nextProviderId) => {
        const normalized = toText(nextProviderId);
        setForm((previous) =>
          toText(previous.service_provider_id) === normalized
            ? previous
            : { ...previous, service_provider_id: normalized }
        );
      }}
    />
  );

  const renderAppointmentsTab = () => (
    <AppointmentTabSection
      plugin={plugin}
      jobData={{ id: toText(linkedJobId), ID: toText(linkedJobId) }}
      preloadedLookupData={preloadedLookupData}
      onCountChange={setAppointmentCount}
      inquiryRecordId={toText(inquiryId)}
      inquiryUid={toText(inquiryUid)}
    />
  );

  const renderPropertyTab = () => (
    <PropertyTabSection
      plugin={plugin}
      preloadedLookupData={preloadedLookupData}
      quoteJobId={toText(linkedJobId)}
      inquiryId={toText(inquiryId)}
      currentPropertyId={effectivePropertyId}
      onOpenContactDetailsModal={onOpenContactDetailsModal}
      accountType={accountType}
      selectedAccountId={selectedAccountId}
      propertySearchValue={propertySearchQuery}
      propertySearchItems={propertySearchItems}
      onPropertySearchValueChange={setPropertySearchQuery}
      onSelectPropertyFromSearch={(item) => {
        const nextId = normalizePropertyId(item?.id);
        if (!nextId) return;
        setSelectedPropertyId(nextId);
        setPropertySearchQuery(item?.label || "");
      }}
      onAddProperty={() =>
        onOpenAddPropertyModal?.({
          onSave: async (draftProperty) => {
            const savedProperty = await savePropertyRecord({ draftProperty });
            const normalized = addProperty({
              ...draftProperty,
              ...savedProperty,
              id: savedProperty?.id || draftProperty?.id || "",
            });
            const nextId = normalizePropertyId(normalized.id);
            if (nextId) setSelectedPropertyId(nextId);
            setLinkedPropertiesWithCache((prev) => {
              if (!nextId) return prev;
              const exists = prev.some(
                (item) => normalizePropertyId(item?.id) === normalizePropertyId(nextId)
              );
              if (exists) {
                return prev.map((item) =>
                  normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                    ? { ...item, ...normalized }
                    : item
                );
              }
              return [normalized, ...prev];
            });
            setPropertySearchQuery(
              normalized.property_name || normalized.unique_id || normalized.id || ""
            );
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED,
              quoteJobId: toText(linkedJobId),
              inquiryId: toText(inquiryId),
              focusId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
              dedupeEntityId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
              title: "Property created",
              content: "A new property was created and linked.",
              logContext: "inquiry-direct:InquiryInformationSection:onAddProperty",
            });
            success("Property saved", "Property details were saved.");
          },
        })
      }
      onEditRelatedProperty={(propertyRecord) => {
        const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
        const selectedFromLookup = (lookupProperties || []).find(
          (item) => normalizePropertyId(item?.id) === editableId
        );
        const selectedFromLinked = (linkedProperties || []).find(
          (item) => normalizePropertyId(item?.id) === editableId
        );
        const editableProperty = {
          ...(activeRelatedProperty || {}),
          ...(selectedFromLinked || {}),
          ...(selectedFromLookup || {}),
          ...(propertyRecord || {}),
        };

        onOpenAddPropertyModal?.({
          initialData: editableProperty,
          onSave: async (draftProperty) => {
            const savedProperty = await savePropertyRecord({
              draftProperty,
              initialPropertyId: editableProperty?.id,
            });
            const normalized = addProperty({
              ...editableProperty,
              ...draftProperty,
              ...savedProperty,
              id: savedProperty?.id || draftProperty?.id || editableProperty?.id || "",
            });
            const nextId = normalizePropertyId(normalized.id);
            if (nextId) setSelectedPropertyId(nextId);
            setLinkedPropertiesWithCache((prev) =>
              prev.map((item) =>
                normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                  ? { ...item, ...normalized }
                  : item
              )
            );
            setPropertySearchQuery(
              normalized.property_name || normalized.unique_id || normalized.id || ""
            );
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED,
              quoteJobId: toText(linkedJobId),
              inquiryId: toText(inquiryId),
              focusId: nextId || editableId,
              dedupeEntityId: nextId || editableId,
              title: "Property updated",
              content: "Property details were updated.",
              logContext: "inquiry-direct:InquiryInformationSection:onEditRelatedProperty",
            });
            success("Property updated", "Property details were updated.");
          },
        });
      }}
      activeRelatedProperty={activeRelatedProperty}
      linkedProperties={linkedProperties}
      isLoading={isPropertiesLoading}
      loadError={propertyLoadError}
      selectedPropertyId={selectedPropertyId}
      onSelectProperty={setSelectedPropertyId}
    />
  );

  const renderRequestTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Service Request</div>
        <div className="grid grid-cols-1 gap-4">
          <SelectInput
            label={isServicesLoading ? "Service Inquiry (Loading...)" : "Service Inquiry"}
            field="service_inquiry_id"
            options={resolvedServiceInquiryOptions}
            value={form.service_inquiry_id}
            onChange={(nextValue) =>
              setForm((prev) => ({
                ...prev,
                service_inquiry_id: normalizeServiceInquiryId(nextValue),
              }))
            }
          />
          <InputField
            label="Date Job Required By"
            type="date"
            field="date_job_required_by"
            value={form.date_job_required_by}
            onChange={handleFieldChange("date_job_required_by")}
          />
          <InputField
            label="Renovations"
            field="renovations"
            value={form.renovations}
            onChange={handleFieldChange("renovations")}
          />
          <InputField
            label="Resident Availability"
            field="resident_availability"
            value={form.resident_availability}
            onChange={handleFieldChange("resident_availability")}
          />
        </div>
      </Card>
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Request Description</div>
        <div className="grid grid-cols-1 gap-4">
          <TextAreaField
            label="How Can We Help"
            field="how_can_we_help"
            value={form.how_can_we_help}
            onChange={handleFieldChange("how_can_we_help")}
            placeholder="Describe the inquiry details..."
            rows={5}
          />
          <ListSelectionField
            label="Noise Signs"
            field="noise_signs_options_as_text"
            value={form.noise_signs_options_as_text}
            options={NOISE_SIGN_OPTIONS}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, noise_signs_options_as_text: nextValue }))
            }
          />
          <ListSelectionField
            label="Pest Active Times"
            field="pest_active_times_options_as_text"
            value={form.pest_active_times_options_as_text}
            options={PEST_ACTIVE_TIME_OPTIONS}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, pest_active_times_options_as_text: nextValue }))
            }
          />
          <ListSelectionField
            label="Pest Location"
            field="pest_location_options_as_text"
            value={form.pest_location_options_as_text}
            options={PEST_LOCATION_OPTIONS}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, pest_location_options_as_text: nextValue }))
            }
          />
        </div>
      </Card>
    </div>
  );

  const renderPipelineTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Sales Pipeline</div>
        <div className="grid grid-cols-1 gap-4">
          <SelectInput
            label="Sales Stage"
            field="sales_stage"
            options={SALES_STAGE_OPTIONS}
            value={form.sales_stage}
            onChange={(nextValue) => setForm((prev) => ({ ...prev, sales_stage: nextValue }))}
          />
          <InputField
            label="Deal Value"
            field="deal_value"
            value={form.deal_value}
            onChange={handleFieldChange("deal_value")}
            placeholder="0.00"
          />
          <InputField
            label="Expected Win (%)"
            field="expected_win"
            value={form.expected_win}
            onChange={handleFieldChange("expected_win")}
            placeholder="0"
          />
          <InputField
            label="Weighted Value"
            field="weighted_value"
            value={form.weighted_value}
            onChange={handleFieldChange("weighted_value")}
            placeholder="0.00"
          />
        </div>
      </Card>
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Dates & Activity</div>
        <div className="grid grid-cols-1 gap-4">
          <InputField
            label="Expected Close Date"
            type="date"
            field="expected_close_date"
            value={form.expected_close_date}
            onChange={handleFieldChange("expected_close_date")}
          />
          <InputField
            label="Actual Close Date"
            type="date"
            field="actual_close_date"
            value={form.actual_close_date}
            onChange={handleFieldChange("actual_close_date")}
          />
          <ColorMappedSelectInput
            label="Recent Activity"
            field="recent_activity"
            options={RECENT_ACTIVITY_OPTIONS}
            value={form.recent_activity}
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, recent_activity: nextValue }))
            }
          />
        </div>
      </Card>
    </div>
  );

  const renderNotesTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Client Notes</div>
        <TextAreaField
          label="Client Notes"
          field="client_notes"
          value={form.client_notes}
          onChange={handleFieldChange("client_notes")}
          rows={10}
          placeholder="Add client-facing notes..."
        />
      </Card>
      <Card className="space-y-4">
        <div className="text-base font-bold text-neutral-700">Admin Notes</div>
        <TextAreaField
          label="Admin Notes"
          field="admin_notes"
          value={form.admin_notes}
          onChange={handleFieldChange("admin_notes")}
          rows={10}
          placeholder="Add internal notes..."
        />
      </Card>
    </div>
  );

  const safeActiveTab = INQUIRY_TABS.some((tab) => tab.id === activeTab)
    ? activeTab
    : "overview";

  return (
    <section data-section="job-information" className="space-y-4">
      <input type="hidden" data-field="property_id" value={toText(effectivePropertyId)} readOnly />
      <input
        type="hidden"
        data-field="service_provider_id"
        value={toText(form.service_provider_id)}
        readOnly
      />
      <TabNav
        activeTab={safeActiveTab}
        onTabChange={onTabChange}
        appointmentCount={appointmentCount}
      />

      {safeActiveTab === "overview" ? renderOverviewTab() : null}
      {safeActiveTab === "service-provider" ? renderServiceProviderTab() : null}
      {safeActiveTab === "appointments" ? renderAppointmentsTab() : null}
      {safeActiveTab === "property" ? renderPropertyTab() : null}
      {safeActiveTab === "request" ? renderRequestTab() : null}
      {safeActiveTab === "pipeline" ? renderPipelineTab() : null}
      {safeActiveTab === "notes" ? renderNotesTab() : null}
    </section>
  );
}
