import { useCallback, useMemo } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import {
  dedupePropertyLookupRecords,
  normalizePropertyLookupRecord,
  buildComparablePropertyAddress,
  normalizeAddressText,
} from "@modules/details-workspace/exports/api.js";
import { searchPropertiesForLookup } from "../../../../modules/details-workspace/api/core/runtime.js";
import { joinAddress, toText } from "@shared/utils/formatters.js";
import { buildStandardPropertyName } from "../../shared/quickInquiryHelpers.js";
import { resolveAddressFromGoogleLookup } from "../../shared/inquiryDetailsFormatting.js";
import { useQuickInquiryBookingCreate } from "../../hooks/useQuickInquiryBookingCreate.js";
import { useQuickInquiryBookingData } from "../../hooks/useQuickInquiryBookingData.js";
import { useQuickInquiryBookingForm } from "../../hooks/useQuickInquiryBookingForm.js";
import { QuickInquiryAccountStep } from "./QuickInquiryAccountStep.jsx";
import { QuickInquiryDetailsStep } from "./QuickInquiryDetailsStep.jsx";
import { QuickInquiryRelatedSidebar } from "./QuickInquiryRelatedSidebar.jsx";

const matchMessageClassByStatus = {
  found: "text-emerald-700",
  checking: "text-slate-500",
  error: "text-red-600",
  invalid: "text-amber-700",
  "not-found": "text-slate-500",
};

