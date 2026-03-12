import { useCallback } from "react";
import { createPropertyRecord, fetchPropertyRecordById, searchPropertiesForLookup, updatePropertyRecord } from "../../../modules/details-workspace/api/core/runtime.js";
import { updateInquiryFieldsById } from "../../../modules/job-records/exports/api.js";
import {
  buildComparablePropertyAddress,
  dedupePropertyLookupRecords,
  mergePropertyCollectionsIfChanged,
  normalizeAddressText,
  normalizePropertyLookupRecord,
  resolvePropertyLookupLabel,
} from "@modules/details-workspace/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { joinAddress, toText } from "@shared/utils/formatters.js";
import { resolveAddressFromGoogleLookup } from "../shared/inquiryDetailsFormatting.js";

export function useInquiryPropertyActions({
  plugin,
  inquiryNumericId,
  safeUid,
  trackRecentActivity,
  error,
  success,
  refreshResolvedInquiry,
  setContactModalState,
  propertySearchManualEditRef,
  setPropertySearchQuery,
  setSelectedPropertyId,
  setPropertyModalState,
  propertyModalState,
  setPropertyLookupRecords,
  setLinkedProperties,
  activeRelatedProperty,
  linkedPropertiesSorted,
  propertyLookupRecords,
  sameAsContactPropertySource,
  setIsPropertySameAsContact,
  setIsApplyingSameAsContactProperty,
  setAppointmentModalMode,
  setAppointmentModalEditingId,
  setAppointmentModalDraft,
  setIsAppointmentModalOpen,
  setIsUploadsModalOpen,
}) {
  const openContactDetailsModal = useCallback(
    ({
      mode = "individual",
      onSave = null,
      onModeChange = null,
      allowModeSwitch = false,
      titleVerb = "Add",
      initialValues = null,
    } = {}) => {
      setContactModalState({
        open: true,
        mode,
        onSave: typeof onSave === "function" ? onSave : null,
        onModeChange: typeof onModeChange === "function" ? onModeChange : null,
        allowModeSwitch: Boolean(allowModeSwitch),
        titleVerb: toText(titleVerb) || "Add",
        initialValues:
          initialValues && typeof initialValues === "object" ? { ...initialValues } : null,
      });
    },
    [setContactModalState]
  );

  const closeContactDetailsModal = useCallback(
    () => setContactModalState((previous) => ({ ...previous, open: false })),
    [setContactModalState]
  );

  const handlePropertySearchQueryChange = useCallback(
    async (query) => {
      const normalizedQuery = toText(query);
      if (!plugin || normalizedQuery.length < 2) return [];
      try {
        const records = await searchPropertiesForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (normalizedRecords.length) {
          setPropertyLookupRecords((previous) =>
            mergePropertyCollectionsIfChanged(previous, normalizedRecords)
          );
        }
        return normalizedRecords;
      } catch (lookupError) {
        console.error("[InquiryDetails] Property lookup search failed", lookupError);
        return [];
      }
    },
    [plugin, setPropertyLookupRecords]
  );

  const handlePropertySearchValueChange = useCallback((value) => {
    propertySearchManualEditRef.current = true;
    setPropertySearchQuery(value);
  }, [propertySearchManualEditRef, setPropertySearchQuery]);

  const handleSelectPropertyFromSearch = useCallback(
    (item = {}) => {
      const nextId = normalizePropertyId(item?.id);
      if (!nextId) return;
      propertySearchManualEditRef.current = false;
      setSelectedPropertyId(nextId);
      setPropertySearchQuery(toText(item?.label));
    },
    [propertySearchManualEditRef, setPropertySearchQuery, setSelectedPropertyId]
  );

  const closePropertyModal = useCallback(() => {
    setPropertyModalState({ open: false, initialData: null });
  }, [setPropertyModalState]);

  const savePropertyRecord = useCallback(
    async ({ draftProperty, initialPropertyId = "" } = {}) => {
      if (!plugin) {
        throw new Error("SDK is still initializing. Please try again.");
      }
      const resolvedId = normalizePropertyId(draftProperty?.id || initialPropertyId);
      const isPersisted = /^\d+$/.test(String(resolvedId || "").trim());
      if (isPersisted) {
        return updatePropertyRecord({ plugin, id: resolvedId, payload: draftProperty });
      }
      return createPropertyRecord({ plugin, payload: draftProperty });
    },
    [plugin]
  );

  const handleSaveProperty = useCallback(
    async (draftProperty) => {
      const initialPropertyId = normalizePropertyId(propertyModalState?.initialData?.id);
      const savedProperty = await savePropertyRecord({ draftProperty, initialPropertyId });
      const resolvedSavedId = normalizePropertyId(
        savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          ""
      );
      const hydratedSavedProperty = resolvedSavedId
        ? await fetchPropertyRecordById({ plugin, propertyId: resolvedSavedId }).catch(() => null)
        : null;
      const normalizedSavedProperty = normalizePropertyLookupRecord({
        ...(propertyModalState?.initialData || {}),
        ...(draftProperty || {}),
        ...(savedProperty || {}),
        ...(hydratedSavedProperty || {}),
        id:
          resolvedSavedId ||
          savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          "",
      });
      const nextId = normalizePropertyId(normalizedSavedProperty?.id);
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, [normalizedSavedProperty])
      );
      setLinkedProperties((previous) => {
        const existing = Array.isArray(previous) ? previous : [];
        return mergePropertyCollectionsIfChanged(existing, [normalizedSavedProperty]);
      });
      if (nextId) setSelectedPropertyId(nextId);
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(resolvePropertyLookupLabel(normalizedSavedProperty));
      success(
        initialPropertyId ? "Property updated" : "Property saved",
        initialPropertyId
          ? "Property details were updated."
          : "Property was saved successfully."
      );
    },
    [
      plugin,
      propertyModalState?.initialData,
      propertySearchManualEditRef,
      savePropertyRecord,
      setLinkedProperties,
      setPropertyLookupRecords,
      setPropertySearchQuery,
      setSelectedPropertyId,
      success,
    ]
  );

  const handleOpenAddPropertyModal = useCallback(
    () => setPropertyModalState({ open: true, initialData: null }),
    [setPropertyModalState]
  );

  const handleOpenEditPropertyModal = useCallback(
    (propertyRecord = null) => {
      const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
      const selectedFromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const selectedFromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const editableProperty = normalizePropertyLookupRecord({
        ...(activeRelatedProperty || {}),
        ...(selectedFromLinked || {}),
        ...(selectedFromLookup || {}),
        ...(propertyRecord || {}),
      });
      setPropertyModalState({
        open: true,
        initialData: editableProperty,
      });
    },
    [activeRelatedProperty, linkedPropertiesSorted, propertyLookupRecords, setPropertyModalState]
  );

  const handleSameAsContactPropertyChange = useCallback(
    async (checked) => {
      if (!checked) return;
      setIsPropertySameAsContact(true);

      if (!plugin || !inquiryNumericId) {
        setIsPropertySameAsContact(false);
        error("Property link failed", "Inquiry context is not ready.");
        return;
      }

      const sourceAddress = toText(sameAsContactPropertySource?.address1);
      const sourceSuburb = toText(sameAsContactPropertySource?.suburbTown);
      const sourceState = toText(sameAsContactPropertySource?.state);
      const sourcePostal = toText(sameAsContactPropertySource?.postalCode);
      const concatenatedSourceAddress = toText(
        sameAsContactPropertySource?.searchText ||
          joinAddress([sourceAddress, sourceSuburb, sourceState, sourcePostal])
      );
      const googleResolvedAddress = await resolveAddressFromGoogleLookup(concatenatedSourceAddress);
      const derivedPropertyName = toText(
        googleResolvedAddress?.formatted_address ||
          sameAsContactPropertySource?.propertyName ||
          concatenatedSourceAddress
      );
      const derivedAddress1 = toText(
        googleResolvedAddress?.address || sourceAddress || concatenatedSourceAddress
      );
      const derivedSuburb = toText(googleResolvedAddress?.city || sourceSuburb);
      const derivedState = toText(googleResolvedAddress?.state || sourceState);
      const derivedPostal = toText(googleResolvedAddress?.zip_code || sourcePostal);
      const derivedCountry = toText(googleResolvedAddress?.country || "AU") || "AU";
      const derivedLot = toText(googleResolvedAddress?.lot_number);
      const derivedUnit = toText(googleResolvedAddress?.unit_number);
      const searchText = toText(
        googleResolvedAddress?.formatted_address ||
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) ||
          concatenatedSourceAddress
      );

      if (!derivedAddress1 && !searchText) {
        setIsPropertySameAsContact(false);
        error(
          "Property link failed",
          "No address is available on the current account to create a property."
        );
        return;
      }

      setIsApplyingSameAsContactProperty(true);
      try {
        const searchedRecords = await searchPropertiesForLookup({
          plugin,
          query: searchText,
          limit: 25,
        });
        const normalizedSearchedRecords = dedupePropertyLookupRecords(searchedRecords || []);
        const targetComparableAddress = normalizeAddressText(
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) || searchText
        );
        const matchedExistingProperty =
          normalizedSearchedRecords.find(
            (record) => buildComparablePropertyAddress(record) === targetComparableAddress
          ) ||
          normalizedSearchedRecords.find((record) => {
            const comparable = buildComparablePropertyAddress(record);
            return Boolean(
              comparable &&
                targetComparableAddress &&
                comparable.includes(targetComparableAddress)
            );
          }) ||
          null;

        let resolvedProperty = matchedExistingProperty;
        if (!resolvedProperty) {
          const createdProperty = await createPropertyRecord({
            plugin,
            payload: {
              property_name: derivedPropertyName || searchText,
              lot_number: derivedLot,
              unit_number: derivedUnit,
              address_1: derivedAddress1 || searchText,
              suburb_town: derivedSuburb,
              state: derivedState,
              postal_code: derivedPostal,
              country: derivedCountry,
            },
          });
          resolvedProperty = normalizePropertyLookupRecord(createdProperty || {});
        }

        const resolvedPropertyId = normalizePropertyId(
          resolvedProperty?.id || resolvedProperty?.ID || resolvedProperty?.Property_ID
        );
        if (!resolvedPropertyId) {
          throw new Error("Unable to resolve a property ID.");
        }

        const hydratedProperty = await fetchPropertyRecordById({
          plugin,
          propertyId: resolvedPropertyId,
        }).catch(() => null);

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            property_id: resolvedPropertyId,
            Property_ID: resolvedPropertyId,
          },
        });

        const normalizedResolvedProperty = normalizePropertyLookupRecord({
          ...(hydratedProperty || {}),
          ...resolvedProperty,
          id: resolvedPropertyId,
          address_1:
            toText(hydratedProperty?.address_1 || hydratedProperty?.address) ||
            toText(resolvedProperty?.address_1 || resolvedProperty?.address) ||
            derivedAddress1,
          suburb_town:
            toText(hydratedProperty?.suburb_town || hydratedProperty?.city) ||
            toText(resolvedProperty?.suburb_town || resolvedProperty?.city) ||
            derivedSuburb,
          state:
            toText(hydratedProperty?.state) ||
            toText(resolvedProperty?.state) ||
            derivedState,
          postal_code:
            toText(hydratedProperty?.postal_code || hydratedProperty?.zip_code) ||
            toText(resolvedProperty?.postal_code || resolvedProperty?.zip_code) ||
            derivedPostal,
          property_name:
            toText(hydratedProperty?.property_name) ||
            toText(resolvedProperty?.property_name) ||
            derivedPropertyName,
        });
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedResolvedProperty])
        );
        setLinkedProperties((previous) => {
          const existing = Array.isArray(previous) ? previous : [];
          return mergePropertyCollectionsIfChanged(existing, [normalizedResolvedProperty]);
        });
        setSelectedPropertyId(resolvedPropertyId);
        propertySearchManualEditRef.current = false;
        setPropertySearchQuery(
          toText(normalizedResolvedProperty?.property_name) ||
            resolvePropertyLookupLabel(normalizedResolvedProperty)
        );

        await refreshResolvedInquiry();
        success(
          "Property linked",
          matchedExistingProperty
            ? "Matched existing property by address and linked it to inquiry."
            : "Created property from account address and linked it to inquiry."
        );
      } catch (saveError) {
        console.error("[InquiryDetails] Failed same-as-contact property flow", saveError);
        setIsPropertySameAsContact(false);
        error("Property link failed", saveError?.message || "Unable to link property.");
      } finally {
        setIsApplyingSameAsContactProperty(false);
      }
    },
    [
      error,
      inquiryNumericId,
      plugin,
      propertySearchManualEditRef,
      refreshResolvedInquiry,
      sameAsContactPropertySource,
      setIsApplyingSameAsContactProperty,
      setIsPropertySameAsContact,
      setLinkedProperties,
      setPropertyLookupRecords,
      setPropertySearchQuery,
      setSelectedPropertyId,
      success,
    ]
  );

  const handleOpenCreateAppointmentModal = useCallback(() => {
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsAppointmentModalOpen(true);
    trackRecentActivity({
      action: "Opened create appointment",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [
    inquiryNumericId,
    safeUid,
    setAppointmentModalDraft,
    setAppointmentModalEditingId,
    setAppointmentModalMode,
    setIsAppointmentModalOpen,
    trackRecentActivity,
  ]);

  const handleOpenEditAppointmentModal = useCallback(
    (record = {}, draftState = null) => {
      const appointmentId = toText(record?.id || record?.ID);
      if (!appointmentId) return;
      setAppointmentModalMode("update");
      setAppointmentModalEditingId(appointmentId);
      setAppointmentModalDraft(draftState && typeof draftState === "object" ? draftState : null);
      setIsAppointmentModalOpen(true);
      trackRecentActivity({
        action: "Opened edit appointment",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          appointment_id: appointmentId,
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
        },
      });
    },
    [
      inquiryNumericId,
      safeUid,
      setAppointmentModalDraft,
      setAppointmentModalEditingId,
      setAppointmentModalMode,
      setIsAppointmentModalOpen,
      trackRecentActivity,
    ]
  );

  const closeAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
  }, [setAppointmentModalDraft, setAppointmentModalEditingId, setAppointmentModalMode, setIsAppointmentModalOpen]);

  const handleOpenUploadModal = useCallback(() => {
    setIsUploadsModalOpen(true);
    trackRecentActivity({
      action: "Opened uploads modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, setIsUploadsModalOpen, trackRecentActivity]);

  const closeUploadsModal = useCallback(() => {
    setIsUploadsModalOpen(false);
  }, [setIsUploadsModalOpen]);

  return {
    openContactDetailsModal,
    closeContactDetailsModal,
    handlePropertySearchQueryChange,
    handlePropertySearchValueChange,
    handleSelectPropertyFromSearch,
    closePropertyModal,
    handleSaveProperty,
    handleOpenAddPropertyModal,
    handleOpenEditPropertyModal,
    handleSameAsContactPropertyChange,
    handleOpenCreateAppointmentModal,
    handleOpenEditAppointmentModal,
    closeAppointmentModal,
    handleOpenUploadModal,
    closeUploadsModal,
  };
}
