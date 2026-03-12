import { InputField } from "../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { Button } from "../../../shared/components/ui/Button.jsx";
import {
  ColorMappedSelectInput,
  SelectInput,
} from "@modules/details-workspace/exports/components.js";
import {
  InquiryEditListSelectionField,
  InquiryEditTextArea,
} from "./InquiryEditFields.jsx";
import {
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../shared/inquiryInformationConstants.js";
import { normalizeServiceInquiryId } from "../shared/inquiryDetailsFormatting.js";

export const INQUIRY_DETAILS_EDIT_EMPTY_FORM = {
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

export function InquiryDetailsEditModal({
  open,
  onClose,
  onSave,
  isSaving,
  inquiryDetailsForm,
  setInquiryDetailsForm,
  inquiryEditFlowRule,
  isInquiryServiceLookupLoading,
  resolvedInquiryServiceOptions,
  shouldShowInquiryEditOther,
  handleInquiryDetailsTextFieldChange,
  isInquiryEditPestAccordionOpen,
  setIsInquiryEditPestAccordionOpen,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Inquiry & Request Details"
      widthClass="max-w-5xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
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
  );
}
