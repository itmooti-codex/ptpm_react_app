import { useCallback } from "react";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import {
  createPropertyRecord,
  updatePropertyRecord,
} from "../../../api/core/runtime.js";
import { normalizeInquiryId, normalizePropertyId } from "./jobInfoUtils.js";

export function usePropertyActions({
  plugin,
  activeJobId,
  linkedInquiryRecordId,
  activeRelatedProperty,
  lookupProperties,
  linkedProperties,
  addProperty,
  setSelectedPropertyId,
  setLinkedPropertiesWithCache,
  setPropertySearchQuery,
  onOpenAddPropertyModal,
}) {
  const { success } = useToast();

  const savePropertyRecord = useCallback(
    async ({ draftProperty, initialPropertyId = "" } = {}) => {
      if (!plugin) {
        throw new Error("SDK is still initializing. Please try again.");
      }

      const resolvedId = normalizePropertyId(draftProperty?.id || initialPropertyId);
      const isPersisted = /^\d+$/.test(String(resolvedId || "").trim());

      if (isPersisted) {
        return updatePropertyRecord({
          plugin,
          id: resolvedId,
          payload: draftProperty,
        });
      }

      return createPropertyRecord({
        plugin,
        payload: draftProperty,
      });
    },
    [plugin]
  );

  const handleAddProperty = useCallback(() => {
    onOpenAddPropertyModal?.({
      onSave: async (draftProperty) => {
        const savedProperty = await savePropertyRecord({ draftProperty });
        const normalized = addProperty({
          ...draftProperty,
          ...savedProperty,
          id: savedProperty?.id || draftProperty?.id || "",
        });
        const nextId = normalizePropertyId(normalized.id);
        if (nextId) setSelectedPropertyId(nextId);
        setLinkedPropertiesWithCache((prev) => {
          if (!nextId) return prev;
          const exists = prev.some(
            (item) => normalizePropertyId(item?.id) === normalizePropertyId(nextId)
          );
          if (exists) {
            return prev.map((item) =>
              normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                ? { ...item, ...normalized }
                : item
            );
          }
          return [normalized, ...prev];
        });
        setPropertySearchQuery(
          normalized.property_name ||
            normalized.address_1 ||
            normalized.address ||
            normalized.unique_id ||
            ""
        );
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED,
          quoteJobId: activeJobId,
          inquiryId: normalizeInquiryId(linkedInquiryRecordId),
          focusId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
          dedupeEntityId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
          title: "Property created",
          content: "A new property was created and linked.",
          logContext: "job-direct:JobInformationSection:onAddProperty",
        });
        success("Property saved", "Property details were saved.");
      },
    });
  }, [
    addProperty,
    activeJobId,
    linkedInquiryRecordId,
    onOpenAddPropertyModal,
    plugin,
    savePropertyRecord,
    setLinkedPropertiesWithCache,
    setPropertySearchQuery,
    setSelectedPropertyId,
    success,
  ]);

  const handleEditRelatedProperty = useCallback(
    (propertyRecord) => {
      const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
      const selectedFromLookup = (lookupProperties || []).find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const selectedFromLinked = (linkedProperties || []).find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const editableProperty = {
        ...(activeRelatedProperty || {}),
        ...(selectedFromLinked || {}),
        ...(selectedFromLookup || {}),
        ...(propertyRecord || {}),
      };

      onOpenAddPropertyModal?.({
        initialData: editableProperty,
        onSave: async (draftProperty) => {
          const savedProperty = await savePropertyRecord({
            draftProperty,
            initialPropertyId: editableProperty?.id,
          });
          const normalized = addProperty({
            ...editableProperty,
            ...draftProperty,
            ...savedProperty,
            id: savedProperty?.id || draftProperty?.id || editableProperty?.id || "",
          });
          const nextId = normalizePropertyId(normalized.id);
          if (nextId) setSelectedPropertyId(nextId);
          setLinkedPropertiesWithCache((prev) =>
            prev.map((item) =>
              normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                ? { ...item, ...normalized }
                : item
            )
          );
          setPropertySearchQuery(
            normalized.property_name ||
              normalized.address_1 ||
              normalized.address ||
              normalized.unique_id ||
              ""
          );
          await emitAnnouncement({
            plugin,
            eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED,
            quoteJobId: activeJobId,
            inquiryId: normalizeInquiryId(linkedInquiryRecordId),
            focusId: nextId || editableId,
            dedupeEntityId: nextId || editableId,
            title: "Property updated",
            content: "Property details were updated.",
            logContext: "job-direct:JobInformationSection:onEditRelatedProperty",
          });
          success("Property updated", "Property details were updated.");
        },
      });
    },
    [
      activeRelatedProperty,
      activeJobId,
      addProperty,
      linkedInquiryRecordId,
      linkedProperties,
      lookupProperties,
      onOpenAddPropertyModal,
      plugin,
      savePropertyRecord,
      setLinkedPropertiesWithCache,
      setPropertySearchQuery,
      setSelectedPropertyId,
      success,
    ]
  );

  return { handleAddProperty, handleEditRelatedProperty };
}
