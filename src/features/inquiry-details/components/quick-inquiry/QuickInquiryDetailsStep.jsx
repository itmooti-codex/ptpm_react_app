import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectInput } from "@modules/details-workspace/exports/components.js";
import { toText } from "@shared/utils/formatters.js";
import { InquiryEditListSelectionField } from "../InquiryEditFields.jsx";
import {
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../../shared/inquiryInformationConstants.js";
import { normalizeServiceInquiryId } from "../../shared/inquiryDetailsFormatting.js";
import { buildStandardPropertyName } from "../../shared/quickInquiryHelpers.js";

export function QuickInquiryDetailsStep({
  detailsForm,
  handleQuickSameAsContactPropertyChange,
  inquiryFlowRule,
  isApplyingQuickSameAsContactProperty,
  isQuickPestServiceSelected,
  isQuickPropertySameAsContact,
  isServiceOptionsLoading,
  matchMessageClassByStatus,
  propertyLookupRef,
  propertyMatchState,
  quickSameAsContactPropertySource,
  serviceOptions,
  setDetailsForm,
  shouldShowOtherSource,
}) {
  return (
    <>
      <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <SelectInput
            label="Source"
            field="quick_inquiry_source"
            options={INQUIRY_SOURCE_OPTIONS}
            value={detailsForm.inquiry_source}
            onChange={(nextValue) =>
              setDetailsForm((previous) => ({ ...previous, inquiry_source: nextValue }))
            }
          />
          <SelectInput
            label="Type"
            field="quick_inquiry_type"
            options={INQUIRY_TYPE_OPTIONS}
            value={detailsForm.type}
            onChange={(nextValue) =>
              setDetailsForm((previous) => ({ ...previous, type: nextValue }))
            }
          />
          {inquiryFlowRule.showServiceInquiry ? (
            <SelectInput
              label={isServiceOptionsLoading ? "Service (Loading...)" : "Service"}
              field="quick_inquiry_service"
              options={serviceOptions}
              value={detailsForm.service_inquiry_id}
              onChange={(nextValue) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  service_inquiry_id: normalizeServiceInquiryId(nextValue),
                }))
              }
            />
          ) : null}
          {inquiryFlowRule.showHowDidYouHear ? (
            <SelectInput
              label="How Did You Hear"
              field="quick_how_did_you_hear"
              options={HOW_DID_YOU_HEAR_OPTIONS}
              value={detailsForm.how_did_you_hear}
              onChange={(nextValue) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  how_did_you_hear: nextValue,
                }))
              }
            />
          ) : null}
          {inquiryFlowRule.showHowDidYouHear && shouldShowOtherSource ? (
            <InputField
              label="Other"
              field="quick_how_did_you_hear_other"
              value={detailsForm.other}
              onChange={(event) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  other: event.target.value,
                }))
              }
            />
          ) : null}
        </div>

        {inquiryFlowRule.showServiceInquiry && isQuickPestServiceSelected ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <InquiryEditListSelectionField
              label="Pest Noise Signs"
              field="quick_noise_signs_options_as_text"
              value={detailsForm.noise_signs_options_as_text}
              options={NOISE_SIGN_OPTIONS}
              onChange={(nextValue) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  noise_signs_options_as_text: nextValue,
                }))
              }
            />
            <InquiryEditListSelectionField
              label="Pest Active Times"
              field="quick_pest_active_times_options_as_text"
              value={detailsForm.pest_active_times_options_as_text}
              options={PEST_ACTIVE_TIME_OPTIONS}
              onChange={(nextValue) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  pest_active_times_options_as_text: nextValue,
                }))
              }
            />
            <InquiryEditListSelectionField
              label="Pest Locations"
              field="quick_pest_location_options_as_text"
              value={detailsForm.pest_location_options_as_text}
              options={PEST_LOCATION_OPTIONS}
              onChange={(nextValue) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  pest_location_options_as_text: nextValue,
                }))
              }
            />
          </div>
        ) : null}

        {inquiryFlowRule.showHowCanWeHelp ? (
          <label className="block">
            <span className="type-label text-slate-600">How Can We Help</span>
            <textarea
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              rows={4}
              value={detailsForm.how_can_we_help}
              onChange={(event) =>
                setDetailsForm((previous) => ({
                  ...previous,
                  how_can_we_help: event.target.value,
                }))
              }
            />
          </label>
        ) : null}

        {inquiryFlowRule.showPropertySearch ? (
          <>
            <div className="mb-1 flex items-center justify-end">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#003882]"
                  checked={Boolean(isQuickPropertySameAsContact)}
                  disabled={
                    isApplyingQuickSameAsContactProperty ||
                    !toText(quickSameAsContactPropertySource?.searchText)
                  }
                  onChange={(event) => {
                    void handleQuickSameAsContactPropertyChange(Boolean(event.target.checked));
                  }}
                />
                <span>
                  {isApplyingQuickSameAsContactProperty
                    ? "Applying..."
                    : "Same as contact's address"}
                </span>
              </label>
            </div>
            <InputField
              label="Which address is this inquiry about?"
              field="quick_property_lookup"
              inputRef={propertyLookupRef}
              value={detailsForm.property_lookup}
              onChange={(event) => {
                const nextLookup = toText(event.target.value);
                setDetailsForm((previous) => {
                  const nextAddress1 = nextLookup || previous.property_address_1;
                  return {
                    ...previous,
                    property_lookup: event.target.value,
                    property_address_1: nextAddress1,
                    property_name: buildStandardPropertyName({
                      lot_number: previous.property_lot_number,
                      unit_number: previous.property_unit_number,
                      address_1: nextAddress1,
                      suburb_town: previous.property_suburb_town,
                      state: previous.property_state,
                      postal_code: previous.property_postal_code,
                      country: previous.property_country || "AU",
                    }),
                  };
                });
              }}
              placeholder="Search address"
            />
            {propertyMatchState.message ? (
              <div
                className={`text-xs ${
                  matchMessageClassByStatus[propertyMatchState.status] || "text-slate-500"
                }`}
              >
                {propertyMatchState.message}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

    </>
  );
}
