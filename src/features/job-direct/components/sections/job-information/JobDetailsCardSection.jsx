import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "../../../constants/options.js";
import { useContactEntityLookupData } from "../../../hooks/useContactEntityLookupData.js";
import { createCompanyRecord, createContactRecord } from "../../../sdk/jobDirectSdk.js";
import {
  ColorMappedSelectInput,
  SearchDropdownInput,
  SearchInput,
  SelectInput,
} from "./JobInfoFormFields.jsx";
import {
  getFirstFilledValue,
  getJobEntitySelection,
  getJobIndividualSelection,
  resolveContactTypeFromJob,
  resolveOptionDefault,
} from "./jobInfoUtils.js";

function formatLookupDisplayLabel(
  primaryText = "",
  emailText = "",
  mobileText = "",
  fallbackText = ""
) {
  const primary = String(primaryText || "").trim();
  const email = String(emailText || "").trim();
  const mobile = String(mobileText || "").trim();
  const fallback = String(fallbackText || "").trim();
  const nameWithEmail = primary && email ? `${primary} <${email}>` : primary || email || "";
  if (nameWithEmail && mobile) return `${nameWithEmail} | ${mobile}`;
  return nameWithEmail || mobile || fallback;
}

export function JobDetailsCardSection({
  showPropertySearch = false,
  jobData,
  plugin,
  preloadedLookupData,
  onOpenContactDetailsModal,
  onClientSelectionChange,
  onJobFieldsChange,
}) {
  const { contacts, companies, addContact, addCompany } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });
  const { success } = useToast();
  const [contactType, setContactType] = useState("individual");
  const [clientQuery, setClientQuery] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedEntityContactId, setSelectedEntityContactId] = useState("");
  const [priorityValue, setPriorityValue] = useState("");
  const [jobTypeValue, setJobTypeValue] = useState("");
  const [jobStatusValue, setJobStatusValue] = useState("");

  const isEntity = contactType === "entity";

  const contactSearchItems = useMemo(
    () =>
      contacts.map((item) => ({
        id: item.id,
        label: formatLookupDisplayLabel(
          [item.first_name, item.last_name].filter(Boolean).join(" ").trim(),
          item.email,
          item.sms_number,
          item.id
        ),
        meta: item.email || item.sms_number || "",
      })),
    [contacts]
  );

  const companySearchItems = useMemo(
    () =>
      companies.map((item) => ({
        id: item.id,
        label: formatLookupDisplayLabel(
          item.name,
          item.primary?.email,
          item.primary?.sms_number,
          item.id
        ),
        meta: item.account_type || "",
        primary: item.primary,
      })),
    [companies]
  );

  useEffect(() => {
    if (!jobData) return;

    const initialType = resolveContactTypeFromJob(jobData);
    setContactType(initialType);

    const entitySelection = getJobEntitySelection(jobData);
    setSelectedEntityId(entitySelection.id);
    setSelectedEntityContactId(entitySelection.primaryId);
    setEntityQuery(
      formatLookupDisplayLabel(
        entitySelection.name,
        entitySelection.primaryEmail,
        entitySelection.primaryMobile,
        entitySelection.id
      )
    );

    const individualSelection = getJobIndividualSelection(jobData);
    setSelectedClientId(individualSelection.id);
    setClientQuery(individualSelection.label);

    setPriorityValue(
      resolveOptionDefault(
        PRIORITY_OPTIONS,
        getFirstFilledValue(jobData, ["priority", "Priority"]) || "123"
      ) || "123"
    );
    setJobTypeValue(
      resolveOptionDefault(
        JOB_TYPE_OPTIONS,
        getFirstFilledValue(jobData, ["job_type", "Job_Type"])
      ) || ""
    );
    setJobStatusValue(
      resolveOptionDefault(
        JOB_STATUS_OPTIONS,
        getFirstFilledValue(jobData, ["job_status", "Job_Status", "status", "Status"])
      ) || ""
    );
  }, [jobData]);

  useEffect(() => {
    onClientSelectionChange?.({
      accountType: isEntity ? "Company" : "Contact",
      clientId: selectedClientId,
      companyId: selectedEntityId,
    });
  }, [isEntity, selectedClientId, selectedEntityId, onClientSelectionChange]);

  useEffect(() => {
    onJobFieldsChange?.({
      priority: priorityValue,
      job_type: jobTypeValue,
      job_status: jobStatusValue,
    });
  }, [jobStatusValue, jobTypeValue, onJobFieldsChange, priorityValue]);

  const handleContactType = (nextType) => {
    setContactType(nextType);
  };

  const openAddModal = (mode) => {
    onOpenContactDetailsModal?.({
      mode,
      onSave: async (draftRecord) => {
        if (!plugin) {
          throw new Error("SDK is still initializing. Please try again.");
        }

        if (mode === "entity") {
          const companyName = String(draftRecord?.name || "").trim();
          if (!companyName) {
            throw new Error("Company name is required.");
          }

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
          setContactType("entity");
          setSelectedEntityId(company.id || "");
          setSelectedEntityContactId(company.primary?.id || "");
          setEntityQuery(
            formatLookupDisplayLabel(
              company.name,
              company.primary?.email,
              company.primary?.sms_number,
              company.id || ""
            )
          );
          success("Entity created", "New entity and primary contact were saved.");
          return;
        }

        const createdContact = await createContactRecord({
          plugin,
          payload: draftRecord,
        });
        const contact = addContact(createdContact);
        setContactType("individual");
        setSelectedClientId(contact.id || "");
        setClientQuery(
          formatLookupDisplayLabel(
            [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim(),
            contact.email,
            contact.sms_number,
            contact.id || ""
          )
        );
        success("Contact created", "New contact was saved.");
      },
    });
  };

  return (
    <Card className="space-y-6">
      <div className="text-base font-bold leading-4 text-neutral-700">Job Details</div>

      <div className="flex gap-4" data-client-toggle>
        <button
          type="button"
          data-contact-toggle="individual"
          onClick={() => handleContactType("individual")}
          className={`rounded-xl border px-2 py-1 text-xs ${
            !isEntity
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
            isEntity
              ? "border-sky-900 bg-[#003882] text-white"
              : "border-slate-300 bg-white text-slate-500"
          }`}
        >
          Entity
        </button>
      </div>

      <input type="hidden" data-field="contact_type" value={contactType} readOnly />
      <input
        type="hidden"
        data-field="account_type"
        value={isEntity ? "Company" : "Contact"}
        readOnly
      />

      <div data-client-section="individual" className={isEntity ? "hidden" : "space-y-4"}>
        <SearchDropdownInput
          label="Client"
          field="client"
          value={clientQuery}
          placeholder="Search by name, email, phone"
          items={contactSearchItems}
          onValueChange={setClientQuery}
          onSelect={(item) => {
            setSelectedClientId(item.id || "");
            setClientQuery(item.label || "");
          }}
          onAdd={() => openAddModal("individual")}
          addButtonLabel="Add New Contact"
          emptyText="No contacts found."
          rootData={{ "data-search-root": "contact-individual" }}
        />
        <input type="hidden" data-field="client_id" value={selectedClientId} readOnly />
      </div>

      <div data-client-section="entity" className={isEntity ? "space-y-4" : "hidden"}>
        <SearchDropdownInput
          label="Company"
          field="entity_name"
          value={entityQuery}
          placeholder="Search entity"
          items={companySearchItems}
          onValueChange={setEntityQuery}
          onSelect={(item) => {
            setSelectedEntityId(item.id || "");
            setSelectedEntityContactId(item.primary?.id || "");
            setEntityQuery(item.label || "");
          }}
          onAdd={() => openAddModal("entity")}
          addButtonLabel="Add New Entity"
          emptyText="No entities found."
          rootData={{ "data-search-root": "contact-entity" }}
        />
        <input type="hidden" data-field="company_id" value={selectedEntityId} readOnly />
        <input type="hidden" data-entity-id="entity-id" value={selectedEntityId} readOnly />
        <input
          type="hidden"
          data-entity-id="entity-contact-id"
          value={selectedEntityContactId}
          readOnly
        />
      </div>

      {showPropertySearch ? (
        <SearchInput
          label="Property Search"
          field="properties"
          defaultValue="230 Cooper St, Epping VIC 3076, Australia"
          placeholder="Search properties"
        />
      ) : null}

      <ColorMappedSelectInput
        label="Priority"
        field="priority"
        options={PRIORITY_OPTIONS}
        value={priorityValue}
        onChange={setPriorityValue}
      />

      <SelectInput
        label="Job Type"
        field="job_type"
        options={JOB_TYPE_OPTIONS}
        value={jobTypeValue}
        onChange={setJobTypeValue}
      />

      <ColorMappedSelectInput
        label="Job Status"
        field="job_status"
        options={JOB_STATUS_OPTIONS}
        value={jobStatusValue}
        onChange={setJobStatusValue}
      />
    </Card>
  );
}
