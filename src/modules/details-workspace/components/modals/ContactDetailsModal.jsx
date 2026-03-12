import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGoogleAddressLookup } from "../../../../shared/hooks/useGoogleAddressLookup.js";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { SearchDropdownInput } from "../sections/job-information/JobInfoFormFields.jsx";
import {
  fetchCompaniesForSearch,
  fetchContactsForSearch,
  findContactByEmail,
  searchCompaniesForLookup,
  searchContactsForLookup,
} from "../../api/core/runtime.js";

const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

const COUNTRY_OPTIONS = [
  { value: "AU", label: "Australia" },
];

const COMPANY_TYPE_OPTIONS = [
  { value: "Family/Individual", label: "Family/Individual" },
  { value: "Business", label: "Business" },
];

const COMPANY_INDUSTRY_OPTIONS = [
  { value: "Education", label: "Education" },
  { value: "Telecom", label: "Telecom" },
  { value: "Software", label: "Software" },
  { value: "Automotive", label: "Automotive" },
  { value: "Hospitality", label: "Hospitality" },
  { value: "Accounting", label: "Accounting" },
  { value: "Restaurant", label: "Restaurant" },
  { value: "Printing", label: "Printing" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Engineering", label: "Engineering" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Food + Agriculture", label: "Food + Agriculture" },
  { value: "Insurance", label: "Insurance" },
  { value: "Pharma", label: "Pharma" },
  { value: "Clothing", label: "Clothing" },
  { value: "Marketing + Advertising", label: "Marketing + Advertising" },
  { value: "Retail", label: "Retail" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Transport", label: "Transport" },
  { value: "Construction", label: "Construction" },
  { value: "Finance", label: "Finance" },
  { value: "Manufacturing", label: "Manufacturing" },
];

const COMPANY_ACCOUNT_TYPE_OPTIONS = [
  { value: "Body Corp", label: "Body Corp" },
  { value: "Body Corp Company", label: "Body Corp Company" },
  { value: "Business & Gov", label: "Business & Gov" },
  { value: "Closed Real Estate", label: "Closed Real Estate" },
  { value: "School/Childcare", label: "School/Childcare" },
  { value: "Real Estate Agent", label: "Real Estate Agent" },
  { value: "Tenant to Pay", label: "Tenant to Pay" },
  { value: "Wildlife Rescue", label: "Wildlife Rescue" },
];

const COMPANY_ANNUAL_REVENUE_OPTIONS = [
  { value: "> 100m", label: "> 100m" },
  { value: "50m - 100m", label: "50m - 100m" },
  { value: "20m - 50m", label: "20m - 50m" },
  { value: "5m - 20m", label: "5m - 20m" },
  { value: "1m - 5m", label: "1m - 5m" },
  { value: "< 1m", label: "< 1m" },
];

const COMPANY_EMPLOYEE_COUNT_OPTIONS = [
  { value: "< 10", label: "< 10" },
  { value: "10 - 50", label: "10 - 50" },
  { value: "50 - 200", label: "50 - 200" },
  { value: "200 - 1000", label: "200 - 1000" },
  { value: "1000 +", label: "1000 +" },
];

const INITIAL_FORM = {
  id: "",
  company_name: "",
  company_type: "",
  company_description: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_postal_code: "",
  company_industry: "",
  company_annual_revenue: "",
  company_number_of_employees: "",
  company_account_type: "",
  popup_comment: "",

  first_name: "",
  last_name: "",
  email: "",
  sms_number: "",

  lot_number: "",
  unit_number: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "AU",

  postal_address: "",
  postal_city: "",
  postal_state: "",
  postal_country: "AU",
  postal_code: "",
};

const ADDRESS_TO_POSTAL_FIELD = {
  address: "postal_address",
  city: "postal_city",
  state: "postal_state",
  country: "postal_country",
  zip_code: "postal_code",
};

function copyAddressIntoPostal(form) {
  return {
    ...form,
    postal_address: form.address || "",
    postal_city: form.city || "",
    postal_state: form.state || "",
    postal_country: form.country || "",
    postal_code: form.zip_code || "",
  };
}

function trimValue(value) {
  return String(value || "").trim();
}

function normalizeRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function normalizeLookupId(record = {}) {
  return trimValue(record?.id || record?.ID || record?.Contact_ID || record?.Company_ID);
}

function mergeLookupRecords(currentRecords = [], incomingRecords = []) {
  const byId = new Map();
  [...(incomingRecords || []), ...(currentRecords || [])].forEach((record) => {
    const id = normalizeLookupId(record);
    if (!id) return;
    if (!byId.has(id)) {
      byId.set(id, record);
    }
  });
  return Array.from(byId.values());
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  return Promise.resolve(result);
}

function compactStringFields(source = {}) {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const trimmed = trimValue(value);
    if (trimmed) output[key] = trimmed;
  });
  return output;
}

function formatDisplayName(firstName, lastName) {
  return [trimValue(firstName), trimValue(lastName)].filter(Boolean).join(" ");
}

function buildContactSearchValue(source = {}) {
  const fullName = formatDisplayName(source?.first_name || source?.First_Name, source?.last_name || source?.Last_Name);
  if (fullName) return fullName;
  return trimValue(source?.email || source?.Email);
}

function buildCompanySearchValue(source = {}) {
  return trimValue(source?.company_name || source?.name || source?.Name);
}

