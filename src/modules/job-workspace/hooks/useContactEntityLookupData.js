import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCompaniesForSearch,
  fetchContactsForSearch,
  subscribeCompaniesForSearch,
  subscribeContactsForSearch,
} from "../sdk/core/runtime.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "./useJobDirectStore.jsx";
import { selectCompanies, selectContacts } from "../state/selectors.js";
import { registerSharedLookupSubscription } from "./lookupRealtimeRegistry.js";

const EMPTY_LIST = [];

function normalizeString(value) {
  return String(value || "").trim();
}

function createContactLookupKey(contact = {}) {
  if (contact.id) return `contact-id:${contact.id}`;
  return [
    "contact",
    normalizeString(contact.first_name),
    normalizeString(contact.last_name),
    normalizeString(contact.email),
    normalizeString(contact.sms_number),
  ].join("|");
}

function createCompanyLookupKey(company = {}) {
  if (company.id) return `company-id:${company.id}`;
  return [
    "company",
    normalizeString(company.name),
    normalizeString(company.account_type),
    normalizeString(company.primary?.id),
    normalizeString(company.primary?.email),
  ].join("|");
}

function dedupeRecords(records = [], getKey) {
  const seen = new Set();
  return records.filter((record) => {
    const key = getKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function areListsEqualByKey(previous = [], next = [], getKey) {
  if (previous === next) return true;
  if (!Array.isArray(previous) || !Array.isArray(next)) return false;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (getKey(previous[index]) !== getKey(next[index])) return false;
  }
  return true;
}

function normalizeContact(contact = {}) {
  const firstName = contact.first_name || contact.First_Name || "";
  const lastName = contact.last_name || contact.Last_Name || "";
  const email = contact.email || contact.Email || "";
  const sms =
    contact.sms_number ||
    contact.SMS_Number ||
    contact.office_phone ||
    contact.Office_Phone ||
    "";
  const id = normalizeString(contact.id || contact.ID || contact.Contact_ID || "");
  const label =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    email ||
    sms ||
    id;

  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    sms_number: sms,
    label,
  };
}

function normalizeCompany(company = {}) {
  const id = normalizeString(company.id || company.ID || "");
  const primary = company.Primary_Person ||
    company.primary_person || {
      id: company.Primary_Person_Contact_ID || "",
      first_name: company.Primary_Person_First_Name || "",
      last_name: company.Primary_Person_Last_Name || "",
      email: company.Primary_Person_Email || "",
      sms_number: company.Primary_Person_SMS_Number || "",
      office_phone: company.Primary_Person_Office_Phone || "",
    };

  return {
    id,
    name: company.name || company.Name || id,
    account_type: company.account_type || company.Account_Type || "",
    primary: {
      id: normalizeString(primary.id || primary.ID || ""),
      first_name: primary.first_name || primary.First_Name || "",
      last_name: primary.last_name || primary.Last_Name || "",
      email: primary.email || primary.Email || "",
      sms_number: primary.sms_number || primary.SMS_Number || primary.office_phone || "",
    },
  };
}

export function useContactEntityLookupData(
  plugin,
  {
    initialContacts = EMPTY_LIST,
    initialCompanies = EMPTY_LIST,
    skipInitialFetch = false,
  } = {}
) {
  const actions = useJobDirectStoreActions();
  const storeContacts = useJobDirectSelector(selectContacts);
  const storeCompanies = useJobDirectSelector(selectCompanies);

  const normalizedInitialContacts = useMemo(
    () => (initialContacts || []).map((item) => normalizeContact(item)),
    [initialContacts]
  );
  const normalizedInitialCompanies = useMemo(
    () => (initialCompanies || []).map((item) => normalizeCompany(item)),
    [initialCompanies]
  );
  const contacts = useMemo(
    () =>
      dedupeRecords((storeContacts || []).map((item) => normalizeContact(item)), createContactLookupKey),
    [storeContacts]
  );
  const companies = useMemo(
    () =>
      dedupeRecords((storeCompanies || []).map((item) => normalizeCompany(item)), createCompanyLookupKey),
    [storeCompanies]
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!normalizedInitialContacts.length) return;
    if (contacts.length && areListsEqualByKey(contacts, normalizedInitialContacts, createContactLookupKey)) {
      return;
    }
    if (!contacts.length) {
      actions.replaceEntityCollection("contacts", normalizedInitialContacts);
    }
  }, [actions, contacts, normalizedInitialContacts]);

  useEffect(() => {
    if (!normalizedInitialCompanies.length) return;
    if (
      companies.length &&
      areListsEqualByKey(companies, normalizedInitialCompanies, createCompanyLookupKey)
    ) {
      return;
    }
    if (!companies.length) {
      actions.replaceEntityCollection("companies", normalizedInitialCompanies);
    }
  }, [actions, companies, normalizedInitialCompanies]);

  useEffect(() => {
    if (!plugin) return undefined;

    const releaseContactsSubscription = registerSharedLookupSubscription({
      key: "lookup:contacts",
      start: () =>
        subscribeContactsForSearch({
          plugin,
          onChange: (records) => {
            const normalized = (records || []).map((item) => normalizeContact(item));
            actions.replaceEntityCollection(
              "contacts",
              dedupeRecords(normalized, createContactLookupKey)
            );
          },
          onError: (lookupError) => {
            console.error("[JobDirect] Contact lookup subscription failed", lookupError);
          },
        }),
    });

    const releaseCompaniesSubscription = registerSharedLookupSubscription({
      key: "lookup:companies",
      start: () =>
        subscribeCompaniesForSearch({
          plugin,
          onChange: (records) => {
            const normalized = (records || []).map((item) => normalizeCompany(item));
            actions.replaceEntityCollection(
              "companies",
              dedupeRecords(normalized, createCompanyLookupKey)
            );
          },
          onError: (lookupError) => {
            console.error("[JobDirect] Company lookup subscription failed", lookupError);
          },
        }),
    });

    return () => {
      releaseContactsSubscription();
      releaseCompaniesSubscription();
    };
  }, [actions, plugin]);

  useEffect(() => {
    let isActive = true;
    if (!plugin) {
      return undefined;
    }

    if (skipInitialFetch) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    Promise.all([
      fetchContactsForSearch({ plugin }),
      fetchCompaniesForSearch({ plugin }),
    ])
      .then(([contactRecords, companyRecords]) => {
        if (!isActive) return;
        const normalizedContacts = (contactRecords || []).map((item) => normalizeContact(item));
        const normalizedCompanies = (companyRecords || []).map((item) => normalizeCompany(item));
        actions.replaceEntityCollection(
          "contacts",
          dedupeRecords(normalizedContacts, createContactLookupKey)
        );
        actions.replaceEntityCollection(
          "companies",
          dedupeRecords(normalizedCompanies, createCompanyLookupKey)
        );
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading contact/company lookup data", error);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    actions,
    plugin,
    skipInitialFetch,
  ]);

  const addContact = useCallback((newContact) => {
    const normalized = normalizeContact(newContact);
    actions.upsertEntityRecord("contacts", normalized, { idField: "id" });
    return normalized;
  }, [actions]);

  const addCompany = useCallback((newCompany) => {
    const normalized = normalizeCompany(newCompany);
    actions.upsertEntityRecord("companies", normalized, { idField: "id" });
    return normalized;
  }, [actions]);

  return {
    contacts,
    companies,
    isLookupLoading: isLoading,
    addContact,
    addCompany,
  };
}
