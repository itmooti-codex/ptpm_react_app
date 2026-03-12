import { useCallback } from "react";
import {
  compactStringFields,
  toText,
} from "@shared/utils/formatters.js";
import { isLikelyEmailValue } from "@shared/utils/accountTypeUtils.js";
import {
  dedupePropertyLookupRecords,
  normalizePropertyLookupRecord,
  buildComparablePropertyAddress,
  normalizeAddressText,
} from "@modules/details-workspace/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import {
  createCompanyRecord,
  createContactRecord,
  createPropertyRecord,
  searchPropertiesForLookup,
} from "../../../modules/details-workspace/api/core/runtime.js";
import { updateInquiryFieldsById } from "../../../modules/job-records/exports/api.js";
import {
  fetchCompanyByExactName,
  fetchContactByExactEmail,
} from "../api/inquiryLookupApi.js";
import { getInquiryFlowRule } from "../shared/inquiryFlowRules.js";
import {
  normalizeMutationIdentifier,
} from "../api/inquiryCoreApi.js";
import {
  normalizeServiceInquiryId,
  resolveAddressFromGoogleLookup,
  toNullableText,
} from "../shared/inquiryDetailsFormatting.js";
import {
  buildStandardPropertyName,
  normalizeComparablePropertyName,
  normalizeComparableText,
  resolveLookupRecordId,
} from "../shared/quickInquiryHelpers.js";

