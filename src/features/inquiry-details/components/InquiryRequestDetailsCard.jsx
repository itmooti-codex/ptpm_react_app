import { DetailsCard } from "@shared/components/ui/DetailsCard.jsx";
import { CardField } from "@shared/components/ui/CardField.jsx";
import { CardNote } from "@shared/components/ui/CardNote.jsx";
import { CardTagList } from "@shared/components/ui/CardTagList.jsx";
import { SectionLoadingState } from "@shared/components/ui/SectionLoadingState.jsx";
import {
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../shared/inquiryInformationConstants.js";

export function InquiryRequestDetailsCard({
  isInquiryInitialLoadInProgress,
  handleOpenInquiryDetailsEditor,
  inquiryNumericId,
  isInquiryRequestExpanded,
  inquiryStatus,
  statusSource,
  statusType,
  inquiryDisplayFlowRule,
  statusServiceName,
  statusServiceNameHref,
  statusHowHeardDisplay,
  requestDateRequired,
  requestRenovations,
  requestResidentAvailability,
  requestPestNoiseTags,
  handleQuickRemoveListSelectionTag,
  requestPestNoiseRawValue,
  isListSelectionTagRemoving,
  requestPestActiveTimesTags,
  requestPestActiveTimesRawValue,
  requestPestLocationsTags,
  requestPestLocationsRawValue,
  statusHowCanHelp,
  notesAdmin,
  notesClient,
}) {
  return (
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
  );
}
