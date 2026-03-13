import { useMemo, useState } from "react";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import {
  EditActionIcon as EditIcon,
} from "../../icons/ActionIcons.jsx";
import {
  AccordionBlock,
  MapPinIcon,
} from "./JobInfoOptionCards.jsx";
import {
  buildPropertyMapLink,
  formatPropertyValue,
  getPropertyFeatureText,
} from "./jobInfoUtils.js";
import { CopyIcon, hasDisplayValue, toSafeText } from "./propertyTabUtils.jsx";

export function PropertyDetailsPanel({
  activeRelatedProperty,
  propertyDetailsVariant,
  onEditRelatedProperty,
  copyPropertyName,
  copyPropertyUid,
  propertyExternalHref,
}) {
  const [openSections, setOpenSections] = useState({
    information: false,
    description: false,
  });

  const relatedPropertyMapLink = buildPropertyMapLink(activeRelatedProperty || {});
  const normalizedPropertyDetailsVariant = String(propertyDetailsVariant || "accordion")
    .trim()
    .toLowerCase();
  const useCardDetailsLayout = normalizedPropertyDetailsVariant === "cards";

  const informationFields = [
    { label: "Property Name", value: activeRelatedProperty?.property_name },
    { label: "Property UID", value: activeRelatedProperty?.unique_id },
    { label: "Lot Number", value: activeRelatedProperty?.lot_number },
    { label: "Unit Number", value: activeRelatedProperty?.unit_number },
    { label: "Address 1", value: activeRelatedProperty?.address_1 || activeRelatedProperty?.address },
    { label: "Address 2", value: activeRelatedProperty?.address_2 },
    { label: "Suburb/Town", value: activeRelatedProperty?.suburb_town || activeRelatedProperty?.city },
    { label: "Postal Code", value: activeRelatedProperty?.postal_code },
    { label: "State", value: activeRelatedProperty?.state },
    { label: "Country", value: activeRelatedProperty?.country },
  ];

  const descriptionFields = [
    { label: "Property Type", value: activeRelatedProperty?.property_type },
    { label: "Building Type", value: activeRelatedProperty?.building_type },
    { label: "Building Type: Other", value: activeRelatedProperty?.building_type_other },
    { label: "Foundation Type", value: activeRelatedProperty?.foundation_type },
    { label: "Bedrooms", value: activeRelatedProperty?.bedrooms },
    { label: "Manhole", value: activeRelatedProperty?.manhole },
    { label: "Stories", value: activeRelatedProperty?.stories },
    { label: "Building Age", value: activeRelatedProperty?.building_age },
    { label: "Building Features", value: getPropertyFeatureText(activeRelatedProperty) },
  ];

  const propertyFeatureTags = useMemo(() => {
    const raw = toSafeText(getPropertyFeatureText(activeRelatedProperty));
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }, [activeRelatedProperty]);

  return (
    <Card className="h-fit overflow-hidden !p-0">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-slate-900">Related Property</div>
        {activeRelatedProperty ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={!relatedPropertyMapLink}
              onClick={() => {
                if (!relatedPropertyMapLink) return;
                window.open(relatedPropertyMapLink, "_blank", "noopener,noreferrer");
              }}
              aria-label="Open related property in Google Maps"
              title="Open in Google Maps"
            >
              <MapPinIcon />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-slate-700"
              onClick={() => onEditRelatedProperty?.(activeRelatedProperty)}
              aria-label="Edit related property"
              title="Edit related property"
            >
              <EditIcon />
            </button>
          </div>
        ) : null}
      </header>

      {activeRelatedProperty ? (
        <div className="space-y-3 p-2.5">
          {useCardDetailsLayout ? (
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 xl:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Property Information
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2">
                  {informationFields.map((item) => {
                    if (!hasDisplayValue(item.value)) return null;
                    const normalizedLabel = String(item.label || "").trim().toLowerCase();
                    const isPropertyNameField = normalizedLabel === "property name";
                    const isPropertyUidField = normalizedLabel === "property uid";
                    return (
                      <div key={item.label} className="group min-w-0">
                        <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          {item.label}
                        </div>
                        <div className="mt-0.5 flex w-full min-w-0 items-start gap-2">
                          {isPropertyNameField ? (
                            <>
                              {relatedPropertyMapLink ? (
                                <a
                                  href={relatedPropertyMapLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block min-w-0 max-w-[calc(100%-1.5rem)] truncate text-[12px] font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                                  title={toSafeText(item.value)}
                                >
                                  {formatPropertyValue(item.value)}
                                </a>
                              ) : (
                                <div className="inline-block min-w-0 max-w-[calc(100%-1.5rem)] truncate text-[12px] font-medium text-slate-800">
                                  {formatPropertyValue(item.value)}
                                </div>
                              )}
                              {toSafeText(item.value) ? (
                                <button
                                  type="button"
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                                  onClick={copyPropertyName}
                                  aria-label="Copy property name"
                                  title="Copy property name"
                                >
                                  <CopyIcon />
                                </button>
                              ) : null}
                            </>
                          ) : isPropertyUidField ? (
                            <>
                              {propertyExternalHref ? (
                                <a
                                  href={propertyExternalHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block min-w-0 max-w-[calc(100%-1.5rem)] truncate text-[12px] font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 uid-text"
                                  title={toSafeText(item.value)}
                                >
                                  {formatPropertyValue(item.value)}
                                </a>
                              ) : (
                                <div className="inline-block min-w-0 max-w-[calc(100%-1.5rem)] truncate text-[12px] font-medium text-slate-800 uid-text">
                                  {formatPropertyValue(item.value)}
                                </div>
                              )}
                              {toSafeText(item.value) ? (
                                <button
                                  type="button"
                                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                                  onClick={copyPropertyUid}
                                  aria-label="Copy property UID"
                                  title="Copy property UID"
                                >
                                  <CopyIcon />
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <div
                              className={`inline-block min-w-0 max-w-full truncate text-[12px] font-medium text-slate-800 ${
                                normalizedLabel.includes("uid") ? "uid-text" : ""
                              }`}
                              title={formatPropertyValue(item.value)}
                            >
                              {formatPropertyValue(item.value)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Property Description
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2">
                  {descriptionFields.map((item) => {
                    const isBuildingFeaturesField =
                      String(item.label || "").trim().toLowerCase() === "building features";
                    if (isBuildingFeaturesField && !propertyFeatureTags.length) return null;
                    if (!isBuildingFeaturesField && !hasDisplayValue(item.value)) return null;
                    return (
                      <div
                        key={item.label}
                        className={`min-w-0 ${isBuildingFeaturesField ? "sm:col-span-2" : ""}`}
                      >
                        <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          {item.label}
                        </div>
                        {isBuildingFeaturesField ? (
                          <div className="mt-1 min-h-0 max-h-[72px] overflow-auto">
                            <div className="flex flex-wrap gap-1">
                              {propertyFeatureTags.map((tag) => (
                                <span
                                  key={`property-feature-${tag}`}
                                  className="inline-flex items-center rounded border border-sky-200 px-2 py-0.5 text-[11px] text-sky-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="inline-block min-w-0 max-w-full truncate text-[12px] font-medium text-slate-800"
                            title={formatPropertyValue(item.value)}
                          >
                            {formatPropertyValue(item.value)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              <AccordionBlock
                title="Property Information"
                isOpen={openSections.information}
                onToggle={() =>
                  setOpenSections((previous) => ({
                    ...previous,
                    information: !previous.information,
                  }))
                }
              >
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {informationFields.map((item) => (
                    <div
                      key={item.label}
                      className="space-y-1 border-b border-slate-100 pb-2 last:border-b-0"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                      <div
                        className={`text-sm text-neutral-800 ${
                          String(item.label || "").toLowerCase().includes("uid") ? "uid-text" : ""
                        }`}
                      >
                        {formatPropertyValue(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionBlock>

              <AccordionBlock
                title="Property Description"
                isOpen={openSections.description}
                onToggle={() =>
                  setOpenSections((previous) => ({
                    ...previous,
                    description: !previous.description,
                  }))
                }
              >
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {descriptionFields.map((item) => (
                    <div
                      key={item.label}
                      className="space-y-1 border-b border-slate-100 pb-2 last:border-b-0"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                      <div className="text-sm text-neutral-800">
                        {formatPropertyValue(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionBlock>
            </>
          )}
        </div>
      ) : (
        <div className="p-2.5">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            No related property linked to this job.
          </div>
        </div>
      )}
    </Card>
  );
}