export function QuickInquiryBookingModal({
  open,
  onClose,
  plugin,
  inquiryId = "",
  prefillContext = null,
  configuredAdminProviderId = "",
  onSavingStart = null,
  onSavingProgress = null,
  onSaved = null,
  onError = null,
}) {
  const form = useQuickInquiryBookingForm({ open, prefillContext });
  const {
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
    setIsQuickPropertySameAsContact,
    setPropertyMatchState,
    setRelatedError,
    setRelatedInquiries,
    setRelatedJobs,
    setServiceOptions,
    setShowCompanyOptional,
    setShowIndividualOptional,
    setIsRelatedLoading,
    setIsServiceOptionsLoading,
    showCompanyOptional,
    showIndividualOptional,
    standardizedPropertyName,
    step,
    setStep,
    shouldShowOtherSource,
  } = form;

  const {
    currentAccountType,
    currentMatchedAccountId,
    isQuickPestServiceSelected,
    serviceNameById,
  } = useQuickInquiryBookingData({
    accountMode,
    companyForm,
    companyMatchState,
    contactMatchState,
    detailsForm,
    individualForm,
    inquiryFlowRule,
    open,
    plugin,
    serviceOptions,
    setCompanyForm,
    setCompanyMatchState,
    setContactMatchState,
    setIndividualForm,
    setIsRelatedLoading,
    setIsServiceOptionsLoading,
    setPropertyMatchState,
    setRelatedError,
    setRelatedInquiries,
    setRelatedJobs,
    setServiceOptions,
    standardizedPropertyName,
  });

  const canProceedStepOne =
    accountMode === "company"
      ? Boolean(toText(companyForm.company_name))
      : Boolean(toText(individualForm.email));
  const canCreateInquiry =
    Boolean(toText(inquiryId)) &&
    Boolean(toText(detailsForm.inquiry_source)) &&
    Boolean(toText(detailsForm.type)) &&
    !isApplyingQuickSameAsContactProperty &&
    !isCreatingInquiry;

  const quickSameAsContactPropertySource = useMemo(() => {
    if (accountMode === "company") {
      const matchedRecord = companyMatchState.record || {};
      const address1 = toText(
        companyForm.company_address || matchedRecord?.address || matchedRecord?.Address
      );
      const suburbTown = toText(companyForm.company_city || matchedRecord?.city || matchedRecord?.City);
      const state = toText(companyForm.company_state || matchedRecord?.state || matchedRecord?.State);
      const postalCode = toText(
        companyForm.company_postal_code ||
          matchedRecord?.postal_code ||
          matchedRecord?.Postal_Code ||
          matchedRecord?.zip_code ||
          matchedRecord?.Zip_Code
      );
      const country = toText(matchedRecord?.country || matchedRecord?.Country || "AU") || "AU";
      return {
        address1,
        suburbTown,
        state,
        postalCode,
        country,
        searchText: joinAddress([address1, suburbTown, state, postalCode]),
      };
    }
    const matchedRecord = contactMatchState.record || {};
    const address1 = toText(individualForm.address || matchedRecord?.address || matchedRecord?.Address);
    const suburbTown = toText(individualForm.city || matchedRecord?.city || matchedRecord?.City);
    const state = toText(individualForm.state || matchedRecord?.state || matchedRecord?.State);
    const postalCode = toText(
      individualForm.zip_code ||
        matchedRecord?.zip_code ||
        matchedRecord?.Zip_Code ||
        matchedRecord?.postal_code ||
        matchedRecord?.Postal_Code
    );
    const country = toText(
      individualForm.country || matchedRecord?.country || matchedRecord?.Country || "AU"
    ) || "AU";
    return {
      address1,
      suburbTown,
      state,
      postalCode,
      country,
      searchText: joinAddress([address1, suburbTown, state, postalCode]),
    };
  }, [accountMode, companyForm, companyMatchState.record, contactMatchState.record, individualForm]);

  const handleQuickSameAsContactPropertyChange = useCallback(
    async (checked) => {
      setIsQuickPropertySameAsContact(Boolean(checked));
      if (!checked) return;

      const sourceAddress = toText(quickSameAsContactPropertySource?.address1);
      const sourceSuburb = toText(quickSameAsContactPropertySource?.suburbTown);
      const sourceState = toText(quickSameAsContactPropertySource?.state);
      const sourcePostal = toText(quickSameAsContactPropertySource?.postalCode);
      const sourceCountry = toText(quickSameAsContactPropertySource?.country || "AU") || "AU";
      const concatenatedSourceAddress = toText(
        quickSameAsContactPropertySource?.searchText ||
          joinAddress([sourceAddress, sourceSuburb, sourceState, sourcePostal])
      );

      if (!concatenatedSourceAddress) {
        setIsQuickPropertySameAsContact(false);
        onError?.(new Error("No address is available on the current account."));
        return;
      }

      setIsApplyingQuickSameAsContactProperty(true);
      try {
        const googleResolvedAddress = await resolveAddressFromGoogleLookup(concatenatedSourceAddress);
        const derivedAddress1 = toText(
          googleResolvedAddress?.address || sourceAddress || concatenatedSourceAddress
        );
        const derivedSuburb = toText(googleResolvedAddress?.city || sourceSuburb);
        const derivedState = toText(googleResolvedAddress?.state || sourceState);
        const derivedPostal = toText(googleResolvedAddress?.zip_code || sourcePostal);
        const derivedCountry = toText(googleResolvedAddress?.country || sourceCountry) || sourceCountry;
        const derivedLot = toText(googleResolvedAddress?.lot_number);
        const derivedUnit = toText(googleResolvedAddress?.unit_number);
        const searchText = toText(
          googleResolvedAddress?.formatted_address ||
            joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) ||
            concatenatedSourceAddress
        );

        if (!derivedAddress1 && !searchText) {
          throw new Error("No address is available on the current account.");
        }

        let matchedExistingProperty = null;
        if (plugin?.switchTo) {
          const searchedRecords = await searchPropertiesForLookup({ plugin, query: searchText, limit: 25 });
          const normalizedSearchedRecords = dedupePropertyLookupRecords(searchedRecords || []);
          const targetComparableAddress = normalizeAddressText(
            joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) || searchText
          );
          matchedExistingProperty =
            normalizedSearchedRecords.find(
              (record) => buildComparablePropertyAddress(record) === targetComparableAddress
            ) ||
            normalizedSearchedRecords.find((record) => {
              const comparable = buildComparablePropertyAddress(record);
              return Boolean(
                comparable && targetComparableAddress && comparable.includes(targetComparableAddress)
              );
            }) ||
            null;
        }

        const normalizedMatchedProperty = normalizePropertyLookupRecord(matchedExistingProperty || {});
        const nextLot = toText(normalizedMatchedProperty?.lot_number || derivedLot);
        const nextUnit = toText(normalizedMatchedProperty?.unit_number || derivedUnit);
        const nextAddress1 = toText(
          normalizedMatchedProperty?.address_1 ||
            normalizedMatchedProperty?.address ||
            derivedAddress1
        );
        const nextSuburb = toText(
          normalizedMatchedProperty?.suburb_town ||
            normalizedMatchedProperty?.city ||
            derivedSuburb
        );
        const nextState = toText(normalizedMatchedProperty?.state || derivedState);
        const nextPostal = toText(
          normalizedMatchedProperty?.postal_code ||
            normalizedMatchedProperty?.zip_code ||
            derivedPostal
        );
        const nextCountry = toText(normalizedMatchedProperty?.country || derivedCountry || "AU") || "AU";
        const nextPropertyName =
          toText(normalizedMatchedProperty?.property_name) ||
          buildStandardPropertyName({
            lot_number: nextLot,
            unit_number: nextUnit,
            address_1: nextAddress1,
            suburb_town: nextSuburb,
            state: nextState,
            postal_code: nextPostal,
            country: nextCountry,
          }) ||
          searchText;
        const nextLookup = toText(googleResolvedAddress?.formatted_address || searchText || nextAddress1);

        setDetailsForm((previous) => ({
          ...previous,
          property_lookup: nextLookup,
          property_lot_number: nextLot,
          property_unit_number: nextUnit,
          property_name: nextPropertyName,
          property_address_1: nextAddress1,
          property_suburb_town: nextSuburb,
          property_state: nextState,
          property_postal_code: nextPostal,
          property_country: nextCountry,
        }));

        if (matchedExistingProperty) {
          setPropertyMatchState({
            status: "found",
            message: "Property already exists and will be linked.",
            record: normalizedMatchedProperty,
          });
        }
      } catch (applyError) {
        console.error("[QuickInquiry] Failed same-as-contact property flow", applyError);
        setIsQuickPropertySameAsContact(false);
        onError?.(
          new Error(applyError?.message || "Unable to apply contact address to property.")
        );
      } finally {
        setIsApplyingQuickSameAsContactProperty(false);
      }
    },
    [
      onError,
      plugin,
      quickSameAsContactPropertySource,
      setDetailsForm,
      setIsApplyingQuickSameAsContactProperty,
      setIsQuickPropertySameAsContact,
      setPropertyMatchState,
    ]
  );

  const handleCreateQuickInquiry = useQuickInquiryBookingCreate({
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
    setIsCreatingInquiry: form.setIsCreatingInquiry,
    shouldShowOtherSource,
    standardizedPropertyName,
  });

  return (
    <Modal
      open={open}
      onClose={isCreatingInquiry ? () => {} : onClose}
      title="Quick Inquiry Booking"
      widthClass="max-w-[min(98vw,1220px)]"
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">Step {step} of 2</div>
          <div className="flex items-center gap-2">
            {step === 2 ? (
              <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={isCreatingInquiry}>
                Back
              </Button>
            ) : null}
            {step === 1 ? (
              <Button variant="primary" size="sm" onClick={() => setStep(2)} disabled={!canProceedStepOne}>
                Next
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleCreateQuickInquiry} disabled={!canCreateInquiry}>
                {isCreatingInquiry ? "Saving..." : "Save Inquiry"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="max-h-[76vh] overflow-y-auto pr-1">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              step === 1 ? "bg-[#003882] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            1. Account
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              step === 2 ? "bg-[#003882] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            2. Inquiry Details
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {step === 1 ? (
              <QuickInquiryAccountStep
                accountMode={accountMode}
                companyForm={companyForm}
                companyMatchState={companyMatchState}
                companyAddressLookupRef={companyAddressLookupRef}
                contactMatchState={contactMatchState}
                individualAddressLookupRef={individualAddressLookupRef}
                individualForm={individualForm}
                matchMessageClassByStatus={matchMessageClassByStatus}
                setAccountMode={setAccountMode}
                setCompanyForm={setCompanyForm}
                setIndividualForm={setIndividualForm}
                setShowCompanyOptional={setShowCompanyOptional}
                setShowIndividualOptional={setShowIndividualOptional}
                showCompanyOptional={showCompanyOptional}
                showIndividualOptional={showIndividualOptional}
              />
            ) : (
              <QuickInquiryDetailsStep
                detailsForm={detailsForm}
                handleQuickSameAsContactPropertyChange={handleQuickSameAsContactPropertyChange}
                inquiryFlowRule={inquiryFlowRule}
                isApplyingQuickSameAsContactProperty={isApplyingQuickSameAsContactProperty}
                isQuickPestServiceSelected={isQuickPestServiceSelected}
                isQuickPropertySameAsContact={isQuickPropertySameAsContact}
                isServiceOptionsLoading={isServiceOptionsLoading}
                matchMessageClassByStatus={matchMessageClassByStatus}
                propertyLookupRef={propertyLookupRef}
                propertyMatchState={propertyMatchState}
                quickSameAsContactPropertySource={quickSameAsContactPropertySource}
                serviceOptions={serviceOptions}
                setDetailsForm={setDetailsForm}
                shouldShowOtherSource={shouldShowOtherSource}
              />
            )}

            {/* Notes — visible on both steps */}
            <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-3 md:grid-cols-2">
              <label className="block">
                <span className="type-label text-slate-600">Admin Notes</span>
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                  rows={3}
                  value={detailsForm.admin_notes}
                  onChange={(event) =>
                    setDetailsForm((previous) => ({
                      ...previous,
                      admin_notes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="type-label text-slate-600">Client Notes</span>
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                  rows={3}
                  value={detailsForm.client_notes}
                  onChange={(event) =>
                    setDetailsForm((previous) => ({
                      ...previous,
                      client_notes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <QuickInquiryRelatedSidebar
            currentAccountType={currentAccountType}
            currentMatchedAccountId={currentMatchedAccountId}
            isRelatedLoading={isRelatedLoading}
            relatedError={relatedError}
            relatedInquiries={relatedInquiries}
            relatedJobs={relatedJobs}
            serviceNameById={serviceNameById}
          />
        </div>
      </div>
    </Modal>
  );
}
