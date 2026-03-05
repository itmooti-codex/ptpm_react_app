import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { TasksModal } from "../../../modules/job-workspace/components/modals/TasksModal.jsx";
import { ContactDetailsModal } from "../../../modules/job-workspace/components/modals/ContactDetailsModal.jsx";
import { JobDirectStoreProvider } from "../../../modules/job-workspace/hooks/useJobDirectStore.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { APP_USER } from "../../../config/userConfig.js";
import {
  ensureGooglePlacesLoaded,
  parseGoogleAddressComponents,
} from "../../../shared/lib/googlePlaces.js";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import { resolveStatusStyle } from "../../../shared/constants/statusStyles.js";
import {
  createLinkedJobForInquiry,
  createMemoCommentForDetails,
  createMemoPostForDetails,
  deleteMemoCommentForDetails,
  deleteMemoPostForDetails,
  fetchMemosForDetails,
  resolveJobDetailsContext,
  subscribeMemosForDetails,
  updateContactFieldsById,
  updateCompanyFieldsById,
  updateInquiryFieldsById,
} from "../../../modules/job-records/public/sdk.js";
import {
  createCompanyRecord,
  createContactRecord,
  createPropertyRecord,
  fetchPropertyRecordById,
  fetchPropertiesForSearch,
  fetchLinkedPropertiesByAccount,
  fetchServicesForActivities,
  fetchServiceProvidersForSearch,
  searchPropertiesForLookup,
  uploadMaterialFile,
  updateContactRecord,
  updatePropertyRecord,
} from "../../../modules/job-workspace/sdk/core/runtime.js";
import {
  AddPropertyModal,
  AppointmentTabSection,
  ColorMappedSelectInput,
  EditActionIcon as EditIcon,
  TrashActionIcon as TrashIcon,
  normalizePropertyId,
  PropertyTabSection,
  SearchDropdownInput,
  SelectInput,
  TitleBackIcon,
  UploadsSection,
} from "@modules/job-workspace/public/components.js";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  fullName,
  getAuthorName,
  getMemoFileMeta,
  isBodyCorpCompanyAccountType,
  isCompanyAccountType,
  isContactAccountType,
  isLikelyEmailValue,
  isLikelyPhoneValue,
  mergeMemosPreservingComments,
  toTelHref,
  toText,
} from "../../job-details/pages/jobDetailsPageHelpers.js";
import {
  parseListSelectionValue,
  serializeListSelectionValue,
} from "../../inquiry-direct/components/sections/inquiryInformationHelpers.js";
import {
  getInquiryFlowRule,
  shouldShowOtherSourceField,
} from "../../inquiry-direct/constants/inquiryFlowRules.js";
import { useRelatedRecordsData } from "../../inquiry-direct/hooks/useRelatedRecordsData.js";
import { isPestServiceFlow } from "../../inquiry-direct/utils/pestRules.js";
import {
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../../inquiry-direct/components/sections/inquiryInformationConstants.js";

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 15V6C5 4.89543 5.89543 4 7 4H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SmallCloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

async function resolveAddressFromGoogleLookup(addressText) {
  const query = toText(addressText);
  if (!query) return null;

  try {
    await ensureGooglePlacesLoaded();
    if (!window.google?.maps?.Geocoder) return null;

    const geocoder = new window.google.maps.Geocoder();
    const results = await new Promise((resolve, reject) => {
      geocoder.geocode(
        {
          address: query,
          componentRestrictions: { country: "AU" },
        },
        (response, status) => {
          if (
            status === "OK" &&
            Array.isArray(response) &&
            response.length
          ) {
            resolve(response);
            return;
          }
          reject(new Error(`Google geocode failed with status: ${status || "UNKNOWN"}`));
        }
      );
    });

    const firstResult = Array.isArray(results) ? results[0] : null;
    if (!firstResult) return null;
    return parseGoogleAddressComponents(firstResult);
  } catch (error) {
    console.warn("[InquiryDetails] Google address resolution failed", error);
    return null;
  }
}

function joinAddress(parts = []) {
  const cleaned = (Array.isArray(parts) ? parts : [])
    .map((value) => toText(value))
    .filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "";
}

function toMailHref(value) {
  const text = toText(value);
  return text ? `mailto:${text}` : "";
}

function toGoogleMapsHref(value) {
  const text = toText(value);
  if (!text || text === "—") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

function toDateInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (!Number.isFinite(num)) return "";
    const seconds = num > 4102444800 ? Math.floor(num / 1000) : num;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUnixSeconds(dateInput) {
  const value = toText(dateInput);
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function toNullableText(value) {
  const text = toText(value);
  return text || null;
}

function formatServiceProviderAllocationLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

function formatServiceProviderInputLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

function formatContactLookupLabel(contact = {}) {
  const id = toText(contact?.id || contact?.ID);
  const name = fullName(contact?.first_name, contact?.last_name);
  const email = toText(contact?.email || contact?.Email);
  const phone = toText(contact?.sms_number || contact?.SMS_Number);
  const resolvedName = name || email || (id ? `Contact #${id}` : "Contact");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

function compactStringFields(source = {}) {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const trimmed = toText(value);
    if (trimmed) output[key] = trimmed;
  });
  return output;
}

function normalizePropertyLookupRecord(record = {}) {
  const id = normalizePropertyId(record?.id || record?.ID || record?.Property_ID);
  const uniqueId = toText(record?.unique_id || record?.Unique_ID || record?.Property_Unique_ID);
  const propertyName = toText(
    record?.property_name || record?.Property_Name || record?.Property_Property_Name
  );
  const address1 = toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address);
  const address2 = toText(record?.address_2 || record?.Address_2);
  const suburbTown = toText(
    record?.suburb_town || record?.Suburb_Town || record?.city || record?.City
  );
  const state = toText(record?.state || record?.State);
  const postalCode = toText(
    record?.postal_code || record?.Postal_Code || record?.zip_code || record?.Zip_Code
  );
  const country = toText(record?.country || record?.Country);
  const propertyType = toText(record?.property_type || record?.Property_Type);
  const buildingType = toText(record?.building_type || record?.Building_Type);
  const buildingTypeOther = toText(record?.building_type_other || record?.Building_Type_Other);
  const foundationType = toText(record?.foundation_type || record?.Foundation_Type);
  const bedrooms = toText(record?.bedrooms || record?.Bedrooms);
  const stories = toText(record?.stories || record?.Stories);
  const buildingAge = toText(record?.building_age || record?.Building_Age);
  const buildingFeaturesValue =
    record?.building_features ||
    record?.Building_Features ||
    record?.building_features_options_as_text ||
    record?.Building_Features_Options_As_Text ||
    "";
  const manholeValue = record?.manhole ?? record?.Manhole;
  const manhole =
    manholeValue === true || String(manholeValue || "").trim().toLowerCase() === "true";

  return {
    ...record,
    id,
    unique_id: uniqueId,
    property_name: propertyName || address1 || uniqueId,
    lot_number: toText(record?.lot_number || record?.Lot_Number),
    unit_number: toText(record?.unit_number || record?.Unit_Number),
    address_1: address1,
    address_2: address2,
    address: address1 || address2,
    suburb_town: suburbTown,
    city: suburbTown,
    state,
    postal_code: postalCode,
    country,
    property_type: propertyType,
    building_type: buildingType,
    building_type_other: buildingTypeOther,
    foundation_type: foundationType,
    bedrooms,
    manhole,
    stories,
    building_age: buildingAge,
    building_features: buildingFeaturesValue,
  };
}

function getPropertyLookupKey(record = {}) {
  const id = normalizePropertyId(record?.id || record?.ID || record?.Property_ID);
  if (id) return `property-id:${id}`;
  return [
    "property",
    toText(record?.unique_id || record?.Unique_ID),
    toText(record?.property_name || record?.Property_Name),
    toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address),
    toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City),
  ].join("|");
}

function dedupePropertyLookupRecords(records = []) {
  const hasMeaningfulValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };
  const mergePreferMeaningfulValues = (base = {}, incoming = {}) => {
    const merged = { ...base };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (!(key in merged) || hasMeaningfulValue(value)) {
        merged[key] = value;
      }
    });
    return merged;
  };
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const normalized = normalizePropertyLookupRecord(record);
    const key = getPropertyLookupKey(normalized);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, normalized);
      return;
    }
    map.set(key, mergePreferMeaningfulValues(map.get(key), normalized));
  });
  return Array.from(map.values());
}

function mergePropertyLookupRecords(...collections) {
  return dedupePropertyLookupRecords(collections.flatMap((collection) => collection || []));
}

function getPropertyRecordSignature(record = {}) {
  return [
    normalizePropertyId(record?.id || record?.ID || record?.Property_ID),
    toText(record?.unique_id || record?.Unique_ID),
    toText(record?.property_name || record?.Property_Name),
    toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address),
    toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City),
    toText(record?.state || record?.State),
    toText(record?.postal_code || record?.Postal_Code || record?.zip_code || record?.Zip_Code),
    toText(record?.country || record?.Country),
    toText(record?.property_type || record?.Property_Type),
    toText(record?.building_type || record?.Building_Type),
    toText(record?.building_type_other || record?.Building_Type_Other),
    toText(record?.foundation_type || record?.Foundation_Type),
    toText(record?.bedrooms || record?.Bedrooms),
    toText(record?.stories || record?.Stories),
    toText(record?.building_age || record?.Building_Age),
    toText(record?.building_features_options_as_text || record?.building_features),
    String(Boolean(record?.manhole ?? record?.Manhole)),
  ].join("::");
}

function arePropertyRecordCollectionsEqual(left = [], right = []) {
  const leftList = dedupePropertyLookupRecords(left || []);
  const rightList = dedupePropertyLookupRecords(right || []);
  if (leftList.length !== rightList.length) return false;

  const rightMap = new Map(
    rightList.map((record) => [getPropertyLookupKey(record), getPropertyRecordSignature(record)])
  );
  for (const record of leftList) {
    const key = getPropertyLookupKey(record);
    const signature = getPropertyRecordSignature(record);
    if (!rightMap.has(key)) return false;
    if (rightMap.get(key) !== signature) return false;
  }
  return true;
}

function mergePropertyCollectionsIfChanged(previous = [], ...collections) {
  const merged = mergePropertyLookupRecords(previous, ...collections);
  if (arePropertyRecordCollectionsEqual(previous, merged)) {
    return previous;
  }
  return merged;
}

function resolvePropertyLookupLabel(record = {}) {
  return toText(
    record?.property_name ||
      record?.Property_Name ||
      record?.address_1 ||
      record?.Address_1 ||
      record?.address ||
      record?.Address ||
      record?.unique_id ||
      record?.Unique_ID
  );
}

function normalizeAddressText(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

function buildComparablePropertyAddress(record = {}) {
  const street = toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address);
  const suburb = toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City);
  const state = toText(record?.state || record?.State);
  const postal = toText(record?.postal_code || record?.Postal_Code || record?.zip_code || record?.Zip_Code);
  return normalizeAddressText([street, suburb, state, postal].filter(Boolean).join(" "));
}

function buildListSelectionTagItems(value, options = []) {
  const raw = toText(value);
  if (!raw) return [];
  const selectedCodes = parseListSelectionValue(raw, options);
  if (!selectedCodes.length) {
    return [
      {
        key: raw,
        code: "",
        label: raw,
      },
    ];
  }
  const optionLabelByCode = new Map(
    (Array.isArray(options) ? options : []).map((item) => [
      toText(item?.code || item?.value),
      toText(item?.label || item?.value || item?.code),
    ])
  );
  return selectedCodes
    .map((code) => {
      const normalizedCode = toText(code);
      if (!normalizedCode) return null;
      return {
        key: normalizedCode,
        code: normalizedCode,
        label: optionLabelByCode.get(normalizedCode) || normalizedCode,
      };
    })
    .filter(Boolean);
}

function normalizeRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function normalizeServiceProviderContact(provider = {}) {
  const contactInfoRaw = provider?.Contact_Information || provider?.contact_information || {};
  const contactInfo = normalizeRelationRecord(contactInfoRaw);
  return {
    first_name: toText(
      provider?.first_name ||
        provider?.First_Name ||
        provider?.contact_information_first_name ||
        provider?.Contact_Information_First_Name ||
        contactInfo?.first_name ||
        contactInfo?.First_Name
    ),
    last_name: toText(
      provider?.last_name ||
        provider?.Last_Name ||
        provider?.contact_information_last_name ||
        provider?.Contact_Information_Last_Name ||
        contactInfo?.last_name ||
        contactInfo?.Last_Name
    ),
    email: toText(
      provider?.work_email ||
        provider?.Work_Email ||
        provider?.email ||
        provider?.Email
    ),
    sms_number: toText(
      provider?.mobile_number ||
        provider?.Mobile_Number ||
        provider?.sms_number ||
        provider?.SMS_Number
    ),
  };
}

function getInquiryPrimaryContact(inquiry = {}) {
  const nested = inquiry?.Primary_Contact || inquiry?.primary_contact || {};
  return {
    id: toText(
      nested?.id || nested?.ID || inquiry?.Primary_Contact_Contact_ID || inquiry?.Contact_Contact_ID
    ),
    first_name: toText(
      nested?.first_name ||
        nested?.First_Name ||
        inquiry?.Primary_Contact_First_Name ||
        inquiry?.Contact_First_Name
    ),
    last_name: toText(
      nested?.last_name ||
        nested?.Last_Name ||
        inquiry?.Primary_Contact_Last_Name ||
        inquiry?.Contact_Last_Name
    ),
    email: toText(
      nested?.email || nested?.Email || inquiry?.Primary_Contact_Email || inquiry?.ContactEmail
    ),
    sms_number: toText(
      nested?.sms_number || nested?.SMS_Number || inquiry?.Primary_Contact_SMS_Number
    ),
    address: toText(nested?.address || nested?.Address || inquiry?.Primary_Contact_Address),
    city: toText(nested?.city || nested?.City || inquiry?.Primary_Contact_City),
    state: toText(nested?.state || nested?.State || inquiry?.Primary_Contact_State),
    zip_code: toText(nested?.zip_code || nested?.Zip_Code || inquiry?.Primary_Contact_Zip_Code),
    popup_comment: toText(
      nested?.popup_comment ||
        nested?.Popup_Comment ||
        inquiry?.Primary_Contact_Popup_Comment
    ),
  };
}

function getInquiryCompany(inquiry = {}) {
  const nested = inquiry?.Company || inquiry?.company || {};
  const nestedPrimaryPerson = nested?.Primary_Person || nested?.primary_person || {};
  const companyScopedPrimaryContact = {
    id: toText(inquiry?.Contact_Contact_ID || inquiry?.ContactID || inquiry?.Contact_ID),
    first_name: toText(inquiry?.Contact_First_Name || inquiry?.ContactFirstName),
    last_name: toText(inquiry?.Contact_Last_Name || inquiry?.ContactLastName),
    email: toText(inquiry?.ContactEmail || inquiry?.Contact_Email),
    sms_number: toText(inquiry?.Contact_SMS_Number || inquiry?.ContactSMSNumber),
  };
  return {
    id: toText(nested?.id || nested?.ID || inquiry?.CompanyID),
    name: toText(nested?.name || nested?.Name || inquiry?.CompanyName),
    type: toText(nested?.type || nested?.Type || inquiry?.CompanyType),
    description: toText(nested?.description || nested?.Description || inquiry?.CompanyDescription),
    phone: toText(nested?.phone || nested?.Phone || inquiry?.CompanyPhone),
    address: toText(nested?.address || nested?.Address || inquiry?.CompanyAddress),
    city: toText(nested?.city || nested?.City || inquiry?.CompanyCity),
    state: toText(nested?.state || nested?.State || inquiry?.CompanyState),
    postal_code: toText(nested?.postal_code || nested?.Postal_Code || inquiry?.Company_Postal_Code),
    industry: toText(nested?.industry || nested?.Industry || inquiry?.CompanyIndustry),
    annual_revenue: toText(
      nested?.annual_revenue || nested?.Annual_Revenue || inquiry?.Company_Annual_Revenue
    ),
    number_of_employees: toText(
      nested?.number_of_employees ||
        nested?.Number_of_Employees ||
        inquiry?.Company_Number_Of_Employees
    ),
    account_type: toText(nested?.account_type || nested?.Account_Type || inquiry?.Company_Account_Type),
    popup_comment: toText(
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Company_Popup_Comment
    ),
    Primary_Person: {
      id: toText(
        nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || companyScopedPrimaryContact.id
      ),
      first_name: toText(
        nestedPrimaryPerson?.first_name ||
          nestedPrimaryPerson?.First_Name ||
          companyScopedPrimaryContact.first_name
      ),
      last_name: toText(
        nestedPrimaryPerson?.last_name ||
          nestedPrimaryPerson?.Last_Name ||
          companyScopedPrimaryContact.last_name
      ),
      email: toText(
        nestedPrimaryPerson?.email ||
          nestedPrimaryPerson?.Email ||
          companyScopedPrimaryContact.email
      ),
      sms_number: toText(
        nestedPrimaryPerson?.sms_number ||
          nestedPrimaryPerson?.SMS_Number ||
          companyScopedPrimaryContact.sms_number
      ),
    },
    Body_Corporate_Company: nested?.Body_Corporate_Company || nested?.body_corporate_company || {
      id: toText(inquiry?.CompanyID1),
      name: toText(inquiry?.CompanyName1),
      type: toText(inquiry?.CompanyType1),
      description: toText(inquiry?.CompanyDescription1),
      phone: toText(inquiry?.CompanyPhone1),
      address: toText(inquiry?.CompanyAddress1),
      city: toText(inquiry?.CompanyCity1),
      state: toText(inquiry?.CompanyState1),
      postal_code: toText(inquiry?.Company_Postal_Code1),
      industry: toText(inquiry?.CompanyIndustry1),
      annual_revenue: toText(inquiry?.Company_Annual_Revenue1),
      number_of_employees: toText(inquiry?.Company_Number_Of_Employees1),
    },
  };
}

function DetailsCard({ title, onEdit, editDisabled = false, className = "", children }) {
  const showEditAction = typeof onEdit === "function";
  return (
    <article className={`rounded border border-slate-200 bg-white ${className}`}>
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        {showEditAction ? (
          <button
            type="button"
            className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            onClick={onEdit}
            disabled={editDisabled}
            aria-label={`Edit ${title}`}
            title={`Edit ${title}`}
          >
            <EditIcon />
          </button>
        ) : null}
      </header>
      <div className="p-2.5">{children}</div>
    </article>
  );
}

function isMissingFieldValue(value) {
  const text = toText(value);
  return !text || text === "—" || text === "-";
}

