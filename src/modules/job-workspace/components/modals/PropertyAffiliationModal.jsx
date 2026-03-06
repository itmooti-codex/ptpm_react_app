import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { useContactEntityLookupData } from "../../hooks/useContactEntityLookupData.js";
import {
  createCompanyRecord,
  createContactRecord,
} from "../../sdk/core/runtime.js";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenizeQuery(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesSearchQuery(searchText = "", query = "") {
  const normalizedSearchText = normalizeText(searchText);
  const queryTokens = tokenizeQuery(query);
  if (!queryTokens.length) return true;
  return queryTokens.every((token) => normalizedSearchText.includes(token));
}

function buildContactLabel(contact = {}) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.email || contact.sms_number || contact.id || "";
}

function createContactRecordKey(contact = {}) {
  const id = String(contact?.id || contact?.ID || "").trim();
  if (id) return `contact:${id}`;
  return [
    "contact",
    normalizeText(contact?.first_name),
    normalizeText(contact?.last_name),
    normalizeText(contact?.email),
    normalizeText(contact?.sms_number),
    normalizeText(contact?.label),
  ].join("|");
}

function createCompanyRecordKey(company = {}) {
  const id = String(company?.id || company?.ID || "").trim();
  if (id) return `company:${id}`;
  return [
    "company",
    normalizeText(company?.name),
    normalizeText(company?.account_type),
    normalizeText(company?.label),
  ].join("|");
}

function dedupeLookupRecords(records = [], createKey) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const key = createKey(record);
    if (!key || map.has(key)) return;
    map.set(key, record);
  });
  return Array.from(map.values());
}

function extractRoleFlags(role = "") {
  const normalizedRole = normalizeText(role);
  return {
    primary_owner_contact: normalizedRole.includes("owner"),
    primary_resident_contact: normalizedRole.includes("resident"),
    primary_property_manager_contact:
      normalizedRole.includes("manager") || normalizedRole.includes("property manager"),
  };
}

