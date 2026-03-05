import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "@modules/job-workspace/public/components.js";
import { AppointmentTabSection } from "@modules/job-workspace/public/components.js";
import { PropertyTabSection } from "@modules/job-workspace/public/components.js";
import { ServiceProviderTabSection } from "@modules/job-workspace/public/components.js";
import { useLinkedPropertiesData } from "@modules/job-workspace/public/components.js";
import { normalizePropertyId } from "@modules/job-workspace/public/components.js";
import { useContactEntityLookupData } from "@modules/job-workspace/public/hooks.js";
import { usePropertyLookupData } from "@modules/job-workspace/public/hooks.js";
import {
  createCompanyRecord,
  createContactRecord,
  createPropertyRecord,
  fetchServicesForActivities,
  updateContactRecord,
  updatePropertyRecord,
} from "@modules/job-workspace/public/sdk.js";
import { extractRecords } from "@modules/job-workspace/public/sdk.js";
import { buildLookupDisplayLabel } from "../../../../shared/utils/lookupLabel.js";
import {
  getInquiryFlowRule,
  shouldShowOtherSourceField,
} from "../../constants/inquiryFlowRules.js";
import { useRelatedRecordsData } from "../../hooks/useRelatedRecordsData.js";
import { isPestServiceFlow } from "../../utils/pestRules.js";
import {
  ENQUIRING_AS_OPTIONS,
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_TABS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
  RECENT_ACTIVITY_OPTIONS,
  SALES_STAGE_OPTIONS,
} from "./inquiryInformationConstants.js";
import {
  buildCompanyItems,
  buildContactItems,
  formatPropertyPrefillDetails,
  normalizeInitialForm,
  normalizeLinkedJobRecord,
  normalizeServiceInquiryId,
  parseListSelectionValue,
  serializeListSelectionValue,
  toPromiseLike,
  toText,
} from "./inquiryInformationHelpers.js";

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

