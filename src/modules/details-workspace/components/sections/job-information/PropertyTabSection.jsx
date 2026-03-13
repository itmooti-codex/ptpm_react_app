import { useCallback } from "react";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import { useContactEntityLookupData } from "../../../hooks/useContactEntityLookupData.js";
import { SearchDropdownInput } from "./JobInfoFormFields.jsx";
import { PropertyOptionCard } from "./JobInfoOptionCards.jsx";
import { dedupeById, normalizePropertyId } from "./jobInfoUtils.js";
import { toSafeText } from "./propertyTabUtils.jsx";
import { usePropertyAffiliations } from "./usePropertyAffiliations.js";
import { usePropertyUploads } from "./usePropertyUploads.js";
import { PropertyDetailsPanel } from "./PropertyDetailsPanel.jsx";
import { PropertyContactsPanel } from "./PropertyContactsPanel.jsx";
import { PropertyUploadsSection } from "./PropertyUploadsSection.jsx";

export function PropertyTabSection({
  plugin,
  preloadedLookupData,
  quoteJobId = "",
  inquiryId = "",
  currentPropertyId,
  onOpenContactDetailsModal,
  accountType,
  selectedAccountId,
  propertySearchValue,
  propertySearchItems,
  onPropertySearchValueChange,
  onPropertySearchQueryChange,
  onSelectPropertyFromSearch,
  onAddProperty,
  activeRelatedProperty,
  linkedProperties,
  isLoading,
  loadError,
  selectedPropertyId,
  onSelectProperty,
  onEditRelatedProperty,
  sameAsContactLabel = "",
  isSameAsContactChecked = false,
  isSameAsContactDisabled = false,
  onSameAsContactChange = null,
  showPropertyUploadsSection = true,
  propertyDetailsVariant = "accordion",
  onAffiliationSaved = null,
}) {
  const { success, error } = useToast();
  const { contacts, companies } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });

  const resolvedPropertyId = normalizePropertyId(
    currentPropertyId || selectedPropertyId || activeRelatedProperty?.id
  );
  const announcementJobId = normalizePropertyId(quoteJobId);
  const announcementInquiryId = normalizePropertyId(inquiryId);

  const affiliationsApi = usePropertyAffiliations({
    plugin,
    resolvedPropertyId,
    contacts,
    companies,
    announcementJobId,
    announcementInquiryId,
    onAffiliationSaved,
    success,
    error,
  });

  const uploadsApi = usePropertyUploads({
    plugin,
    resolvedPropertyId,
    announcementJobId,
    announcementInquiryId,
    success,
    error,
  });

  const linkedPropertyOptions = (() => {
    const normalizedLinked = dedupeById(
      (Array.isArray(linkedProperties) ? linkedProperties : []).filter(Boolean)
    );
    const activeId = normalizePropertyId(
      activeRelatedProperty?.id || activeRelatedProperty?.ID || activeRelatedProperty?.Property_ID
    );
    if (!activeId) {
      return normalizedLinked;
    }
    const hasActiveInLinked = normalizedLinked.some(
      (property) => normalizePropertyId(property?.id || property?.ID || property?.Property_ID) === activeId
    );
    if (hasActiveInLinked) {
      return normalizedLinked;
    }
    return dedupeById([{ ...activeRelatedProperty, id: activeId }, ...normalizedLinked]);
  })();

  const propertyRecordId = toSafeText(
    activeRelatedProperty?.id || activeRelatedProperty?.ID || activeRelatedProperty?.Property_ID
  );
  const propertyExternalHref = propertyRecordId
    ? `https://app.ontraport.com/#!/o_properties10001/edit&id=${encodeURIComponent(propertyRecordId)}`
    : "";

  const copyPropertyName = useCallback(async () => {
    const value = toSafeText(activeRelatedProperty?.property_name);
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      success("Copied", "Property name copied.");
    } catch {
      error("Copy failed", "Unable to copy property name.");
    }
  }, [activeRelatedProperty?.property_name, error, success]);

  const copyPropertyUid = useCallback(async () => {
    const value = toSafeText(activeRelatedProperty?.unique_id || activeRelatedProperty?.Unique_ID);
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      success("Copied", "Property UID copied.");
    } catch {
      error("Copy failed", "Unable to copy property UID.");
    }
  }, [activeRelatedProperty?.unique_id, activeRelatedProperty?.Unique_ID, error, success]);

  return (
    <div
      data-job-section="job-section-property"
      className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]"
    >
      <div className="w-full">
        <Card className="h-fit space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-bold leading-4 text-neutral-700">Property</div>
            {typeof onSameAsContactChange === "function" && String(sameAsContactLabel || "").trim() ? (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#003882]"
                  checked={Boolean(isSameAsContactChecked)}
                  disabled={Boolean(isSameAsContactDisabled)}
                  onChange={(event) => onSameAsContactChange(Boolean(event.target.checked))}
                />
                <span>{sameAsContactLabel}</span>
              </label>
            ) : null}
          </div>
          <SearchDropdownInput
            label="Property Search"
            field="properties"
            value={propertySearchValue}
            placeholder="Search by property name, UID, or address"
            items={propertySearchItems}
            onValueChange={onPropertySearchValueChange}
            onSearchQueryChange={onPropertySearchQueryChange}
            onSelect={onSelectPropertyFromSearch}
            onAdd={onAddProperty}
            addButtonLabel="Add New Property"
            emptyText="No properties found."
            rootData={{ "data-search-root": "property" }}
          />
          <div className="border-t border-slate-200" />

          <div className="text-base font-bold leading-4 text-neutral-700">Link Property</div>

          {!selectedAccountId ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Select a {accountType === "Company" ? "company" : "contact"} to view linked properties.
            </div>
          ) : null}

          {selectedAccountId && isLoading && !linkedPropertyOptions.length ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Loading linked properties...
            </div>
          ) : null}

          {selectedAccountId && loadError ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </div>
          ) : null}

          {selectedAccountId && !isLoading && !loadError && !linkedPropertyOptions.length ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              No linked properties found.
            </div>
          ) : null}

          {selectedAccountId && !loadError && linkedPropertyOptions.length ? (
            <div className="space-y-2">
              {linkedPropertyOptions.map((property, index) => {
                const propertyId = normalizePropertyId(property.id);
                const isSelected = normalizePropertyId(selectedPropertyId) === propertyId;
                return (
                  <PropertyOptionCard
                    key={`${propertyId || property.unique_id || "property"}-${index}`}
                    property={property}
                    isSelected={isSelected}
                    radioName="linked-property"
                    onSelect={onSelectProperty}
                  />
                );
              })}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="w-full space-y-4">
        <PropertyDetailsPanel
          activeRelatedProperty={activeRelatedProperty}
          propertyDetailsVariant={propertyDetailsVariant}
          onEditRelatedProperty={onEditRelatedProperty}
          copyPropertyName={copyPropertyName}
          copyPropertyUid={copyPropertyUid}
          propertyExternalHref={propertyExternalHref}
        />

        <PropertyContactsPanel
          plugin={plugin}
          resolvedPropertyId={resolvedPropertyId}
          affiliations={affiliationsApi.affiliations}
          isAffiliationsLoading={affiliationsApi.isAffiliationsLoading}
          affiliationLoadError={affiliationsApi.affiliationLoadError}
          affiliationModalState={affiliationsApi.affiliationModalState}
          deleteTarget={affiliationsApi.deleteTarget}
          isDeleting={affiliationsApi.isDeleting}
          contactLookupById={affiliationsApi.contactLookupById}
          companyLookupById={affiliationsApi.companyLookupById}
          onOpenContactDetailsModal={onOpenContactDetailsModal}
          openCreateAffiliation={affiliationsApi.openCreateAffiliation}
          openEditAffiliation={affiliationsApi.openEditAffiliation}
          closeAffiliationModal={affiliationsApi.closeAffiliationModal}
          saveAffiliation={affiliationsApi.saveAffiliation}
          confirmDeleteAffiliation={affiliationsApi.confirmDeleteAffiliation}
          setDeleteTarget={affiliationsApi.setDeleteTarget}
        />

        {showPropertyUploadsSection ? (
          <PropertyUploadsSection
            resolvedPropertyId={resolvedPropertyId}
            propertyUploads={uploadsApi.propertyUploads}
            pendingPropertyUploads={uploadsApi.pendingPropertyUploads}
            isPropertyDropActive={uploadsApi.isPropertyDropActive}
            isUploadsLoading={uploadsApi.isUploadsLoading}
            uploadsLoadError={uploadsApi.uploadsLoadError}
            isUploading={uploadsApi.isUploading}
            deleteUploadTarget={uploadsApi.deleteUploadTarget}
            isDeletingUpload={uploadsApi.isDeletingUpload}
            uploadsInputRef={uploadsApi.uploadsInputRef}
            triggerUploadFilePicker={uploadsApi.triggerUploadFilePicker}
            handleUploadFilesSelected={uploadsApi.handleUploadFilesSelected}
            handlePropertyDropZoneDragOver={uploadsApi.handlePropertyDropZoneDragOver}
            handlePropertyDropZoneDragLeave={uploadsApi.handlePropertyDropZoneDragLeave}
            handlePropertyDropZoneDrop={uploadsApi.handlePropertyDropZoneDrop}
            removePendingPropertyUpload={uploadsApi.removePendingPropertyUpload}
            savePendingPropertyUploads={uploadsApi.savePendingPropertyUploads}
            confirmDeleteUpload={uploadsApi.confirmDeleteUpload}
            setDeleteUploadTarget={uploadsApi.setDeleteUploadTarget}
          />
        ) : null}
      </div>
    </div>
  );
}
