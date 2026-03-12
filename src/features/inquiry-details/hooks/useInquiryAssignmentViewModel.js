import { useMemo } from "react";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { resolvePropertyLookupLabel } from "@modules/details-workspace/exports/api.js";
import {
  formatContactLookupLabel,
  formatServiceProviderAllocationLabel,
  formatServiceProviderInputLabel,
  fullName,
  toText,
} from "@shared/utils/formatters.js";
import {
  normalizeRelationRecord,
  normalizeServiceProviderContact,
} from "../shared/inquiryDetailsRecordHelpers.js";

export function useInquiryAssignmentViewModel({
  activeRelatedProperty,
  configuredAdminProviderId,
  inquiry,
  inquiryContactId,
  inquiryPrimaryContact,
  inquiryTakenByFallback,
  inquiryTakenByLookup,
  safeUid,
  serviceInquiryName,
  serviceProvider,
  serviceProviderContact,
  serviceProviderFallbackRecord,
  serviceProviderFallbackContact,
  serviceProviderLookup,
}) {
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
    toText(serviceProviderContact?.email) || toText(serviceProviderFallbackContact?.email);
  const serviceProviderPhone =
    toText(serviceProviderContact?.sms_number) ||
    toText(serviceProviderFallbackContact?.sms_number);

  const inquiryTakenByStoredId = toText(
    inquiry?.Inquiry_Taken_By_id || inquiry?.Inquiry_Taken_By_ID || inquiry?.inquiry_taken_by_id
  );
  const inquiryTakenByIdResolved = inquiryTakenByStoredId || configuredAdminProviderId;
  const inquiryTakenByFallbackRecord = normalizeRelationRecord(inquiryTakenByFallback);
  const inquiryTakenByFallbackContact = normalizeServiceProviderContact(
    inquiryTakenByFallbackRecord
  );

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
    const serviceLabel = toText(serviceInquiryName);
    const inquiryTypeLabel = toText(inquiry?.type || inquiry?.Type);
    const title = [safeUid, serviceLabel, inquiryTypeLabel].filter(Boolean).join(" | ");
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
    inquiry,
    inquiryContactId,
    inquiryPrimaryContact,
    safeUid,
    serviceInquiryName,
    serviceProviderIdResolved,
    serviceProviderPrefillLabel,
  ]);

  return {
    hasServiceProviderRelationDetails,
    inquiryAppointmentPrefillContext,
    inquiryTakenByFallbackContact,
    inquiryTakenByFallbackRecord,
    inquiryTakenByIdResolved,
    inquiryTakenByPrefillLabel,
    inquiryTakenBySearchItems,
    inquiryTakenBySelectedLookupRecord,
    inquiryTakenByStoredId,
    serviceProviderEmail,
    serviceProviderIdResolved,
    serviceProviderPhone,
    serviceProviderPrefillLabel,
    serviceProviderSearchItems,
  };
}