function mapContactRecordToForm(record = {}, previous = INITIAL_FORM) {
  return {
    ...previous,
    id: trimValue(record?.id || record?.ID || record?.Contact_ID),
    first_name: trimValue(record?.first_name || record?.First_Name || previous.first_name),
    last_name: trimValue(record?.last_name || record?.Last_Name || previous.last_name),
    email: trimValue(record?.email || record?.Email || previous.email),
    sms_number: trimValue(
      record?.sms_number ||
        record?.SMS_Number ||
        record?.office_phone ||
        record?.Office_Phone ||
        previous.sms_number
    ),
    lot_number: trimValue(record?.lot_number || record?.Lot_Number || previous.lot_number),
    unit_number: trimValue(record?.unit_number || record?.Unit_Number || previous.unit_number),
    address: trimValue(record?.address || record?.Address || previous.address),
    city: trimValue(record?.city || record?.City || previous.city),
    state: trimValue(record?.state || record?.State || previous.state),
    zip_code: trimValue(record?.zip_code || record?.Zip_Code || previous.zip_code),
    country: trimValue(record?.country || record?.Country || previous.country || "AU") || "AU",
    postal_address: trimValue(
      record?.postal_address || record?.Postal_Address || previous.postal_address
    ),
    postal_city: trimValue(record?.postal_city || record?.Postal_City || previous.postal_city),
    postal_state: trimValue(
      record?.postal_state || record?.Postal_State || previous.postal_state
    ),
    postal_country: trimValue(
      record?.postal_country || record?.Postal_Country || previous.postal_country || "AU"
    ) || "AU",
    postal_code: trimValue(record?.postal_code || record?.Postal_Code || previous.postal_code),
  };
}

function mapCompanyRecordToForm(record = {}, previous = INITIAL_FORM) {
  const primary = normalizeRelationRecord(
    record?.Primary_Person ||
      record?.primary_person ||
      record?.PrimaryPerson
  );
  return {
    ...previous,
    id: trimValue(record?.id || record?.ID || record?.Company_ID),
    company_name: trimValue(record?.name || record?.Name || previous.company_name),
    company_type: trimValue(record?.type || record?.Type || previous.company_type),
    company_description: trimValue(
      record?.description || record?.Description || previous.company_description
    ),
    company_phone: trimValue(record?.phone || record?.Phone || previous.company_phone),
    company_address: trimValue(record?.address || record?.Address || previous.company_address),
    company_city: trimValue(record?.city || record?.City || previous.company_city),
    company_state: trimValue(record?.state || record?.State || previous.company_state),
    company_postal_code: trimValue(
      record?.postal_code || record?.Postal_Code || previous.company_postal_code
    ),
    company_industry: trimValue(record?.industry || record?.Industry || previous.company_industry),
    company_annual_revenue: trimValue(
      record?.annual_revenue || record?.Annual_Revenue || previous.company_annual_revenue
    ),
    company_number_of_employees: trimValue(
      record?.number_of_employees ||
        record?.Number_of_Employees ||
        previous.company_number_of_employees
    ),
    company_account_type: trimValue(
      record?.account_type || record?.Account_Type || previous.company_account_type
    ),
    popup_comment: trimValue(record?.popup_comment || record?.Popup_Comment || previous.popup_comment),
    first_name: trimValue(
      primary?.first_name ||
        primary?.First_Name ||
        record?.Primary_Person_First_Name ||
        previous.first_name
    ),
    last_name: trimValue(
      primary?.last_name ||
        primary?.Last_Name ||
        record?.Primary_Person_Last_Name ||
        previous.last_name
    ),
    email: trimValue(
      primary?.email ||
        primary?.Email ||
        record?.Primary_Person_Email ||
        previous.email
    ),
    sms_number: trimValue(
      primary?.sms_number ||
        primary?.SMS_Number ||
        primary?.office_phone ||
        primary?.Office_Phone ||
        record?.Primary_Person_SMS_Number ||
        record?.Primary_Person_Office_Phone ||
        previous.sms_number
    ),
  };
}

