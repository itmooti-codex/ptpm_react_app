import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleAddressLookup } from "../../../shared/hooks/useGoogleAddressLookup.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { joinAddress, toText } from "@shared/utils/formatters.js";
import { getInquiryFlowRule, shouldShowOtherSourceField } from "../shared/inquiryFlowRules.js";
import {
  normalizeServiceInquiryId,
} from "../shared/inquiryDetailsFormatting.js";
import {
  buildStandardPropertyName,
  QUICK_INQUIRY_EMPTY_COMPANY_FORM,
  QUICK_INQUIRY_EMPTY_DETAILS_FORM,
  QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM,
  resolveLookupRecordId,
} from "../shared/quickInquiryHelpers.js";

export function useQuickInquiryBookingForm({ open, prefillContext }) {
  const [step, setStep] = useState(1);
  const [accountMode, setAccountMode] = useState("individual");
  const [showIndividualOptional, setShowIndividualOptional] = useState(false);
  const [showCompanyOptional, setShowCompanyOptional] = useState(false);
  const [individualForm, setIndividualForm] = useState({ ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM });
  const [companyForm, setCompanyForm] = useState({ ...QUICK_INQUIRY_EMPTY_COMPANY_FORM });
  const [detailsForm, setDetailsForm] = useState({ ...QUICK_INQUIRY_EMPTY_DETAILS_FORM });
  const [contactMatchState, setContactMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [companyMatchState, setCompanyMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [propertyMatchState, setPropertyMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [isServiceOptionsLoading, setIsServiceOptionsLoading] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [relatedInquiries, setRelatedInquiries] = useState([]);
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState("");
  const [isQuickPropertySameAsContact, setIsQuickPropertySameAsContact] = useState(false);
  const [isApplyingQuickSameAsContactProperty, setIsApplyingQuickSameAsContactProperty] =
    useState(false);
  const didHydrateOnOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      didHydrateOnOpenRef.current = false;
      return;
    }
    if (didHydrateOnOpenRef.current) return;
    didHydrateOnOpenRef.current = true;

    const normalizedPrefill =
      prefillContext && typeof prefillContext === "object" ? prefillContext : null;
    if (!normalizedPrefill) {
      setStep(1);
      setAccountMode("individual");
      setShowIndividualOptional(false);
      setShowCompanyOptional(false);
      setIndividualForm({ ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM });
      setCompanyForm({ ...QUICK_INQUIRY_EMPTY_COMPANY_FORM });
      setDetailsForm({ ...QUICK_INQUIRY_EMPTY_DETAILS_FORM });
      setContactMatchState({ status: "idle", message: "", record: null });
      setCompanyMatchState({ status: "idle", message: "", record: null });
      setPropertyMatchState({ status: "idle", message: "", record: null });
      setIsQuickPropertySameAsContact(false);
      return;
    }

    const resolvedAccountType = toText(
      normalizedPrefill?.account_type || normalizedPrefill?.Account_Type
    ).toLowerCase();
    const nextAccountMode = resolvedAccountType === "company" ? "company" : "individual";
    const prefillContact =
      normalizedPrefill?.contact && typeof normalizedPrefill.contact === "object"
        ? normalizedPrefill.contact
        : {};
    const prefillCompany =
      normalizedPrefill?.company && typeof normalizedPrefill.company === "object"
        ? normalizedPrefill.company
        : {};
    const prefillDetails =
      normalizedPrefill?.details && typeof normalizedPrefill.details === "object"
        ? normalizedPrefill.details
        : {};
    const prefillPropertyRecord =
      prefillDetails?.property_record && typeof prefillDetails.property_record === "object"
        ? prefillDetails.property_record
        : {};
    const prefillPropertyId = normalizePropertyId(
      prefillDetails?.property_id ||
        prefillPropertyRecord?.id ||
        prefillPropertyRecord?.ID ||
        prefillPropertyRecord?.Property_ID
    );

    const nextIndividualForm = {
      ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM,
      email: toText(prefillContact?.email || prefillContact?.Email),
      first_name: toText(prefillContact?.first_name || prefillContact?.First_Name),
      last_name: toText(prefillContact?.last_name || prefillContact?.Last_Name),
      sms_number: toText(prefillContact?.sms_number || prefillContact?.SMS_Number),
      address: toText(prefillContact?.address || prefillContact?.Address),
      city: toText(prefillContact?.city || prefillContact?.City),
      state: toText(prefillContact?.state || prefillContact?.State),
      zip_code: toText(
        prefillContact?.zip_code ||
          prefillContact?.Zip_Code ||
          prefillContact?.postal_code ||
          prefillContact?.Postal_Code
      ),
      country: toText(prefillContact?.country || prefillContact?.Country || "AU") || "AU",
    };
    const nextCompanyForm = {
      ...QUICK_INQUIRY_EMPTY_COMPANY_FORM,
      company_name: toText(
        prefillCompany?.company_name || prefillCompany?.name || prefillCompany?.Name
      ),
      company_phone: toText(
        prefillCompany?.company_phone || prefillCompany?.phone || prefillCompany?.Phone
      ),
      company_address: toText(
        prefillCompany?.company_address || prefillCompany?.address || prefillCompany?.Address
      ),
      company_city: toText(
        prefillCompany?.company_city || prefillCompany?.city || prefillCompany?.City
      ),
      company_state: toText(
        prefillCompany?.company_state || prefillCompany?.state || prefillCompany?.State
      ),
      company_postal_code: toText(
        prefillCompany?.company_postal_code ||
          prefillCompany?.postal_code ||
          prefillCompany?.Postal_Code ||
          prefillCompany?.zip_code ||
          prefillCompany?.Zip_Code
      ),
      company_account_type: toText(
        prefillCompany?.company_account_type ||
          prefillCompany?.account_type ||
          prefillCompany?.Account_Type
      ),
      primary_first_name: toText(
        prefillCompany?.primary_first_name || prefillCompany?.Primary_First_Name
      ),
      primary_last_name: toText(
        prefillCompany?.primary_last_name || prefillCompany?.Primary_Last_Name
      ),
      primary_email: toText(prefillCompany?.primary_email || prefillCompany?.Primary_Email),
      primary_sms_number: toText(
        prefillCompany?.primary_sms_number || prefillCompany?.Primary_SMS_Number
      ),
    };
    const nextDetailsForm = {
      ...QUICK_INQUIRY_EMPTY_DETAILS_FORM,
      inquiry_source: toText(prefillDetails?.inquiry_source || prefillDetails?.Inquiry_Source),
      type: toText(prefillDetails?.type || prefillDetails?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        prefillDetails?.service_inquiry_id || prefillDetails?.Service_Inquiry_ID
      ),
      how_can_we_help: toText(prefillDetails?.how_can_we_help || prefillDetails?.How_can_we_help),
      how_did_you_hear: toText(
        prefillDetails?.how_did_you_hear || prefillDetails?.How_did_you_hear
      ),
      other: toText(prefillDetails?.other || prefillDetails?.Other),
      noise_signs_options_as_text: toText(
        prefillDetails?.noise_signs_options_as_text || prefillDetails?.Noise_Signs_Options_As_Text
      ),
      pest_active_times_options_as_text: toText(
        prefillDetails?.pest_active_times_options_as_text ||
          prefillDetails?.Pest_Active_Times_Options_As_Text
      ),
      pest_location_options_as_text: toText(
        prefillDetails?.pest_location_options_as_text ||
          prefillDetails?.Pest_Location_Options_As_Text
      ),
      property_lot_number: toText(
        prefillDetails?.property_lot_number ||
          prefillPropertyRecord?.lot_number ||
          prefillPropertyRecord?.Lot_Number
      ),
      property_unit_number: toText(
        prefillDetails?.property_unit_number ||
          prefillPropertyRecord?.unit_number ||
          prefillPropertyRecord?.Unit_Number
      ),
      property_lookup: toText(
        prefillDetails?.property_lookup ||
          joinAddress([
            prefillPropertyRecord?.address_1 ||
              prefillPropertyRecord?.Address_1 ||
              prefillPropertyRecord?.address ||
              prefillPropertyRecord?.Address,
            prefillPropertyRecord?.suburb_town ||
              prefillPropertyRecord?.Suburb_Town ||
              prefillPropertyRecord?.city ||
              prefillPropertyRecord?.City,
            prefillPropertyRecord?.state || prefillPropertyRecord?.State,
            prefillPropertyRecord?.postal_code ||
              prefillPropertyRecord?.Postal_Code ||
              prefillPropertyRecord?.zip_code ||
              prefillPropertyRecord?.Zip_Code,
            prefillPropertyRecord?.country || prefillPropertyRecord?.Country,
          ])
      ),
      property_name: toText(
        prefillDetails?.property_name ||
          prefillPropertyRecord?.property_name ||
          prefillPropertyRecord?.Property_Name
      ),
      property_address_1: toText(
        prefillDetails?.property_address_1 ||
          prefillPropertyRecord?.address_1 ||
          prefillPropertyRecord?.Address_1 ||
          prefillPropertyRecord?.address ||
          prefillPropertyRecord?.Address
      ),
      property_suburb_town: toText(
        prefillDetails?.property_suburb_town ||
          prefillPropertyRecord?.suburb_town ||
          prefillPropertyRecord?.Suburb_Town ||
          prefillPropertyRecord?.city ||
          prefillPropertyRecord?.City
      ),
      property_state: toText(
        prefillDetails?.property_state || prefillPropertyRecord?.state || prefillPropertyRecord?.State
      ),
      property_postal_code: toText(
        prefillDetails?.property_postal_code ||
          prefillPropertyRecord?.postal_code ||
          prefillPropertyRecord?.Postal_Code ||
          prefillPropertyRecord?.zip_code ||
          prefillPropertyRecord?.Zip_Code
      ),
      property_country:
        toText(
          prefillDetails?.property_country ||
            prefillPropertyRecord?.country ||
            prefillPropertyRecord?.Country ||
            "AU"
        ) || "AU",
      admin_notes: toText(prefillDetails?.admin_notes || prefillDetails?.Admin_Notes),
      client_notes: toText(prefillDetails?.client_notes || prefillDetails?.Client_Notes),
    };

    const contactId = resolveLookupRecordId(prefillContact, "Contact");
    const companyId = resolveLookupRecordId(prefillCompany, "Company");
    const hasIndividualOptional = Boolean(
      nextIndividualForm.first_name ||
        nextIndividualForm.last_name ||
        nextIndividualForm.sms_number ||
        nextIndividualForm.address ||
        nextIndividualForm.city ||
        nextIndividualForm.state ||
        nextIndividualForm.zip_code
    );
    const hasCompanyOptional = Boolean(
      nextCompanyForm.company_phone ||
        nextCompanyForm.company_address ||
        nextCompanyForm.company_city ||
        nextCompanyForm.company_state ||
        nextCompanyForm.company_postal_code ||
        nextCompanyForm.company_account_type ||
        nextCompanyForm.primary_first_name ||
        nextCompanyForm.primary_last_name ||
        nextCompanyForm.primary_email ||
        nextCompanyForm.primary_sms_number
    );

    setStep(1);
    setAccountMode(nextAccountMode);
    setShowIndividualOptional(hasIndividualOptional);
    setShowCompanyOptional(hasCompanyOptional);
    setIndividualForm(nextIndividualForm);
    setCompanyForm(nextCompanyForm);
    setDetailsForm(nextDetailsForm);
    setContactMatchState(
      contactId || nextIndividualForm.email
        ? {
            status: "found",
            message: "This contact already exists. Proceed with this email.",
            record: {
              ...prefillContact,
              id: contactId || toText(prefillContact?.id || prefillContact?.ID),
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setCompanyMatchState(
      companyId || nextCompanyForm.company_name
        ? {
            status: "found",
            message: "This company already exists. Proceed with this company.",
            record: {
              ...prefillCompany,
              id: companyId || toText(prefillCompany?.id || prefillCompany?.ID),
              name: toText(
                prefillCompany?.company_name || prefillCompany?.name || prefillCompany?.Name
              ),
              account_type: toText(
                prefillCompany?.company_account_type ||
                  prefillCompany?.account_type ||
                  prefillCompany?.Account_Type
              ),
              Primary_Person: {
                first_name: toText(
                  prefillCompany?.primary_first_name || prefillCompany?.Primary_First_Name
                ),
                last_name: toText(
                  prefillCompany?.primary_last_name || prefillCompany?.Primary_Last_Name
                ),
                email: toText(prefillCompany?.primary_email || prefillCompany?.Primary_Email),
                sms_number: toText(
                  prefillCompany?.primary_sms_number || prefillCompany?.Primary_SMS_Number
                ),
              },
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setPropertyMatchState(
      prefillPropertyId
        ? {
            status: "found",
            message: "Property already exists and will be linked.",
            record: {
              ...prefillPropertyRecord,
              id: prefillPropertyId,
              property_name: toText(
                nextDetailsForm.property_name || prefillPropertyRecord?.property_name
              ),
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setIsQuickPropertySameAsContact(
      Boolean(
        normalizedPrefill?.isPropertySameAsContact || normalizedPrefill?.property_same_as_contact
      )
    );
  }, [open, prefillContext]);

  const inquiryFlowRule = useMemo(() => getInquiryFlowRule(detailsForm.type), [detailsForm.type]);

  const individualAddressLookupRef = useGoogleAddressLookup({
    enabled: open && accountMode === "individual" && showIndividualOptional,
    country: "au",
    onAddressSelected: (parsed) => {
      setIndividualForm((previous) => ({
        ...previous,
        address: toText(parsed?.address || parsed?.formatted_address || previous.address),
        city: toText(parsed?.city || previous.city),
        state: toText(parsed?.state || previous.state),
        zip_code: toText(parsed?.zip_code || previous.zip_code),
        country: toText(parsed?.country || previous.country || "AU"),
      }));
    },
  });

  const companyAddressLookupRef = useGoogleAddressLookup({
    enabled: open && accountMode === "company" && showCompanyOptional,
    country: "au",
    onAddressSelected: (parsed) => {
      setCompanyForm((previous) => ({
        ...previous,
        company_address: toText(
          parsed?.address || parsed?.formatted_address || previous.company_address
        ),
        company_city: toText(parsed?.city || previous.company_city),
        company_state: toText(parsed?.state || previous.company_state),
        company_postal_code: toText(parsed?.zip_code || previous.company_postal_code),
      }));
    },
  });

  const propertyLookupRef = useGoogleAddressLookup({
    enabled: open && step === 2 && inquiryFlowRule.showPropertySearch,
    country: "au",
    onAddressSelected: (parsed) => {
      const lookupLabel = toText(parsed?.formatted_address || parsed?.address);
      const lotNumber = toText(parsed?.lot_number);
      const unitNumber = toText(parsed?.unit_number);
      const address1 = toText(parsed?.address || lookupLabel);
      const suburbTown = toText(parsed?.city);
      const state = toText(parsed?.state);
      const postalCode = toText(parsed?.zip_code);
      const country = toText(parsed?.country || "AU");
      const propertyName = buildStandardPropertyName({
        lot_number: lotNumber,
        unit_number: unitNumber,
        address_1: address1,
        suburb_town: suburbTown,
        state,
        postal_code: postalCode,
        country,
      });
      setDetailsForm((previous) => ({
        ...previous,
        property_lookup: lookupLabel || previous.property_lookup,
        property_lot_number: lotNumber || previous.property_lot_number,
        property_unit_number: unitNumber || previous.property_unit_number,
        property_name: propertyName || previous.property_name,
        property_address_1: address1 || previous.property_address_1,
        property_suburb_town: suburbTown || previous.property_suburb_town,
        property_state: state || previous.property_state,
        property_postal_code: postalCode || previous.property_postal_code,
        property_country: country || previous.property_country || "AU",
      }));
    },
  });

  const standardizedPropertyName = useMemo(
    () =>
      buildStandardPropertyName({
        lot_number: detailsForm.property_lot_number,
        unit_number: detailsForm.property_unit_number,
        address_1: detailsForm.property_address_1 || detailsForm.property_lookup,
        suburb_town: detailsForm.property_suburb_town,
        state: detailsForm.property_state,
        postal_code: detailsForm.property_postal_code,
        country: detailsForm.property_country || "AU",
      }),
    [
      detailsForm.property_address_1,
      detailsForm.property_country,
      detailsForm.property_lookup,
      detailsForm.property_lot_number,
      detailsForm.property_postal_code,
      detailsForm.property_state,
      detailsForm.property_suburb_town,
      detailsForm.property_unit_number,
    ]
  );

  const shouldShowOtherSource = useMemo(
    () => shouldShowOtherSourceField(detailsForm.how_did_you_hear),
    [detailsForm.how_did_you_hear]
  );

  return {
    accountMode,
    companyForm,
    companyMatchState,
    companyAddressLookupRef,
    contactMatchState,
    detailsForm,
    individualAddressLookupRef,
    individualForm,
    inquiryFlowRule,
    isApplyingQuickSameAsContactProperty,
    isCreatingInquiry,
    isQuickPropertySameAsContact,
    isRelatedLoading,
    isServiceOptionsLoading,
    open,
    propertyLookupRef,
    propertyMatchState,
    relatedError,
    relatedInquiries,
    relatedJobs,
    serviceOptions,
    setAccountMode,
    setCompanyForm,
    setCompanyMatchState,
    setContactMatchState,
    setDetailsForm,
    setIndividualForm,
    setIsApplyingQuickSameAsContactProperty,
    setIsCreatingInquiry,
    setIsQuickPropertySameAsContact,
    setIsRelatedLoading,
    setIsServiceOptionsLoading,
    setPropertyMatchState,
    setRelatedError,
    setRelatedInquiries,
    setRelatedJobs,
    setServiceOptions,
    setShowCompanyOptional,
    setShowIndividualOptional,
    showCompanyOptional,
    showIndividualOptional,
    standardizedPropertyName,
    step,
    setStep,
    shouldShowOtherSource,
  };
}
