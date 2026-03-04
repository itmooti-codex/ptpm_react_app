import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobDirectSelector, useJobDirectStoreActions } from "../../../hooks/useJobDirectStore.jsx";
import { selectLinkedPropertiesByAccountKey } from "../../../state/selectors.js";
import {
  fetchLinkedPropertiesByAccount,
  fetchPropertyRecordById,
  fetchPropertyRecordByUniqueId,
} from "../../../sdk/jobDirectSdk.js";
import {
  getJobRelatedProperty,
  getLinkedRecordsCacheKey,
  normalizePropertyId,
} from "./jobInfoUtils.js";

function toText(value) {
  return String(value ?? "").trim();
}

function resolvePropertySearchLabel(property = {}) {
  const propertyName = toText(
    property?.property_name ||
      property?.Property_Name ||
      property?.Property_Property_Name ||
      property?.name ||
      property?.Name
  );
  if (propertyName) return propertyName;

  const address = toText(
    property?.address_1 ||
      property?.Address_1 ||
      property?.address ||
      property?.Address
  );
  if (address) return address;

  return toText(property?.unique_id || property?.Unique_ID);
}

export function useLinkedPropertiesData({
  plugin,
  activeJobData,
  lookupProperties,
  addProperty,
  accountType,
  selectedAccountId,
}) {
  const storeActions = useJobDirectStoreActions();
  const persistedRelatedProperty = useMemo(
    () => getJobRelatedProperty(activeJobData),
    [activeJobData]
  );
  const persistedPropertyId = normalizePropertyId(persistedRelatedProperty?.id);
  const [selectedPropertyId, setSelectedPropertyId] = useState(persistedPropertyId);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const linkedPropertiesRef = useRef([]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(false);
  const [propertyLoadError, setPropertyLoadError] = useState("");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");

  useEffect(() => {
    linkedPropertiesRef.current = Array.isArray(linkedProperties) ? linkedProperties : [];
  }, [linkedProperties]);

  useEffect(() => {
    setSelectedPropertyId(persistedPropertyId);
  }, [persistedPropertyId]);

  useEffect(() => {
    let isActive = true;
    const relatedId = normalizePropertyId(persistedPropertyId);
    if (!plugin || !relatedId) return undefined;

    const hasHydrated = (lookupProperties || []).some(
      (property) => normalizePropertyId(property?.id) === relatedId
    );
    if (hasHydrated) return undefined;

    fetchPropertyRecordById({ plugin, propertyId: relatedId })
      .then((record) => {
        if (!isActive || !record) return;
        addProperty(record);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed to hydrate related property by ID", error);
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    persistedPropertyId,
    lookupProperties,
    addProperty,
    persistedRelatedProperty?.unique_id,
  ]);

  useEffect(() => {
    let isActive = true;
    const relatedId = normalizePropertyId(persistedPropertyId);
    const relatedUid = String(persistedRelatedProperty?.unique_id || "").trim();
    if (!plugin || relatedId || !relatedUid) return undefined;

    const hasHydratedByUid = (lookupProperties || []).some(
      (property) => String(property?.unique_id || "").trim() === relatedUid
    );
    if (hasHydratedByUid) return undefined;

    fetchPropertyRecordByUniqueId({ plugin, uniqueId: relatedUid })
      .then((record) => {
        if (!isActive || !record) return;
        const normalized = addProperty(record);
        const hydratedId = normalizePropertyId(normalized?.id || record?.id);
        if (hydratedId) setSelectedPropertyId(hydratedId);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed to hydrate related property by unique_id", error);
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    persistedPropertyId,
    persistedRelatedProperty?.unique_id,
    lookupProperties,
    addProperty,
  ]);

  const linkedPropertyCacheKey = useMemo(
    () => getLinkedRecordsCacheKey(accountType, selectedAccountId),
    [accountType, selectedAccountId]
  );
  const cachedLinkedPropertiesSelector = useCallback(
    (state) => selectLinkedPropertiesByAccountKey(state, linkedPropertyCacheKey),
    [linkedPropertyCacheKey]
  );
  const cachedLinkedProperties = useJobDirectSelector(cachedLinkedPropertiesSelector);
  const hasCachedLinkedPropertiesSelector = useCallback(
    (state) => {
      const key = String(linkedPropertyCacheKey || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.linkedPropertiesByAccount ?? {},
        key
      );
    },
    [linkedPropertyCacheKey]
  );
  const hasCachedLinkedProperties = useJobDirectSelector(hasCachedLinkedPropertiesSelector);
  const setLinkedPropertiesWithCache = useCallback(
    (valueOrUpdater) => {
      const previous = linkedPropertiesRef.current;
      const nextValue =
        typeof valueOrUpdater === "function" ? valueOrUpdater(previous) : valueOrUpdater;
      const safeNext = Array.isArray(nextValue) ? nextValue : [];
      linkedPropertiesRef.current = safeNext;
      setLinkedProperties(safeNext);
      if (linkedPropertyCacheKey) {
        storeActions.replaceRelationCollection(
          "linkedPropertiesByAccount",
          linkedPropertyCacheKey,
          safeNext
        );
      }
    },
    [linkedPropertyCacheKey, storeActions]
  );

  useEffect(() => {
    let isActive = true;
    if (!plugin || !selectedAccountId) {
      setLinkedPropertiesWithCache([]);
      setPropertyLoadError("");
      setIsPropertiesLoading(false);
      return undefined;
    }

    if (linkedPropertyCacheKey && hasCachedLinkedProperties) {
      const cachedRecords = cachedLinkedProperties || [];
      setLinkedProperties(cachedRecords);
      setPropertyLoadError("");
      setIsPropertiesLoading(false);
      const validIds = cachedRecords.map((item) => normalizePropertyId(item.id)).filter(Boolean);
      setSelectedPropertyId((previous) => {
        const prev = normalizePropertyId(previous);
        if (prev && validIds.includes(prev)) return prev;
        if (persistedPropertyId && validIds.includes(persistedPropertyId)) return persistedPropertyId;
        return prev || persistedPropertyId || "";
      });
      return undefined;
    }

    setIsPropertiesLoading(true);
    setPropertyLoadError("");
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType,
      accountId: selectedAccountId,
    })
      .then((records) => {
        if (!isActive) return;
        setLinkedPropertiesWithCache(records);
        const validIds = records.map((item) => normalizePropertyId(item.id)).filter(Boolean);
        setSelectedPropertyId((previous) => {
          const prev = normalizePropertyId(previous);
          if (prev && validIds.includes(prev)) return prev;
          if (persistedPropertyId && validIds.includes(persistedPropertyId)) return persistedPropertyId;
          return prev || persistedPropertyId || "";
        });
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading linked properties", error);
        setLinkedPropertiesWithCache([]);
        setPropertyLoadError("Unable to load linked properties.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsPropertiesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    selectedAccountId,
    accountType,
    persistedPropertyId,
    linkedPropertyCacheKey,
    cachedLinkedProperties,
    hasCachedLinkedProperties,
    setLinkedPropertiesWithCache,
  ]);

  const activeRelatedProperty = useMemo(() => {
    const selectedFromLookup = (lookupProperties || []).find(
      (property) => normalizePropertyId(property?.id) === normalizePropertyId(selectedPropertyId)
    );
    const selectedFromLinked = linkedProperties.find(
      (property) => normalizePropertyId(property?.id) === normalizePropertyId(selectedPropertyId)
    );
    if (selectedFromLookup && selectedFromLinked) {
      return { ...selectedFromLinked, ...selectedFromLookup };
    }
    if (selectedFromLookup) return selectedFromLookup;
    if (selectedFromLinked) return selectedFromLinked;

    if (
      persistedRelatedProperty &&
      normalizePropertyId(persistedRelatedProperty.id) === normalizePropertyId(selectedPropertyId)
    ) {
      const persistedFromLookup = (lookupProperties || []).find(
        (property) => normalizePropertyId(property?.id) === normalizePropertyId(persistedRelatedProperty.id)
      );
      return persistedFromLookup
        ? { ...persistedRelatedProperty, ...persistedFromLookup }
        : persistedRelatedProperty;
    }

    if (!selectedPropertyId && persistedRelatedProperty) return persistedRelatedProperty;
    return selectedFromLookup || selectedFromLinked || persistedRelatedProperty || null;
  }, [linkedProperties, lookupProperties, selectedPropertyId, persistedRelatedProperty]);

  const propertySearchItems = useMemo(
    () =>
      (lookupProperties || []).map((item) => ({
        id: normalizePropertyId(item.id),
        label: resolvePropertySearchLabel(item) || "Property",
        meta: [item.unique_id, item.address, item.suburb_town, item.state, item.postal_code]
          .filter(Boolean)
          .join(" | "),
      })),
    [lookupProperties]
  );

  useEffect(() => {
    const normalizedSelectedId = normalizePropertyId(selectedPropertyId);
    const selectedFromLookup = (lookupProperties || []).find(
      (item) => normalizePropertyId(item.id) === normalizedSelectedId
    );
    const selectedFromLinked = (linkedProperties || []).find(
      (item) => normalizePropertyId(item.id) === normalizedSelectedId
    );
    const selectedProperty = selectedFromLookup || selectedFromLinked || activeRelatedProperty;

    if (!selectedProperty) return;
    setPropertySearchQuery(resolvePropertySearchLabel(selectedProperty) || "");
  }, [selectedPropertyId, lookupProperties, linkedProperties, activeRelatedProperty]);

  useEffect(() => {
    if (!persistedRelatedProperty) return;
    const nextLabel = resolvePropertySearchLabel(persistedRelatedProperty);
    if (!nextLabel) return;
    setPropertySearchQuery(nextLabel);
  }, [
    persistedRelatedProperty?.id,
    persistedRelatedProperty?.address,
    persistedRelatedProperty?.address_1,
    persistedRelatedProperty?.name,
    persistedRelatedProperty?.property_name,
    persistedRelatedProperty?.unique_id,
  ]);

  const effectivePropertyId = normalizePropertyId(
    selectedPropertyId || activeRelatedProperty?.id || persistedPropertyId
  );

  return {
    activeRelatedProperty,
    effectivePropertyId,
    isPropertiesLoading,
    linkedProperties,
    propertyLoadError,
    propertySearchItems,
    propertySearchQuery,
    selectedPropertyId,
    setLinkedPropertiesWithCache,
    setPropertySearchQuery,
    setSelectedPropertyId,
  };
}
