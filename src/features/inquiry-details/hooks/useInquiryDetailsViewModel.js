import { useMemo } from "react";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { normalizePropertyLookupRecord } from "@modules/details-workspace/exports/api.js";
import { formatDate, joinAddress, toText } from "@shared/utils/formatters.js";
import {
  parseListSelectionValue,
  serializeListSelectionValue,
} from "../shared/inquiryInformationHelpers.js";
import {
  getInquiryFlowRule,
  shouldShowOtherSourceField,
} from "../shared/inquiryFlowRules.js";
import { isPestServiceFlow } from "../shared/pestRules.js";
import {
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../shared/inquiryInformationConstants.js";
import {
  buildListSelectionTagItems,
  normalizeServiceInquiryId,
  toDateInput,
} from "../shared/inquiryDetailsFormatting.js";

export function useInquiryDetailsViewModel({
  activeRelatedProperty,
  hasUid,
  inquiry,
  inquiryAccountType,
  inquiryCompany,
  inquiryCompanyId,
  inquiryCompanyPrimaryPerson,
  inquiryContactId,
  inquiryDetailsForm,
  inquiryNumericId,
  inquiryPrimaryContact,
  inquiryPropertyId,
  inquiryPropertyRecord,
  inquiryServiceOptions,
  isContextLoading,
  isInquiryDetailsModalOpen,
  isPropertySameAsContact,
  isSdkReady,
  optimisticListSelectionByField,
  resolvedInquiry,
  safeUid,
  serviceInquiryLabelById,
  serviceInquiryName,
}) {
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
    () =>
      shouldShowOtherSourceField(toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear)),
    [inquiry]
  );
  const statusHowHeardDisplay =
    shouldShowStatusOther && statusOther ? statusOther : statusHowHeard;

  const requestDateRequired = formatDate(
    inquiry?.date_job_required_by || inquiry?.Date_Job_Required_By
  );
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
      admin_notes: notesAdmin,
      client_notes: notesClient,
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
          inquiry?.pest_active_times_options_as_text ||
            inquiry?.Pest_Active_Times_Options_As_Text,
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
    [inquiry, notesAdmin, notesClient]
  );

  const quickInquiryPrefillContext = useMemo(() => {
    const hasExistingInquiryContext =
      Boolean(toText(inquiryNumericId)) && toText(safeUid).toLowerCase() !== "new";
    if (!hasExistingInquiryContext) return null;

    const resolvedPropertyRecord = normalizePropertyLookupRecord(
      activeRelatedProperty || inquiryPropertyRecord || {}
    );
    const resolvedPropertyId = normalizePropertyId(
      resolvedPropertyRecord?.id ||
        inquiry?.property_id ||
        inquiry?.Property_ID ||
        inquiryPropertyId
    );

    return {
      account_type: inquiryAccountType || "Contact",
      contact: {
        id: inquiryContactId || toText(inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID),
        first_name: toText(inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name),
        last_name: toText(inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name),
        email: toText(inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email),
        sms_number: toText(inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number),
        address: toText(inquiryPrimaryContact?.address || inquiryPrimaryContact?.Address),
        city: toText(inquiryPrimaryContact?.city || inquiryPrimaryContact?.City),
        state: toText(inquiryPrimaryContact?.state || inquiryPrimaryContact?.State),
        zip_code: toText(
          inquiryPrimaryContact?.zip_code ||
            inquiryPrimaryContact?.Zip_Code ||
            inquiryPrimaryContact?.postal_code ||
            inquiryPrimaryContact?.Postal_Code
        ),
        country: toText(inquiryPrimaryContact?.country || inquiryPrimaryContact?.Country || "AU"),
      },
      company: {
        id: inquiryCompanyId || toText(inquiryCompany?.id || inquiryCompany?.ID),
        company_name: toText(inquiryCompany?.name || inquiryCompany?.Name),
        company_phone: toText(inquiryCompany?.phone || inquiryCompany?.Phone),
        company_address: toText(inquiryCompany?.address || inquiryCompany?.Address),
        company_city: toText(inquiryCompany?.city || inquiryCompany?.City),
        company_state: toText(inquiryCompany?.state || inquiryCompany?.State),
        company_postal_code: toText(
          inquiryCompany?.postal_code ||
            inquiryCompany?.Postal_Code ||
            inquiryCompany?.zip_code ||
            inquiryCompany?.Zip_Code
        ),
        company_account_type: toText(
          inquiryCompany?.account_type ||
            inquiryCompany?.Account_Type ||
            inquiry?.Company_Account_Type
        ),
        primary_first_name: toText(
          inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name
        ),
        primary_last_name: toText(
          inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
        ),
        primary_email: toText(
          inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email
        ),
        primary_sms_number: toText(
          inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
        ),
      },
      details: {
        inquiry_source: toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source),
        type: toText(inquiry?.type || inquiry?.Type),
        service_inquiry_id: normalizeServiceInquiryId(
          inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
        ),
        how_can_we_help: toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help),
        how_did_you_hear: toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear),
        other: toText(inquiry?.other || inquiry?.Other),
        noise_signs_options_as_text: toText(
          inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text
        ),
        pest_active_times_options_as_text: toText(
          inquiry?.pest_active_times_options_as_text ||
            inquiry?.Pest_Active_Times_Options_As_Text
        ),
        pest_location_options_as_text: toText(
          inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text
        ),
        property_id: resolvedPropertyId,
        property_name: toText(
          resolvedPropertyRecord?.property_name || resolvedPropertyRecord?.Property_Name
        ),
        property_lookup: joinAddress([
          resolvedPropertyRecord?.address_1 ||
            resolvedPropertyRecord?.Address_1 ||
            resolvedPropertyRecord?.address ||
            resolvedPropertyRecord?.Address,
          resolvedPropertyRecord?.suburb_town ||
            resolvedPropertyRecord?.Suburb_Town ||
            resolvedPropertyRecord?.city ||
            resolvedPropertyRecord?.City,
          resolvedPropertyRecord?.state || resolvedPropertyRecord?.State,
          resolvedPropertyRecord?.postal_code ||
            resolvedPropertyRecord?.Postal_Code ||
            resolvedPropertyRecord?.zip_code ||
            resolvedPropertyRecord?.Zip_Code,
          resolvedPropertyRecord?.country || resolvedPropertyRecord?.Country,
        ]),
        property_lot_number: toText(
          resolvedPropertyRecord?.lot_number || resolvedPropertyRecord?.Lot_Number
        ),
        property_unit_number: toText(
          resolvedPropertyRecord?.unit_number || resolvedPropertyRecord?.Unit_Number
        ),
        property_address_1: toText(
          resolvedPropertyRecord?.address_1 ||
            resolvedPropertyRecord?.Address_1 ||
            resolvedPropertyRecord?.address ||
            resolvedPropertyRecord?.Address
        ),
        property_suburb_town: toText(
          resolvedPropertyRecord?.suburb_town ||
            resolvedPropertyRecord?.Suburb_Town ||
            resolvedPropertyRecord?.city ||
            resolvedPropertyRecord?.City
        ),
        property_state: toText(resolvedPropertyRecord?.state || resolvedPropertyRecord?.State),
        property_postal_code: toText(
          resolvedPropertyRecord?.postal_code ||
            resolvedPropertyRecord?.Postal_Code ||
            resolvedPropertyRecord?.zip_code ||
            resolvedPropertyRecord?.Zip_Code
        ),
        property_country: toText(
          resolvedPropertyRecord?.country || resolvedPropertyRecord?.Country || "AU"
        ),
        property_record: resolvedPropertyRecord,
        admin_notes: notesAdmin,
        client_notes: notesClient,
      },
      property_same_as_contact: Boolean(isPropertySameAsContact),
    };
  }, [
    activeRelatedProperty,
    inquiry,
    inquiryAccountType,
    inquiryCompany,
    inquiryCompanyId,
    inquiryCompanyPrimaryPerson,
    inquiryContactId,
    inquiryNumericId,
    inquiryPrimaryContact,
    inquiryPropertyId,
    inquiryPropertyRecord,
    isPropertySameAsContact,
    notesAdmin,
    notesClient,
    safeUid,
  ]);

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
    if (
      selectedServiceId &&
      !options.some((option) => toText(option?.value) === selectedServiceId)
    ) {
      options.unshift({
        value: selectedServiceId,
        label: toText(serviceInquiryLabelById?.[selectedServiceId]) || `Service #${selectedServiceId}`,
      });
    }
    return options;
  }, [inquiryDetailsForm.service_inquiry_id, inquiryServiceOptions, serviceInquiryLabelById]);

  return {
    inquiryDetailsInitialForm,
    inquiryDisplayFlowRule,
    inquiryEditFlowRule,
    isInquiryEditPestService,
    isInquiryInitialLoadInProgress,
    notesAdmin,
    notesClient,
    quickInquiryPrefillContext,
    requestDateRequired,
    requestPestActiveTimesTags,
    requestPestLocationsTags,
    requestPestNoiseTags,
    requestRenovations,
    requestResidentAvailability,
    resolvedInquiryServiceOptions,
    selectedInquiryEditServiceLabel,
    shouldShowInquiryEditOther,
    shouldShowStatusOther,
    statusHowCanHelp,
    statusHowHeard,
    statusHowHeardDisplay,
    statusOther,
    statusServiceInquiryId,
    statusServiceName,
    statusServiceNameHref,
    statusSource,
    statusType,
  };
}