async function fetchCompanyById({ plugin, companyId }) {
  if (!plugin?.switchTo) return null;
  const id = trimValue(companyId);
  if (!id) return null;
  const query = plugin
    .switchTo("PeterpmCompany")
    .query()
    .where("id", id)
    .deSelectAll()
    .select([
      "id",
      "name",
      "type",
      "description",
      "phone",
      "address",
      "city",
      "state",
      "postal_code",
      "industry",
      "annual_revenue",
      "number_of_employees",
      "account_type",
      "popup_comment",
    ])
    .include("Primary_Person", (personQuery) =>
      personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const response = await toPromiseLike(query.fetchDirect());
  const rows = response?.resp || response?.data || [];
  return Array.isArray(rows) && rows.length ? rows[0] || null : null;
}

async function fetchContactById({ plugin, contactId }) {
  if (!plugin?.switchTo) return null;
  const id = trimValue(contactId);
  if (!id) return null;
  const query = plugin
    .switchTo("PeterpmContact")
    .query()
    .where("id", id)
    .deSelectAll()
    .select([
      "id",
      "first_name",
      "last_name",
      "email",
      "sms_number",
      "office_phone",
      "lot_number",
      "unit_number",
      "address",
      "city",
      "state",
      "zip_code",
      "country",
      "postal_address",
      "postal_city",
      "postal_state",
      "postal_country",
      "postal_code",
    ])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const response = await toPromiseLike(query.fetchDirect());
  const rows = response?.resp || response?.data || [];
  return Array.isArray(rows) && rows.length ? rows[0] || null : null;
}

async function findCompanyByName({ plugin, name }) {
  const companyName = trimValue(name);
  if (!plugin?.switchTo || !companyName) return null;

  try {
    const directQuery = plugin
      .switchTo("PeterpmCompany")
      .query()
      .where("name", companyName)
      .deSelectAll()
      .select(["id", "name"])
      .limit(1)
      .noDestroy();
    directQuery.getOrInitQueryCalc?.();
    const directResponse = await toPromiseLike(directQuery.fetchDirect());
    const directRows = directResponse?.resp || directResponse?.data || [];
    const directRecord = Array.isArray(directRows) && directRows.length ? directRows[0] || null : null;
    const directId = trimValue(directRecord?.id || directRecord?.ID);
    if (directId) {
      const detailed = await fetchCompanyById({ plugin, companyId: directId });
      return detailed || directRecord;
    }
  } catch (lookupError) {
    console.warn("[JobDirect] Company direct-name lookup failed", lookupError);
  }

  try {
    const results = await searchCompaniesForLookup({
      plugin,
      query: companyName,
      limit: 20,
    });
    const normalizedTarget = companyName.toLowerCase();
    const matched = (Array.isArray(results) ? results : []).find(
      (item) => trimValue(item?.name || item?.Name).toLowerCase() === normalizedTarget
    );
    const matchedId = trimValue(matched?.id || matched?.ID);
    if (!matchedId) return null;
    const detailed = await fetchCompanyById({ plugin, companyId: matchedId });
    return detailed || matched;
  } catch (lookupError) {
    console.error("[JobDirect] Company duplicate lookup failed", lookupError);
    return null;
  }
}

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        className={`flex w-full items-center justify-between bg-[color:var(--color-light)] px-4 py-3 text-left transition-colors hover:bg-[#eaf0f7] ${
          isOpen ? "rounded-t" : "rounded"
        }`}
        onClick={onToggle}
      >
        <span className="type-subheadline-2 text-slate-800">{title}</span>
        <span
          className={`inline-block text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}

export function ContactDetailsModal({
  open,
  onClose,
  mode = "individual",
  onSave,
  plugin = null,
  onModeChange = null,
  allowModeSwitch = false,
  titleVerb = "Add",
  initialValues = null,
  saveOnLookupSelect = false,
  useTopLookupSearch = false,
  enableInlineDuplicateLookup = false,
}) {
  const { error: showErrorToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [sameAsAddress, setSameAsAddress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [existingContactRecord, setExistingContactRecord] = useState(null);
  const [existingCompanyRecord, setExistingCompanyRecord] = useState(null);
  const [isContactLookupLoading, setIsContactLookupLoading] = useState(false);
  const [isCompanyLookupLoading, setIsCompanyLookupLoading] = useState(false);
  const [openSections, setOpenSections] = useState({
    company: true,
    companyAddress: true,
    basic: true,
    address: true,
    postal: true,
  });
  const [lookupContacts, setLookupContacts] = useState([]);
  const [lookupCompanies, setLookupCompanies] = useState([]);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupSearching, setIsLookupSearching] = useState(false);
  const [selectedLookupContact, setSelectedLookupContact] = useState({
    id: "",
    email: "",
  });
  const [selectedPrimaryPersonContact, setSelectedPrimaryPersonContact] = useState({
    id: "",
    email: "",
  });
  const existingLookupRef = useRef({
    requestKey: "",
    matchedId: "",
  });
  const companyLookupRef = useRef({
    requestKey: "",
    matchedId: "",
  });
  const primaryPersonLookupRef = useRef({
    requestKey: "",
    matchedId: "",
  });
  const [existingPrimaryPersonRecord, setExistingPrimaryPersonRecord] = useState(null);
  const [isPrimaryPersonLookupLoading, setIsPrimaryPersonLookupLoading] = useState(false);
  const isEntity = mode === "entity";

  const contactItems = useMemo(
    () =>
      (lookupContacts || [])
        .map((contact) => {
          const id = trimValue(contact?.id || contact?.ID || contact?.Contact_ID);
          const firstName = trimValue(contact?.first_name || contact?.First_Name);
          const lastName = trimValue(contact?.last_name || contact?.Last_Name);
          const email = trimValue(contact?.email || contact?.Email);
          const smsNumber = trimValue(
            contact?.sms_number || contact?.SMS_Number || contact?.office_phone || contact?.Office_Phone
          );
          const label = formatDisplayName(firstName, lastName) || email || smsNumber || id;
          const meta = [email, smsNumber, id].filter(Boolean).join(" | ");
          return {
            id,
            label,
            meta,
            first_name: firstName,
            last_name: lastName,
            email,
            sms_number: smsNumber,
          };
        })
        .filter((item) => Boolean(item.id || item.label)),
    [lookupContacts]
  );

  const companyItems = useMemo(
    () =>
      (lookupCompanies || [])
        .map((company) => {
          const id = trimValue(company?.id || company?.ID || company?.Company_ID);
          const name = trimValue(company?.name || company?.Name);
          const accountType = trimValue(company?.account_type || company?.Account_Type);
          const primary = normalizeRelationRecord(
            company?.primary ||
              company?.Primary_Person
          );
          const primaryFirstName = trimValue(
            primary?.first_name || primary?.First_Name || company?.Primary_Person_First_Name
          );
          const primaryLastName = trimValue(
            primary?.last_name || primary?.Last_Name || company?.Primary_Person_Last_Name
          );
          const primaryName = formatDisplayName(primaryFirstName, primaryLastName);
          const primaryEmail = trimValue(
            primary?.email || primary?.Email || company?.Primary_Person_Email
          );
          const primarySms = trimValue(
            primary?.sms_number ||
              primary?.SMS_Number ||
              primary?.office_phone ||
              primary?.Office_Phone ||
              company?.Primary_Person_SMS_Number ||
              company?.Primary_Person_Office_Phone
          );
          const meta = [accountType, primaryName, primaryEmail, primarySms, id]
            .filter(Boolean)
            .join(" | ");
          return {
            id,
            label: name || id,
            meta,
            name,
            account_type: accountType,
            primary: {
              first_name: primaryFirstName,
              last_name: primaryLastName,
              email: primaryEmail,
              sms_number: primarySms,
            },
          };
        })
        .filter((item) => Boolean(item.id || item.label)),
    [lookupCompanies]
  );

  useEffect(() => {
    if (!open || !useTopLookupSearch || !plugin?.switchTo) return undefined;
    let isMounted = true;
    setIsLookupLoading(true);

    Promise.all([
      fetchContactsForSearch({ plugin }),
      fetchCompaniesForSearch({ plugin }),
    ])
      .then(([contactRecords, companyRecords]) => {
        if (!isMounted) return;
        setLookupContacts(Array.isArray(contactRecords) ? contactRecords : []);
        setLookupCompanies(Array.isArray(companyRecords) ? companyRecords : []);
      })
      .catch((lookupError) => {
        if (!isMounted) return;
        console.error("[JobDirect] Failed to load top-level lookup data", lookupError);
        setLookupContacts([]);
        setLookupCompanies([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLookupLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, plugin, useTopLookupSearch]);

  const searchContacts = useCallback(
    async (query) => {
      const normalizedQuery = trimValue(query);
      if (!useTopLookupSearch || !plugin?.switchTo || normalizedQuery.length < 2) return [];
      setIsLookupSearching(true);
      try {
        const records = await searchContactsForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const resolvedRecords = Array.isArray(records) ? records : [];
        setLookupContacts((previous) => mergeLookupRecords(previous, resolvedRecords));
        return resolvedRecords;
      } catch (lookupError) {
        console.error("[JobDirect] Contact top lookup search failed", lookupError);
        return [];
      } finally {
        setIsLookupSearching(false);
      }
    },
    [plugin, useTopLookupSearch]
  );

  const searchCompanies = useCallback(
    async (query) => {
      const normalizedQuery = trimValue(query);
      if (!useTopLookupSearch || !plugin?.switchTo || normalizedQuery.length < 2) return [];
      setIsLookupSearching(true);
      try {
        const records = await searchCompaniesForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const resolvedRecords = Array.isArray(records) ? records : [];
        setLookupCompanies((previous) => mergeLookupRecords(previous, resolvedRecords));
        return resolvedRecords;
      } catch (lookupError) {
        console.error("[JobDirect] Company top lookup search failed", lookupError);
        return [];
      } finally {
        setIsLookupSearching(false);
      }
    },
    [plugin, useTopLookupSearch]
  );

  useEffect(() => {
    if (!open) return;
    setIsSaving(false);
    setSaveError("");
    setSameAsAddress(false);
    setOpenSections({
      company: true,
      companyAddress: true,
      basic: true,
      address: true,
      postal: true,
    });
    setSelectedLookupContact({
      id: "",
      email: "",
    });
    const resolvedInitialValues =
      initialValues && typeof initialValues === "object" ? initialValues : {};
    setSelectedPrimaryPersonContact({
      id: trimValue(
        resolvedInitialValues?.primary_person_contact_id ||
          resolvedInitialValues?.primary_contact_id ||
          resolvedInitialValues?.Primary_Contact_ID
      ),
      email: trimValue(resolvedInitialValues?.email || resolvedInitialValues?.Email),
    });
    setExistingContactRecord(null);
    setExistingCompanyRecord(null);
    setIsContactLookupLoading(false);
    setIsCompanyLookupLoading(false);
    setExistingPrimaryPersonRecord(null);
    setIsPrimaryPersonLookupLoading(false);
    existingLookupRef.current = {
      requestKey: "",
      matchedId: "",
    };
    companyLookupRef.current = {
      requestKey: "",
      matchedId: "",
    };
    primaryPersonLookupRef.current = {
      requestKey: "",
      matchedId: "",
    };
    setForm({
      ...INITIAL_FORM,
      country: "AU",
      postal_country: "AU",
      ...resolvedInitialValues,
    });
    setContactSearch(buildContactSearchValue(resolvedInitialValues));
    setCompanySearch(buildCompanySearchValue(resolvedInitialValues));
  }, [open, isEntity, initialValues]);

  useEffect(() => {
    if (!open || !enableInlineDuplicateLookup || isEntity || !plugin?.switchTo) return undefined;

    const normalizedEmail = trimValue(form.email).toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setIsContactLookupLoading(false);
      setExistingContactRecord(null);
      setSelectedLookupContact({
        id: "",
        email: "",
      });
      if (existingLookupRef.current.matchedId) {
        existingLookupRef.current.matchedId = "";
        setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
      }
      return undefined;
    }

    existingLookupRef.current.requestKey = normalizedEmail;
    setIsContactLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findContactByEmail({ plugin, email: normalizedEmail });
        if (existingLookupRef.current.requestKey !== normalizedEmail) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Contact_ID);
        if (!matchedId) {
          setExistingContactRecord(null);
          setSelectedLookupContact({
            id: "",
            email: "",
          });
          if (existingLookupRef.current.matchedId) {
            existingLookupRef.current.matchedId = "";
            setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
          }
          return;
        }
        existingLookupRef.current.matchedId = matchedId;
        setExistingContactRecord(matched);
        setSelectedLookupContact({
          id: matchedId,
          email: trimValue(matched?.email || matched?.Email),
        });
        setForm((previous) => {
          if (trimValue(previous.id) === matchedId) return previous;
          return mapContactRecordToForm(matched, previous);
        });
      } catch (lookupError) {
        if (existingLookupRef.current.requestKey !== normalizedEmail) return;
        console.error("[JobDirect] Contact duplicate lookup failed", lookupError);
      } finally {
        if (existingLookupRef.current.requestKey === normalizedEmail) {
          setIsContactLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enableInlineDuplicateLookup, open, isEntity, plugin, form.email]);

  useEffect(() => {
    if (useTopLookupSearch || !open || !enableInlineDuplicateLookup || !isEntity || !plugin?.switchTo) return undefined;

    const normalizedName = trimValue(form.company_name);
    if (!normalizedName) {
      setIsCompanyLookupLoading(false);
      setExistingCompanyRecord(null);
      if (companyLookupRef.current.matchedId) {
        companyLookupRef.current.matchedId = "";
        setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
      }
      return undefined;
    }

    companyLookupRef.current.requestKey = normalizedName.toLowerCase();
    setIsCompanyLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findCompanyByName({ plugin, name: normalizedName });
        if (companyLookupRef.current.requestKey !== normalizedName.toLowerCase()) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Company_ID);
        if (!matchedId) {
          setExistingCompanyRecord(null);
          if (companyLookupRef.current.matchedId) {
            companyLookupRef.current.matchedId = "";
            setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
          }
          return;
        }
        companyLookupRef.current.matchedId = matchedId;
        setExistingCompanyRecord(matched);
        setForm((previous) => {
          if (trimValue(previous.id) === matchedId) return previous;
          return mapCompanyRecordToForm(matched, previous);
        });
      } catch (lookupError) {
        if (companyLookupRef.current.requestKey !== normalizedName.toLowerCase()) return;
        console.error("[JobDirect] Company duplicate lookup failed", lookupError);
      } finally {
        if (companyLookupRef.current.requestKey === normalizedName.toLowerCase()) {
          setIsCompanyLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [useTopLookupSearch, open, enableInlineDuplicateLookup, isEntity, plugin, form.company_name]);

  useEffect(() => {
    if (!open || !enableInlineDuplicateLookup || !isEntity || !plugin?.switchTo) return undefined;

    const normalizedEmail = trimValue(form.email).toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setIsPrimaryPersonLookupLoading(false);
      setExistingPrimaryPersonRecord(null);
      setSelectedPrimaryPersonContact((previous) =>
        trimValue(previous.id) || trimValue(previous.email)
          ? { id: "", email: "" }
          : previous
      );
      primaryPersonLookupRef.current = {
        requestKey: "",
        matchedId: "",
      };
      return undefined;
    }

    primaryPersonLookupRef.current.requestKey = normalizedEmail;
    setIsPrimaryPersonLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findContactByEmail({ plugin, email: normalizedEmail });
        if (primaryPersonLookupRef.current.requestKey !== normalizedEmail) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Contact_ID);
        if (!matchedId) {
          setExistingPrimaryPersonRecord(null);
          setSelectedPrimaryPersonContact((previous) =>
            trimValue(previous.id) || trimValue(previous.email)
              ? { id: "", email: "" }
              : previous
          );
          primaryPersonLookupRef.current.matchedId = "";
          return;
        }
        primaryPersonLookupRef.current.matchedId = matchedId;
        setExistingPrimaryPersonRecord(matched);
        setSelectedPrimaryPersonContact({
          id: matchedId,
          email: trimValue(matched?.email || matched?.Email),
        });
        setForm((previous) => ({
          ...previous,
          first_name: trimValue(matched?.first_name || matched?.First_Name || previous.first_name),
          last_name: trimValue(matched?.last_name || matched?.Last_Name || previous.last_name),
          email: trimValue(matched?.email || matched?.Email || previous.email),
          sms_number: trimValue(
            matched?.sms_number ||
              matched?.SMS_Number ||
              matched?.office_phone ||
              matched?.Office_Phone ||
              previous.sms_number
          ),
        }));
      } catch (lookupError) {
        if (primaryPersonLookupRef.current.requestKey !== normalizedEmail) return;
        console.error("[JobDirect] Primary person email lookup failed", lookupError);
      } finally {
        if (primaryPersonLookupRef.current.requestKey === normalizedEmail) {
          setIsPrimaryPersonLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, enableInlineDuplicateLookup, isEntity, plugin, form.email]);

  const updateField =
    (field, { syncToPostal = false } = {}) =>
    (event) => {
      const nextValue = event.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: nextValue };
        if (
          useTopLookupSearch &&
          !isEntity &&
          field === "email" &&
          trimValue(selectedLookupContact.id) &&
          trimValue(prev.id) === trimValue(selectedLookupContact.id)
        ) {
          const previousSelectedEmail = trimValue(selectedLookupContact.email).toLowerCase();
          const currentEmail = trimValue(nextValue).toLowerCase();
          if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
            next.id = "";
          }
        }
        if (sameAsAddress && syncToPostal) {
          const postalField = ADDRESS_TO_POSTAL_FIELD[field];
          if (postalField) next[postalField] = nextValue;
        }
        return next;
      });
      if (
        useTopLookupSearch &&
        !isEntity &&
        field === "email" &&
        trimValue(selectedLookupContact.id)
      ) {
        const previousSelectedEmail = trimValue(selectedLookupContact.email).toLowerCase();
        const currentEmail = trimValue(nextValue).toLowerCase();
        if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
          setSelectedLookupContact({
            id: "",
            email: "",
          });
        }
      }
      if (
        isEntity &&
        field === "email" &&
        trimValue(selectedPrimaryPersonContact.id)
      ) {
        const previousSelectedEmail = trimValue(selectedPrimaryPersonContact.email).toLowerCase();
        const currentEmail = trimValue(nextValue).toLowerCase();
        if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
          setSelectedPrimaryPersonContact({
            id: "",
            email: "",
          });
          setExistingPrimaryPersonRecord(null);
        }
      }
    };

  const handleAddressLookupSelected = useCallback(
    (parsed) => {
      setForm((prev) => {
        let next = {
          ...prev,
          lot_number: parsed.lot_number || prev.lot_number,
          unit_number: parsed.unit_number || prev.unit_number,
          address: parsed.address || prev.address,
          city: parsed.city || prev.city,
          state: parsed.state || prev.state,
          zip_code: parsed.zip_code || prev.zip_code,
          country: "AU",
        };

        if (sameAsAddress) next = copyAddressIntoPostal(next);
        return next;
      });
    },
    [sameAsAddress]
  );

  const handleCompanyAddressLookupSelected = useCallback((parsed) => {
    setForm((prev) => ({
      ...prev,
      company_address: parsed.address || prev.company_address,
      company_city: parsed.city || prev.company_city,
      company_state: parsed.state || prev.company_state,
      company_postal_code: parsed.zip_code || prev.company_postal_code,
    }));
  }, []);

  const individualAddressLookupRef = useGoogleAddressLookup({
    enabled: open && !isEntity,
    country: "au",
    onAddressSelected: handleAddressLookupSelected,
  });

  const companyAddressLookupRef = useGoogleAddressLookup({
    enabled: open && isEntity,
    country: "au",
    onAddressSelected: handleCompanyAddressLookupSelected,
  });

  const handleSameAsAddressChange = (event) => {
    const checked = event.target.checked;
    setSameAsAddress(checked);
    if (!checked) return;
    setForm((prev) => copyAddressIntoPostal(prev));
  };

  const saveLookupSelection = useCallback(
    async (payload, context) => {
      if (isSaving || typeof onSave !== "function") return;
      setIsSaving(true);
      setSaveError("");
      try {
        await onSave(payload, context);
        onClose?.();
      } catch (error) {
        const message = error?.message || "Unable to link selected record right now.";
        setSaveError(message);
        showErrorToast("Save failed", message);
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, onClose, onSave, showErrorToast]
  );

  const handleContactLookupSelect = useCallback(
    async (item) => {
      const contactId = trimValue(item?.id);
      if (!contactId) return;
      setContactSearch(trimValue(item?.label));
      if (saveOnLookupSelect && typeof onSave === "function") {
        void saveLookupSelection(
          {
            id: contactId,
            first_name: trimValue(item?.first_name),
            last_name: trimValue(item?.last_name),
            email: trimValue(item?.email),
            sms_number: trimValue(item?.sms_number),
          },
          { mode: "individual" }
        );
        return;
      }
      const resolvedEmail = trimValue(item?.email);
      setSelectedLookupContact({
        id: contactId,
        email: resolvedEmail,
      });
      if (!plugin?.switchTo) {
        setForm((previous) => ({
          ...previous,
          id: contactId,
          first_name: trimValue(item?.first_name) || previous.first_name,
          last_name: trimValue(item?.last_name) || previous.last_name,
          email: resolvedEmail || previous.email,
          sms_number: trimValue(item?.sms_number) || previous.sms_number,
        }));
        return;
      }
      setIsLookupSearching(true);
      try {
        const detailedRecord = await fetchContactById({ plugin, contactId });
        const resolvedRecord = detailedRecord || item || {};
        setSelectedLookupContact({
          id: contactId,
          email: trimValue(resolvedRecord?.email || resolvedRecord?.Email),
        });
        setForm((previous) =>
          mapContactRecordToForm(resolvedRecord, previous)
        );
      } catch (lookupError) {
        console.error("[JobDirect] Contact detail prefill failed", lookupError);
        setForm((previous) => ({
          ...previous,
          id: contactId,
          first_name: trimValue(item?.first_name) || previous.first_name,
          last_name: trimValue(item?.last_name) || previous.last_name,
          email: resolvedEmail || previous.email,
          sms_number: trimValue(item?.sms_number) || previous.sms_number,
        }));
      } finally {
        setIsLookupSearching(false);
      }
    },
    [onSave, plugin, saveLookupSelection, saveOnLookupSelect]
  );

  const handleCompanyLookupSelect = useCallback(
    async (item) => {
      const companyId = trimValue(item?.id);
      if (!companyId) return;
      setCompanySearch(trimValue(item?.label));
      setSelectedLookupContact({
        id: "",
        email: "",
      });
      if (saveOnLookupSelect && typeof onSave === "function") {
        void saveLookupSelection(
          {
            id: companyId,
            name: trimValue(item?.name) || trimValue(item?.label),
          },
          { mode: "entity" }
        );
        return;
      }
      if (!plugin?.switchTo) {
        setForm((previous) => ({
          ...previous,
          id: companyId,
          company_name: trimValue(item?.name) || trimValue(item?.label) || previous.company_name,
          company_account_type: trimValue(item?.account_type) || previous.company_account_type,
        }));
        return;
      }
      setIsLookupSearching(true);
      try {
        const detailedRecord = await fetchCompanyById({ plugin, companyId });
        setForm((previous) => {
          const next = mapCompanyRecordToForm(detailedRecord || item || {}, previous);
          return {
            ...next,
            first_name: previous.first_name,
            last_name: previous.last_name,
            email: previous.email,
            sms_number: previous.sms_number,
          };
        });
      } catch (lookupError) {
        console.error("[JobDirect] Company detail prefill failed", lookupError);
        setForm((previous) => ({
          ...previous,
          id: companyId,
          company_name: trimValue(item?.name) || trimValue(item?.label) || previous.company_name,
          company_account_type: trimValue(item?.account_type) || previous.company_account_type,
        }));
      } finally {
        setIsLookupSearching(false);
      }
    },
    [onSave, plugin, saveLookupSelection, saveOnLookupSelect]
  );

  const handleSave = async () => {
    if (isSaving) return;

    if (typeof onSave !== "function") {
      onClose?.();
      return;
    }

    const contactPayload = {
      id: trimValue(form.id),
      first_name: trimValue(form.first_name),
      last_name: trimValue(form.last_name),
      email: trimValue(form.email),
      sms_number: trimValue(form.sms_number),

      lot_number: trimValue(form.lot_number),
      unit_number: trimValue(form.unit_number),
      address: trimValue(form.address),
      city: trimValue(form.city),
      state: trimValue(form.state),
      zip_code: trimValue(form.zip_code),
      country: trimValue(form.country),

      postal_address: trimValue(form.postal_address),
      postal_city: trimValue(form.postal_city),
      postal_state: trimValue(form.postal_state),
      postal_country: trimValue(form.postal_country),
      postal_code: trimValue(form.postal_code),
    };

    if (isEntity) {
      const companyName = trimValue(form.company_name);
      if (!companyName) {
        const message = "Company name is required.";
        setSaveError(message);
        showErrorToast("Save failed", message);
        return;
      }

      const primaryPersonPayload = compactStringFields({
        id: trimValue(
          selectedPrimaryPersonContact?.id ||
            form.primary_person_contact_id
        ),
        first_name: trimValue(form.first_name),
        last_name: trimValue(form.last_name),
        email: trimValue(form.email),
        sms_number: trimValue(form.sms_number),
      });
      const entityPayload = {
        id: trimValue(form.id),
        type: trimValue(form.company_type),
        name: companyName,
        description: trimValue(form.company_description),
        phone: trimValue(form.company_phone),
        address: trimValue(form.company_address),
        city: trimValue(form.company_city),
        state: trimValue(form.company_state),
        postal_code: trimValue(form.company_postal_code),
        industry: trimValue(form.company_industry),
        annual_revenue: trimValue(form.company_annual_revenue),
        number_of_employees: trimValue(form.company_number_of_employees),
        account_type: trimValue(form.company_account_type),
        popup_comment: trimValue(form.popup_comment),
        ...(Object.keys(primaryPersonPayload).length
          ? { Primary_Person: primaryPersonPayload }
          : {}),
      };

      setIsSaving(true);
      setSaveError("");
      try {
        await onSave(entityPayload, { mode: "entity" });
        onClose?.();
      } catch (error) {
        console.error("[JobDirect] Entity save failed", error);
        const message = error?.message || "Unable to save entity right now.";
        setSaveError(message);
        showErrorToast("Save failed", message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(contactPayload, { mode: "individual" });
      onClose?.();
    } catch (error) {
      console.error("[JobDirect] Contact save failed", error);
      const message = error?.message || "Unable to save contact right now.";
      setSaveError(message);
      showErrorToast("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  const resolvedTitleVerb = trimValue(titleVerb) || "Add";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEntity ? `${resolvedTitleVerb} Entity` : `${resolvedTitleVerb} Contact`}
      widthClass="max-w-5xl max-h-[calc(100vh-4rem)] my-8 overflow-hidden"
      zIndexClass="z-[80]"
      footer={
        <div className="flex justify-end gap-2">
          {saveError ? (
            <div className="mr-auto self-center text-xs text-[color:var(--color-danger)]">
              {saveError}
            </div>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEntity ? "Save Entity" : "Save Contact"}
          </Button>
        </div>
      }
    >
      <div className="max-h-[calc(100vh-20rem)] space-y-4 overflow-y-auto pr-1">
        {allowModeSwitch && typeof onModeChange === "function" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-xl border px-2 py-1 text-xs ${
                !isEntity
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
              onClick={() => {
                setSaveError("");
                onModeChange?.("individual");
              }}
              disabled={isSaving}
            >
              Individual
            </button>
            <button
              type="button"
              className={`rounded-xl border px-2 py-1 text-xs ${
                isEntity
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
              onClick={() => {
                setSaveError("");
                onModeChange?.("entity");
              }}
              disabled={isSaving}
            >
              Entity
            </button>
          </div>
        ) : null}
        {useTopLookupSearch ? (
          isEntity ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <SearchDropdownInput
                label="Search Existing Entity"
                field="existing_entity_lookup"
                value={companySearch}
                placeholder="Search company"
                items={companyItems}
                onValueChange={setCompanySearch}
                onSearchQueryChange={searchCompanies}
                onSelect={handleCompanyLookupSelect}
                hideAddAction
                emptyText={
                  isLookupSearching
                    ? "Searching entities..."
                    : isLookupLoading
                    ? "Loading entities..."
                    : "No entities found."
                }
                rootData={{ "data-search-root": "contact-details-entity" }}
              />
              <div className="mt-1 text-xs text-slate-500">
                {saveOnLookupSelect
                  ? "Select an existing entity to link it immediately."
                  : "Search and select an existing entity, or fill the form below."}
              </div>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <SearchDropdownInput
                label="Search Existing Contact"
                field="existing_contact_lookup"
                value={contactSearch}
                placeholder="Search contact"
                items={contactItems}
                onValueChange={setContactSearch}
                onSearchQueryChange={searchContacts}
                onSelect={handleContactLookupSelect}
                hideAddAction
                emptyText={
                  isLookupSearching
                    ? "Searching contacts..."
                    : isLookupLoading
                    ? "Loading contacts..."
                    : "No contacts found."
                }
                rootData={{ "data-search-root": "contact-details-individual" }}
              />
              <div className="mt-1 text-xs text-slate-500">
                {saveOnLookupSelect
                  ? "Select an existing contact to link it immediately."
                  : "Search and select an existing contact, or fill the form below."}
              </div>
            </div>
          )
        ) : null}
        {isEntity ? (
          <AccordionSection
            title="Company Details"
            isOpen={openSections.company}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                company: !prev.company,
              }))
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <InputField
                  label="Name"
                  value={form.company_name}
                  onChange={updateField("company_name")}
                  data-contact-field="company_name"
                />
                {!useTopLookupSearch ? (
                  <div
                    className={`mt-1 text-xs ${
                      trimValue(existingCompanyRecord?.id || existingCompanyRecord?.ID)
                        ? "text-amber-700"
                        : "text-slate-500"
                    }`}
                  >
                    {isCompanyLookupLoading
                      ? "Searching company..."
                      : trimValue(existingCompanyRecord?.id || existingCompanyRecord?.ID)
                      ? "Company already exists. Form is prefilled with existing details."
                      : "Type company name to search existing company or add a new one."}
                  </div>
                ) : null}
              </div>
              <SelectField
                label="Type"
                options={COMPANY_TYPE_OPTIONS}
                value={form.company_type}
                onChange={updateField("company_type")}
                data-contact-field="company_type"
              />
              <SelectField
                label="Account Type"
                options={COMPANY_ACCOUNT_TYPE_OPTIONS}
                value={form.company_account_type}
                onChange={updateField("company_account_type")}
                data-contact-field="company_account_type"
              />
              <SelectField
                label="Industry"
                options={COMPANY_INDUSTRY_OPTIONS}
                value={form.company_industry}
                onChange={updateField("company_industry")}
                data-contact-field="company_industry"
              />
              <InputField
                label="Phone"
                value={form.company_phone}
                onChange={updateField("company_phone")}
                data-contact-field="company_phone"
              />
              <SelectField
                label="Annual Revenue"
                options={COMPANY_ANNUAL_REVENUE_OPTIONS}
                value={form.company_annual_revenue}
                onChange={updateField("company_annual_revenue")}
                data-contact-field="company_annual_revenue"
              />
              <SelectField
                label="Number of Employees"
                options={COMPANY_EMPLOYEE_COUNT_OPTIONS}
                value={form.company_number_of_employees}
                onChange={updateField("company_number_of_employees")}
                data-contact-field="company_number_of_employees"
              />
              <InputField
                label="Description"
                value={form.company_description}
                onChange={updateField("company_description")}
                data-contact-field="company_description"
              />
              <InputField
                label="Popup Comment"
                value={form.popup_comment}
                onChange={updateField("popup_comment")}
                className="md:col-span-2"
                data-contact-field="popup_comment"
              />
            </div>
          </AccordionSection>
        ) : null}

        {isEntity ? (
          <AccordionSection
            title="Company Address"
            isOpen={openSections.companyAddress}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                companyAddress: !prev.companyAddress,
              }))
            }
          >
            <InputField
              label="Address Lookup"
              placeholder="Search address"
              inputRef={companyAddressLookupRef}
              data-contact-field="company_address_lookup"
            />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField
                label="Address"
                value={form.company_address}
                onChange={updateField("company_address")}
                className="md:col-span-2"
                data-contact-field="company_address"
              />
              <InputField
                label="City"
                value={form.company_city}
                onChange={updateField("company_city")}
                data-contact-field="company_city"
              />
              <SelectField
                label="State"
                options={STATE_OPTIONS}
                value={form.company_state}
                onChange={updateField("company_state")}
                data-contact-field="company_state"
              />
              <InputField
                label="Postal Code"
                value={form.company_postal_code}
                onChange={updateField("company_postal_code")}
                data-contact-field="company_postal_code"
              />
            </div>
          </AccordionSection>
        ) : null}

        <AccordionSection
          title={isEntity ? "Primary Person" : "Basic Information"}
          isOpen={openSections.basic}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              basic: !prev.basic,
            }))
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              label="First Name"
              value={form.first_name}
              onChange={updateField("first_name")}
              data-contact-field="first_name"
            />
            <InputField
              label="Last Name"
              value={form.last_name}
              onChange={updateField("last_name")}
              data-contact-field="last_name"
            />
            <div>
              <InputField
                label="Email"
                value={form.email}
                onChange={updateField("email")}
                data-contact-field="email"
              />
              {!isEntity && enableInlineDuplicateLookup ? (
                <div
                  className={`mt-1 text-xs ${
                    trimValue(
                      existingContactRecord?.id ||
                        existingContactRecord?.ID ||
                        existingContactRecord?.Contact_ID
                    )
                      ? "text-amber-700"
                      : "text-slate-500"
                  }`}
                >
                  {isContactLookupLoading
                    ? "Searching contact..."
                    : trimValue(
                    existingContactRecord?.id ||
                      existingContactRecord?.ID ||
                      existingContactRecord?.Contact_ID
                  )
                    ? "Email already exists."
                    : "Type email to search existing contact or add a new one."}
                </div>
              ) : null}
              {isEntity && enableInlineDuplicateLookup ? (
                <div
                  className={`mt-1 text-xs ${
                    trimValue(
                      existingPrimaryPersonRecord?.id ||
                        existingPrimaryPersonRecord?.ID ||
                        existingPrimaryPersonRecord?.Contact_ID
                    )
                      ? "text-amber-700"
                      : "text-slate-500"
                  }`}
                >
                  {isPrimaryPersonLookupLoading
                    ? "Searching contact..."
                    : trimValue(
                    existingPrimaryPersonRecord?.id ||
                      existingPrimaryPersonRecord?.ID ||
                      existingPrimaryPersonRecord?.Contact_ID
                  )
                    ? "Email already exists."
                    : "Primary person email for this entity."}
                </div>
              ) : null}
            </div>
            <div>
              <InputField
                label="SMS Number"
                value={form.sms_number}
                onChange={updateField("sms_number")}
                data-contact-field="sms_number"
              />
            </div>
          </div>
        </AccordionSection>

        {!isEntity ? (
          <AccordionSection
            title="Address"
            isOpen={openSections.address}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                address: !prev.address,
              }))
            }
          >
            <InputField
              label="Address Lookup"
              placeholder="Search address"
              inputRef={individualAddressLookupRef}
              data-contact-field="address_lookup"
            />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField
                label="Lot Number"
                value={form.lot_number}
                onChange={updateField("lot_number")}
                data-contact-field="lot_number"
              />
              <InputField
                label="Unit Number"
                value={form.unit_number}
                onChange={updateField("unit_number")}
                data-contact-field="unit_number"
              />
              <InputField
                label="Address"
                value={form.address}
                onChange={updateField("address", { syncToPostal: true })}
                data-contact-field="address"
              />
              <InputField
                label="City"
                value={form.city}
                onChange={updateField("city", { syncToPostal: true })}
                data-contact-field="city"
              />
              <SelectField
                label="State"
                options={STATE_OPTIONS}
                value={form.state}
                onChange={updateField("state", { syncToPostal: true })}
                data-contact-field="state"
              />
              <InputField
                label="Postcode"
                value={form.zip_code}
                onChange={updateField("zip_code", { syncToPostal: true })}
                data-contact-field="zip_code"
              />
              <SelectField
                label="Country"
                options={COUNTRY_OPTIONS}
                value={form.country}
                onChange={updateField("country", { syncToPostal: true })}
                data-contact-field="country"
              />
            </div>
          </AccordionSection>
        ) : null}

        {!isEntity ? (
          <AccordionSection
            title="Postal Address"
            isOpen={openSections.postal}
            onToggle={() =>
              setOpenSections((prev) => ({
                ...prev,
                postal: !prev.postal,
              }))
            }
          >
            <CheckboxField
              label="Same as address"
              checked={sameAsAddress}
              onChange={handleSameAsAddressChange}
              data-contact-field="postal_same_as_address"
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InputField
                label="Postal Address"
                value={form.postal_address}
                onChange={updateField("postal_address")}
                disabled={sameAsAddress}
                data-contact-field="postal_address"
              />
              <InputField
                label="Postal City"
                value={form.postal_city}
                onChange={updateField("postal_city")}
                disabled={sameAsAddress}
                data-contact-field="postal_city"
              />
              <SelectField
                label="Postal State"
                options={STATE_OPTIONS}
                value={form.postal_state}
                onChange={updateField("postal_state")}
                disabled={sameAsAddress}
                data-contact-field="postal_state"
              />
              <InputField
                label="Postal Postcode"
                value={form.postal_code}
                onChange={updateField("postal_code")}
                disabled={sameAsAddress}
                data-contact-field="postal_code"
              />
              <SelectField
                label="Postal Country"
                options={COUNTRY_OPTIONS}
                value={form.postal_country}
                onChange={updateField("postal_country")}
                disabled={sameAsAddress}
                data-contact-field="postal_country"
              />
            </div>
          </AccordionSection>
        ) : null}
      </div>
    </Modal>
  );
}