function CardField({
  label,
  value,
  mono = false,
  className = "",
  href = "",
  openInNewTab = false,
  copyable = false,
  copyValue = "",
  onCopy = null,
}) {
  const displayValue = toText(value);
  if (isMissingFieldValue(displayValue)) return null;
  const canLink = Boolean(toText(href));
  const copyText = toText(copyValue || value);
  const canCopy = Boolean(copyable && copyText);
  const valueMaxWidthClass = canCopy ? "max-w-[calc(100%-1.5rem)]" : "max-w-full";
  const handleCopyClick = async () => {
    if (!canCopy) return;
    if (typeof onCopy === "function") {
      await onCopy({ label, value: copyText });
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyText);
    }
  };
  return (
    <div className={`group min-w-0 ${className}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex w-full min-w-0 items-start gap-2">
        {canLink ? (
          <a
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </a>
        ) : (
          <div
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-slate-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </div>
        )}
        {canCopy ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            onClick={handleCopyClick}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            <CopyIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CardNote({ label, value, className = "" }) {
  const displayValue = toText(value);
  if (isMissingFieldValue(displayValue)) return null;
  return (
    <div className={`rounded border border-slate-200 bg-slate-50 p-1.5 ${className}`}>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="max-h-[72px] overflow-auto whitespace-pre-wrap text-[12px] leading-4 text-slate-700">
        {displayValue}
      </div>
    </div>
  );
}

function CardTagList({
  label,
  tags = [],
  className = "",
  compact = false,
  onRemoveTag = null,
  isTagRemoving = null,
  isRemovalDisabled = false,
}) {
  const safeTags = (Array.isArray(tags) ? tags : [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const text = toText(item);
        if (!text) return null;
        return {
          key: text,
          code: "",
          label: text,
        };
      }
      const labelValue = toText(item?.label || item?.value || item?.code);
      const keyValue = toText(item?.key || item?.code || labelValue);
      if (!labelValue || !keyValue) return null;
      return {
        key: keyValue,
        code: toText(item?.code),
        label: labelValue,
      };
    })
    .filter(Boolean);
  if (!safeTags.length) return null;
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 min-h-0 ${
          compact ? "max-h-7 overflow-x-auto overflow-y-hidden" : "max-h-[72px] overflow-auto"
        }`}
      >
        <div className={`flex gap-1 ${compact ? "flex-nowrap whitespace-nowrap pr-1" : "flex-wrap"}`}>
          {safeTags.map((tag) => {
            const tagKey = toText(tag?.key);
            const tagLabel = toText(tag?.label);
            const canRemove = typeof onRemoveTag === "function";
            const removing = typeof isTagRemoving === "function" ? Boolean(isTagRemoving(tag)) : false;
            return (
              <span
                key={`${label}-${tagKey}`}
                className="inline-flex items-center rounded border border-sky-200 px-2 py-0.5 text-[11px] text-sky-800"
              >
                <span>{tagLabel}</span>
                {canRemove ? (
                  <button
                    type="button"
                    className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onRemoveTag(tag)}
                    disabled={isRemovalDisabled || removing}
                    aria-label={`Remove ${tagLabel}`}
                    title={`Remove ${tagLabel}`}
                  >
                    <SmallCloseIcon />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionLoadingState({
  label = "Loading",
  blocks = 4,
  columnsClass = "sm:grid-cols-2",
  className = "",
}) {
  const placeholderItems = Array.from(
    { length: Math.max(1, Number.parseInt(blocks, 10) || 1) },
    (_, index) => index
  );
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <span>{label}</span>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${columnsClass}`}>
        {placeholderItems.map((item) => (
          <div
            key={`section-loader-${label}-${item}`}
            className="rounded border border-slate-200 bg-slate-50 p-2"
          >
            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

const INQUIRY_DETAILS_EDIT_EMPTY_FORM = {
  inquiry_status: "New Inquiry",
  inquiry_source: "",
  type: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  how_did_you_hear: "",
  other: "",
  admin_notes: "",
  client_notes: "",
  date_job_required_by: "",
  renovations: "",
  resident_availability: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
};

const INQUIRY_WORKSPACE_TABS = [
  { id: "related-records", label: "Related Records" },
  { id: "properties", label: "Properties" },
  { id: "uploads", label: "Uploads" },
  { id: "appointments", label: "Appointments" },
];

function InquiryEditTextArea({
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

function InquiryEditListSelectionField({
  label,
  field,
  value,
  options = [],
  onChange,
}) {
  const selectedValues = useMemo(
    () => parseListSelectionValue(value, options),
    [value, options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionLabelByKey = useMemo(() => {
    const map = new Map();
    options.forEach((option) => {
      const key = toText(option?.code || option?.value);
      if (!key) return;
      map.set(key, option?.label || option?.value || option?.code);
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
          {selectedValues.map((key) => (
            <span
              key={`${field}-selected-${key}`}
              className="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
            >
              {optionLabelByKey.get(key) || key}
            </span>
          ))}
        </div>
        <div className="max-h-32 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionKey = toText(option?.code || option?.value);
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
                  {option?.label || option?.value || option?.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
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

function extractFirstRecord(payload) {
  const rows =
    payload?.resp ||
    payload?.data ||
    payload?.payload?.data?.PeterpmDeal ||
    payload?.payload?.data?.peterpmdeal ||
    [];
  if (Array.isArray(rows) && rows.length) return rows[0] || null;
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value) && value.length) return value[0] || null;
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value) && value.length) return value[0] || null;
    }
  }
  return null;
}

function buildInquiryLiteBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmDeal")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "account_type",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "how_can_we_help",
      "other",
      "admin_notes",
      "client_notes",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "service_inquiry_id",
      "service_provider_id",
      "Inquiry_Taken_By_id",
      "company_id",
      "primary_contact_id",
      "property_id",
      "quote_record_id",
      "Quote_Record_ID",
      "Quote_record_ID",
      "inquiry_for_job_id",
      "Inquiry_For_Job_ID",
      "Inquiry_for_Job_ID",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "renovations",
      "resident_availability",
      "date_job_required_by",
      "CompanyID",
      "CompanyName",
      "CompanyType",
      "CompanyPhone",
      "CompanyAddress",
      "CompanyCity",
      "CompanyState",
      "Company_Postal_Code",
      "Contact_Contact_ID",
      "Contact_First_Name",
      "Contact_Last_Name",
      "ContactEmail",
      "Contact_SMS_Number",
      "Company_Account_Type",
      "CompanyID1",
      "CompanyName1",
      "CompanyType1",
      "CompanyPhone1",
      "CompanyAddress1",
      "CompanyCity1",
      "CompanyState1",
      "Company_Postal_Code1",
    ])
    .include("Primary_Contact", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "address",
          "city",
          "state",
          "zip_code",
        ])
    )
    .include("Company", (sq) =>
      sq
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
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
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
            ])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "address_1",
          "address_2",
          "suburb_town",
          "city",
          "state",
          "postal_code",
          "country",
        ])
    )
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "work_email", "mobile_number"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    );
}

async function fetchInquiryLiteByUid({ plugin, uid }) {
  const uniqueId = toText(uid);
  if (!plugin?.switchTo || !uniqueId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("unique_id", uniqueId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchInquiryLiteById({ plugin, id }) {
  const inquiryId = toText(id);
  if (!plugin?.switchTo || !inquiryId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("id", inquiryId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchServiceNameById({ plugin, serviceId }) {
  const normalizedId = normalizeServiceInquiryId(serviceId);
  if (!plugin?.switchTo || !normalizedId) return "";
  const query = plugin
    .switchTo("PeterpmService")
    .query()
    .where("id", /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId)
    .deSelectAll()
    .select(["id", "service_name"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.service_name || record?.Service_Name);
}

async function fetchServiceProviderById({ plugin, providerId }) {
  const normalizedId = toText(providerId);
  if (!plugin?.switchTo || !normalizedId) return null;
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  const runQuery = async ({ field, value }) => {
    const query = providerModel
      .query()
      .where(field, value)
      .deSelectAll()
      .select(["id", "unique_id", "type", "status", "work_email", "mobile_number"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  const byId = await runQuery({
    field: "id",
    value: /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId,
  });
  if (byId) return byId;

  const byUniqueId = await runQuery({ field: "unique_id", value: normalizedId });
  if (byUniqueId) return byUniqueId;

  return null;
}

async function fetchJobIdByUniqueId({ plugin, uniqueId }) {
  const normalizedUniqueId = toText(uniqueId);
  if (!plugin?.switchTo || !normalizedUniqueId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("unique_id", normalizedUniqueId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.id || record?.ID);
}

async function fetchJobUniqueIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.unique_id || record?.Unique_ID);
}

async function fetchJobInquiryRecordIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "inquiry_record_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.inquiry_record_id || record?.Inquiry_Record_ID);
}

export function InquiryDetailsPage() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const { plugin, isReady: isSdkReady } = useVitalStatsPlugin();
  const { uid = "" } = useParams();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isBodyCorpDetailsOpen, setIsBodyCorpDetailsOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
    onModeChange: null,
    allowModeSwitch: false,
    titleVerb: "Add",
    initialValues: null,
  });
  const [resolvedInquiry, setResolvedInquiry] = useState(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [serviceInquiryName, setServiceInquiryName] = useState("");
  const [serviceProviderFallback, setServiceProviderFallback] = useState(null);
  const [serviceProviderLookup, setServiceProviderLookup] = useState([]);
  const [isServiceProviderLookupLoading, setIsServiceProviderLookupLoading] = useState(false);
  const [serviceProviderSearch, setServiceProviderSearch] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [isSavingLinkedJob, setIsSavingLinkedJob] = useState(false);
  const [linkedJobSelectionOverride, setLinkedJobSelectionOverride] = useState(undefined);
  const [relatedJobIdByUid, setRelatedJobIdByUid] = useState({});
  const [relatedRecordsRefreshKey, setRelatedRecordsRefreshKey] = useState(0);
  const [inquiryTakenByLookup, setInquiryTakenByLookup] = useState([]);
  const [isInquiryTakenByLookupLoading, setIsInquiryTakenByLookupLoading] = useState(false);
  const [inquiryTakenByFallback, setInquiryTakenByFallback] = useState(null);
  const [inquiryTakenBySearch, setInquiryTakenBySearch] = useState("");
  const [selectedInquiryTakenById, setSelectedInquiryTakenById] = useState("");
  const [isSavingInquiryTakenBy, setIsSavingInquiryTakenBy] = useState(false);
  const [isCreatingCallback, setIsCreatingCallback] = useState(false);
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isOpeningQuoteJob, setIsOpeningQuoteJob] = useState(false);
  const [isQuoteJobDirectlyLinked, setIsQuoteJobDirectlyLinked] = useState(false);
  const [quoteCreateDraft, setQuoteCreateDraft] = useState({
    quote_date: "",
    follow_up_date: "",
  });
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isInquiryDetailsModalOpen, setIsInquiryDetailsModalOpen] = useState(false);
  const [isSavingInquiryDetails, setIsSavingInquiryDetails] = useState(false);
  const [isInquiryEditPestAccordionOpen, setIsInquiryEditPestAccordionOpen] = useState(false);
  const [removingListTagKeys, setRemovingListTagKeys] = useState({});
  const [optimisticListSelectionByField, setOptimisticListSelectionByField] = useState({});
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("related-records");
  const [propertyLookupRecords, setPropertyLookupRecords] = useState([]);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [isLinkedPropertiesLoading, setIsLinkedPropertiesLoading] = useState(false);
  const [linkedPropertiesError, setLinkedPropertiesError] = useState("");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [isPropertySameAsContact, setIsPropertySameAsContact] = useState(false);
  const [isApplyingSameAsContactProperty, setIsApplyingSameAsContactProperty] = useState(false);
  const [propertyModalState, setPropertyModalState] = useState({
    open: false,
    initialData: null,
  });
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState("create");
  const [appointmentModalEditingId, setAppointmentModalEditingId] = useState("");
  const [appointmentModalDraft, setAppointmentModalDraft] = useState(null);
  const [isUploadsModalOpen, setIsUploadsModalOpen] = useState(false);
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const [inquiryDetailsForm, setInquiryDetailsForm] = useState({
    ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
  });
  const [inquiryServiceOptions, setInquiryServiceOptions] = useState([]);
  const [serviceInquiryLabelById, setServiceInquiryLabelById] = useState({});
  const [isInquiryServiceLookupLoading, setIsInquiryServiceLookupLoading] = useState(false);
  const moreMenuRef = useRef(null);
  const inquiryTakenByAutofillRef = useRef(new Set());
  const listSelectionDesiredRef = useRef({});
  const listSelectionSyncingRef = useRef({});
  const propertySearchManualEditRef = useRef(false);
  const previousSelectedPropertyIdRef = useRef("");
  const previousVisibleWorkspaceTabsKeyRef = useRef("");
  const previousAccountBindingKeyRef = useRef("");
  const memoFileInputRef = useRef(null);
  const popupCommentAutoShownRef = useRef({});
  const safeUid = useMemo(() => String(uid || "").trim(), [uid]);
  const hasUid = Boolean(safeUid);
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const inquiryStatus = useMemo(
    () => String(resolvedInquiry?.inquiry_status || resolvedInquiry?.Inquiry_Status || "").trim(),
    [resolvedInquiry]
  );
  const inquiryNumericId = useMemo(
    () => String(resolvedInquiry?.id || resolvedInquiry?.ID || "").trim(),
    [resolvedInquiry]
  );
  const inquiryStatusStyle = useMemo(() => {
    if (!inquiryStatus) {
      return { color: "#64748b", backgroundColor: "#f1f5f9" };
    }
    return resolveStatusStyle(inquiryStatus);
  }, [inquiryStatus]);
  const externalInquiryUrl = useMemo(() => {
    if (!inquiryNumericId) return "";
    return `https://app.ontraport.com/#!/deal/edit&id=${encodeURIComponent(inquiryNumericId)}`;
  }, [inquiryNumericId]);
  const inquiry = resolvedInquiry || {};
  const inquiryPrimaryContact = getInquiryPrimaryContact(inquiry);
  const inquiryCompany = getInquiryCompany(inquiry);
  const inquiryCompanyPrimaryPerson =
    inquiryCompany?.Primary_Person || inquiryCompany?.primary_person || {};
  const inquiryBodyCorpCompanyRaw =
    inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company || null;
  const inquiryBodyCorpCompany = Array.isArray(inquiryBodyCorpCompanyRaw)
    ? inquiryBodyCorpCompanyRaw[0] || {}
    : inquiryBodyCorpCompanyRaw || {};
  const serviceProvider = normalizeRelationRecord(
    inquiry?.Service_Provider || inquiry?.service_provider
  );
  const serviceProviderContact = normalizeServiceProviderContact(serviceProvider);
  const serviceProviderFallbackRecord = normalizeRelationRecord(serviceProviderFallback);
  const serviceProviderFallbackContact = normalizeServiceProviderContact(serviceProviderFallbackRecord);

  const inquiryAccountType = toText(inquiry?.account_type || inquiry?.Account_Type);
  const normalizedAccountType = inquiryAccountType.toLowerCase();
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const hasInquiryContactDetails = Boolean(
    fullName(inquiryPrimaryContact?.first_name, inquiryPrimaryContact?.last_name) ||
      toText(inquiryPrimaryContact?.email) ||
      toText(inquiryPrimaryContact?.sms_number) ||
      toText(inquiryPrimaryContact?.address)
  );
  const hasInquiryCompanyDetails = Boolean(
    toText(inquiryCompany?.name) || toText(inquiryCompany?.phone) || toText(inquiryCompany?.address)
  );
  const companyAccountType = toText(
    inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasInquiryContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasInquiryCompanyDetails);

  const accountType = inquiryAccountType;
  const inquiryCompanyId = toText(
    inquiry?.company_id || inquiry?.Company_ID || inquiryCompany?.id || inquiryCompany?.ID
  );
  const inquiryContactId = toText(
    inquiry?.primary_contact_id ||
      inquiry?.Primary_Contact_ID ||
      inquiryPrimaryContact?.id ||
      inquiryPrimaryContact?.ID
  );
  const contactPopupComment = toText(
    inquiryPrimaryContact?.popup_comment || inquiryPrimaryContact?.Popup_Comment
  );
  const companyPopupComment = toText(inquiryCompany?.popup_comment || inquiryCompany?.Popup_Comment);
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasAnyPopupComment = Boolean(contactPopupComment || companyPopupComment);
  const hasMemoContext = Boolean(inquiryNumericId);
  const currentUserId = toText(APP_USER?.id);
  const relatedRecordsAccountType = useMemo(() => {
    if (isCompanyAccount) return "Company";
    if (isContactAccount) return "Contact";
    return inquiryCompanyId ? "Company" : "Contact";
  }, [inquiryCompanyId, isCompanyAccount, isContactAccount]);
  const relatedRecordsAccountId = useMemo(() => {
    if (relatedRecordsAccountType === "Company") {
      return inquiryCompanyId || inquiryContactId;
    }
    return inquiryContactId || inquiryCompanyId;
  }, [inquiryCompanyId, inquiryContactId, relatedRecordsAccountType]);
  const {
    relatedDeals,
    relatedJobs,
    isLoading: isRelatedRecordsLoading,
    error: relatedRecordsError,
  } = useRelatedRecordsData({
    plugin,
    accountType: relatedRecordsAccountType,
    accountId: relatedRecordsAccountId,
    refreshKey: relatedRecordsRefreshKey,
  });
  const filteredRelatedDeals = useMemo(() => {
    const currentInquiryId = toText(inquiryNumericId);
    const currentInquiryUid = toText(safeUid);
    return (Array.isArray(relatedDeals) ? relatedDeals : []).filter((deal) => {
      const dealId = toText(deal?.id || deal?.ID);
      const dealUid = toText(deal?.unique_id || deal?.Unique_ID);
      if (currentInquiryId && dealId && dealId === currentInquiryId) return false;
      if (currentInquiryUid && dealUid && dealUid === currentInquiryUid) return false;
      return true;
    });
  }, [inquiryNumericId, relatedDeals, safeUid]);
  const isInquiryRequestExpanded = true;
  const quoteJobIdFromRecord = toText(
    inquiry?.quote_record_id || inquiry?.Quote_Record_ID || inquiry?.Quote_record_ID
  );
  const linkedInquiryJobIdFromRecord = toText(
    inquiry?.inquiry_for_job_id || inquiry?.Inquiry_For_Job_ID || inquiry?.Inquiry_for_Job_ID
  );
  const selectedRelatedJobId =
    linkedJobSelectionOverride !== undefined
      ? toText(linkedJobSelectionOverride)
      : linkedInquiryJobIdFromRecord;
  const inquiryPropertyRelationRecord = useMemo(
    () => normalizeRelationRecord(inquiry?.Property || inquiry?.property),
    [inquiry?.Property, inquiry?.property]
  );
  const inquiryPropertyId = normalizePropertyId(
    inquiry?.property_id ||
      inquiry?.Property_ID ||
      inquiryPropertyRelationRecord?.id ||
      inquiryPropertyRelationRecord?.ID
  );
  const inquiryPropertyRecord = useMemo(
    () =>
      normalizePropertyLookupRecord({
        ...inquiryPropertyRelationRecord,
        id:
          inquiryPropertyId ||
          inquiryPropertyRelationRecord?.id ||
          inquiryPropertyRelationRecord?.ID,
      }),
    [inquiryPropertyId, inquiryPropertyRelationRecord]
  );
  const normalizedSelectedPropertyId = normalizePropertyId(selectedPropertyId);
  const linkedPropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(linkedProperties).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [linkedProperties]
  );
  const propertySearchItems = useMemo(
    () =>
      dedupePropertyLookupRecords(propertyLookupRecords)
        .map((item) => ({
          id: normalizePropertyId(item?.id),
          label: resolvePropertyLookupLabel(item) || "Property",
          meta: [
            toText(item?.unique_id || item?.Unique_ID),
            toText(item?.address_1 || item?.Address_1 || item?.address || item?.Address),
            toText(item?.suburb_town || item?.Suburb_Town || item?.city || item?.City),
            toText(item?.state || item?.State),
            toText(item?.postal_code || item?.Postal_Code || item?.zip_code || item?.Zip_Code),
          ]
            .filter(Boolean)
            .join(" | "),
        }))
        .filter((item) => item.id || item.label),
    [propertyLookupRecords]
  );
  const activeRelatedProperty = useMemo(() => {
    if (normalizedSelectedPropertyId) {
      const fromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      const fromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      if (fromLookup && fromLinked) return { ...fromLinked, ...fromLookup };
      if (fromLookup) return fromLookup;
      if (fromLinked) return fromLinked;
    }
    if (linkedPropertiesSorted.length) return linkedPropertiesSorted[0];
    return null;
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);
  const workspacePropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(propertyLookupRecords).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [propertyLookupRecords]
  );
  const workspaceLookupData = useMemo(() => {
    const providers = [
      ...(Array.isArray(serviceProviderLookup) ? serviceProviderLookup : []),
      ...(Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []),
    ];
    const dedupedProviderMap = new Map();
    providers.forEach((provider) => {
      const key = toText(provider?.id || provider?.ID);
      if (!key || dedupedProviderMap.has(key)) return;
      dedupedProviderMap.set(key, provider);
    });
    const contacts = [];
    if (inquiryContactId || inquiryPrimaryContact?.email || inquiryPrimaryContact?.sms_number) {
      contacts.push({
        id: inquiryContactId || inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID || "",
        first_name: inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name || "",
        last_name: inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name || "",
        email: inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email || "",
        sms_number: inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number || "",
      });
    }
    const companies = [];
    if (inquiryCompanyId || inquiryCompany?.name || inquiryCompany?.Name) {
      companies.push({
        id: inquiryCompanyId || inquiryCompany?.id || inquiryCompany?.ID || "",
        name: inquiryCompany?.name || inquiryCompany?.Name || "",
        account_type:
          inquiryCompany?.account_type ||
          inquiryCompany?.Account_Type ||
          inquiry?.Company_Account_Type ||
          "",
        Primary_Person: {
          id: inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID || "",
          first_name:
            inquiryCompanyPrimaryPerson?.first_name ||
            inquiryCompanyPrimaryPerson?.First_Name ||
            "",
          last_name:
            inquiryCompanyPrimaryPerson?.last_name ||
            inquiryCompanyPrimaryPerson?.Last_Name ||
            "",
          email: inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email || "",
          sms_number:
            inquiryCompanyPrimaryPerson?.sms_number ||
            inquiryCompanyPrimaryPerson?.SMS_Number ||
            "",
        },
      });
    }
    return {
      contacts,
      companies,
      properties: workspacePropertiesSorted,
      serviceProviders: Array.from(dedupedProviderMap.values()),
    };
  }, [
    inquiry,
    inquiryCompany,
    inquiryCompanyId,
    inquiryCompanyPrimaryPerson,
    inquiryContactId,
    inquiryPrimaryContact,
    inquiryTakenByLookup,
    serviceProviderLookup,
    workspacePropertiesSorted,
  ]);
  const accountContactName = fullName(
    inquiryPrimaryContact?.first_name,
    inquiryPrimaryContact?.last_name
  );
  const accountContactEmail = toText(inquiryPrimaryContact?.email);
  const accountContactPhone = toText(inquiryPrimaryContact?.sms_number);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail)
    ? toMailHref(accountContactEmail)
    : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone)
    ? toTelHref(accountContactPhone)
    : "";
  const accountContactAddress = joinAddress([
    inquiryPrimaryContact?.address,
    inquiryPrimaryContact?.city,
    inquiryPrimaryContact?.state,
    inquiryPrimaryContact?.zip_code,
  ]);
  const accountContactAddressHref = toGoogleMapsHref(accountContactAddress);
  const accountCompanyName = toText(inquiryCompany?.name || inquiryCompany?.Name);
  const accountCompanyPhone = toText(inquiryCompany?.phone || inquiryCompany?.Phone);
  const accountCompanyPhoneHref = isLikelyPhoneValue(accountCompanyPhone)
    ? toTelHref(accountCompanyPhone)
    : "";
  const accountCompanyAddress = joinAddress([
    inquiryCompany?.address || inquiryCompany?.Address,
    inquiryCompany?.city || inquiryCompany?.City,
    inquiryCompany?.state || inquiryCompany?.State,
    inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code || inquiryCompany?.Zip_Code,
  ]);
  const accountCompanyAddressHref = toGoogleMapsHref(accountCompanyAddress);
  const accountCompanyPrimaryName = fullName(
    inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name,
    inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
  );
  const accountCompanyPrimaryEmail = toText(
    inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email
  );
  const accountCompanyPrimaryEmailHref = isLikelyEmailValue(accountCompanyPrimaryEmail)
    ? toMailHref(accountCompanyPrimaryEmail)
    : "";
  const accountCompanyPrimaryPhone = toText(
    inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
  );
  const accountCompanyPrimaryPhoneHref = isLikelyPhoneValue(accountCompanyPrimaryPhone)
    ? toTelHref(accountCompanyPrimaryPhone)
    : "";
  const accountBodyCorpName = toText(inquiryBodyCorpCompany?.name || inquiryBodyCorpCompany?.Name);
  const accountBodyCorpType = toText(inquiryBodyCorpCompany?.type || inquiryBodyCorpCompany?.Type);
  const accountBodyCorpPhone = toText(inquiryBodyCorpCompany?.phone || inquiryBodyCorpCompany?.Phone);
  const accountBodyCorpPhoneHref = isLikelyPhoneValue(accountBodyCorpPhone)
    ? toTelHref(accountBodyCorpPhone)
    : "";
  const accountBodyCorpAddress = joinAddress([
    inquiryBodyCorpCompany?.address || inquiryBodyCorpCompany?.Address,
    inquiryBodyCorpCompany?.city || inquiryBodyCorpCompany?.City,
    inquiryBodyCorpCompany?.state || inquiryBodyCorpCompany?.State,
    inquiryBodyCorpCompany?.postal_code || inquiryBodyCorpCompany?.Postal_Code,
  ]);
  const accountBodyCorpAddressHref = toGoogleMapsHref(accountBodyCorpAddress);
  const hasBodyCorpDetails = Boolean(
    accountBodyCorpName || accountBodyCorpType || accountBodyCorpPhone || accountBodyCorpAddress
  );
  const hasAccountContactFields = Boolean(
    accountContactName || accountContactEmail || accountContactPhone || accountContactAddress
  );
  const hasAccountCompanyFields = Boolean(
    accountCompanyName ||
      accountCompanyPhone ||
      accountCompanyPrimaryName ||
      accountCompanyPrimaryEmail ||
      accountCompanyPrimaryPhone ||
      accountCompanyAddress
  );

  useEffect(() => {
    setPopupCommentDrafts({
      contact: contactPopupComment,
      company: companyPopupComment,
    });
  }, [companyPopupComment, contactPopupComment, inquiryCompanyId, inquiryContactId]);

  useEffect(() => {
    const currentUid = toText(safeUid);
    if (!currentUid || isContextLoading) return;
    if (!hasAnyPopupComment) return;
    if (popupCommentAutoShownRef.current?.[currentUid]) return;
    popupCommentAutoShownRef.current[currentUid] = true;
    setIsPopupCommentModalOpen(true);
  }, [hasAnyPopupComment, isContextLoading, safeUid]);

  const sameAsContactPropertySource = useMemo(() => {
    const contactStreet = toText(inquiryPrimaryContact?.address);
    const contactCity = toText(inquiryPrimaryContact?.city);
    const contactState = toText(inquiryPrimaryContact?.state);
    const contactPostalCode = toText(inquiryPrimaryContact?.zip_code);
    const companyStreet = toText(inquiryCompany?.address || inquiryCompany?.Address);
    const companyCity = toText(inquiryCompany?.city || inquiryCompany?.City);
    const companyState = toText(inquiryCompany?.state || inquiryCompany?.State);
    const companyPostalCode = toText(
      inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
    );

    const fallbackStreet = contactStreet || companyStreet;
    const fallbackCity = contactCity || companyCity;
    const fallbackState = contactState || companyState;
    const fallbackPostalCode = contactPostalCode || companyPostalCode;
    const formatted = joinAddress([fallbackStreet, fallbackCity, fallbackState, fallbackPostalCode]);
    return {
      sourceType: contactStreet || contactCity ? "contact" : "company",
      address1: fallbackStreet || formatted,
      suburbTown: fallbackCity,
      state: fallbackState,
      postalCode: fallbackPostalCode,
      propertyName:
        fallbackStreet ||
        formatted ||
        accountContactName ||
        accountCompanyName ||
        `Property ${safeUid || ""}`.trim(),
      searchText: formatted || fallbackStreet,
    };
  }, [
    accountCompanyName,
    accountContactName,
    inquiryCompany,
    inquiryPrimaryContact,
    safeUid,
  ]);
  const accountBindingKey = useMemo(
    () =>
      [
        toText(inquiryAccountType),
        toText(inquiryContactId),
        toText(inquiryCompanyId),
      ].join("|"),
    [inquiryAccountType, inquiryCompanyId, inquiryContactId]
  );

  const accountEditorContactInitialValues = useMemo(
    () => ({
      id: toText(inquiryPrimaryContact?.id),
      first_name: toText(inquiryPrimaryContact?.first_name),
      last_name: toText(inquiryPrimaryContact?.last_name),
      email: toText(inquiryPrimaryContact?.email),
      sms_number: toText(inquiryPrimaryContact?.sms_number),
      address: toText(inquiryPrimaryContact?.address),
      city: toText(inquiryPrimaryContact?.city),
      state: toText(inquiryPrimaryContact?.state),
      zip_code: toText(inquiryPrimaryContact?.zip_code),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiryPrimaryContact]
  );
  const accountEditorCompanyInitialValues = useMemo(
    () => ({
      id: toText(inquiryCompany?.id),
      company_name: toText(inquiryCompany?.name || inquiryCompany?.Name),
      company_type: toText(inquiryCompany?.type || inquiryCompany?.Type),
      company_description: toText(inquiryCompany?.description || inquiryCompany?.Description),
      company_phone: toText(inquiryCompany?.phone || inquiryCompany?.Phone),
      company_address: toText(inquiryCompany?.address || inquiryCompany?.Address),
      company_city: toText(inquiryCompany?.city || inquiryCompany?.City),
      company_state: toText(inquiryCompany?.state || inquiryCompany?.State),
      company_postal_code: toText(
        inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
      ),
      company_industry: toText(inquiryCompany?.industry || inquiryCompany?.Industry),
      company_annual_revenue: toText(
        inquiryCompany?.annual_revenue || inquiryCompany?.Annual_Revenue
      ),
      company_number_of_employees: toText(
        inquiryCompany?.number_of_employees || inquiryCompany?.Number_of_Employees
      ),
      company_account_type: toText(
        inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
      ),
      primary_person_contact_id: toText(
        inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID
      ),
      first_name: toText(
        inquiryCompanyPrimaryPerson?.first_name ||
          inquiryCompanyPrimaryPerson?.First_Name
      ),
      last_name: toText(
        inquiryCompanyPrimaryPerson?.last_name ||
          inquiryCompanyPrimaryPerson?.Last_Name
      ),
      email: toText(
        inquiryCompanyPrimaryPerson?.email ||
          inquiryCompanyPrimaryPerson?.Email
      ),
      sms_number: toText(
        inquiryCompanyPrimaryPerson?.sms_number ||
          inquiryCompanyPrimaryPerson?.SMS_Number
      ),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiry?.Company_Account_Type, inquiryCompany, inquiryCompanyPrimaryPerson]
  );

  const statusSource = toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source);
  const statusType = toText(inquiry?.type || inquiry?.Type);
  const statusServiceInquiryId = normalizeServiceInquiryId(
    inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
  );
  const statusServiceName =
    serviceInquiryName || (statusServiceInquiryId ? `Service #${statusServiceInquiryId}` : "");
  const statusServiceNameHref = statusServiceInquiryId
    ? `https://app.ontraport.com/#!/o_services10003/edit&id=${encodeURIComponent(
        statusServiceInquiryId
      )}`
    : "";
  const statusHowCanHelp = toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help);
  const statusHowHeard = toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear);
  const statusOther = toText(inquiry?.other || inquiry?.Other);
  const inquiryDisplayFlowRule = useMemo(() => {
    const resolvedType = toText(inquiry?.type || inquiry?.Type);
    return getInquiryFlowRule(resolvedType);
  }, [inquiry]);
  const shouldShowStatusOther = useMemo(
    () => shouldShowOtherSourceField(toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear)),
    [inquiry]
  );
  const statusHowHeardDisplay =
    shouldShowStatusOther && statusOther ? statusOther : statusHowHeard;

  const requestDateRequired = formatDate(inquiry?.date_job_required_by || inquiry?.Date_Job_Required_By);
  const requestRenovations = toText(inquiry?.renovations || inquiry?.Renovations);
  const requestResidentAvailability = toText(
    inquiry?.resident_availability || inquiry?.Resident_Availability
  );
  const requestPestNoiseRawValue =
    inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text;
  const requestPestActiveTimesRawValue =
    inquiry?.pest_active_times_options_as_text || inquiry?.Pest_Active_Times_Options_As_Text;
  const requestPestLocationsRawValue =
    inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text;
  const requestPestNoiseDisplayValue = Array.isArray(
    optimisticListSelectionByField.noise_signs_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.noise_signs_options_as_text)
    : requestPestNoiseRawValue;
  const requestPestActiveTimesDisplayValue = Array.isArray(
    optimisticListSelectionByField.pest_active_times_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.pest_active_times_options_as_text)
    : requestPestActiveTimesRawValue;
  const requestPestLocationsDisplayValue = Array.isArray(
    optimisticListSelectionByField.pest_location_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.pest_location_options_as_text)
    : requestPestLocationsRawValue;
  const requestPestNoiseTags = buildListSelectionTagItems(
    requestPestNoiseDisplayValue,
    NOISE_SIGN_OPTIONS
  );
  const requestPestActiveTimesTags = buildListSelectionTagItems(
    requestPestActiveTimesDisplayValue,
    PEST_ACTIVE_TIME_OPTIONS
  );
  const requestPestLocationsTags = buildListSelectionTagItems(
    requestPestLocationsDisplayValue,
    PEST_LOCATION_OPTIONS
  );
  const hasRelatedRecordsData =
    filteredRelatedDeals.length > 0 || (Array.isArray(relatedJobs) && relatedJobs.length > 0);
  const shouldShowRelationshipTabsByFlow = Boolean(inquiryDisplayFlowRule.showPropertySearch);
  const shouldShowRelatedRecordsTab =
    Boolean(relatedRecordsAccountId) &&
    shouldShowRelationshipTabsByFlow &&
    hasRelatedRecordsData;
  const shouldShowPropertiesTab = shouldShowRelationshipTabsByFlow;
  const visibleWorkspaceTabs = useMemo(
    () =>
      INQUIRY_WORKSPACE_TABS.filter((tab) => {
        if (tab.id === "related-records") return shouldShowRelatedRecordsTab;
        if (tab.id === "properties") return shouldShowPropertiesTab;
        return true;
      }),
    [shouldShowPropertiesTab, shouldShowRelatedRecordsTab]
  );
  const visibleWorkspaceTabsKey = useMemo(
    () => visibleWorkspaceTabs.map((tab) => tab.id).join("|"),
    [visibleWorkspaceTabs]
  );

  useEffect(() => {
    if (!visibleWorkspaceTabs.length) return;
    const firstVisibleTabId = visibleWorkspaceTabs[0].id;
    const hasVisibleTabSetChanged =
      previousVisibleWorkspaceTabsKeyRef.current !== visibleWorkspaceTabsKey;
    if (hasVisibleTabSetChanged) {
      previousVisibleWorkspaceTabsKeyRef.current = visibleWorkspaceTabsKey;
      setActiveWorkspaceTab(firstVisibleTabId);
      return;
    }
    const isActiveVisible = visibleWorkspaceTabs.some((tab) => tab.id === activeWorkspaceTab);
    if (isActiveVisible) return;
    setActiveWorkspaceTab(firstVisibleTabId);
  }, [activeWorkspaceTab, visibleWorkspaceTabs, visibleWorkspaceTabsKey]);

  const notesAdmin = toText(inquiry?.admin_notes || inquiry?.Admin_Notes);
  const notesClient = toText(inquiry?.client_notes || inquiry?.Client_Notes);
  const isInquiryInitialLoadInProgress =
    hasUid && !resolvedInquiry && (!isSdkReady || isContextLoading);
  const inquiryDetailsInitialForm = useMemo(
    () => ({
      inquiry_status: toText(inquiry?.inquiry_status || inquiry?.Inquiry_Status) || "New Inquiry",
      inquiry_source: toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source),
      type: toText(inquiry?.type || inquiry?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
      ),
      how_can_we_help: toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help),
      how_did_you_hear: toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear),
      other: toText(inquiry?.other || inquiry?.Other),
      admin_notes: toText(inquiry?.admin_notes || inquiry?.Admin_Notes),
      client_notes: toText(inquiry?.client_notes || inquiry?.Client_Notes),
      date_job_required_by: toDateInput(
        inquiry?.date_job_required_by || inquiry?.Date_Job_Required_By
      ),
      renovations: toText(inquiry?.renovations || inquiry?.Renovations),
      resident_availability: toText(
        inquiry?.resident_availability || inquiry?.Resident_Availability
      ),
      noise_signs_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text,
          NOISE_SIGN_OPTIONS
        )
      ),
      pest_active_times_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.pest_active_times_options_as_text || inquiry?.Pest_Active_Times_Options_As_Text,
          PEST_ACTIVE_TIME_OPTIONS
        )
      ),
      pest_location_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text,
          PEST_LOCATION_OPTIONS
        )
      ),
    }),
    [inquiry]
  );
  const inquiryEditFlowRule = useMemo(
    () => getInquiryFlowRule(inquiryDetailsForm.type),
    [inquiryDetailsForm.type]
  );
  const shouldShowInquiryEditOther = useMemo(
    () => shouldShowOtherSourceField(inquiryDetailsForm.how_did_you_hear),
    [inquiryDetailsForm.how_did_you_hear]
  );
  const selectedInquiryEditServiceLabel = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    if (!selectedServiceId) return "";
    const fromOptions = (Array.isArray(inquiryServiceOptions) ? inquiryServiceOptions : []).find(
      (option) => toText(option?.value) === selectedServiceId
    );
    return toText(fromOptions?.label || serviceInquiryLabelById?.[selectedServiceId]);
  }, [inquiryDetailsForm.service_inquiry_id, inquiryServiceOptions, serviceInquiryLabelById]);
  const isInquiryEditPestService = useMemo(
    () => isPestServiceFlow(selectedInquiryEditServiceLabel),
    [selectedInquiryEditServiceLabel]
  );
  const resolvedInquiryServiceOptions = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    const options = Array.isArray(inquiryServiceOptions) ? [...inquiryServiceOptions] : [];
    if (selectedServiceId && !options.some((option) => toText(option?.value) === selectedServiceId)) {
      options.unshift({
        value: selectedServiceId,
        label: toText(serviceInquiryLabelById?.[selectedServiceId]) || `Service #${selectedServiceId}`,
      });
    }
    return options;
  }, [inquiryDetailsForm.service_inquiry_id, inquiryServiceOptions, serviceInquiryLabelById]);

  const serviceProviderIdResolved = toText(
    inquiry?.service_provider_id ||
      inquiry?.Service_Provider_ID ||
      serviceProvider?.id ||
      serviceProvider?.ID ||
      serviceProviderFallbackRecord?.id ||
      serviceProviderFallbackRecord?.ID
  );
  const hasServiceProviderRelationDetails = Boolean(
    fullName(serviceProviderContact?.first_name, serviceProviderContact?.last_name) ||
      toText(serviceProviderContact?.email) ||
      toText(serviceProviderContact?.sms_number)
  );
  const serviceProviderEmail =
    toText(serviceProviderContact?.email) ||
    toText(serviceProviderFallbackContact?.email);
  const serviceProviderPhone =
    toText(serviceProviderContact?.sms_number) ||
    toText(serviceProviderFallbackContact?.sms_number);
  const inquiryTakenByStoredId = toText(
    inquiry?.Inquiry_Taken_By_id || inquiry?.Inquiry_Taken_By_ID || inquiry?.inquiry_taken_by_id
  );
  const inquiryTakenByIdResolved = inquiryTakenByStoredId || configuredAdminProviderId;
  const inquiryTakenByFallbackRecord = normalizeRelationRecord(inquiryTakenByFallback);
  const inquiryTakenByFallbackContact = normalizeServiceProviderContact(inquiryTakenByFallbackRecord);
  const inquiryTakenBySelectedLookupRecord = useMemo(
    () =>
      (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []).find(
        (provider) => toText(provider?.id || provider?.ID) === inquiryTakenByIdResolved
      ) || null,
    [inquiryTakenByIdResolved, inquiryTakenByLookup]
  );
  const serviceProviderPrefillLabel = useMemo(
    () =>
      serviceProviderIdResolved
        ? formatServiceProviderInputLabel({
            id: serviceProviderIdResolved,
            first_name:
              serviceProviderContact?.first_name || serviceProviderFallbackContact?.first_name,
            last_name:
              serviceProviderContact?.last_name || serviceProviderFallbackContact?.last_name,
            email: serviceProviderEmail,
            sms_number: serviceProviderPhone,
          })
        : "",
    [
      serviceProviderContact?.first_name,
      serviceProviderContact?.last_name,
      serviceProviderEmail,
      serviceProviderFallbackContact?.first_name,
      serviceProviderFallbackContact?.last_name,
      serviceProviderIdResolved,
      serviceProviderPhone,
    ]
  );
  const inquiryTakenByPrefillLabel = useMemo(() => {
    if (!inquiryTakenByIdResolved) return "";
    if (inquiryTakenBySelectedLookupRecord) {
      return formatServiceProviderInputLabel(inquiryTakenBySelectedLookupRecord);
    }
    if (inquiryTakenByFallbackRecord && toText(inquiryTakenByFallbackRecord?.id)) {
      return formatServiceProviderInputLabel({
        id: inquiryTakenByIdResolved,
        first_name: inquiryTakenByFallbackContact?.first_name,
        last_name: inquiryTakenByFallbackContact?.last_name,
        email: inquiryTakenByFallbackContact?.email,
        sms_number: inquiryTakenByFallbackContact?.sms_number,
      });
    }
    return "";
  }, [
    inquiryTakenByFallbackContact?.email,
    inquiryTakenByFallbackContact?.first_name,
    inquiryTakenByFallbackContact?.last_name,
    inquiryTakenByFallbackContact?.sms_number,
    inquiryTakenByFallbackRecord,
    inquiryTakenByIdResolved,
    inquiryTakenBySelectedLookupRecord,
  ]);
  const serviceProviderSearchItems = useMemo(
    () =>
      (Array.isArray(serviceProviderLookup) ? serviceProviderLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email),
            sms_number: toText(provider?.sms_number),
          };
        })
        .filter(Boolean),
    [serviceProviderLookup]
  );
  const inquiryTakenBySearchItems = useMemo(
    () =>
      (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email || provider?.work_email || provider?.Work_Email),
            sms_number: toText(
              provider?.sms_number || provider?.mobile_number || provider?.Mobile_Number
            ),
          };
        })
        .filter(Boolean),
    [inquiryTakenByLookup]
  );
  const inquiryAppointmentPrefillContext = useMemo(() => {
    const locationId = normalizePropertyId(activeRelatedProperty?.id);
    const locationLabel = resolvePropertyLookupLabel(activeRelatedProperty || {});
    const guestId = inquiryContactId || toText(inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID);
    const guestLabel = formatContactLookupLabel({
      id: guestId,
      first_name: inquiryPrimaryContact?.first_name,
      last_name: inquiryPrimaryContact?.last_name,
      email: inquiryPrimaryContact?.email,
      sms_number: inquiryPrimaryContact?.sms_number,
    });
    const serviceLabel = toText(statusServiceName);
    const title = [safeUid, serviceLabel].filter(Boolean).join(" | ");
    const details = [
      serviceLabel ? `Service:\n${serviceLabel}` : "",
      locationLabel ? `Property:\n${locationLabel}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      locationId,
      locationLabel,
      hostId: serviceProviderIdResolved,
      hostLabel: serviceProviderPrefillLabel,
      guestId,
      guestLabel,
      title,
      description: details,
    };
  }, [
    activeRelatedProperty,
    inquiryContactId,
    inquiryPrimaryContact,
    safeUid,
    serviceProviderIdResolved,
    serviceProviderPrefillLabel,
    statusServiceName,
  ]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onDocumentClick = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [isMoreOpen]);

  useEffect(() => {
    setIsBodyCorpDetailsOpen(false);
  }, [safeUid]);

  useEffect(() => {
    if (!accountBindingKey) return;
    if (!previousAccountBindingKeyRef.current) {
      previousAccountBindingKeyRef.current = accountBindingKey;
      return;
    }
    if (previousAccountBindingKeyRef.current === accountBindingKey) return;
    previousAccountBindingKeyRef.current = accountBindingKey;
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
  }, [accountBindingKey]);

  useEffect(() => {
    previousVisibleWorkspaceTabsKeyRef.current = "";
    previousAccountBindingKeyRef.current = "";
  }, [safeUid]);

  useEffect(() => {
    setSelectedPropertyId("");
    setPropertySearchQuery("");
    propertySearchManualEditRef.current = false;
    previousSelectedPropertyIdRef.current = "";
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
    setLinkedProperties([]);
    setLinkedPropertiesError("");
    setPropertyModalState({ open: false, initialData: null });
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsUploadsModalOpen(false);
  }, [safeUid]);

  useEffect(() => {
    if (!plugin || !relatedRecordsAccountId || !inquiryDisplayFlowRule.showPropertySearch) {
      setLinkedProperties([]);
      setLinkedPropertiesError("");
      setIsLinkedPropertiesLoading(false);
      return;
    }

    let isMounted = true;
    setIsLinkedPropertiesLoading(true);
    setLinkedPropertiesError("");
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        setLinkedProperties((previous) =>
          arePropertyRecordCollectionsEqual(previous, normalizedRecords)
            ? previous
            : normalizedRecords
        );
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
      })
      .catch((loadError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading linked properties", loadError);
        setLinkedProperties([]);
        setLinkedPropertiesError(loadError?.message || "Unable to load linked properties.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLinkedPropertiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inquiryDisplayFlowRule.showPropertySearch, plugin, relatedRecordsAccountId, relatedRecordsAccountType]);

  useEffect(() => {
    if (!inquiryPropertyId && !resolvePropertyLookupLabel(inquiryPropertyRecord)) return;
    setPropertyLookupRecords((previous) =>
      mergePropertyCollectionsIfChanged(previous, [inquiryPropertyRecord])
    );
  }, [inquiryPropertyId, inquiryPropertyRecord]);

  useEffect(() => {
    if (!plugin || !shouldShowPropertiesTab) return;

    let isMounted = true;
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (!normalizedRecords.length) return;
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
      })
      .catch((loadError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading property lookup", loadError);
      });

    return () => {
      isMounted = false;
    };
  }, [plugin, shouldShowPropertiesTab]);

  useEffect(() => {
    const normalizedInquiryPropertyId = normalizePropertyId(inquiryPropertyId);
    if (!normalizedInquiryPropertyId) return;
    setSelectedPropertyId((previous) => {
      const normalizedPreviousId = normalizePropertyId(previous);
      if (normalizedPreviousId === normalizedInquiryPropertyId) return previous;
      return normalizedInquiryPropertyId;
    });
  }, [inquiryPropertyId]);

  useEffect(() => {
    if (normalizedSelectedPropertyId) {
      const isStillAvailableInLinked = linkedPropertiesSorted.some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      const isStillAvailableInLookup = dedupePropertyLookupRecords(propertyLookupRecords).some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      if (isStillAvailableInLinked || isStillAvailableInLookup) return;
    }
    const fallbackId = inquiryPropertyId || normalizePropertyId(linkedPropertiesSorted[0]?.id);
    setSelectedPropertyId((previous) => {
      const prevId = normalizePropertyId(previous);
      if (prevId === fallbackId) return previous;
      return fallbackId;
    });
  }, [inquiryPropertyId, linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);

  useEffect(() => {
    if (!normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = "";
      return;
    }
    const selectedRecord =
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
    if (!selectedRecord) return;
    const nextLabel = resolvePropertyLookupLabel(selectedRecord);
    if (!nextLabel) return;
    if (previousSelectedPropertyIdRef.current !== normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = normalizedSelectedPropertyId;
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(nextLabel);
      return;
    }
    if (propertySearchManualEditRef.current) return;
    if (toText(propertySearchQuery) === toText(nextLabel)) return;
    setPropertySearchQuery(nextLabel);
  }, [
    linkedPropertiesSorted,
    normalizedSelectedPropertyId,
    propertyLookupRecords,
    propertySearchQuery,
  ]);

  useEffect(() => {
    if (!plugin || !normalizedSelectedPropertyId) return;
    const selectedRecord =
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      null;
    if (!selectedRecord) return;

    const hasAddressDetails = Boolean(
      toText(
        selectedRecord?.address_1 ||
          selectedRecord?.Address_1 ||
          selectedRecord?.address ||
          selectedRecord?.Address
      ) ||
        toText(
          selectedRecord?.suburb_town ||
            selectedRecord?.Suburb_Town ||
            selectedRecord?.city ||
            selectedRecord?.City
        )
    );
    if (hasAddressDetails) return;

    let isMounted = true;
    fetchPropertyRecordById({ plugin, propertyId: normalizedSelectedPropertyId })
      .then((record) => {
        if (!isMounted || !record) return;
        const normalizedRecord = normalizePropertyLookupRecord(record);
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedRecord])
        );
        setLinkedProperties((previous) =>
          mergePropertyCollectionsIfChanged(previous || [], [normalizedRecord])
        );
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed hydrating selected property details", fetchError);
      });

    return () => {
      isMounted = false;
    };
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, plugin, propertyLookupRecords]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    if (!shouldShowInquiryEditOther && toText(inquiryDetailsForm.other)) {
      setInquiryDetailsForm((previous) => ({ ...previous, other: "" }));
    }
  }, [isInquiryDetailsModalOpen, inquiryDetailsForm.other, shouldShowInquiryEditOther]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    setIsInquiryEditPestAccordionOpen(isInquiryEditPestService);
  }, [isInquiryDetailsModalOpen, isInquiryEditPestService]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !isSdkReady || !plugin) return;

    let isMounted = true;
    setIsInquiryServiceLookupLoading(true);
    const loadServices = async () => {
      try {
        let records = await fetchServicesForActivities({ plugin });
        records = Array.isArray(records) ? records : [];
        if (!records.length) {
          const allServicesQuery = plugin
            .switchTo("PeterpmService")
            .query()
            .deSelectAll()
            .select(["id", "service_name", "service_type"])
            .noDestroy();
          allServicesQuery.getOrInitQueryCalc?.();
          const response = await toPromiseLike(allServicesQuery.fetchDirect());
          const rows = response?.resp || response?.data || [];
          records = Array.isArray(rows) ? rows : [];
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
        setInquiryServiceOptions(mapped.map((record) => ({ value: record.id, label: record.name })));
        setServiceInquiryLabelById(Object.fromEntries(mapped.map((record) => [record.id, record.name])));
      } catch (serviceError) {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading service options", serviceError);
        setInquiryServiceOptions([]);
        setServiceInquiryLabelById({});
      } finally {
        if (!isMounted) return;
        setIsInquiryServiceLookupLoading(false);
      }
    };
    loadServices();

    return () => {
      isMounted = false;
    };
  }, [isInquiryDetailsModalOpen, isSdkReady, plugin]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !plugin?.switchTo) return;
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    if (!selectedServiceId) return;
    if (serviceInquiryLabelById[selectedServiceId]) return;

    let isActive = true;
    const loadServiceLabel = async () => {
      try {
        const resolvedLabel = await fetchServiceNameById({ plugin, serviceId: selectedServiceId });
        if (!isActive || !resolvedLabel) return;
        setServiceInquiryLabelById((previous) => ({
          ...previous,
          [selectedServiceId]: resolvedLabel,
        }));
      } catch (_) {
        if (!isActive) return;
      }
    };
    loadServiceLabel();

    return () => {
      isActive = false;
    };
  }, [inquiryDetailsForm.service_inquiry_id, isInquiryDetailsModalOpen, plugin, serviceInquiryLabelById]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceProviderLookup([]);
      setIsServiceProviderLookupLoading(false);
      return;
    }

    let cancelled = false;
    setIsServiceProviderLookupLoading(true);
    fetchServiceProvidersForSearch({ plugin })
      .then((records) => {
        if (cancelled) return;
        setServiceProviderLookup(Array.isArray(records) ? records : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to fetch service provider lookup", lookupError);
        setServiceProviderLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsServiceProviderLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setInquiryTakenByLookup([]);
      setIsInquiryTakenByLookupLoading(false);
      return;
    }

    let cancelled = false;
    setIsInquiryTakenByLookupLoading(true);
    fetchServiceProvidersForSearch({ plugin, providerType: "Admin", status: "" })
      .then((records) => {
        if (cancelled) return;
        setInquiryTakenByLookup(Array.isArray(records) ? records : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to fetch inquiry taken by lookup", lookupError);
        setInquiryTakenByLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsInquiryTakenByLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !hasUid) {
      setResolvedInquiry(null);
      return;
    }

    let cancelled = false;
    setIsContextLoading(true);
    resolveJobDetailsContext({ plugin, uid: safeUid, sourceTab: "inquiry" })
      .then(async (context) => {
        if (cancelled) return;
        const fromContext =
          context?.inquiry ||
          context?.job?.Inquiry_Record ||
          context?.job?.inquiry_record ||
          null;
        if (fromContext) {
          const contextInquiryId = toText(fromContext?.id || fromContext?.ID);
          const enrichedFromContextId = contextInquiryId
            ? await fetchInquiryLiteById({ plugin, id: contextInquiryId })
            : null;
          if (cancelled) return;
          if (enrichedFromContextId) {
            setResolvedInquiry(enrichedFromContextId);
            return;
          }

          const contextInquiryUid = toText(fromContext?.unique_id || fromContext?.Unique_ID || safeUid);
          const enrichedFromContextUid = contextInquiryUid
            ? await fetchInquiryLiteByUid({ plugin, uid: contextInquiryUid })
            : null;
          if (cancelled) return;
          if (enrichedFromContextUid) {
            setResolvedInquiry(enrichedFromContextUid);
            return;
          }

          setResolvedInquiry(fromContext);
          return;
        }

        const liteByUid = await fetchInquiryLiteByUid({ plugin, uid: safeUid });
        if (cancelled) return;
        if (liteByUid) {
          setResolvedInquiry(liteByUid);
          return;
        }

        if (/^\d+$/.test(safeUid)) {
          const liteById = await fetchInquiryLiteById({ plugin, id: safeUid });
          if (cancelled) return;
          if (liteById) {
            setResolvedInquiry(liteById);
            return;
          }
        }

        setResolvedInquiry(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed loading inquiry context", loadError);
        setResolvedInquiry(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasUid, isSdkReady, plugin, safeUid]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceInquiryName("");
      return;
    }
    if (!statusServiceInquiryId) {
      setServiceInquiryName("");
      return;
    }

    let cancelled = false;
    fetchServiceNameById({ plugin, serviceId: statusServiceInquiryId })
      .then((name) => {
        if (cancelled) return;
        setServiceInquiryName(toText(name));
      })
      .catch(() => {
        if (cancelled) return;
        setServiceInquiryName("");
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, statusServiceInquiryId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceProviderFallback(null);
      return;
    }
    if (!serviceProviderIdResolved) {
      setServiceProviderFallback(null);
      return;
    }
    if (hasServiceProviderRelationDetails) {
      setServiceProviderFallback(null);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: serviceProviderIdResolved })
      .then((providerRecord) => {
        if (cancelled) return;
        setServiceProviderFallback(providerRecord || null);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceProviderFallback(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasServiceProviderRelationDetails, isSdkReady, plugin, serviceProviderIdResolved]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setInquiryTakenByFallback(null);
      return;
    }
    if (!inquiryTakenByIdResolved) {
      setInquiryTakenByFallback(null);
      return;
    }
    const fromLookup = (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []).find(
      (provider) => toText(provider?.id || provider?.ID) === inquiryTakenByIdResolved
    );
    if (fromLookup) {
      setInquiryTakenByFallback(fromLookup);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: inquiryTakenByIdResolved })
      .then((providerRecord) => {
        if (cancelled) return;
        setInquiryTakenByFallback(providerRecord || null);
      })
      .catch(() => {
        if (cancelled) return;
        setInquiryTakenByFallback(null);
      });

    return () => {
      cancelled = true;
    };
  }, [inquiryTakenByIdResolved, inquiryTakenByLookup, isSdkReady, plugin]);

  useEffect(() => {
    const currentId = toText(serviceProviderIdResolved);
    setSelectedServiceProviderId(currentId);
    setServiceProviderSearch(currentId ? serviceProviderPrefillLabel : "");
  }, [serviceProviderIdResolved, serviceProviderPrefillLabel]);

  useEffect(() => {
    const quoteJobId = toText(quoteJobIdFromRecord);
    const inquiryId = toText(inquiryNumericId);
    if (!plugin?.switchTo || !/^\d+$/.test(quoteJobId) || !inquiryId) {
      setIsQuoteJobDirectlyLinked(false);
      return;
    }

    let cancelled = false;
    fetchJobInquiryRecordIdById({ plugin, jobId: quoteJobId })
      .then((jobInquiryId) => {
        if (cancelled) return;
        setIsQuoteJobDirectlyLinked(toText(jobInquiryId) === inquiryId);
      })
      .catch((linkError) => {
        if (cancelled) return;
        console.warn("[InquiryDetails] Failed verifying quote/job association", linkError);
        setIsQuoteJobDirectlyLinked(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inquiryNumericId, plugin, quoteJobIdFromRecord]);

  useEffect(() => {
    setLinkedJobSelectionOverride(undefined);
  }, [linkedInquiryJobIdFromRecord, safeUid]);

  useEffect(() => {
    setRelatedJobIdByUid({});
  }, [safeUid]);

  useEffect(() => {
    if (!plugin || !Array.isArray(relatedJobs) || !relatedJobs.length) return;
    const unresolvedUids = relatedJobs
      .map((job) => ({
        id: toText(job?.id || job?.ID),
        uid: toText(job?.unique_id || job?.Unique_ID),
      }))
      .filter((row) => !row.id && row.uid && !toText(relatedJobIdByUid[row.uid]));
    if (!unresolvedUids.length) return;

    let cancelled = false;
    Promise.all(
      unresolvedUids.map(async (row) => ({
        uid: row.uid,
        id: await fetchJobIdByUniqueId({ plugin, uniqueId: row.uid }),
      }))
    )
      .then((resolvedRows) => {
        if (cancelled) return;
        setRelatedJobIdByUid((previous) => {
          const next = { ...previous };
          let changed = false;
          resolvedRows.forEach(({ uid, id }) => {
            const normalizedUid = toText(uid);
            const normalizedId = toText(id);
            if (!normalizedUid || !normalizedId || toText(next[normalizedUid]) === normalizedId) return;
            next[normalizedUid] = normalizedId;
            changed = true;
          });
          return changed ? next : previous;
        });
      })
      .catch((resolveError) => {
        if (cancelled) return;
        console.warn("[InquiryDetails] Failed resolving related job ids", resolveError);
      });

    return () => {
      cancelled = true;
    };
  }, [plugin, relatedJobIdByUid, relatedJobs]);

  useEffect(() => {
    const currentId = toText(
      inquiryTakenBySelectedLookupRecord?.id ||
        inquiryTakenByFallbackRecord?.id ||
        inquiryTakenByIdResolved
    );
    setSelectedInquiryTakenById(currentId);
    setInquiryTakenBySearch(currentId ? inquiryTakenByPrefillLabel : "");
  }, [
    inquiryTakenByFallbackRecord?.id,
    inquiryTakenByIdResolved,
    inquiryTakenByPrefillLabel,
    inquiryTakenBySelectedLookupRecord?.id,
  ]);

  const refreshResolvedInquiry = useCallback(async () => {
    if (!plugin || !inquiryNumericId) return;
    const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
    if (refreshed) {
      setResolvedInquiry(refreshed);
    }
  }, [inquiryNumericId, plugin]);

  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [hasMemoContext, inquiryNumericId, isSdkReady, plugin]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      setIsMemosLoading(false);
      setMemosError("");
      return undefined;
    }

    setIsMemosLoading(true);
    setMemosError("");

    fetchMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
    })
      .then((rows) => {
        if (cancelled) return;
        setMemos(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to load memos", loadError);
        setMemos([]);
        setMemosError(loadError?.message || "Unable to load memos.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsMemosLoading(false);
      });

    const unsubscribeMemos = subscribeMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
      onChange: (rows) => {
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
        setIsMemosLoading(false);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Memo subscription failed", streamError);
        setMemosError((previous) => previous || "Live memo updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeMemos?.();
    };
  }, [hasMemoContext, inquiryNumericId, isSdkReady, plugin]);

  useEffect(() => {
    setOptimisticListSelectionByField({});
    setRemovingListTagKeys({});
    listSelectionDesiredRef.current = {};
    listSelectionSyncingRef.current = {};
  }, [inquiryNumericId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    if (!inquiryNumericId) return;
    if (!configuredAdminProviderId) return;
    if (inquiryTakenByStoredId) return;

    const marker = `${inquiryNumericId}:${configuredAdminProviderId}`;
    if (inquiryTakenByAutofillRef.current.has(marker)) return;
    inquiryTakenByAutofillRef.current.add(marker);

    let cancelled = false;
    updateInquiryFieldsById({
      plugin,
      inquiryId: inquiryNumericId,
      payload: {
        Inquiry_Taken_By_id: configuredAdminProviderId,
      },
    })
      .then(async () => {
        if (cancelled) return;
        const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
        if (cancelled || !refreshed) return;
        setResolvedInquiry(refreshed);
      })
      .catch((autoAssignError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to auto-set inquiry taken by", autoAssignError);
      });

    return () => {
      cancelled = true;
    };
  }, [
    configuredAdminProviderId,
    inquiryNumericId,
    inquiryTakenByStoredId,
    isSdkReady,
    plugin,
  ]);

  const openContactDetailsModal = useCallback(
    ({
      mode = "individual",
      onSave = null,
      onModeChange = null,
      allowModeSwitch = false,
      titleVerb = "Add",
      initialValues = null,
    } = {}) => {
      setContactModalState({
        open: true,
        mode,
        onSave: typeof onSave === "function" ? onSave : null,
        onModeChange: typeof onModeChange === "function" ? onModeChange : null,
        allowModeSwitch: Boolean(allowModeSwitch),
        titleVerb: toText(titleVerb) || "Add",
        initialValues:
          initialValues && typeof initialValues === "object" ? { ...initialValues } : null,
      });
    },
    []
  );

  const closeContactDetailsModal = useCallback(() => {
    setContactModalState((previous) => ({
      ...previous,
      open: false,
    }));
  }, []);

  const handlePropertySearchQueryChange = useCallback(
    async (query) => {
      const normalizedQuery = toText(query);
      if (!plugin || normalizedQuery.length < 2) return [];
      try {
        const records = await searchPropertiesForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (normalizedRecords.length) {
          setPropertyLookupRecords((previous) =>
            mergePropertyCollectionsIfChanged(previous, normalizedRecords)
          );
        }
        return normalizedRecords;
      } catch (lookupError) {
        console.error("[InquiryDetails] Property lookup search failed", lookupError);
        return [];
      }
    },
    [plugin]
  );

  const handlePropertySearchValueChange = useCallback((value) => {
    propertySearchManualEditRef.current = true;
    setPropertySearchQuery(value);
  }, []);

  const handleSelectPropertyFromSearch = useCallback((item = {}) => {
    const nextId = normalizePropertyId(item?.id);
    if (!nextId) return;
    propertySearchManualEditRef.current = false;
    setSelectedPropertyId(nextId);
    setPropertySearchQuery(toText(item?.label));
  }, []);

  const closePropertyModal = useCallback(() => {
    setPropertyModalState({ open: false, initialData: null });
  }, []);

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

  const handleSaveProperty = useCallback(
    async (draftProperty) => {
      const initialPropertyId = normalizePropertyId(propertyModalState?.initialData?.id);
      const savedProperty = await savePropertyRecord({ draftProperty, initialPropertyId });
      const resolvedSavedId = normalizePropertyId(
        savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          ""
      );
      const hydratedSavedProperty = resolvedSavedId
        ? await fetchPropertyRecordById({ plugin, propertyId: resolvedSavedId }).catch(() => null)
        : null;
      const normalizedSavedProperty = normalizePropertyLookupRecord({
        ...(propertyModalState?.initialData || {}),
        ...(draftProperty || {}),
        ...(savedProperty || {}),
        ...(hydratedSavedProperty || {}),
        id:
          resolvedSavedId ||
          savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          "",
      });
      const nextId = normalizePropertyId(normalizedSavedProperty?.id);
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, [normalizedSavedProperty])
      );
      setLinkedProperties((previous) => {
        const existing = Array.isArray(previous) ? previous : [];
        return mergePropertyCollectionsIfChanged(existing, [normalizedSavedProperty]);
      });
      if (nextId) setSelectedPropertyId(nextId);
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(resolvePropertyLookupLabel(normalizedSavedProperty));
      success(
        initialPropertyId ? "Property updated" : "Property saved",
        initialPropertyId
          ? "Property details were updated."
          : "Property was saved successfully."
      );
    },
    [plugin, propertyModalState?.initialData, savePropertyRecord, success]
  );

  const handleOpenAddPropertyModal = useCallback(() => {
    setPropertyModalState({
      open: true,
      initialData: null,
    });
  }, []);

  const handleOpenEditPropertyModal = useCallback(
    (propertyRecord = null) => {
      const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
      const selectedFromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const selectedFromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const editableProperty = normalizePropertyLookupRecord({
        ...(activeRelatedProperty || {}),
        ...(selectedFromLinked || {}),
        ...(selectedFromLookup || {}),
        ...(propertyRecord || {}),
      });
      setPropertyModalState({
        open: true,
        initialData: editableProperty,
      });
    },
    [activeRelatedProperty, linkedPropertiesSorted, propertyLookupRecords]
  );

  const handleSameAsContactPropertyChange = useCallback(
    async (checked) => {
      setIsPropertySameAsContact(Boolean(checked));
      if (!checked) return;

      if (!plugin || !inquiryNumericId) {
        setIsPropertySameAsContact(false);
        error("Property link failed", "Inquiry context is not ready.");
        return;
      }

      const sourceAddress = toText(sameAsContactPropertySource?.address1);
      const sourceSuburb = toText(sameAsContactPropertySource?.suburbTown);
      const sourceState = toText(sameAsContactPropertySource?.state);
      const sourcePostal = toText(sameAsContactPropertySource?.postalCode);
      const concatenatedSourceAddress = toText(
        sameAsContactPropertySource?.searchText ||
          joinAddress([sourceAddress, sourceSuburb, sourceState, sourcePostal])
      );
      const googleResolvedAddress = await resolveAddressFromGoogleLookup(concatenatedSourceAddress);
      const derivedPropertyName = toText(
        googleResolvedAddress?.formatted_address ||
          sameAsContactPropertySource?.propertyName ||
          concatenatedSourceAddress
      );
      const derivedAddress1 = toText(
        googleResolvedAddress?.address || sourceAddress || concatenatedSourceAddress
      );
      const derivedSuburb = toText(googleResolvedAddress?.city || sourceSuburb);
      const derivedState = toText(googleResolvedAddress?.state || sourceState);
      const derivedPostal = toText(googleResolvedAddress?.zip_code || sourcePostal);
      const derivedCountry = toText(googleResolvedAddress?.country || "AU") || "AU";
      const derivedLot = toText(googleResolvedAddress?.lot_number);
      const derivedUnit = toText(googleResolvedAddress?.unit_number);
      const searchText = toText(
        googleResolvedAddress?.formatted_address ||
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) ||
          concatenatedSourceAddress
      );

      if (!derivedAddress1 && !searchText) {
        setIsPropertySameAsContact(false);
        error(
          "Property link failed",
          "No address is available on the current account to create a property."
        );
        return;
      }

      setIsApplyingSameAsContactProperty(true);
      try {
        const searchedRecords = await searchPropertiesForLookup({
          plugin,
          query: searchText,
          limit: 25,
        });
        const normalizedSearchedRecords = dedupePropertyLookupRecords(searchedRecords || []);
        const targetComparableAddress = normalizeAddressText(
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) || searchText
        );
        const matchedExistingProperty =
          normalizedSearchedRecords.find(
            (record) => buildComparablePropertyAddress(record) === targetComparableAddress
          ) ||
          normalizedSearchedRecords.find((record) => {
            const comparable = buildComparablePropertyAddress(record);
            return Boolean(comparable && targetComparableAddress && comparable.includes(targetComparableAddress));
          }) ||
          null;

        let resolvedProperty = matchedExistingProperty;
        if (!resolvedProperty) {
          const createdProperty = await createPropertyRecord({
            plugin,
            payload: {
              property_name: derivedPropertyName || searchText,
              lot_number: derivedLot,
              unit_number: derivedUnit,
              address_1: derivedAddress1 || searchText,
              suburb_town: derivedSuburb,
              state: derivedState,
              postal_code: derivedPostal,
              country: derivedCountry,
            },
          });
          resolvedProperty = normalizePropertyLookupRecord(createdProperty || {});
        }

        const resolvedPropertyId = normalizePropertyId(
          resolvedProperty?.id || resolvedProperty?.ID || resolvedProperty?.Property_ID
        );
        if (!resolvedPropertyId) {
          throw new Error("Unable to resolve a property ID.");
        }

        const hydratedProperty = await fetchPropertyRecordById({
          plugin,
          propertyId: resolvedPropertyId,
        }).catch(() => null);

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            property_id: resolvedPropertyId,
            Property_ID: resolvedPropertyId,
          },
        });

        const normalizedResolvedProperty = normalizePropertyLookupRecord({
          ...(hydratedProperty || {}),
          ...resolvedProperty,
          id: resolvedPropertyId,
          address_1:
            toText(hydratedProperty?.address_1 || hydratedProperty?.address) ||
            toText(resolvedProperty?.address_1 || resolvedProperty?.address) ||
            derivedAddress1,
          suburb_town:
            toText(hydratedProperty?.suburb_town || hydratedProperty?.city) ||
            toText(resolvedProperty?.suburb_town || resolvedProperty?.city) ||
            derivedSuburb,
          state:
            toText(hydratedProperty?.state) ||
            toText(resolvedProperty?.state) ||
            derivedState,
          postal_code:
            toText(hydratedProperty?.postal_code || hydratedProperty?.zip_code) ||
            toText(resolvedProperty?.postal_code || resolvedProperty?.zip_code) ||
            derivedPostal,
          property_name:
            toText(hydratedProperty?.property_name) ||
            toText(resolvedProperty?.property_name) ||
            derivedPropertyName,
        });
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedResolvedProperty])
        );
        setLinkedProperties((previous) => {
          const existing = Array.isArray(previous) ? previous : [];
          return mergePropertyCollectionsIfChanged(existing, [normalizedResolvedProperty]);
        });
        setSelectedPropertyId(resolvedPropertyId);
        propertySearchManualEditRef.current = false;
        setPropertySearchQuery(
          toText(normalizedResolvedProperty?.property_name) ||
            resolvePropertyLookupLabel(normalizedResolvedProperty)
        );

        await refreshResolvedInquiry();
        success(
          "Property linked",
          matchedExistingProperty
            ? "Matched existing property by address and linked it to inquiry."
            : "Created property from account address and linked it to inquiry."
        );
      } catch (saveError) {
        console.error("[InquiryDetails] Failed same-as-contact property flow", saveError);
        setIsPropertySameAsContact(false);
        error("Property link failed", saveError?.message || "Unable to link property.");
      } finally {
        setIsApplyingSameAsContactProperty(false);
      }
    },
    [
      error,
      inquiryNumericId,
      plugin,
      refreshResolvedInquiry,
      sameAsContactPropertySource,
      success,
    ]
  );

  const handleOpenCreateAppointmentModal = useCallback(() => {
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsAppointmentModalOpen(true);
  }, []);

  const handleOpenEditAppointmentModal = useCallback((record = {}, draftState = null) => {
    const appointmentId = toText(record?.id || record?.ID);
    if (!appointmentId) return;
    setAppointmentModalMode("update");
    setAppointmentModalEditingId(appointmentId);
    setAppointmentModalDraft(draftState && typeof draftState === "object" ? draftState : null);
    setIsAppointmentModalOpen(true);
  }, []);

  const closeAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
  }, []);

  const handleOpenUploadModal = useCallback(() => {
    setIsUploadsModalOpen(true);
  }, []);

  const closeUploadsModal = useCallback(() => {
    setIsUploadsModalOpen(false);
  }, []);

  const handleNewInquiry = () => {
    navigate("/inquiry-direct/new");
  };

  const handleEditInquiry = () => {
    if (!hasUid) return;
    navigate(`/inquiry-direct/${encodeURIComponent(safeUid)}`);
  };

  const handleCreateCallback = useCallback(async () => {
    if (isCreatingCallback) return;
    if (!plugin || !inquiryNumericId) {
      error("Create callback failed", "Inquiry context is not ready.");
      return;
    }
    setIsCreatingCallback(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          call_back: true,
        },
      });
      await refreshResolvedInquiry();
      success("Callback created", "Callback request was marked on this inquiry.");
    } catch (saveError) {
      console.error("[InquiryDetails] Failed creating callback", saveError);
      error("Create callback failed", saveError?.message || "Unable to create callback.");
    } finally {
      setIsCreatingCallback(false);
    }
  }, [error, inquiryNumericId, isCreatingCallback, plugin, refreshResolvedInquiry, success]);

  const handleOpenCreateQuoteModal = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setQuoteCreateDraft({
      quote_date: `${year}-${month}-${day}`,
      follow_up_date: "",
    });
    setIsCreateQuoteModalOpen(true);
  }, []);

  const hasLinkedQuoteJob =
    isQuoteJobDirectlyLinked && toText(inquiryStatus).toLowerCase() === "quote created";

  const handleQuoteJobAction = useCallback(async () => {
    if (isCreatingQuote || isOpeningQuoteJob) return;
    if (!hasLinkedQuoteJob) {
      handleOpenCreateQuoteModal();
      return;
    }
    const linkedJobValue = toText(quoteJobIdFromRecord);
    if (!linkedJobValue) {
      handleOpenCreateQuoteModal();
      return;
    }

    setIsOpeningQuoteJob(true);
    try {
      let targetUid = "";
      if (plugin?.switchTo) {
        targetUid = await fetchJobUniqueIdById({ plugin, jobId: linkedJobValue });
      }
      const resolvedUid = toText(targetUid || linkedJobValue);
      if (!resolvedUid) {
        error("Open failed", "Unable to resolve quote/job record.");
        return;
      }
      navigate(`/details/${encodeURIComponent(resolvedUid)}`);
    } catch (openError) {
      console.error("[InquiryDetails] Failed opening quote/job details", openError);
      error("Open failed", openError?.message || "Unable to open quote/job.");
    } finally {
      setIsOpeningQuoteJob(false);
    }
  }, [
    error,
    handleOpenCreateQuoteModal,
    hasLinkedQuoteJob,
    inquiryStatus,
    isCreatingQuote,
    isQuoteJobDirectlyLinked,
    isOpeningQuoteJob,
    quoteJobIdFromRecord,
    navigate,
    plugin,
  ]);

  const handleCloseCreateQuoteModal = useCallback(() => {
    if (isCreatingQuote) return;
    setIsCreateQuoteModalOpen(false);
  }, [isCreatingQuote]);

  const handleConfirmCreateQuote = useCallback(async () => {
    if (isCreatingQuote) return;
    if (!plugin || !inquiryNumericId) {
      error("Create failed", "Inquiry context is not ready.");
      return;
    }

    const providerId = toText(serviceProviderIdResolved || selectedServiceProviderId);
    const inquiryTakenById = toText(
      selectedInquiryTakenById || inquiryTakenByStoredId || inquiryTakenByIdResolved
    );

    const propertyId = normalizePropertyId(activeRelatedProperty?.id || inquiryPropertyId);

    setIsCreatingQuote(true);
    setIsCreateQuoteModalOpen(false);
    try {
      const inquiryPayload = {
        ...(inquiry || {}),
        id: inquiryNumericId,
        ID: inquiryNumericId,
        property_id: propertyId || null,
        Property_ID: propertyId || null,
      };
      if (providerId) {
        inquiryPayload.service_provider_id = providerId;
        inquiryPayload.Service_Provider_ID = providerId;
      }
      const createdJob = await createLinkedJobForInquiry({
        plugin,
        inquiry: inquiryPayload,
        serviceProviderId: providerId || null,
        inquiryTakenById: inquiryTakenById || null,
        quoteDate: quoteCreateDraft.quote_date,
        followUpDate: quoteCreateDraft.follow_up_date,
      });
      await refreshResolvedInquiry();
      setRelatedRecordsRefreshKey((previous) => previous + 1);
      success(
        "Quote created",
        `Quote ${toText(createdJob?.unique_id || createdJob?.Unique_ID) || ""} created.`
      );
    } catch (createError) {
      console.error("[InquiryDetails] Create quote failed", createError);
      error("Create failed", createError?.message || "Unable to create quote.");
    } finally {
      setIsCreatingQuote(false);
    }
  }, [
    activeRelatedProperty?.id,
    error,
    inquiry,
    inquiryNumericId,
    inquiryPropertyId,
    isCreatingQuote,
    plugin,
    quoteCreateDraft.follow_up_date,
    quoteCreateDraft.quote_date,
    refreshResolvedInquiry,
    selectedInquiryTakenById,
    selectedServiceProviderId,
    serviceProviderIdResolved,
    inquiryTakenByStoredId,
    inquiryTakenByIdResolved,
    success,
  ]);

  const handleMemoFileChange = useCallback((event) => {
    const nextFile = Array.from(event?.target?.files || [])[0] || null;
    setMemoFile(nextFile);
    if (event?.target) event.target.value = "";
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      error("Post failed", "No linked inquiry found for memos.");
      return;
    }
    if (!text && !memoFile) {
      error("Post failed", "Enter a message or attach a file.");
      return;
    }
    if (isPostingMemo) return;

    setIsPostingMemo(true);
    try {
      let memoFilePayload = "";
      if (memoFile) {
        const uploaded = await uploadMaterialFile({
          file: memoFile,
          uploadPath: `forum-memos/${inquiryNumericId || safeUid || "inquiry-details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      await createMemoPostForDetails({
        plugin,
        payload: {
          post_copy: text,
          post_status: "Published",
          related_inquiry_id: inquiryNumericId || null,
          related_job_id: linkedInquiryJobIdFromRecord || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      success("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[InquiryDetails] Failed posting memo", postError);
      error("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    error,
    hasMemoContext,
    inquiryNumericId,
    isPostingMemo,
    memoFile,
    memoText,
    plugin,
    refreshMemos,
    safeUid,
    linkedInquiryJobIdFromRecord,
    success,
  ]);

  const handleSendMemoReply = useCallback(
    async (postId) => {
      const normalizedPostId = toText(postId);
      const text = toText(memoReplyDrafts?.[normalizedPostId]);
      if (!normalizedPostId || !text) return;
      if (sendingReplyPostId) return;

      setSendingReplyPostId(normalizedPostId);
      try {
        await createMemoCommentForDetails({
          plugin,
          payload: {
            forum_post_id: normalizedPostId,
            comment: text,
            comment_status: "Published",
            created_at: Math.floor(Date.now() / 1000),
          },
        });
        setMemoReplyDrafts((previous) => ({
          ...(previous || {}),
          [normalizedPostId]: "",
        }));
        await refreshMemos();
        success("Reply posted", "Your reply was added.");
      } catch (replyError) {
        console.error("[InquiryDetails] Failed posting memo reply", replyError);
        error("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [error, memoReplyDrafts, plugin, refreshMemos, sendingReplyPostId, success]
  );

  const confirmDeleteMemoItem = useCallback(async () => {
    if (!memoDeleteTarget || isDeletingMemoItem) return;
    const deleteType = toText(memoDeleteTarget?.type);
    const targetId = toText(memoDeleteTarget?.id);
    if (!deleteType || !targetId) return;

    setIsDeletingMemoItem(true);
    try {
      if (deleteType === "post") {
        await deleteMemoPostForDetails({ plugin, postId: targetId });
      } else {
        await deleteMemoCommentForDetails({ plugin, commentId: targetId });
      }
      setMemoDeleteTarget(null);
      await refreshMemos();
      success("Deleted", deleteType === "post" ? "Memo deleted." : "Reply deleted.");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed deleting memo item", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [error, isDeletingMemoItem, memoDeleteTarget, plugin, refreshMemos, success]);

  const handleSavePopupComments = useCallback(async () => {
    if (isSavingPopupComment) return;

    const nextContactComment = toText(popupCommentDrafts?.contact);
    const nextCompanyComment = toText(popupCommentDrafts?.company);
    const contactChanged = nextContactComment !== contactPopupComment;
    const companyChanged = nextCompanyComment !== companyPopupComment;

    if (!contactChanged && !companyChanged) {
      setIsPopupCommentModalOpen(false);
      return;
    }

    try {
      setIsSavingPopupComment(true);

      if (contactChanged) {
        if (!inquiryContactId) {
          throw new Error("Primary contact is missing.");
        }
        await updateContactFieldsById({
          plugin,
          contactId: inquiryContactId,
          payload: {
            popup_comment: nextContactComment || null,
          },
        });
      }

      if (companyChanged) {
        if (!inquiryCompanyId) {
          throw new Error("Company is missing.");
        }
        await updateCompanyFieldsById({
          plugin,
          companyId: inquiryCompanyId,
          payload: {
            popup_comment: nextCompanyComment || null,
          },
        });
      }

      success("Saved", "Popup comment updated.");
      setIsPopupCommentModalOpen(false);
      await refreshResolvedInquiry();
    } catch (saveError) {
      console.error("[InquiryDetails] Popup comment save failed", saveError);
      error("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally {
      setIsSavingPopupComment(false);
    }
  }, [
    companyPopupComment,
    contactPopupComment,
    error,
    inquiryCompanyId,
    inquiryContactId,
    isSavingPopupComment,
    plugin,
    popupCommentDrafts,
    refreshResolvedInquiry,
    success,
  ]);

  const handleDeleteRecord = useCallback(() => {
    setIsMoreOpen(false);
    setIsDeleteRecordModalOpen(true);
  }, []);

  const handleCloseDeleteRecordModal = useCallback(() => {
    if (isDeletingRecord) return;
    setIsDeleteRecordModalOpen(false);
  }, [isDeletingRecord]);

  const handleConfirmDeleteRecord = useCallback(async () => {
    if (isDeletingRecord) return;
    if (!plugin || !inquiryNumericId) {
      error("Delete failed", "Inquiry context is not ready.");
      return;
    }

    setIsDeletingRecord(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          inquiry_status: "Cancelled",
        },
      });
      success("Record cancelled", "Inquiry status was updated to Cancelled.");
      setIsDeleteRecordModalOpen(false);
      navigate("/");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed cancelling inquiry", deleteError);
      error("Delete failed", deleteError?.message || "Unable to cancel inquiry.");
    } finally {
      setIsDeletingRecord(false);
    }
  }, [error, inquiryNumericId, isDeletingRecord, navigate, plugin, success]);

  const handleConfirmServiceProviderAllocation = useCallback(async () => {
    if (isAllocatingServiceProvider) return;
    if (!plugin || !inquiryNumericId) {
      error("Allocation failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = toText(selectedServiceProviderId);
    if (!providerId) {
      error("Allocation failed", "Select a service provider first.");
      return;
    }

    setIsAllocatingServiceProvider(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          service_provider_id: providerId,
          Service_Provider_ID: providerId,
        },
      });
      await refreshResolvedInquiry();
      success("Service provider allocated", "Deal was updated with selected service provider.");
    } catch (allocationError) {
      console.error("[InquiryDetails] Service provider allocation failed", allocationError);
      error("Allocation failed", allocationError?.message || "Unable to allocate service provider.");
    } finally {
      setIsAllocatingServiceProvider(false);
    }
  }, [
    error,
    inquiryNumericId,
    isAllocatingServiceProvider,
    plugin,
    refreshResolvedInquiry,
    selectedServiceProviderId,
    success,
  ]);

  const handleConfirmInquiryTakenBy = useCallback(async () => {
    if (isSavingInquiryTakenBy) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = toText(selectedInquiryTakenById);
    if (!providerId) {
      error("Save failed", "Select admin first.");
      return;
    }

    setIsSavingInquiryTakenBy(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          Inquiry_Taken_By_id: providerId,
        },
      });
      await refreshResolvedInquiry();
      success("Inquiry taken by updated", "Inquiry was updated with selected admin.");
    } catch (saveError) {
      console.error("[InquiryDetails] Inquiry taken by update failed", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry taken by.");
    } finally {
      setIsSavingInquiryTakenBy(false);
    }
  }, [
    error,
    inquiryNumericId,
    isSavingInquiryTakenBy,
    plugin,
    refreshResolvedInquiry,
    selectedInquiryTakenById,
    success,
  ]);

  const handleOpenInquiryDetailsEditor = useCallback(() => {
    setInquiryDetailsForm({
      ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
      ...(inquiryDetailsInitialForm || {}),
    });
    setIsInquiryDetailsModalOpen(true);
  }, [inquiryDetailsInitialForm]);

  const handleCloseInquiryDetailsEditor = useCallback(() => {
    if (isSavingInquiryDetails) return;
    setIsInquiryDetailsModalOpen(false);
  }, [isSavingInquiryDetails]);

  const handleSaveInquiryDetails = useCallback(async () => {
    if (isSavingInquiryDetails) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }

    const normalizedServiceInquiryId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    const payload = {
      inquiry_status: toNullableText(inquiryDetailsForm.inquiry_status),
      inquiry_source: toNullableText(inquiryDetailsForm.inquiry_source),
      type: toNullableText(inquiryDetailsForm.type),
      service_inquiry_id: normalizedServiceInquiryId
        ? /^\d+$/.test(normalizedServiceInquiryId)
          ? Number.parseInt(normalizedServiceInquiryId, 10)
          : normalizedServiceInquiryId
        : null,
      how_can_we_help: toNullableText(inquiryDetailsForm.how_can_we_help),
      how_did_you_hear: toNullableText(inquiryDetailsForm.how_did_you_hear),
      other: toNullableText(inquiryDetailsForm.other),
      admin_notes: toNullableText(inquiryDetailsForm.admin_notes),
      client_notes: toNullableText(inquiryDetailsForm.client_notes),
      date_job_required_by: toUnixSeconds(inquiryDetailsForm.date_job_required_by),
      renovations: toNullableText(inquiryDetailsForm.renovations),
      resident_availability: toNullableText(inquiryDetailsForm.resident_availability),
      noise_signs_options_as_text: toNullableText(inquiryDetailsForm.noise_signs_options_as_text),
      pest_active_times_options_as_text: toNullableText(
        inquiryDetailsForm.pest_active_times_options_as_text
      ),
      pest_location_options_as_text: toNullableText(inquiryDetailsForm.pest_location_options_as_text),
    };

    setIsSavingInquiryDetails(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload,
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Inquiry details were updated.");
      setIsInquiryDetailsModalOpen(false);
    } catch (saveError) {
      console.error("[InquiryDetails] Failed to update inquiry details", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry details.");
    } finally {
      setIsSavingInquiryDetails(false);
    }
  }, [
    error,
    inquiryDetailsForm.admin_notes,
    inquiryDetailsForm.client_notes,
    inquiryDetailsForm.date_job_required_by,
    inquiryDetailsForm.how_can_we_help,
    inquiryDetailsForm.how_did_you_hear,
    inquiryDetailsForm.inquiry_source,
    inquiryDetailsForm.inquiry_status,
    inquiryDetailsForm.noise_signs_options_as_text,
    inquiryDetailsForm.other,
    inquiryDetailsForm.pest_active_times_options_as_text,
    inquiryDetailsForm.pest_location_options_as_text,
    inquiryDetailsForm.renovations,
    inquiryDetailsForm.resident_availability,
    inquiryDetailsForm.service_inquiry_id,
    inquiryDetailsForm.type,
    inquiryNumericId,
    isSavingInquiryDetails,
    plugin,
    refreshResolvedInquiry,
    success,
  ]);

  const flushQuickListSelectionField = useCallback(
    async (field) => {
      const normalizedField = toText(field);
      if (!normalizedField || !plugin || !inquiryNumericId) return;
      if (listSelectionSyncingRef.current[normalizedField]) return;

      listSelectionSyncingRef.current[normalizedField] = true;
      let lastSyncedSignature = "";
      let didFail = false;
      try {
        while (true) {
          const desiredCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? [...listSelectionDesiredRef.current[normalizedField]]
            : [];
          const desiredSignature = desiredCodes.join("|");
          lastSyncedSignature = desiredSignature;
          await updateInquiryFieldsById({
            plugin,
            inquiryId: inquiryNumericId,
            payload: {
              [normalizedField]: serializeListSelectionValue(desiredCodes),
            },
          });
          const latestCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? listSelectionDesiredRef.current[normalizedField]
            : [];
          if (latestCodes.join("|") === desiredSignature) break;
        }

        await refreshResolvedInquiry();
      } catch (removeError) {
        didFail = true;
        console.error("[InquiryDetails] Failed to remove list selection tag", removeError);
        error("Update failed", removeError?.message || "Unable to remove selection.");
        try {
          await refreshResolvedInquiry();
        } catch (refreshError) {
          console.error("[InquiryDetails] Failed refreshing inquiry after list tag failure", refreshError);
        }
      } finally {
        listSelectionSyncingRef.current[normalizedField] = false;

        const desiredNow = Array.isArray(listSelectionDesiredRef.current[normalizedField])
          ? listSelectionDesiredRef.current[normalizedField].join("|")
          : "";
        const shouldClearFieldState = didFail || desiredNow === lastSyncedSignature;

        if (shouldClearFieldState) {
          delete listSelectionDesiredRef.current[normalizedField];
          setOptimisticListSelectionByField((previous) => {
            if (!(normalizedField in previous)) return previous;
            const next = { ...previous };
            delete next[normalizedField];
            return next;
          });
          setRemovingListTagKeys((previous) => {
            const nextEntries = Object.entries(previous).filter(
              ([key]) => !key.startsWith(`${normalizedField}:`)
            );
            if (nextEntries.length === Object.keys(previous).length) return previous;
            return Object.fromEntries(nextEntries);
          });
        } else {
          void flushQuickListSelectionField(normalizedField);
        }
      }
    },
    [error, inquiryNumericId, plugin, refreshResolvedInquiry]
  );

  const handleQuickRemoveListSelectionTag = useCallback(
    ({ field, rawValue, options, tag }) => {
      if (!plugin || !inquiryNumericId) {
        error("Update failed", "Inquiry context is not ready.");
        return;
      }
      const normalizedField = toText(field);
      if (!normalizedField) return;

      const tagCode = toText(tag?.code || tag?.key);
      const tagLabel = toText(tag?.label || tagCode) || "value";
      const optimisticCodes = optimisticListSelectionByField[normalizedField];
      const currentCodes = Array.isArray(optimisticCodes)
        ? optimisticCodes
        : parseListSelectionValue(rawValue, options);
      const nextCodes = tagCode
        ? currentCodes.filter((code) => toText(code) !== tagCode)
        : [];
      if (tagCode && nextCodes.length === currentCodes.length) return;

      listSelectionDesiredRef.current[normalizedField] = nextCodes;
      setOptimisticListSelectionByField((previous) => ({
        ...previous,
        [normalizedField]: nextCodes,
      }));
      setRemovingListTagKeys((previous) => ({
        ...previous,
        [`${normalizedField}:${tagCode || tagLabel}`]: true,
      }));

      void flushQuickListSelectionField(normalizedField);
    },
    [
      error,
      flushQuickListSelectionField,
      inquiryNumericId,
      optimisticListSelectionByField,
      plugin,
    ]
  );

  const isListSelectionTagRemoving = useCallback(
    (field, tag) =>
      Boolean(
        removingListTagKeys[`${toText(field)}:${toText(tag?.code || tag?.key || tag?.label)}`]
      ),
    [removingListTagKeys]
  );

  const handleOpenAccountEditor = useCallback(() => {
    if (!plugin || !inquiryNumericId) return;
    const currentMode = isCompanyAccount ? "entity" : "individual";

    const handleSaveAccount = async (draftRecord, context = {}) => {
      const mode = toText(context?.mode || currentMode).toLowerCase() === "entity"
        ? "entity"
        : "individual";

      if (mode === "entity") {
        const companyName = toText(draftRecord?.name);
        if (!companyName) {
          throw new Error("Company name is required.");
        }
        const companyPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          name: companyName,
        };
        delete companyPayload.primary_contact_id;
        delete companyPayload.Primary_Contact_ID;
        if (companyPayload?.Primary_Person && typeof companyPayload.Primary_Person === "object") {
          const compactPrimaryPerson = compactStringFields(companyPayload.Primary_Person);
          if (Object.keys(compactPrimaryPerson).length) {
            companyPayload.Primary_Person = compactPrimaryPerson;
          } else {
            delete companyPayload.Primary_Person;
          }
        }
        const existingCompanyId = toText(
          companyPayload?.id || companyPayload?.ID || companyPayload?.Company_ID
        );

        let companyId = existingCompanyId;
        if (existingCompanyId) {
          await updateCompanyFieldsById({
            plugin,
            companyId: existingCompanyId,
            payload: companyPayload,
          });
        } else {
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          companyId = toText(createdCompany?.id || createdCompany?.ID);
        }
        if (!companyId) {
          throw new Error("Unable to resolve company ID.");
        }
        const preservedPrimaryContactId = toText(
          inquiryPrimaryContact?.id ||
            inquiry?.primary_contact_id ||
            inquiry?.Primary_Contact_ID
        );

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            account_type: "Company",
            Account_Type: "Company",
            company_id: companyId,
            Company_ID: companyId,
            primary_contact_id: preservedPrimaryContactId || null,
            Primary_Contact_ID: preservedPrimaryContactId || null,
          },
        });
        await refreshResolvedInquiry();
        success("Inquiry updated", "Company account was linked and inquiry contact was preserved.");
        return;
      }

      const existingContactId = toText(
        draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
      );
      const savedContact = existingContactId
        ? await updateContactRecord({
            plugin,
            id: existingContactId,
            payload: draftRecord || {},
          })
        : await createContactRecord({
            plugin,
            payload: draftRecord || {},
          });
      const contactId = toText(savedContact?.id || savedContact?.ID || existingContactId);
      if (!contactId) {
        throw new Error("Unable to resolve contact ID.");
      }

      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          account_type: "Contact",
          Account_Type: "Contact",
          primary_contact_id: contactId,
          Primary_Contact_ID: contactId,
          company_id: toText(inquiryCompany?.id) || null,
          Company_ID: toText(inquiryCompany?.id) || null,
        },
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Contact account was linked and company was preserved.");
    };

    openContactDetailsModal({
      mode: currentMode,
      onSave: handleSaveAccount,
      allowModeSwitch: true,
      titleVerb: "Update",
      initialValues:
        currentMode === "entity"
          ? accountEditorCompanyInitialValues
          : accountEditorContactInitialValues,
      onModeChange: (nextMode) => {
        const normalizedMode = toText(nextMode).toLowerCase() === "entity" ? "entity" : "individual";
        setContactModalState((previous) => ({
          ...previous,
          mode: normalizedMode,
          initialValues:
            normalizedMode === "entity"
              ? accountEditorCompanyInitialValues
              : accountEditorContactInitialValues,
        }));
      },
    });
  }, [
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    inquiryNumericId,
    inquiryCompany,
    inquiryPrimaryContact,
    isCompanyAccount,
    openContactDetailsModal,
    plugin,
    refreshResolvedInquiry,
    success,
  ]);

  const handleOpenTasksModal = () => {
    if (!inquiryNumericId) return;
    setIsTasksModalOpen(true);
  };
  const handleCloseTasksModal = () => {
    setIsTasksModalOpen(false);
  };

  const handleCopyUid = useCallback(async () => {
    if (!safeUid) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeUid);
      } else {
        throw new Error("Clipboard API is unavailable.");
      }
      success("UID copied", safeUid);
    } catch (copyError) {
      error("Copy failed", copyError?.message || "Unable to copy UID.");
    }
  }, [error, safeUid, success]);
  const handleCopyFieldValue = useCallback(
    async ({ label, value }) => {
      const text = toText(value);
      if (!text) return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error("Clipboard API is unavailable.");
        }
        success(`${label} copied`, text);
      } catch (copyError) {
        error("Copy failed", copyError?.message || "Unable to copy value.");
      }
    },
    [error, success]
  );
  const openRelatedRecord = useCallback(
    (uniqueId) => {
      const nextUid = toText(uniqueId);
      if (!nextUid) return;
      navigate(`/details/${encodeURIComponent(nextUid)}`);
    },
    [navigate]
  );
  const handleToggleRelatedJobLink = useCallback(
    async (jobRecord = {}) => {
      if (isSavingLinkedJob) return;
      if (!plugin || !inquiryNumericId) {
        error("Save failed", "Inquiry context is not ready.");
        return;
      }
      const jobUniqueId = toText(jobRecord?.unique_id || jobRecord?.Unique_ID);
      let resolvedJobId = toText(
        jobRecord?.id || jobRecord?.ID || (jobUniqueId ? relatedJobIdByUid[jobUniqueId] : "")
      );
      if (!resolvedJobId && jobUniqueId) {
        resolvedJobId = toText(await fetchJobIdByUniqueId({ plugin, uniqueId: jobUniqueId }));
        if (resolvedJobId) {
          setRelatedJobIdByUid((previous) =>
            toText(previous[jobUniqueId]) === resolvedJobId
              ? previous
              : { ...previous, [jobUniqueId]: resolvedJobId }
          );
        }
      }
      if (!resolvedJobId) {
        error("Save failed", "Selected job is missing a record ID.");
        return;
      }

      const currentlySelected = toText(selectedRelatedJobId);
      const shouldUnselect =
        Boolean(currentlySelected) &&
        (currentlySelected === resolvedJobId || (jobUniqueId && currentlySelected === jobUniqueId));
      const nextLinkedJobId = shouldUnselect ? "" : resolvedJobId;

      setLinkedJobSelectionOverride(nextLinkedJobId);
      setIsSavingLinkedJob(true);
      try {
        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            inquiry_for_job_id: nextLinkedJobId,
          },
        });
        await refreshResolvedInquiry();
        if (shouldUnselect) {
          success("Job unlinked", "Inquiry job link was removed.");
        } else {
          success(
            "Job linked",
            `Inquiry linked to ${jobUniqueId || resolvedJobId || "selected job"}.`
          );
        }
      } catch (saveError) {
        console.error("[InquiryDetails] Failed to update inquiry linked job", saveError);
        setLinkedJobSelectionOverride(undefined);
        error("Save failed", saveError?.message || "Unable to update linked job.");
      } finally {
        setIsSavingLinkedJob(false);
      }
    },
    [
      error,
      inquiryNumericId,
      isSavingLinkedJob,
      plugin,
      refreshResolvedInquiry,
      relatedJobIdByUid,
      selectedRelatedJobId,
      success,
    ]
  );
  const handleInquiryDetailsTextFieldChange = useCallback(
    (field) => (event) => {
      const nextValue = String(event?.target?.value ?? "");
      setInquiryDetailsForm((previous) =>
        previous[field] === nextValue ? previous : { ...previous, [field]: nextValue }
      );
    },
    []
  );

  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']" data-page="inquiry-details">
      <GlobalTopHeader />

      <section className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="w-full px-2">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                aria-label="Back to dashboard"
              >
                <TitleBackIcon className="h-4 w-4" />
              </Link>
              <div className="min-w-0 flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-slate-900">
                  Inquiry Details
                </div>
                {hasUid ? (
                  <>
                    {externalInquiryUrl ? (
                      <a
                        href={externalInquiryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="uid-link hover:text-blue-800"
                        title={`Open inquiry ${inquiryNumericId} in Ontraport`}
                      >
                        {safeUid}
                      </a>
                    ) : (
                      <span className="uid-text">{safeUid}</span>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                      onClick={handleCopyUid}
                      title="Copy UID"
                      aria-label="Copy UID"
                    >
                      <CopyIcon />
                    </button>
                  </>
                ) : null}
              </div>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={inquiryStatusStyle}
              >
                {inquiryStatus || (isContextLoading ? "Loading..." : "Unknown")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
                <span className="service-provider-allocation-legend">Service Provider</span>
                <SearchDropdownInput
                  label=""
                  field="service_provider_allocation"
                  value={serviceProviderSearch}
                  placeholder="Allocate service provider"
                  items={serviceProviderSearchItems}
                  onValueChange={(value) => {
                    setServiceProviderSearch(value);
                    setSelectedServiceProviderId("");
                  }}
                  onSelect={(item) => {
                    const providerId = toText(item?.id);
                    setSelectedServiceProviderId(providerId);
                    setServiceProviderSearch(toText(item?.valueLabel || item?.label));
                  }}
                  onAdd={handleConfirmServiceProviderAllocation}
                  addButtonLabel={
                    isAllocatingServiceProvider ? "Allocating..." : "Confirm Allocation"
                  }
                  emptyText={
                    isServiceProviderLookupLoading
                      ? "Loading service providers..."
                      : "No service providers found."
                  }
                  rootData={{
                    className: "service-provider-allocation-root w-full",
                    "data-search-root": "service-provider-allocation",
                  }}
                />
              </div>
              <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
                <span className="service-provider-allocation-legend">Inquiry Taken By</span>
                <SearchDropdownInput
                  label=""
                  field="inquiry_taken_by_allocation"
                  value={inquiryTakenBySearch}
                  placeholder="Set inquiry taken by"
                  items={inquiryTakenBySearchItems}
                  onValueChange={(value) => {
                    setInquiryTakenBySearch(value);
                    setSelectedInquiryTakenById("");
                  }}
                  onSelect={(item) => {
                    const providerId = toText(item?.id);
                    setSelectedInquiryTakenById(providerId);
                    setInquiryTakenBySearch(toText(item?.valueLabel || item?.label));
                  }}
                  onAdd={handleConfirmInquiryTakenBy}
                  addButtonLabel={isSavingInquiryTakenBy ? "Saving..." : "Confirm Selection"}
                  emptyText={
                    isInquiryTakenByLookupLoading
                      ? "Loading admins..."
                      : "No admin records found."
                  }
                  rootData={{
                    className: "service-provider-allocation-root w-full",
                    "data-search-root": "inquiry-taken-by-allocation",
                  }}
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleNewInquiry}
              >
                New Inquiry
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleEditInquiry}
                disabled={!hasUid}
              >
                Edit Inquiry
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleCreateCallback}
                disabled={!inquiryNumericId || isCreatingCallback}
              >
                {isCreatingCallback ? "Creating..." : "Create Call Back"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleOpenTasksModal}
                disabled={!inquiryNumericId}
              >
                Manage Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleQuoteJobAction}
                disabled={!inquiryNumericId || isCreatingQuote || isOpeningQuoteJob}
              >
                {isCreatingQuote
                  ? "Creating Quote/Job..."
                  : isOpeningQuoteJob
                    ? "Opening Quote/Job..."
                    : hasLinkedQuoteJob
                      ? "View Quote/Job"
                      : "Create Quote/Job"}
              </Button>

              <div className="relative" ref={moreMenuRef}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 whitespace-nowrap px-3 !text-xs"
                  onClick={() => setIsMoreOpen((previous) => !previous)}
                  aria-haspopup="menu"
                  aria-expanded={isMoreOpen}
                >
                  More
                  <ChevronDownIcon />
                </Button>
                {isMoreOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 ${
                        isDeletingRecord ? "pointer-events-none opacity-50" : ""
                      }`}
                      onClick={handleDeleteRecord}
                    >
                      Delete Record
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      <JobDirectStoreProvider
        jobUid={safeUid || null}
        jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
        lookupData={workspaceLookupData}
      >
      <TasksModal
        open={isTasksModalOpen}
        onClose={handleCloseTasksModal}
        plugin={plugin}
        contextType="deal"
        contextId={inquiryNumericId}
        jobData={{
          ...(resolvedInquiry || {}),
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
          inquiry_record_id: inquiryNumericId,
          Inquiry_Record_ID: inquiryNumericId,
        }}
        additionalCreatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
        additionalUpdatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
      />
      <ContactDetailsModal
        open={contactModalState.open}
        onClose={closeContactDetailsModal}
        mode={contactModalState.mode}
        plugin={plugin}
        onSave={contactModalState.onSave}
        onModeChange={contactModalState.onModeChange}
        allowModeSwitch={contactModalState.allowModeSwitch}
        titleVerb={contactModalState.titleVerb}
        initialValues={contactModalState.initialValues}
        useTopLookupSearch
        enableInlineDuplicateLookup
      />
      <AddPropertyModal
        open={propertyModalState.open}
        onClose={closePropertyModal}
        onSave={handleSaveProperty}
        initialData={propertyModalState.initialData}
        plugin={plugin}
      />
      <Modal
        open={isInquiryDetailsModalOpen}
        onClose={handleCloseInquiryDetailsEditor}
        title="Edit Inquiry & Request Details"
        widthClass="max-w-5xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseInquiryDetailsEditor}
              disabled={isSavingInquiryDetails}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveInquiryDetails}
              disabled={isSavingInquiryDetails}
            >
              {isSavingInquiryDetails ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ColorMappedSelectInput
              label="Inquiry Status"
              field="inquiry_status"
              options={INQUIRY_STATUS_OPTIONS}
              value={inquiryDetailsForm.inquiry_status}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, inquiry_status: nextValue }))
              }
            />
            <SelectInput
              label="Inquiry Source"
              field="inquiry_source"
              options={INQUIRY_SOURCE_OPTIONS}
              value={inquiryDetailsForm.inquiry_source}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, inquiry_source: nextValue }))
              }
            />
            <SelectInput
              label="Type"
              field="type"
              options={INQUIRY_TYPE_OPTIONS}
              value={inquiryDetailsForm.type}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, type: nextValue }))
              }
            />
            {inquiryEditFlowRule.showServiceInquiry ? (
              <SelectInput
                label={isInquiryServiceLookupLoading ? "Select Service (Loading...)" : "Select Service"}
                field="service_inquiry_id"
                options={resolvedInquiryServiceOptions}
                value={inquiryDetailsForm.service_inquiry_id}
                onChange={(nextValue) =>
                  setInquiryDetailsForm((previous) => ({
                    ...previous,
                    service_inquiry_id: normalizeServiceInquiryId(nextValue),
                  }))
                }
              />
            ) : null}
            {inquiryEditFlowRule.showHowDidYouHear ? (
              <SelectInput
                label="How Did You Hear About Us"
                field="how_did_you_hear"
                options={HOW_DID_YOU_HEAR_OPTIONS}
                value={inquiryDetailsForm.how_did_you_hear}
                onChange={(nextValue) =>
                  setInquiryDetailsForm((previous) => ({ ...previous, how_did_you_hear: nextValue }))
                }
              />
            ) : null}
            {inquiryEditFlowRule.showHowDidYouHear && shouldShowInquiryEditOther ? (
              <InputField
                label="Other"
                field="other"
                value={inquiryDetailsForm.other}
                onChange={handleInquiryDetailsTextFieldChange("other")}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField
              label="Date Job Required By"
              type="date"
              field="date_job_required_by"
              value={inquiryDetailsForm.date_job_required_by}
              onChange={handleInquiryDetailsTextFieldChange("date_job_required_by")}
            />
            <InputField
              label="Renovations"
              field="renovations"
              value={inquiryDetailsForm.renovations}
              onChange={handleInquiryDetailsTextFieldChange("renovations")}
            />
            <InputField
              label="Resident Availability"
              field="resident_availability"
              value={inquiryDetailsForm.resident_availability}
              onChange={handleInquiryDetailsTextFieldChange("resident_availability")}
            />
          </div>

          <div className="rounded border border-slate-200 bg-slate-50">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left"
              onClick={() => setIsInquiryEditPestAccordionOpen((previous) => !previous)}
              aria-expanded={isInquiryEditPestAccordionOpen}
            >
              <span className="type-label text-slate-700">Pest Details</span>
              <span className="text-xs font-semibold text-slate-600">
                {isInquiryEditPestAccordionOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {isInquiryEditPestAccordionOpen ? (
              <div className="space-y-3 border-t border-slate-200 bg-white px-3 py-3">
                <InquiryEditListSelectionField
                  label="Noise Signs"
                  field="noise_signs_options_as_text"
                  value={inquiryDetailsForm.noise_signs_options_as_text}
                  options={NOISE_SIGN_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      noise_signs_options_as_text: nextValue,
                    }))
                  }
                />
                <InquiryEditListSelectionField
                  label="Pest Active Times"
                  field="pest_active_times_options_as_text"
                  value={inquiryDetailsForm.pest_active_times_options_as_text}
                  options={PEST_ACTIVE_TIME_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      pest_active_times_options_as_text: nextValue,
                    }))
                  }
                />
                <InquiryEditListSelectionField
                  label="Pest Location"
                  field="pest_location_options_as_text"
                  value={inquiryDetailsForm.pest_location_options_as_text}
                  options={PEST_LOCATION_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      pest_location_options_as_text: nextValue,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>

          {inquiryEditFlowRule.showHowCanWeHelp ? (
            <div className="md:col-span-2">
              <InquiryEditTextArea
                label="How Can We Help"
                field="how_can_we_help"
                value={inquiryDetailsForm.how_can_we_help}
                onChange={handleInquiryDetailsTextFieldChange("how_can_we_help")}
                placeholder="Describe the inquiry details..."
                rows={5}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InquiryEditTextArea
              label="Admin Notes"
              field="admin_notes"
              value={inquiryDetailsForm.admin_notes}
              onChange={handleInquiryDetailsTextFieldChange("admin_notes")}
              rows={6}
            />
            <InquiryEditTextArea
              label="Client Notes"
              field="client_notes"
              value={inquiryDetailsForm.client_notes}
              onChange={handleInquiryDetailsTextFieldChange("client_notes")}
              rows={6}
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={isAppointmentModalOpen}
        onClose={closeAppointmentModal}
        title={appointmentModalMode === "update" ? "Edit Appointment" : "Add Appointment"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AppointmentTabSection
            plugin={plugin}
            jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
            preloadedLookupData={workspaceLookupData}
            inquiryRecordId={inquiryNumericId}
            inquiryUid={safeUid}
            mode={appointmentModalMode}
            editingAppointmentId={appointmentModalEditingId}
            draft={appointmentModalDraft}
            prefillContext={inquiryAppointmentPrefillContext}
            layoutMode="form"
            hideStatusFieldInForm
          />
        </div>
      </Modal>
      <Modal
        open={isUploadsModalOpen}
        onClose={closeUploadsModal}
        title="Add Uploads"
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          {inquiryNumericId ? (
            <UploadsSection
              plugin={plugin}
              jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
              uploadsMode="inquiry"
              inquiryId={inquiryNumericId}
              inquiryUid={safeUid}
              linkedJobId={linkedInquiryJobIdFromRecord}
              additionalCreatePayload={{
                inquiry_id: inquiryNumericId,
                Inquiry_ID: inquiryNumericId,
                inquiry_record_id: inquiryNumericId,
                Inquiry_Record_ID: inquiryNumericId,
                job_id: linkedInquiryJobIdFromRecord || null,
                Job_ID: linkedInquiryJobIdFromRecord || null,
              }}
              layoutMode="form"
            />
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Inquiry record ID is required to add uploads.
            </div>
          )}
        </div>
      </Modal>
      <Modal
        open={isCreateQuoteModalOpen}
        onClose={handleCloseCreateQuoteModal}
        title="Create Quote/Job"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseCreateQuoteModal}
              disabled={isCreatingQuote}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmCreateQuote}
              disabled={isCreatingQuote}
            >
              {isCreatingQuote ? "Creating..." : "Create Quote/Job"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <InputField
            label="Quote Date"
            type="date"
            field="quote_date"
            value={quoteCreateDraft.quote_date}
            onChange={(event) =>
              setQuoteCreateDraft((previous) => ({
                ...previous,
                quote_date: String(event?.target?.value || ""),
              }))
            }
          />
          <InputField
            label="Follow Up Date"
            type="date"
            field="follow_up_date"
            value={quoteCreateDraft.follow_up_date}
            onChange={(event) =>
              setQuoteCreateDraft((previous) => ({
                ...previous,
                follow_up_date: String(event?.target?.value || ""),
              }))
            }
          />
        </div>
      </Modal>
      <Modal
        open={isDeleteRecordModalOpen}
        onClose={handleCloseDeleteRecordModal}
        title="Delete Record"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseDeleteRecordModal}
              disabled={isDeletingRecord}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteRecord}
              disabled={isDeletingRecord}
            >
              {isDeletingRecord ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          This will mark the inquiry status as <strong>Cancelled</strong> and return you to the
          dashboard.
        </p>
      </Modal>
      <Modal
        open={isPopupCommentModalOpen}
        onClose={() => {
          if (isSavingPopupComment) return;
          setPopupCommentDrafts({
            contact: contactPopupComment,
            company: companyPopupComment,
          });
          setIsPopupCommentModalOpen(false);
        }}
        title="Popup Comments"
        widthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPopupCommentDrafts({
                  contact: contactPopupComment,
                  company: companyPopupComment,
                });
                setIsPopupCommentModalOpen(false);
              }}
              disabled={isSavingPopupComment}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePopupComments}
              disabled={isSavingPopupComment}
            >
              {isSavingPopupComment ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {showContactDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Primary Contact Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.contact}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    contact: event.target.value,
                  }))
                }
                placeholder="Add popup comment for primary contact"
              />
            </div>
          ) : null}

          {showCompanyDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Company Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.company}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    company: event.target.value,
                  }))
                }
                placeholder="Add popup comment for company"
              />
            </div>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={Boolean(memoDeleteTarget)}
        onClose={() => {
          if (isDeletingMemoItem) return;
          setMemoDeleteTarget(null);
        }}
        title={toText(memoDeleteTarget?.type) === "post" ? "Delete Memo" : "Delete Reply"}
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoDeleteTarget(null)}
              disabled={isDeletingMemoItem}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteMemoItem}
              disabled={isDeletingMemoItem}
            >
              {isDeletingMemoItem ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {toText(memoDeleteTarget?.type) === "post"
            ? "Are you sure you want to delete this memo?"
            : "Are you sure you want to delete this reply?"}
        </p>
      </Modal>

      <section
        className="w-full px-2 py-2"
        data-page="inquiry-details"
        data-inquiry-uid={safeUid}
      >
        {!hasUid ? (
          <div className="mb-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Open this page with a valid inquiry UID to load inquiry details.
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
          <DetailsCard
            title="Account Details"
            onEdit={handleOpenAccountEditor}
            editDisabled={!inquiryNumericId}
          >
            {isInquiryInitialLoadInProgress ? (
              <SectionLoadingState
                label="Loading account details"
                blocks={6}
                columnsClass="sm:grid-cols-2"
              />
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                  <CardField
                    label="UID"
                    value={safeUid}
                    mono
                    copyable
                    copyValue={safeUid}
                    onCopy={handleCopyFieldValue}
                  />
                  <CardField label="Account Type" value={accountType} />
                </div>

                {showContactDetails && hasAccountContactFields ? (
                  <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                    <CardField label="Contact Name" value={accountContactName} />
                    <CardField
                      label="Contact Email"
                      value={accountContactEmail}
                      href={accountContactEmailHref}
                      copyable
                      copyValue={accountContactEmail}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Contact Phone"
                      value={accountContactPhone}
                      href={accountContactPhoneHref}
                      copyable
                      copyValue={accountContactPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Contact Address"
                      value={accountContactAddress}
                      href={accountContactAddressHref}
                      openInNewTab
                      copyable
                      copyValue={accountContactAddressHref ? accountContactAddress : ""}
                      onCopy={handleCopyFieldValue}
                      className="sm:col-span-2"
                    />
                  </div>
                ) : null}

                {showCompanyDetails && hasAccountCompanyFields ? (
                  <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                    <CardField label="Company" value={accountCompanyName} />
                    <CardField
                      label="Company Phone"
                      value={accountCompanyPhone}
                      href={accountCompanyPhoneHref}
                      copyable
                      copyValue={accountCompanyPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField label="Company Primary" value={accountCompanyPrimaryName} />
                    <CardField
                      label="Primary Email"
                      value={accountCompanyPrimaryEmail}
                      href={accountCompanyPrimaryEmailHref}
                      copyable
                      copyValue={accountCompanyPrimaryEmail}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Primary Phone"
                      value={accountCompanyPrimaryPhone}
                      href={accountCompanyPrimaryPhoneHref}
                      copyable
                      copyValue={accountCompanyPrimaryPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Company Address"
                      value={accountCompanyAddress}
                      href={accountCompanyAddressHref}
                      openInNewTab
                      copyable
                      copyValue={accountCompanyAddressHref ? accountCompanyAddress : ""}
                      onCopy={handleCopyFieldValue}
                      className="sm:col-span-2"
                    />
                  </div>
                ) : null}

                {showCompanyDetails && isBodyCorpAccount && hasBodyCorpDetails ? (
                  <div className="rounded border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
                      onClick={() => setIsBodyCorpDetailsOpen((previous) => !previous)}
                      aria-expanded={isBodyCorpDetailsOpen}
                      aria-controls="body-corp-company-details"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Body Corp Company
                      </span>
                      <span
                        className={`text-slate-500 transition-transform ${
                          isBodyCorpDetailsOpen ? "rotate-180" : ""
                        }`}
                      >
                        <ChevronDownIcon />
                      </span>
                    </button>
                    {isBodyCorpDetailsOpen ? (
                      <div
                        id="body-corp-company-details"
                        className="grid grid-cols-1 gap-x-3 gap-y-2 px-2 pb-2 sm:grid-cols-2"
                      >
                        <CardField label="Body Corp Name" value={accountBodyCorpName} />
                        <CardField label="Body Corp Type" value={accountBodyCorpType} />
                        <CardField
                          label="Body Corp Phone"
                          value={accountBodyCorpPhone}
                          href={accountBodyCorpPhoneHref}
                          copyable
                          copyValue={accountBodyCorpPhone}
                          onCopy={handleCopyFieldValue}
                        />
                        <CardField
                          label="Body Corp Address"
                          value={accountBodyCorpAddress}
                          href={accountBodyCorpAddressHref}
                          openInNewTab
                          copyable
                          copyValue={accountBodyCorpAddressHref ? accountBodyCorpAddress : ""}
                          onCopy={handleCopyFieldValue}
                          className="sm:col-span-2"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </DetailsCard>

          <DetailsCard
            title="Inquiry & Request Details"
            onEdit={handleOpenInquiryDetailsEditor}
            editDisabled={!inquiryNumericId}
            className={isInquiryRequestExpanded ? "xl:col-span-2" : ""}
          >
            {isInquiryInitialLoadInProgress ? (
              <SectionLoadingState
                label="Loading inquiry details"
                blocks={8}
                columnsClass="sm:grid-cols-2 xl:grid-cols-4"
              />
            ) : isInquiryRequestExpanded ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-5">
                  <CardField label="Inquiry Status" value={inquiryStatus} />
                  <CardField label="Source" value={statusSource} />
                  <CardField label="Type" value={statusType} />
                  {inquiryDisplayFlowRule.showServiceInquiry ? (
                    <CardField
                      label="Service Name"
                      value={statusServiceName}
                      href={statusServiceNameHref}
                      openInNewTab
                    />
                  ) : null}
                  {inquiryDisplayFlowRule.showHowDidYouHear ? (
                    <CardField label="How Did You Hear" value={statusHowHeardDisplay} />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-5">
                  <CardField label="Date Job Required By" value={requestDateRequired} />
                  <CardField label="Renovations" value={requestRenovations} />
                  <CardField label="Resident Availability" value={requestResidentAvailability} />
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-3">
                  <CardTagList
                    label="Pest Noise Signs"
                    tags={requestPestNoiseTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "noise_signs_options_as_text",
                        rawValue: requestPestNoiseRawValue,
                        options: NOISE_SIGN_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("noise_signs_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Active Times"
                    tags={requestPestActiveTimesTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_active_times_options_as_text",
                        rawValue: requestPestActiveTimesRawValue,
                        options: PEST_ACTIVE_TIME_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_active_times_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Locations"
                    tags={requestPestLocationsTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_location_options_as_text",
                        rawValue: requestPestLocationsRawValue,
                        options: PEST_LOCATION_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_location_options_as_text", tag)
                    }
                  />
                </div>
                <div
                  className={`grid grid-cols-1 gap-1.5 ${
                    inquiryDisplayFlowRule.showHowCanWeHelp ? "md:grid-cols-3" : "md:grid-cols-2"
                  }`}
                >
                  {inquiryDisplayFlowRule.showHowCanWeHelp ? (
                    <CardNote label="How Can We Help" value={statusHowCanHelp} />
                  ) : null}
                  <CardNote label="Admin Notes" value={notesAdmin} />
                  <CardNote label="Client Notes" value={notesClient} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <CardField label="Inquiry Status" value={inquiryStatus} />
                  <CardField label="Source" value={statusSource} />
                  <CardField label="Type" value={statusType} />
                  {inquiryDisplayFlowRule.showServiceInquiry ? (
                    <CardField
                      label="Service Name"
                      value={statusServiceName}
                      href={statusServiceNameHref}
                      openInNewTab
                    />
                  ) : null}
                  {inquiryDisplayFlowRule.showHowDidYouHear ? (
                    <CardField label="How Did You Hear" value={statusHowHeardDisplay} />
                  ) : null}
                  <CardTagList
                    label="Pest Noise Signs"
                    tags={requestPestNoiseTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "noise_signs_options_as_text",
                        rawValue: requestPestNoiseRawValue,
                        options: NOISE_SIGN_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("noise_signs_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Active Times"
                    tags={requestPestActiveTimesTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_active_times_options_as_text",
                        rawValue: requestPestActiveTimesRawValue,
                        options: PEST_ACTIVE_TIME_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_active_times_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Locations"
                    tags={requestPestLocationsTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_location_options_as_text",
                        rawValue: requestPestLocationsRawValue,
                        options: PEST_LOCATION_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_location_options_as_text", tag)
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <CardField label="Date Job Required By" value={requestDateRequired} />
                  <CardField label="Renovations" value={requestRenovations} />
                  <CardField label="Resident Availability" value={requestResidentAvailability} />
                </div>
                {inquiryDisplayFlowRule.showHowCanWeHelp ? (
                  <CardNote label="How Can We Help" value={statusHowCanHelp} />
                ) : null}
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <CardNote label="Admin Notes" value={notesAdmin} />
                  <CardNote label="Client Notes" value={notesClient} />
                </div>
              </div>
            )}
          </DetailsCard>

        </div>

          <section className="inquiry-details-workspace mt-1.5 overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-1.5 py-1">
              {visibleWorkspaceTabs.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded-md border px-2 py-[3px] text-[11px] font-semibold leading-4 transition ${
                      isActive
                        ? "border-[#003882] bg-[#003882] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-1.5">
              {isInquiryInitialLoadInProgress ? (
                <SectionLoadingState
                  label="Loading workspace"
                  blocks={6}
                  columnsClass="md:grid-cols-2"
                />
              ) : (
                <>
                  {shouldShowRelatedRecordsTab && activeWorkspaceTab === "related-records" ? (
                !relatedRecordsAccountId ? (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Link a contact/company on this inquiry to load related records.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isRelatedRecordsLoading && !filteredRelatedDeals.length && !relatedJobs.length ? (
                      <div className="text-[11px] text-slate-500">Loading related inquiries and jobs...</div>
                    ) : null}
                    {relatedRecordsError ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                        {relatedRecordsError}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Related Inquiries
                        </div>
                        {filteredRelatedDeals.length ? (
                          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                            {filteredRelatedDeals.slice(0, 12).map((deal) => {
                              const dealUid = toText(deal?.unique_id);
                              const dealName = toText(deal?.deal_name);
                              const fallbackId = toText(deal?.id);
                              const dealIdentifier = dealUid || fallbackId;
                              if (!dealIdentifier && !dealName) return null;
                              return (
                                <button
                                  key={dealUid || fallbackId || dealName}
                                  type="button"
                                  className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-slate-300"
                                  onClick={() => openRelatedRecord(dealUid)}
                                  disabled={!dealUid}
                                >
                                  <div className="truncate text-[11px] font-semibold text-sky-700 underline">
                                    {dealIdentifier}
                                  </div>
                                  {dealName ? (
                                    <div className="truncate text-[11px] text-slate-600">{dealName}</div>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            {isRelatedRecordsLoading
                              ? "Loading related inquiries..."
                              : "No related inquiries found."}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Related Jobs
                        </div>
                        {relatedJobs.length ? (
                          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                            {relatedJobs.slice(0, 12).map((job) => {
                              const jobId = toText(job?.id || job?.ID);
                              const jobUid = toText(job?.unique_id || job?.Unique_ID);
                              const jobIdentifier = jobUid || jobId;
                              const resolvedJobId = jobId || toText(relatedJobIdByUid[jobUid]);
                              const propertyName = toText(job?.property_name);
                              if (!jobIdentifier && !propertyName) return null;
                              const isSelected =
                                Boolean(selectedRelatedJobId) &&
                                (selectedRelatedJobId === resolvedJobId ||
                                  selectedRelatedJobId === jobUid);
                              return (
                                <div
                                  key={jobUid || jobId || propertyName}
                                  className={`rounded border bg-white px-2 py-1.5 ${
                                    isSelected ? "border-sky-400" : "border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        className="truncate text-[11px] font-semibold text-sky-700 underline"
                                        onClick={() => openRelatedRecord(jobUid)}
                                        disabled={!jobUid}
                                      >
                                        {jobIdentifier}
                                      </button>
                                      {propertyName ? (
                                        <div className="truncate text-[11px] text-slate-600">
                                          {propertyName}
                                        </div>
                                      ) : null}
                                    </div>
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 shrink-0 accent-[#003882]"
                                      checked={isSelected}
                                      disabled={(!resolvedJobId && !jobUid) || isSavingLinkedJob}
                                      onChange={() => handleToggleRelatedJobLink(job)}
                                      aria-label={`Link inquiry to job ${jobUid || jobId || ""}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            {isRelatedRecordsLoading ? "Loading related jobs..." : "No related jobs found."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
                  ) : null}

                  {shouldShowPropertiesTab && activeWorkspaceTab === "properties" ? (
                  <PropertyTabSection
                    plugin={plugin}
                    preloadedLookupData={workspaceLookupData}
                    quoteJobId={linkedInquiryJobIdFromRecord}
                    inquiryId={inquiryNumericId}
                    currentPropertyId={normalizePropertyId(
                      activeRelatedProperty?.id || selectedPropertyId
                    )}
                    onOpenContactDetailsModal={openContactDetailsModal}
                    accountType={relatedRecordsAccountType}
                    selectedAccountId={relatedRecordsAccountId}
                    propertySearchValue={propertySearchQuery}
                    propertySearchItems={propertySearchItems}
                    onPropertySearchValueChange={handlePropertySearchValueChange}
                    onPropertySearchQueryChange={handlePropertySearchQueryChange}
                    onSelectPropertyFromSearch={handleSelectPropertyFromSearch}
                    onAddProperty={handleOpenAddPropertyModal}
                    activeRelatedProperty={activeRelatedProperty}
                    linkedProperties={linkedPropertiesSorted}
                    isLoading={isLinkedPropertiesLoading}
                    loadError={linkedPropertiesError}
                    selectedPropertyId={normalizePropertyId(
                      activeRelatedProperty?.id || selectedPropertyId
                    )}
                    onSelectProperty={setSelectedPropertyId}
                    onEditRelatedProperty={handleOpenEditPropertyModal}
                    sameAsContactLabel={
                      isApplyingSameAsContactProperty ? "Applying..." : "Same as contact"
                    }
                    isSameAsContactChecked={isPropertySameAsContact}
                    isSameAsContactDisabled={
                      isApplyingSameAsContactProperty || !inquiryNumericId || !plugin
                    }
                    onSameAsContactChange={handleSameAsContactPropertyChange}
                  />
                  ) : null}

                  {activeWorkspaceTab === "uploads" ? (
                inquiryNumericId ? (
                  <UploadsSection
                    plugin={plugin}
                    jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
                    uploadsMode="inquiry"
                    inquiryId={inquiryNumericId}
                    inquiryUid={safeUid}
                    linkedJobId={linkedInquiryJobIdFromRecord}
                    additionalCreatePayload={{
                      inquiry_id: inquiryNumericId,
                      Inquiry_ID: inquiryNumericId,
                      inquiry_record_id: inquiryNumericId,
                      Inquiry_Record_ID: inquiryNumericId,
                      job_id: linkedInquiryJobIdFromRecord || null,
                      Job_ID: linkedInquiryJobIdFromRecord || null,
                    }}
                    layoutMode="table"
                    onRequestAddUpload={handleOpenUploadModal}
                  />
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Inquiry record ID is required to load uploads.
                  </div>
                )
                  ) : null}

                  {activeWorkspaceTab === "appointments" ? (
                <AppointmentTabSection
                  plugin={plugin}
                  jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
                  preloadedLookupData={workspaceLookupData}
                  inquiryRecordId={inquiryNumericId}
                  inquiryUid={safeUid}
                  prefillContext={inquiryAppointmentPrefillContext}
                  layoutMode="table"
                  eventRowTintOpacity={0.4}
                  onRequestCreate={handleOpenCreateAppointmentModal}
                  onRequestEdit={handleOpenEditAppointmentModal}
                />
                  ) : null}
                </>
              )}
            </div>
          </section>
      </section>
      <div className="pointer-events-none fixed bottom-5 right-6 z-[60] flex flex-col items-end gap-3">
        <button
          type="button"
          className={`pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-700 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.35)] transition ${
            hasPopupCommentsSection
              ? "hover:bg-red-700"
              : "cursor-not-allowed opacity-45"
          }`}
          onClick={() => {
            if (!hasPopupCommentsSection) return;
            setIsPopupCommentModalOpen(true);
          }}
          disabled={!hasPopupCommentsSection}
          aria-label="Open popup comments"
          title={hasPopupCommentsSection ? "Popup comments" : "Popup comments unavailable"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              d="M12 7.25V13.25"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.1" r="1.25" fill="currentColor" />
          </svg>
        </button>

        {isMemoChatOpen ? (
          <section className="pointer-events-auto flex w-[370px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.22)]">
            <header className="flex items-center justify-between bg-[#003882] px-3 py-2.5 text-white">
              <div className="text-sm font-semibold">Memos</div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/30 text-white hover:bg-white/10"
                onClick={() => setIsMemoChatOpen(false)}
                aria-label="Close memos chat"
                title="Close"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[420px] min-h-[340px] space-y-2 overflow-y-auto bg-slate-50 p-2.5">
              {!hasMemoContext ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  Memos are available when inquiry is linked.
                </div>
              ) : isMemosLoading ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  Loading memos...
                </div>
              ) : memosError ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {memosError}
                </div>
              ) : !memos.length ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  No memos yet.
                </div>
              ) : (
                memos.map((memo, memoIndex) => {
                  const memoId = toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`;
                  const memoAuthor = memo?.Author || {};
                  const memoIsMine =
                    Boolean(currentUserId) && toText(memo?.author_id || memoAuthor?.id) === currentUserId;
                  const memoAuthorName = getAuthorName(memoAuthor);
                  const memoFileMeta = getMemoFileMeta(memo?.file || memo?.File);
                  const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
                  const isReplySending = sendingReplyPostId === memoId;
                  return (
                    <div
                      key={memoId}
                      className={`rounded-lg border px-2.5 py-2 ${
                        memoIsMine
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="truncate text-[11px] font-semibold text-slate-700">
                          {memoIsMine ? "You" : memoAuthorName}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">
                            {formatRelativeTime(memo?.created_at || memo?.Date_Added)}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                            onClick={() => setMemoDeleteTarget({ type: "post", id: memoId })}
                            title="Delete memo"
                            aria-label="Delete memo"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-slate-700">
                        {toText(
                          memo?.post_copy ||
                            memo?.Post_Copy ||
                            memo?.comment ||
                            memo?.Comment ||
                            memo?.text ||
                            memo?.Text ||
                            memo?.content ||
                            memo?.Content
                        ) || "-"}
                      </p>
                      {memoFileMeta?.link ? (
                        <a
                          href={memoFileMeta.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex max-w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-[#003882] underline underline-offset-2"
                        >
                          <span className="max-w-[240px] truncate">
                            {memoFileMeta.name || "View attachment"}
                            {memoFileMeta.size ? ` (${formatFileSize(memoFileMeta.size)})` : ""}
                          </span>
                        </a>
                      ) : null}

                      {replies.length ? (
                        <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                          {replies.map((reply, replyIndex) => {
                            const replyId = toText(reply?.id || reply?.ID) || `${memoId}-reply-${replyIndex}`;
                            const replyAuthor = reply?.Author || {};
                            const replyIsMine =
                              Boolean(currentUserId) &&
                              toText(reply?.author_id || replyAuthor?.id) === currentUserId;
                            return (
                              <div
                                key={replyId}
                                className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                              >
                                <div className="mb-0.5 flex items-center justify-between gap-2">
                                  <span className="truncate text-[10px] font-semibold text-slate-700">
                                    {replyIsMine ? "You" : getAuthorName(replyAuthor)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500">
                                      {formatRelativeTime(reply?.created_at)}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                                      onClick={() =>
                                        setMemoDeleteTarget({ type: "comment", id: replyId })
                                      }
                                      title="Delete reply"
                                      aria-label="Delete reply"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>
                                <p className="whitespace-pre-wrap text-xs text-slate-700">
                                  {toText(
                                    reply?.comment ||
                                      reply?.Comment ||
                                      reply?.post_copy ||
                                      reply?.Post_Copy ||
                                      reply?.text ||
                                      reply?.Text ||
                                      reply?.content ||
                                      reply?.Content
                                  ) || "-"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-end gap-1.5">
                        <textarea
                          className="min-h-[34px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
                          placeholder="Reply..."
                          value={toText(memoReplyDrafts?.[memoId])}
                          onChange={(event) =>
                            setMemoReplyDrafts((previous) => ({
                              ...(previous || {}),
                              [memoId]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="!px-2 !py-1 !text-xs"
                          disabled={Boolean(sendingReplyPostId)}
                          onClick={() => handleSendMemoReply(memoId)}
                        >
                          {isReplySending ? "..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className="space-y-2 border-t border-slate-200 bg-white p-2.5">
              <textarea
                className="min-h-[52px] w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                placeholder="Write a memo..."
                value={memoText}
                onChange={(event) => setMemoText(event.target.value)}
                disabled={!hasMemoContext || isPostingMemo}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!px-2 !py-1 !text-xs"
                    onClick={() => memoFileInputRef.current?.click()}
                    disabled={!hasMemoContext || isPostingMemo}
                  >
                    Attach
                  </Button>
                  <input
                    ref={memoFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleMemoFileChange}
                  />
                  {memoFile ? (
                    <span className="max-w-[150px] truncate text-[11px] text-slate-500">
                      {memoFile.name}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="!bg-[#003882] !px-2 !py-1 !text-xs !text-white hover:!bg-[#0A4A9E]"
                  onClick={handleSendMemo}
                  disabled={!hasMemoContext || isPostingMemo}
                >
                  {isPostingMemo ? "Posting..." : "Send"}
                </Button>
              </div>
            </footer>
          </section>
        ) : null}

        <button
          type="button"
          className="pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#003882] text-white shadow-[0_10px_24px_rgba(0,56,130,0.35)] transition hover:bg-[#0A4A9E]"
          onClick={() => setIsMemoChatOpen((previous) => !previous)}
          aria-label={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
          title={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <path
              d="M20 6.5v7A3.5 3.5 0 0 1 16.5 17H9l-4 3v-3A3.5 3.5 0 0 1 1.5 13.5v-7A3.5 3.5 0 0 1 5 3h11.5A3.5 3.5 0 0 1 20 6.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M6.5 8.5h8M6.5 11.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {memos.length ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {memos.length > 99 ? "99+" : memos.length}
            </span>
          ) : null}
        </button>
      </div>
      </JobDirectStoreProvider>
    </main>
  );
}