function ReadOnlyValueField({ label, value, emptyText = "-" }) {
  const displayValue = toText(value) || emptyText;
  return (
    <div className="block">
      <span className="type-label text-slate-600">{label}</span>
      <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {displayValue}
      </div>
    </div>
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
  const navigate = useNavigate();
  const [form, setForm] = useState(() => normalizeInitialForm(initialValues));
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [enquiringAs, setEnquiringAs] = useState("individual");
  const [isPestAccordionOpen, setIsPestAccordionOpen] = useState(false);
  const [appointmentDraft, setAppointmentDraft] = useState(null);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [serviceInquiryOptions, setServiceInquiryOptions] = useState([]);
  const [serviceInquiryLabelById, setServiceInquiryLabelById] = useState({});
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [linkedJobRecord, setLinkedJobRecord] = useState(null);
  const [linkedJobUniqueIdFromDeal, setLinkedJobUniqueIdFromDeal] = useState("");
  const { success, error } = useToast();

  const {
    contacts,
    companies,
    addContact,
    addCompany,
    searchContacts,
    searchCompanies,
    isLookupLoading: isContactCompanyLoading,
  } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });
  const {
    properties: lookupProperties,
    addProperty,
    searchProperties,
  } = usePropertyLookupData(plugin, {
    initialProperties: preloadedLookupData?.properties || [],
    skipInitialFetch: true,
  });

  const contactItems = useMemo(() => buildContactItems(contacts), [contacts]);
  const companyItems = useMemo(() => buildCompanyItems(companies), [companies]);

  useEffect(() => {
    setForm(normalizeInitialForm(initialValues));
  }, [initialValues]);

  useEffect(() => {
    const companyId = toText(form.company_id);
    if (!companyId) {
      setCompanySearch((previous) => (previous ? "" : previous));
      return;
    }
    const matchedCompany = companyItems.find((item) => toText(item?.id) === companyId);
    const nextLabel = toText(matchedCompany?.label);
    if (!nextLabel) return;
    setCompanySearch((previous) => (toText(previous) === nextLabel ? previous : nextLabel));
  }, [form.company_id, companyItems]);

  useEffect(() => {
    const clientId = toText(form.client_id);
    if (!clientId) {
      setContactSearch((previous) => (previous ? "" : previous));
      return;
    }
    const matchedContact = contactItems.find((item) => toText(item?.id) === clientId);
    const nextLabel = toText(matchedContact?.label);
    if (!nextLabel) return;
    setContactSearch((previous) => (toText(previous) === nextLabel ? previous : nextLabel));
  }, [form.client_id, contactItems]);

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
  const resolvedInquiryJobId = toText(form.inquiry_for_job_id || linkedJobId);
  const selectedContactRecord = useMemo(
    () => contacts.find((item) => toText(item?.id) === toText(form.client_id)) || null,
    [contacts, form.client_id]
  );
  const selectedCompanyRecord = useMemo(
    () => companies.find((item) => toText(item?.id) === toText(form.company_id)) || null,
    [companies, form.company_id]
  );
  const inquiryFlowRule = useMemo(() => getInquiryFlowRule(form.type), [form.type]);
  const shouldShowOther = shouldShowOtherSourceField(form.how_did_you_hear);
  const selectedServiceInquiryLabel = useMemo(() => {
    const id = normalizeServiceInquiryId(form.service_inquiry_id);
    if (!id) return "";
    const optionLabel = resolvedServiceInquiryOptions.find(
      (item) => toText(item?.value) === id
    )?.label;
    return toText(optionLabel || serviceInquiryLabelById[id]);
  }, [form.service_inquiry_id, resolvedServiceInquiryOptions, serviceInquiryLabelById]);
  const isPestServiceSelected = useMemo(
    () => isPestServiceFlow(selectedServiceInquiryLabel),
    [selectedServiceInquiryLabel]
  );

  const {
    relatedDeals,
    relatedJobs,
    isLoading: isRelatedRecordsLoading,
    error: relatedRecordsError,
  } = useRelatedRecordsData({
    plugin,
    accountType,
    accountId: selectedAccountId,
  });

  useEffect(() => {
    let isActive = true;
    const normalizedInquiryId = toText(inquiryId);
    if (!plugin?.switchTo || !normalizedInquiryId) {
      setLinkedJobUniqueIdFromDeal("");
      return undefined;
    }

    const loadLinkedJobUniqueId = async () => {
      const query = plugin
        .switchTo("PeterpmDeal")
        .query()
        .fromGraphql(`
          query calcDeals($id: PeterpmDealID!) {
            calcDeals(query: [{ where: { id: $id } }]) {
              Inquiry_For_Job_Unique_ID: field(arg: ["Inquiry_for_Job", "unique_id"])
            }
          }
        `);
      const response = await toPromiseLike(
        query.fetchDirect({
          variables: {
            id: /^\d+$/.test(normalizedInquiryId)
              ? Number.parseInt(normalizedInquiryId, 10)
              : normalizedInquiryId,
          },
        })
      );
      if (!isActive) return;
      const record = extractRecords(response)?.[0] || null;
      const rawUniqueId = record?.Inquiry_For_Job_Unique_ID;
      const normalizedUniqueId = Array.isArray(rawUniqueId)
        ? toText(rawUniqueId[0])
        : toText(rawUniqueId);
      setLinkedJobUniqueIdFromDeal(normalizedUniqueId);
    };

    loadLinkedJobUniqueId().catch(() => {
      if (!isActive) return;
      setLinkedJobUniqueIdFromDeal("");
    });

    return () => {
      isActive = false;
    };
  }, [plugin, inquiryId]);

  useEffect(() => {
    const linkedUniqueId = toText(linkedJobUniqueIdFromDeal);
    if (!linkedUniqueId) return;
    setForm((previous) => {
      if (toText(previous.inquiry_for_job_id)) return previous;
      return {
        ...previous,
        inquiry_for_job_id: linkedUniqueId,
      };
    });
  }, [linkedJobUniqueIdFromDeal]);

  useEffect(() => {
    let isActive = true;
    const linkedValue = toText(resolvedInquiryJobId || linkedJobUniqueIdFromDeal);

    if (!plugin?.switchTo || !linkedValue) {
      setLinkedJobRecord(null);
      return undefined;
    }

    const matchedRelatedJob = (Array.isArray(relatedJobs) ? relatedJobs : []).find((job) => {
      const jobId = toText(job?.id || job?.ID);
      const jobUniqueId = toText(job?.unique_id || job?.Unique_ID);
      return linkedValue === jobId || linkedValue === jobUniqueId;
    });
    if (matchedRelatedJob) {
      const normalized = normalizeLinkedJobRecord(matchedRelatedJob);
      setLinkedJobRecord((previous) => {
        const previousId = toText(previous?.id || previous?.ID);
        const previousUid = toText(previous?.unique_id || previous?.Unique_ID);
        if (previousId === normalized.id && previousUid === normalized.unique_id) {
          return previous;
        }
        return normalized;
      });
      return undefined;
    }

    const loadLinkedJob = async () => {
      const whereField = /^\d+$/.test(linkedValue) ? "id" : "unique_id";
      const whereValue =
        whereField === "id" ? Number.parseInt(linkedValue, 10) : linkedValue;
      const query = plugin
        .switchTo("PeterpmJob")
        .query()
        .where(whereField, whereValue)
        .deSelectAll()
        .select(["id", "unique_id"])
        .include("Property", (propertyQuery) =>
          propertyQuery.deSelectAll().select(["property_name"])
        )
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const response = await toPromiseLike(query.fetchDirect());
      const record = extractRecords(response)?.[0] || null;
      if (!isActive) return;
      const normalized = normalizeLinkedJobRecord(record || {});
      if (!normalized.id && !normalized.unique_id) {
        setLinkedJobRecord(null);
        return;
      }
      setLinkedJobRecord(normalized);
    };

    loadLinkedJob().catch(() => {
      if (!isActive) return;
      setLinkedJobRecord(null);
    });

    return () => {
      isActive = false;
    };
  }, [plugin, relatedJobs, resolvedInquiryJobId, linkedJobUniqueIdFromDeal]);

  const displayedRelatedJobs = useMemo(() => {
    const jobs = Array.isArray(relatedJobs) ? [...relatedJobs] : [];
    const linkedJobId = toText(linkedJobRecord?.id || linkedJobRecord?.ID);
    const linkedJobUid = toText(
      linkedJobRecord?.unique_id || linkedJobRecord?.Unique_ID
    );
    if (!linkedJobId && !linkedJobUid) return jobs;
    const exists = jobs.some((job) => {
      const jobId = toText(job?.id || job?.ID);
      const jobUid = toText(job?.unique_id || job?.Unique_ID);
      if (linkedJobId && jobId && linkedJobId === jobId) return true;
      if (linkedJobUid && jobUid && linkedJobUid === jobUid) return true;
      return false;
    });
    if (exists) return jobs;
    return [linkedJobRecord, ...jobs];
  }, [relatedJobs, linkedJobRecord]);

  useEffect(() => {
    if (isCompany) {
      setEnquiringAs((previous) => (previous === "government" ? "government" : "business"));
      return;
    }
    setEnquiringAs("individual");
  }, [isCompany]);

  useEffect(() => {
    if (!shouldShowOther && toText(form.other)) {
      setForm((previous) => ({ ...previous, other: "" }));
    }
  }, [shouldShowOther, form.other]);

  useEffect(() => {
    if (isPestServiceSelected) {
      setIsPestAccordionOpen(true);
    } else {
      setIsPestAccordionOpen(false);
    }
  }, [isPestServiceSelected]);

  const linkedPropertySource = useMemo(
    () => ({
      id: resolvedInquiryJobId,
      ID: resolvedInquiryJobId,
      property_id: toText(form.property_id),
      Property_ID: toText(form.property_id),
    }),
    [resolvedInquiryJobId, form.property_id]
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

  const handleEnquiringAsChange = (nextValue) => {
    const normalized = String(nextValue || "").trim().toLowerCase();
    if (normalized === "government") {
      setEnquiringAs("government");
      setForm((prev) => ({
        ...prev,
        account_type: "Company",
      }));
      return;
    }
    if (normalized === "business") {
      setEnquiringAs("business");
      setForm((prev) => ({
        ...prev,
        account_type: "Company",
      }));
      return;
    }
    setEnquiringAs("individual");
    setForm((prev) => ({
      ...prev,
      account_type: "Contact",
    }));
  };

  const openRelatedRecord = useCallback(
    (uniqueId) => {
      const uid = toText(uniqueId);
      if (!uid) return;
      navigate(`/details/${encodeURIComponent(uid)}`);
    },
    [navigate]
  );

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
            }));
            setCompanySearch(
              buildLookupDisplayLabel(
                company.name,
                company.primary?.email,
                company.primary?.sms_number,
                toText(company.id)
              )
            );
            success("Entity created", "New entity and primary contact were saved.");
            return;
          } catch (createError) {
            error("Create failed", createError?.message || "Unable to create entity.");
            throw createError;
          }
        }

        try {
          const existingContactId = toText(
            draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
          );
          const savedContact = existingContactId
            ? await updateContactRecord({
                plugin,
                id: existingContactId,
                payload: draftRecord,
              })
            : await createContactRecord({
                plugin,
                payload: draftRecord,
              });
          const contact = addContact(savedContact);
          setForm((prev) => ({
            ...prev,
            account_type: "Contact",
            client_id: toText(contact.id),
          }));
          setContactSearch(
            buildLookupDisplayLabel(
              [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim(),
              contact.email,
              contact.sms_number,
              toText(contact.id)
            )
          );
          success(
            existingContactId ? "Contact updated" : "Contact created",
            existingContactId ? "Existing contact was updated." : "New contact was saved."
          );
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="text-base font-bold text-neutral-700">Account & Inquiry</div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2" data-client-toggle>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Inquiring As
              </div>
              <div className="flex flex-wrap gap-2">
                {ENQUIRING_AS_OPTIONS.map((option) => {
                  const isActive = enquiringAs === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleEnquiringAsChange(option.id)}
                      className={`rounded-xl border px-2 py-1 text-xs ${
                        isActive
                          ? "border-sky-900 bg-[#003882] text-white"
                          : "border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
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
                onSearchQueryChange={searchCompanies}
                onSelect={(item) => {
                  const nextId = toText(item?.id);
                  setForm((prev) => ({
                    ...prev,
                    account_type: "Company",
                    company_id: nextId,
                  }));
                  setCompanySearch(item?.label || "");
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
                onSearchQueryChange={searchContacts}
                onSelect={(item) => {
                  const nextId = toText(item?.id);
                  setForm((prev) => ({
                    ...prev,
                    account_type: "Contact",
                    client_id: nextId,
                  }));
                  setContactSearch(item?.label || "");
                }}
                onAdd={() => openAddModal("individual")}
                addButtonLabel="Add New Contact"
                emptyText={
                  isContactCompanyLoading ? "Loading contacts..." : "No contacts found."
                }
                rootData={{ "data-search-root": "contact-individual" }}
              />
            )}

            {selectedAccountId ? (
              <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-bold text-neutral-700">Related Records</div>
                {isRelatedRecordsLoading && !relatedDeals.length && !displayedRelatedJobs.length ? (
                  <div className="text-sm text-slate-500">Loading related inquiries and jobs...</div>
                ) : (
                  <div className="space-y-3">
                    {relatedRecordsError ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {relatedRecordsError}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Related Inquiries
                        </div>
                        {relatedDeals.length ? (
                          relatedDeals.slice(0, 12).map((deal) => (
                            <div
                              key={toText(deal?.unique_id || deal?.id)}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                            >
                              <div className="font-medium text-slate-800">
                                {toText(deal?.deal_name) || "Inquiry"}
                              </div>
                              <button
                                type="button"
                                className="mt-1 text-xs font-semibold text-sky-700 underline"
                                onClick={() => openRelatedRecord(deal?.unique_id)}
                              >
                                {toText(deal?.unique_id) || "-"}
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500">
                            {isRelatedRecordsLoading
                              ? "Loading related inquiries..."
                              : "No related inquiries found."}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Related Jobs
                        </div>
                        {displayedRelatedJobs.length ? (
                          displayedRelatedJobs.slice(0, 12).map((job) => {
                            const jobId = toText(job?.id || job?.ID);
                            const jobUniqueId = toText(job?.unique_id || job?.Unique_ID);
                            const jobSelectionValue = jobId || jobUniqueId;
                            const isSelected =
                              (Boolean(resolvedInquiryJobId) &&
                                (resolvedInquiryJobId === jobId ||
                                  resolvedInquiryJobId === jobUniqueId)) ||
                              (Boolean(linkedJobUniqueIdFromDeal) &&
                                linkedJobUniqueIdFromDeal === jobUniqueId);
                            return (
                              <div
                                key={toText(job?.id || job?.ID || job?.unique_id)}
                                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                                  isSelected
                                    ? "border-sky-700 bg-sky-50"
                                    : "border-slate-300 bg-white hover:border-slate-400"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      className="font-semibold text-sky-700 underline"
                                      onClick={() => openRelatedRecord(job?.unique_id)}
                                    >
                                      {toText(job?.unique_id) || "-"}
                                    </button>
                                    <div className="mt-1 text-xs text-slate-600">
                                      {toText(job?.property_name) || "Property not set"}
                                    </div>
                                  </div>
                                  <input
                                    type="radio"
                                    name="inquiry-linked-job"
                                    className="mt-0.5 h-4 w-4 accent-[#003882]"
                                    value={jobSelectionValue}
                                    checked={isSelected}
                                    disabled={!jobSelectionValue}
                                    onChange={() => {
                                      if (!jobSelectionValue) return;
                                      setForm((previous) =>
                                        toText(previous.inquiry_for_job_id) === jobSelectionValue
                                          ? previous
                                          : {
                                              ...previous,
                                              inquiry_for_job_id: jobSelectionValue,
                                            }
                                      );
                                    }}
                                    aria-label={`Link inquiry to job ${toText(job?.unique_id) || ""}`}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500">
                            {isRelatedRecordsLoading
                              ? "Loading related jobs..."
                              : "No related jobs found."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
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
            {inquiryFlowRule.showServiceInquiry ? (
              <SelectInput
                label={isServicesLoading ? "Select Service (Loading...)" : "Select Service"}
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
            ) : null}
            {inquiryFlowRule.showHowCanWeHelp ? (
              <TextAreaField
                label="How Can We Help"
                field="how_can_we_help"
                value={form.how_can_we_help}
                onChange={handleFieldChange("how_can_we_help")}
                placeholder="Describe the inquiry details..."
                rows={5}
              />
            ) : null}
            {inquiryFlowRule.showHowDidYouHear ? (
              <SelectInput
                label="How Did You Hear About Us"
                field="how_did_you_hear"
                options={HOW_DID_YOU_HEAR_OPTIONS}
                value={form.how_did_you_hear}
                onChange={(nextValue) =>
                  setForm((prev) => ({ ...prev, how_did_you_hear: nextValue }))
                }
              />
            ) : null}
            {inquiryFlowRule.showHowDidYouHear && shouldShowOther ? (
              <InputField
                label="Other"
                field="other"
                value={form.other}
                onChange={handleFieldChange("other")}
              />
            ) : null}
          </div>
        </Card>
      </div>

      {inquiryFlowRule.showPropertySearch ? (
        <div className="space-y-2">
          <div className="px-1 text-sm font-semibold text-slate-700">Property</div>
          {renderPropertyTab()}
        </div>
      ) : null}
    </div>
  );

  const renderServiceProviderTab = () => (
    <ServiceProviderTabSection
      plugin={plugin}
      jobData={{
        id: resolvedInquiryJobId,
        ID: resolvedInquiryJobId,
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
      recordLabel="inquiry"
    />
  );

  const appointmentPrefillContext = useMemo(() => {
    const locationId = toText(effectivePropertyId);
    const selectedProperty = propertySearchItems.find(
      (item) => normalizePropertyId(item?.id) === normalizePropertyId(locationId)
    );
    const inquiryUidLabel = toText(inquiryUid);
    const inquiryTypeLabel = toText(form.type);
    const serviceTypeLabel = toText(selectedServiceInquiryLabel);
    const appointmentTitle = [inquiryUidLabel, inquiryTypeLabel, serviceTypeLabel]
      .filter(Boolean)
      .join(" | ");
    const serviceDetails = serviceTypeLabel || toText(form.how_can_we_help);
    const propertyDetails = formatPropertyPrefillDetails({
      selectedProperty,
      activeProperty: activeRelatedProperty,
    });
    const appointmentDescription = [
      serviceDetails ? `Service:\n${serviceDetails}` : "",
      propertyDetails ? `Property:\n${propertyDetails}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const serviceProviders = Array.isArray(preloadedLookupData?.serviceProviders)
      ? preloadedLookupData.serviceProviders
      : [];
    const selectedProvider = serviceProviders.find(
      (provider) => toText(provider?.id || provider?.ID) === toText(form.service_provider_id)
    );
    const providerFirstName =
      selectedProvider?.first_name ||
      selectedProvider?.Contact_Information?.first_name ||
      selectedProvider?.Contact_Information?.First_Name ||
      selectedProvider?.Contact_Information_First_Name;
    const providerLastName =
      selectedProvider?.last_name ||
      selectedProvider?.Contact_Information?.last_name ||
      selectedProvider?.Contact_Information?.Last_Name ||
      selectedProvider?.Contact_Information_Last_Name;
    const providerEmail =
      selectedProvider?.email ||
      selectedProvider?.contact_information_email ||
      selectedProvider?.Contact_Information_Email ||
      selectedProvider?.Contact_Information?.email ||
      selectedProvider?.Contact_Information?.Email;
    const providerMobile =
      selectedProvider?.sms_number ||
      selectedProvider?.contact_information_sms_number ||
      selectedProvider?.Contact_Information_SMS_Number ||
      selectedProvider?.Contact_Information?.sms_number ||
      selectedProvider?.Contact_Information?.SMS_Number;
    const providerLabel = buildLookupDisplayLabel(
      [providerFirstName, providerLastName].filter(Boolean).join(" ").trim(),
      providerEmail,
      providerMobile,
      toText(selectedProvider?.label) || toText(form.service_provider_id)
    );

    const companyPrimary = selectedCompanyRecord?.primary || {};
    const companyPrimaryName = [companyPrimary.first_name, companyPrimary.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const companyPrimaryId = toText(companyPrimary.id);
    const companyPrimaryLabel = buildLookupDisplayLabel(
      companyPrimaryName,
      companyPrimary.email,
      companyPrimary.sms_number,
      companyPrimaryId ? `Contact #${companyPrimaryId}` : ""
    );

    const selectedContactLabel = buildLookupDisplayLabel(
      [selectedContactRecord?.first_name, selectedContactRecord?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim(),
      selectedContactRecord?.email,
      selectedContactRecord?.sms_number,
      toText(form.client_id) ? `Contact #${toText(form.client_id)}` : ""
    );

    const guestId = isCompany ? companyPrimaryId || toText(form.client_id) : toText(form.client_id);
    const guestLabel = isCompany
      ? companyPrimaryLabel || selectedContactLabel
      : selectedContactLabel;

    return {
      accountType,
      locationId,
      locationLabel: toText(selectedProperty?.label) || "",
      hostId: toText(form.service_provider_id),
      hostLabel: providerLabel,
      guestId,
      guestLabel,
      title: appointmentTitle,
      description: appointmentDescription,
    };
  }, [
    accountType,
    activeRelatedProperty,
    companies,
    effectivePropertyId,
    form.client_id,
    form.how_can_we_help,
    form.service_provider_id,
    form.type,
    inquiryUid,
    isCompany,
    preloadedLookupData?.serviceProviders,
    propertySearchItems,
    selectedServiceInquiryLabel,
    selectedCompanyRecord?.primary,
    selectedContactRecord,
  ]);

  const renderAppointmentsTab = () => (
    <AppointmentTabSection
      plugin={plugin}
      jobData={{ id: resolvedInquiryJobId, ID: resolvedInquiryJobId }}
      preloadedLookupData={preloadedLookupData}
      onCountChange={setAppointmentCount}
      inquiryRecordId={toText(inquiryId)}
      inquiryUid={toText(inquiryUid)}
      draft={appointmentDraft}
      onDraftChange={setAppointmentDraft}
      onResetDraft={() => setAppointmentDraft(null)}
      prefillContext={appointmentPrefillContext}
    />
  );

  const renderPropertyTab = () => (
    <PropertyTabSection
      plugin={plugin}
      preloadedLookupData={preloadedLookupData}
      quoteJobId={resolvedInquiryJobId}
      inquiryId={toText(inquiryId)}
      currentPropertyId={effectivePropertyId}
      onOpenContactDetailsModal={onOpenContactDetailsModal}
      accountType={accountType}
      selectedAccountId={selectedAccountId}
      propertySearchValue={propertySearchQuery}
      propertySearchItems={propertySearchItems}
      onPropertySearchValueChange={setPropertySearchQuery}
      onPropertySearchQueryChange={searchProperties}
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
              normalized.property_name ||
                normalized.address_1 ||
                normalized.address ||
                normalized.unique_id ||
                ""
            );
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED,
              quoteJobId: resolvedInquiryJobId,
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
              normalized.property_name ||
                normalized.address_1 ||
                normalized.address ||
                normalized.unique_id ||
                ""
            );
            await emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED,
              quoteJobId: resolvedInquiryJobId,
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
        <button
          type="button"
          className="flex w-full items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left"
          onClick={() => setIsPestAccordionOpen((previous) => !previous)}
          aria-expanded={isPestAccordionOpen}
        >
          <div className="text-base font-bold text-neutral-700">Pest Details</div>
          <span className="text-xs font-semibold text-slate-600">
            {isPestAccordionOpen ? "⌃" : "⌄"}
          </span>
        </button>
        <div
          className={`space-y-4 overflow-hidden transition-all duration-200 ${
            isPestAccordionOpen ? "max-h-[900px] pt-1" : "max-h-0 pt-0"
          }`}
        >
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
          <ReadOnlyValueField
            label="Weighted Value"
            value={form.weighted_value}
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
          <ReadOnlyValueField
            label="Actual Close Date"
            value={form.actual_close_date}
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
      <input type="hidden" data-field="inquiry_for_job_id" value={resolvedInquiryJobId} readOnly />
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
      {safeActiveTab === "request" ? renderRequestTab() : null}
      {safeActiveTab === "pipeline" ? renderPipelineTab() : null}
      {safeActiveTab === "notes" ? renderNotesTab() : null}
    </section>
  );
}
