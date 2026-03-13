import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useContactEntityLookupData } from "../../hooks/useContactEntityLookupData.js";
import {
  createCompanyRecord,
  createContactRecord,
} from "../../api/core/runtime.js";
import {
  createContactRecordKey,
  createCompanyRecordKey,
  dedupeLookupRecords,
  extractRoleFlags,
  isPersistedRecordId,
  mapInitialForm,
} from "./propertyAffiliationUtils.js";

export function usePropertyAffiliationForm({
  open,
  initialData,
  plugin,
  propertyId,
  onClose,
  onSave,
  onOpenContactDetailsModal,
}) {
  const { success, error } = useToast();
  const {
    contacts,
    companies,
    addContact,
    addCompany,
    searchContacts,
    searchCompanies,
  } = useContactEntityLookupData(plugin, {
    skipInitialFetch: true,
    skipSubscriptions: !open,
  });

  const [form, setForm] = useState(mapInitialForm(initialData));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [searchedContacts, setSearchedContacts] = useState([]);
  const [searchedCompanies, setSearchedCompanies] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(mapInitialForm(initialData));
    setIsSaving(false);
    setSaveError("");
    setSearchedContacts([]);
    setSearchedCompanies([]);
  }, [open, initialData]);

  const mergedContacts = useMemo(
    () => dedupeLookupRecords([...(searchedContacts || []), ...(contacts || [])], createContactRecordKey),
    [contacts, searchedContacts]
  );
  const mergedCompanies = useMemo(
    () => dedupeLookupRecords([...(searchedCompanies || []), ...(companies || [])], createCompanyRecordKey),
    [companies, searchedCompanies]
  );

  const handleSearchContacts = async (query) => {
    const normalized = await searchContacts(query);
    if (Array.isArray(normalized) && normalized.length) {
      setSearchedContacts((previous) =>
        dedupeLookupRecords([...(normalized || []), ...(previous || [])], createContactRecordKey)
      );
    }
    return normalized;
  };

  const handleSearchCompanies = async (query) => {
    const normalized = await searchCompanies(query);
    if (Array.isArray(normalized) && normalized.length) {
      setSearchedCompanies((previous) =>
        dedupeLookupRecords([...(normalized || []), ...(previous || [])], createCompanyRecordKey)
      );
    }
    return normalized;
  };

  const contactItems = useMemo(
    () =>
      mergedContacts.map((item) => ({
        id: item.id,
        label: item.label || item.id,
        meta: [item.email, item.sms_number].filter(Boolean).join(" | "),
      })),
    [mergedContacts]
  );

  const companyItems = useMemo(
    () =>
      mergedCompanies.map((item) => ({
        id: item.id,
        label: item.name || item.id,
        meta: [item.account_type, item.primary?.email].filter(Boolean).join(" | "),
      })),
    [mergedCompanies]
  );

  const handleAddLookupRecord = (mode) => {
    if (typeof onOpenContactDetailsModal !== "function") return;
    onOpenContactDetailsModal({
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
          const existingCompanyId = String(
            draftRecord?.id || draftRecord?.ID || draftRecord?.Company_ID || ""
          ).trim();
          const isPersistedCompanyId = isPersistedRecordId(existingCompanyId);
          if (isPersistedCompanyId) {
            const normalizedCompany = addCompany({
              ...draftRecord,
              id: existingCompanyId,
              name: companyName,
            });
            setForm((previous) => {
              const next = {
                ...previous,
                company_id: normalizedCompany.id || existingCompanyId,
                company_label: normalizedCompany.name || companyName,
              };
              if (previous.same_as_company) {
                next.company_as_accounts_contact_id = normalizedCompany.id || existingCompanyId;
                next.company_as_accounts_contact_label = normalizedCompany.name || companyName;
              }
              return next;
            });
            success("Company selected", "Existing company was selected.");
            return {
              ...draftRecord,
              id: existingCompanyId,
              name: companyName,
            };
          }
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: {
              ...draftRecord,
              name: companyName,
            },
          });
          const normalizedCompany = addCompany({
            ...createdCompany,
            Primary_Person:
              createdCompany?.Primary_Person || draftRecord?.Primary_Person || null,
          });
          setForm((previous) => {
            const next = {
              ...previous,
              company_id: normalizedCompany.id || "",
              company_label: normalizedCompany.name || "",
            };
            if (previous.same_as_company) {
              next.company_as_accounts_contact_id = normalizedCompany.id || "";
              next.company_as_accounts_contact_label = normalizedCompany.name || "";
            }
            return next;
          });
          success("Company created", "New company was saved.");
          return createdCompany;
        }

        const existingContactId = String(
          draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID || ""
        ).trim();
        if (isPersistedRecordId(existingContactId)) {
          const normalizedContact = addContact({
            ...draftRecord,
            id: existingContactId,
          });
          setForm((previous) => ({
            ...previous,
            contact_id: normalizedContact.id || existingContactId,
            contact_label: normalizedContact.label || previous.contact_label,
          }));
          success("Contact selected", "Existing contact was selected.");
          return {
            ...draftRecord,
            id: existingContactId,
          };
        }
        const savedContact = await createContactRecord({
          plugin,
          payload: draftRecord,
        });
        const normalizedContact = addContact(savedContact);
        setForm((previous) => ({
          ...previous,
          contact_id: normalizedContact.id || "",
          contact_label: normalizedContact.label || "",
        }));
        success("Contact created", "New contact was saved.");
        return savedContact;
      },
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!propertyId) {
      const message = "Select a property before adding property contacts.";
      setSaveError(message);
      error("Save failed", message);
      return;
    }
    if (!form.role.trim()) {
      const message = "Role is required.";
      setSaveError(message);
      error("Save failed", message);
      return;
    }
    if (!form.contact_id && !form.company_id) {
      const message = "Select at least one contact or company.";
      setSaveError(message);
      error("Save failed", message);
      return;
    }

    const { primary_owner_contact, primary_resident_contact, primary_property_manager_contact } =
      extractRoleFlags(form.role);

    const payload = {
      role: String(form.role || "").trim(),
      property_id: propertyId,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      company_as_accounts_contact_id: form.same_as_company
        ? form.company_id || null
        : form.company_as_accounts_contact_id || null,
      primary_owner_contact: form.is_primary ? primary_owner_contact : false,
      primary_resident_contact: form.is_primary ? primary_resident_contact : false,
      primary_property_manager_contact: form.is_primary
        ? primary_property_manager_contact
        : false,
    };

    if (typeof onSave !== "function") {
      onClose?.();
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(payload, { id: form.id || "" });
      onClose?.();
    } catch (saveErrorValue) {
      const message = saveErrorValue?.message || "Unable to save property contact.";
      setSaveError(message);
      error("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    form,
    setForm,
    isSaving,
    saveError,
    contactItems,
    companyItems,
    handleSearchContacts,
    handleSearchCompanies,
    handleAddLookupRecord,
    handleSave,
  };
}