export function useQuickInquiryBookingCreate({
  accountMode,
  companyForm,
  companyMatchState,
  configuredAdminProviderId,
  contactMatchState,
  detailsForm,
  inquiryId,
  individualForm,
  isCreatingInquiry,
  isQuickPestServiceSelected,
  isQuickPropertySameAsContact,
  onError,
  onSaved,
  onSavingProgress,
  onSavingStart,
  plugin,
  propertyMatchState,
  setIsCreatingInquiry,
  shouldShowOtherSource,
  standardizedPropertyName,
}) {
  return useCallback(async () => {
    if (!plugin) {
      onError?.(new Error("SDK is still initializing. Please wait."));
      return;
    }
    const normalizedInquiryId = toText(inquiryId);
    if (!normalizedInquiryId) {
      onError?.(new Error("Inquiry is still being prepared. Please wait a moment."));
      return;
    }
    if (isCreatingInquiry) return;

    const resolvedAccountMode = accountMode === "company" ? "Company" : "Contact";
    const currentFlowRule = getInquiryFlowRule(detailsForm.type);
    const sourceValue = toText(detailsForm.inquiry_source);
    const typeValue = toText(detailsForm.type);
    if (!sourceValue || !typeValue) {
      onError?.(new Error("Source and Type are required before creating inquiry."));
      return;
    }
    if (resolvedAccountMode === "Contact") {
      const email = toText(individualForm.email);
      if (!email || !isLikelyEmailValue(email)) {
        onError?.(new Error("A valid email is required for individual inquiry."));
        return;
      }
    } else if (!toText(companyForm.company_name)) {
      onError?.(new Error("Company name is required for company inquiry."));
      return;
    }

    const optimisticInquiryPatch = {
      inquiry_status: "New Inquiry",
      account_type: resolvedAccountMode,
      inquiry_source: toText(sourceValue),
      type: toText(typeValue),
      service_inquiry_id: currentFlowRule.showServiceInquiry
        ? normalizeServiceInquiryId(detailsForm.service_inquiry_id)
        : "",
      how_can_we_help: currentFlowRule.showHowCanWeHelp ? toText(detailsForm.how_can_we_help) : "",
      how_did_you_hear: currentFlowRule.showHowDidYouHear
        ? toText(detailsForm.how_did_you_hear)
        : "",
      other:
        currentFlowRule.showHowDidYouHear && shouldShowOtherSource ? toText(detailsForm.other) : "",
      noise_signs_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.noise_signs_options_as_text)
        : "",
      pest_active_times_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.pest_active_times_options_as_text)
        : "",
      pest_location_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.pest_location_options_as_text)
        : "",
      admin_notes: toText(detailsForm.admin_notes),
      client_notes: toText(detailsForm.client_notes),
      Inquiry_Taken_By_id: configuredAdminProviderId
        ? normalizeMutationIdentifier(configuredAdminProviderId)
        : null,
    };
    if (currentFlowRule.showPropertySearch) {
      const optimisticPropertyName = toText(
        standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
      );
      const matchedPropertyId = normalizePropertyId(
        propertyMatchState.record?.id || propertyMatchState.record?.ID
      );
      optimisticInquiryPatch.property_id = matchedPropertyId || "";
      optimisticInquiryPatch.Property = {
        id: matchedPropertyId || "",
        property_name: optimisticPropertyName,
        address_1: toText(detailsForm.property_address_1 || detailsForm.property_lookup),
        suburb_town: toText(detailsForm.property_suburb_town),
        state: toText(detailsForm.property_state),
        postal_code: toText(detailsForm.property_postal_code),
        country: toText(detailsForm.property_country || "AU"),
      };
    }
    if (resolvedAccountMode === "Contact") {
      const matchedContactId = resolveLookupRecordId(contactMatchState.record, "Contact");
      optimisticInquiryPatch.primary_contact_id = matchedContactId || "";
      optimisticInquiryPatch.Primary_Contact = {
        id: matchedContactId || "",
        first_name: toText(individualForm.first_name),
        last_name: toText(individualForm.last_name),
        email: toText(individualForm.email),
        sms_number: toText(individualForm.sms_number),
        address: toText(individualForm.address),
        city: toText(individualForm.city),
        state: toText(individualForm.state),
        zip_code: toText(individualForm.zip_code),
        country: toText(individualForm.country || "AU"),
      };
    } else {
      const matchedCompanyId = resolveLookupRecordId(companyMatchState.record, "Company");
      optimisticInquiryPatch.company_id = matchedCompanyId || "";
      optimisticInquiryPatch.Company = {
        id: matchedCompanyId || "",
        name: toText(companyForm.company_name),
        phone: toText(companyForm.company_phone),
        address: toText(companyForm.company_address),
        city: toText(companyForm.company_city),
        state: toText(companyForm.company_state),
        postal_code: toText(companyForm.company_postal_code),
        account_type: toText(companyForm.company_account_type),
        Primary_Person: {
          first_name: toText(companyForm.primary_first_name),
          last_name: toText(companyForm.primary_last_name),
          email: toText(companyForm.primary_email),
          sms_number: toText(companyForm.primary_sms_number),
        },
      };
    }

    setIsCreatingInquiry(true);
    onSavingStart?.(optimisticInquiryPatch);
    try {
      let resolvedContactId = "";
      let resolvedCompanyId = "";

      onSavingProgress?.("Saving account information...");
      if (resolvedAccountMode === "Contact") {
        const email = toText(individualForm.email);
        const matchedRecord = contactMatchState.record;
        const matchedEmail = normalizeComparableText(matchedRecord?.email || matchedRecord?.Email);
        const shouldUseMatched =
          Boolean(matchedRecord) && matchedEmail === normalizeComparableText(email);
        if (shouldUseMatched) {
          resolvedContactId = resolveLookupRecordId(matchedRecord, "Contact");
        }
        if (!resolvedContactId) {
          resolvedContactId = resolveLookupRecordId(
            await fetchContactByExactEmail({ plugin, email }),
            "Contact"
          );
        }
        if (!resolvedContactId) {
          const payload = compactStringFields({
            first_name: individualForm.first_name,
            last_name: individualForm.last_name,
            email,
            sms_number: individualForm.sms_number,
            address: individualForm.address,
            city: individualForm.city,
            state: individualForm.state,
            zip_code: individualForm.zip_code,
            country: individualForm.country || "AU",
          });
          try {
            resolvedContactId = resolveLookupRecordId(
              await createContactRecord({ plugin, payload }),
              "Contact"
            );
          } catch (createError) {
            resolvedContactId = resolveLookupRecordId(
              await fetchContactByExactEmail({ plugin, email }),
              "Contact"
            );
            if (!resolvedContactId) throw createError;
          }
          if (!resolvedContactId) {
            resolvedContactId = resolveLookupRecordId(
              await fetchContactByExactEmail({ plugin, email }),
              "Contact"
            );
          }
        }
        if (!resolvedContactId) {
          throw new Error("Unable to resolve contact for this inquiry.");
        }
      } else {
        const companyName = toText(companyForm.company_name);
        const matchedRecord = companyMatchState.record;
        const matchedName = normalizeComparableText(matchedRecord?.name || matchedRecord?.Name);
        const shouldUseMatched =
          Boolean(matchedRecord) && matchedName === normalizeComparableText(companyName);
        if (shouldUseMatched) {
          resolvedCompanyId = resolveLookupRecordId(matchedRecord, "Company");
        }
        if (!resolvedCompanyId) {
          resolvedCompanyId = resolveLookupRecordId(
            await fetchCompanyByExactName({ plugin, companyName }),
            "Company"
          );
        }
        if (!resolvedCompanyId) {
          const primaryPersonPayload = compactStringFields({
            first_name: companyForm.primary_first_name,
            last_name: companyForm.primary_last_name,
            email: companyForm.primary_email,
            sms_number: companyForm.primary_sms_number,
          });
          const companyPayload = compactStringFields({
            name: companyName,
            phone: companyForm.company_phone,
            address: companyForm.company_address,
            city: companyForm.company_city,
            state: companyForm.company_state,
            postal_code: companyForm.company_postal_code,
            account_type: companyForm.company_account_type,
          });
          if (Object.keys(primaryPersonPayload).length) {
            companyPayload.Primary_Person = primaryPersonPayload;
          }
          try {
            resolvedCompanyId = resolveLookupRecordId(
              await createCompanyRecord({ plugin, payload: companyPayload }),
              "Company"
            );
          } catch (createError) {
            resolvedCompanyId = resolveLookupRecordId(
              await fetchCompanyByExactName({ plugin, companyName }),
              "Company"
            );
            if (!resolvedCompanyId) throw createError;
          }
          if (!resolvedCompanyId) {
            resolvedCompanyId = resolveLookupRecordId(
              await fetchCompanyByExactName({ plugin, companyName }),
              "Company"
            );
          }
        }
        if (!resolvedCompanyId) {
          throw new Error("Unable to resolve company for this inquiry.");
        }
      }

      onSavingProgress?.("Saving property information...");
      let resolvedPropertyId = "";
      let resolvedPropertyRecord = null;
      if (currentFlowRule.showPropertySearch) {
        const propertyName = toText(
          standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
        );
        const propertyDraft = {
          property_name: propertyName,
          lot_number: toText(detailsForm.property_lot_number),
          unit_number: toText(detailsForm.property_unit_number),
          address_1: toText(detailsForm.property_address_1 || detailsForm.property_lookup),
          suburb_town: toText(detailsForm.property_suburb_town),
          state: toText(detailsForm.property_state),
          postal_code: toText(detailsForm.property_postal_code),
          country: toText(detailsForm.property_country || "AU"),
        };
        const matchedProperty = propertyMatchState.record;
        const comparableTargetPropertyName = normalizeComparablePropertyName(propertyName);
        const comparableMatchedPropertyName = normalizeComparablePropertyName(
          matchedProperty?.property_name || matchedProperty?.Property_Name
        );
        if (
          matchedProperty &&
          comparableTargetPropertyName &&
          comparableMatchedPropertyName === comparableTargetPropertyName
        ) {
          resolvedPropertyId = normalizePropertyId(matchedProperty?.id || matchedProperty?.ID);
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            ...(matchedProperty || {}),
            id: resolvedPropertyId || matchedProperty?.id || matchedProperty?.ID || "",
          });
        } else if (propertyName) {
          const createdProperty = await createPropertyRecord({
            plugin,
            payload: compactStringFields(propertyDraft),
          });
          resolvedPropertyId = normalizePropertyId(createdProperty?.id || createdProperty?.ID);
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            ...(createdProperty || {}),
            id: resolvedPropertyId || createdProperty?.id || createdProperty?.ID || "",
          });
        }
        if (resolvedPropertyId && !resolvedPropertyRecord) {
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            id: resolvedPropertyId,
          });
        }
      }

      const payload = {
        inquiry_status: "New Inquiry",
        account_type: resolvedAccountMode,
        primary_contact_id:
          resolvedAccountMode === "Contact"
            ? normalizeMutationIdentifier(resolvedContactId)
            : null,
        company_id:
          resolvedAccountMode === "Company"
            ? normalizeMutationIdentifier(resolvedCompanyId)
            : null,
        inquiry_source: toNullableText(sourceValue),
        type: toNullableText(typeValue),
        service_inquiry_id: currentFlowRule.showServiceInquiry
          ? normalizeMutationIdentifier(normalizeServiceInquiryId(detailsForm.service_inquiry_id))
          : null,
        how_can_we_help: currentFlowRule.showHowCanWeHelp
          ? toNullableText(detailsForm.how_can_we_help)
          : null,
        how_did_you_hear: currentFlowRule.showHowDidYouHear
          ? toNullableText(detailsForm.how_did_you_hear)
          : null,
        other:
          currentFlowRule.showHowDidYouHear && shouldShowOtherSource
            ? toNullableText(detailsForm.other)
            : null,
        noise_signs_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.noise_signs_options_as_text)
          : null,
        pest_active_times_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.pest_active_times_options_as_text)
          : null,
        pest_location_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.pest_location_options_as_text)
          : null,
        admin_notes: toNullableText(detailsForm.admin_notes),
        client_notes: toNullableText(detailsForm.client_notes),
        property_id:
          currentFlowRule.showPropertySearch && resolvedPropertyId
            ? normalizeMutationIdentifier(resolvedPropertyId)
            : null,
        Inquiry_Taken_By_id: configuredAdminProviderId
          ? normalizeMutationIdentifier(configuredAdminProviderId)
          : null,
      };

      onSavingProgress?.("Saving service information...");
      await updateInquiryFieldsById({
        plugin,
        inquiryId: normalizedInquiryId,
        payload,
      });
      onSaved?.({
        id: normalizedInquiryId,
        propertyId: resolvedPropertyId,
        propertyRecord: resolvedPropertyRecord,
        isPropertySameAsContact: Boolean(
          currentFlowRule.showPropertySearch && isQuickPropertySameAsContact
        ),
      });
    } catch (saveError) {
      onError?.(saveError);
    } finally {
      setIsCreatingInquiry(false);
    }
  }, [
    accountMode,
    companyForm.company_account_type,
    companyForm.company_address,
    companyForm.company_city,
    companyForm.company_name,
    companyForm.company_phone,
    companyForm.company_postal_code,
    companyForm.company_state,
    companyForm.primary_email,
    companyForm.primary_first_name,
    companyForm.primary_last_name,
    companyForm.primary_sms_number,
    companyMatchState.record,
    configuredAdminProviderId,
    contactMatchState.record,
    detailsForm.admin_notes,
    detailsForm.client_notes,
    detailsForm.how_can_we_help,
    detailsForm.how_did_you_hear,
    detailsForm.inquiry_source,
    detailsForm.noise_signs_options_as_text,
    detailsForm.other,
    detailsForm.pest_active_times_options_as_text,
    detailsForm.pest_location_options_as_text,
    detailsForm.property_address_1,
    detailsForm.property_country,
    detailsForm.property_lot_number,
    detailsForm.property_lookup,
    detailsForm.property_name,
    detailsForm.property_postal_code,
    detailsForm.property_state,
    detailsForm.property_suburb_town,
    detailsForm.property_unit_number,
    detailsForm.service_inquiry_id,
    detailsForm.type,
    inquiryId,
    individualForm.address,
    individualForm.city,
    individualForm.country,
    individualForm.email,
    individualForm.first_name,
    individualForm.last_name,
    individualForm.sms_number,
    individualForm.state,
    individualForm.zip_code,
    isCreatingInquiry,
    isQuickPestServiceSelected,
    isQuickPropertySameAsContact,
    onError,
    onSaved,
    onSavingProgress,
    onSavingStart,
    plugin,
    propertyMatchState.record,
    setIsCreatingInquiry,
    shouldShowOtherSource,
    standardizedPropertyName,
  ]);
}