function isPersistedRecordId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function SearchLookupInput({
  label,
  value,
  placeholder,
  items = [],
  onValueChange,
  onSelect,
  onAdd,
  onSearchQueryChange = null,
  searchDebounceMs = 250,
  minSearchLength = 2,
  addLabel,
  emptyText,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const hasValue = Boolean(String(value || "").trim());

  const filteredItems = useMemo(() => {
    const query = String(value || "");
    if (!tokenizeQuery(query).length) return items;
    return items.filter((item) => {
      const searchText = [
        item.label,
        item.meta,
        item.id,
        item.first_name,
        item.last_name,
        item.firstName,
        item.lastName,
        item.full_name,
        item.fullName,
        item.name,
        item.searchText,
        Array.isArray(item.searchTokens) ? item.searchTokens.join(" ") : item.searchTokens,
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ");
      return matchesSearchQuery(searchText, query);
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

  useEffect(() => {
    if (!isOpen || disabled) return undefined;
    if (typeof onSearchQueryChange !== "function") return undefined;
    const normalizedQuery = String(value || "").trim();
    if (normalizedQuery.length < Math.max(0, Number(minSearchLength) || 0)) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      Promise.resolve(onSearchQueryChange(normalizedQuery)).catch((searchError) => {
        console.error("[JobDirect] Affiliation lookup search failed", searchError);
      });
    }, Math.max(0, Number(searchDebounceMs) || 0));
    return () => window.clearTimeout(timeoutId);
  }, [
    disabled,
    isOpen,
    minSearchLength,
    onSearchQueryChange,
    searchDebounceMs,
    value,
  ]);

  return (
    <div ref={rootRef} className="w-full">
      <div className="mb-1 text-sm font-medium leading-4 text-neutral-700">{label}</div>
      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(event) => {
            onValueChange(event.target.value);
            if (!disabled) setIsOpen(true);
          }}
          disabled={disabled}
          className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 pr-14 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {hasValue ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onValueChange("");
              if (!disabled) setIsOpen(true);
            }}
            disabled={disabled}
            className="absolute inset-y-0 right-7 inline-flex items-center px-1 text-slate-400 hover:text-slate-600 disabled:opacity-40"
            aria-label={`Clear ${label} search`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setIsOpen((previous) => !previous);
          }}
          disabled={disabled}
          className="absolute inset-y-0 right-2 inline-flex items-center px-1 text-slate-400 disabled:opacity-40"
          aria-label={`Open ${label} lookup`}
        >
          ▾
        </button>

        {isOpen ? (
          <div className="absolute z-40 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredItems.length ? (
                filteredItems.map((item, index) => (
                  <li key={`${item.id || item.label || "item"}-${index}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-slate-50"
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
                {addLabel || "Add New"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function mapInitialForm(initialData = null) {
  if (!initialData) {
    return {
      id: "",
      role: "",
      is_primary: false,
      contact_id: "",
      contact_label: "",
      company_id: "",
      company_label: "",
      same_as_company: false,
      company_as_accounts_contact_id: "",
      company_as_accounts_contact_label: "",
    };
  }

  const contactLabel = [
    initialData.contact_first_name || initialData.Contact_First_Name || "",
    initialData.contact_last_name || initialData.Contact_Last_Name || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const companyLabel = String(
    initialData.company_name || initialData.CompanyName || ""
  ).trim();

  const accountsCompanyLabel = String(
    initialData.company_as_accounts_contact_name ||
      initialData.Company_as_Accounts_Contact_Name ||
      ""
  ).trim();

  const companyId = String(initialData.company_id || initialData.Company_ID || "").trim();
  const accountsCompanyId = String(
    initialData.company_as_accounts_contact_id ||
      initialData.Company_as_Accounts_Contact_ID ||
      ""
  ).trim();
  const sameAsCompany = Boolean(companyId && accountsCompanyId && companyId === accountsCompanyId);
  const isPrimary = Boolean(
    initialData.primary_owner_contact ||
      initialData.Primary_Owner_Contact ||
      initialData.primary_resident_contact ||
      initialData.Primary_Resident_Contact ||
      initialData.primary_property_manager_contact ||
      initialData.Primary_Property_Manager_Contact
  );

  return {
    id: String(initialData.id || initialData.ID || "").trim(),
    role: String(initialData.role || initialData.Role || "").trim(),
    is_primary: isPrimary,
    contact_id: String(initialData.contact_id || initialData.Contact_ID || "").trim(),
    contact_label: contactLabel || String(initialData.contact_email || initialData.ContactEmail || "").trim(),
    company_id: companyId,
    company_label: companyLabel,
    same_as_company: sameAsCompany,
    company_as_accounts_contact_id: accountsCompanyId,
    company_as_accounts_contact_label:
      accountsCompanyLabel || (sameAsCompany ? companyLabel : ""),
  };
}

export function PropertyAffiliationModal({
  open,
  onClose,
  onSave,
  initialData = null,
  plugin,
  propertyId,
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
        success(
          "Contact created",
          "New contact was saved."
        );
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Edit Property Contact" : "Add Property Contact"}
      widthClass="max-w-3xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          {saveError ? <div className="mr-auto text-xs text-red-600">{saveError}</div> : null}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : form.id ? "Update Contact" : "Save Contact"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <InputField
          label="Role"
          value={form.role}
          onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}
          placeholder="Owner, Resident, Property Manager"
        />
        <CheckboxField
          label="Is Primary?"
          checked={Boolean(form.is_primary)}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              is_primary: Boolean(event.target.checked),
            }))
          }
        />

        <SearchLookupInput
          label="Contact"
          value={form.contact_label}
          placeholder="Search contact"
          items={contactItems}
          onSearchQueryChange={handleSearchContacts}
          onValueChange={(nextValue) =>
            setForm((previous) => ({
              ...previous,
              contact_label: nextValue,
              contact_id: "",
            }))
          }
          onSelect={(item) =>
            setForm((previous) => ({
              ...previous,
              contact_id: item.id || "",
              contact_label: item.label || "",
            }))
          }
          onAdd={() => handleAddLookupRecord("individual")}
          addLabel="Add New Contact"
          emptyText="No contacts found."
        />

        <SearchLookupInput
          label="Company"
          value={form.company_label}
          placeholder="Search company"
          items={companyItems}
          onSearchQueryChange={handleSearchCompanies}
          onValueChange={(nextValue) =>
            setForm((previous) => ({
              ...previous,
              company_label: nextValue,
              company_id: "",
              ...(previous.same_as_company
                ? {
                    company_as_accounts_contact_id: "",
                    company_as_accounts_contact_label: nextValue,
                  }
                : {}),
            }))
          }
          onSelect={(item) =>
            setForm((previous) => ({
              ...previous,
              company_id: item.id || "",
              company_label: item.label || "",
              ...(previous.same_as_company
                ? {
                    company_as_accounts_contact_id: item.id || "",
                    company_as_accounts_contact_label: item.label || "",
                  }
                : {}),
            }))
          }
          onAdd={() => handleAddLookupRecord("entity")}
          addLabel="Add New Company"
          emptyText="No companies found."
        />

        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-neutral-700">Company As Accounts Contact</div>
          <CheckboxField
            label="Same as company"
            checked={form.same_as_company}
            onChange={(event) =>
              setForm((previous) => {
                const checked = event.target.checked;
                if (!checked) {
                  return {
                    ...previous,
                    same_as_company: false,
                    company_as_accounts_contact_id: "",
                    company_as_accounts_contact_label: "",
                  };
                }
                return {
                  ...previous,
                  same_as_company: true,
                  company_as_accounts_contact_id: previous.company_id || "",
                  company_as_accounts_contact_label: previous.company_label || "",
                };
              })
            }
          />

          <div className="mt-2">
            <SearchLookupInput
              label="Accounts Company"
              value={form.company_as_accounts_contact_label}
              placeholder="Search company"
              items={companyItems}
              onSearchQueryChange={handleSearchCompanies}
              onValueChange={(nextValue) =>
                setForm((previous) => ({
                  ...previous,
                  company_as_accounts_contact_label: nextValue,
                  company_as_accounts_contact_id: "",
                }))
              }
              onSelect={(item) =>
                setForm((previous) => ({
                  ...previous,
                  company_as_accounts_contact_id: item.id || "",
                  company_as_accounts_contact_label: item.label || "",
                }))
              }
              onAdd={() => handleAddLookupRecord("entity")}
              addLabel="Add New Company"
              emptyText="No companies found."
              disabled={form.same_as_company}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}
