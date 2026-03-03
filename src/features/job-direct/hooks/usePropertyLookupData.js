import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPropertiesForSearch,
  subscribePropertiesForSearch,
} from "../sdk/jobDirectSdk.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "./useJobDirectStore.jsx";
import { selectProperties } from "../state/selectors.js";
import { registerSharedLookupSubscription } from "./lookupRealtimeRegistry.js";

const EMPTY_LIST = [];

function normalizeString(value) {
  return String(value || "").trim();
}

function createPropertyLookupKey(property = {}) {
  if (property.id) return `property-id:${property.id}`;
  return [
    "property",
    normalizeString(property.unique_id),
    normalizeString(property.property_name),
    normalizeString(property.address),
  ].join("|");
}

function dedupeRecords(records = [], getKey) {
  const seen = new Set();
  return records.filter((record) => {
    const key = getKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function areListsEqualByKey(previous = [], next = [], getKey) {
  if (previous === next) return true;
  if (!Array.isArray(previous) || !Array.isArray(next)) return false;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (getKey(previous[index]) !== getKey(next[index])) return false;
  }
  return true;
}

function extractFeatureTokens(value) {
  if (value === null || value === undefined) return [];

  const raw =
    typeof value === "object" && !Array.isArray(value)
      ? value.id || value.value || value.name || value.label || ""
      : value;
  const text = normalizeString(raw);
  if (!text) return [];

  return text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeProperty(property = {}) {
  const id = normalizeString(
    property.id || property.ID || property.Property_ID || property.PropertiesID || ""
  );
  const uniqueId = normalizeString(
    property.unique_id || property.Unique_ID || property.Property_Unique_ID || ""
  );
  const propertyName = normalizeString(
    property.property_name || property.Property_Name || property.Property_Property_Name || ""
  );
  const address = normalizeString(
    property.address_1 ||
      property.address ||
      property.Address_1 ||
      property.Address ||
      property.address_2 ||
      ""
  );
  const suburb = normalizeString(property.suburb_town || property.city || property.Suburb_Town || "");
  const state = normalizeString(property.state || property.State || "");
  const postalCode = normalizeString(
    property.postal_code || property.zip_code || property.Postal_Code || property.Zip_Code || ""
  );
  const country = normalizeString(property.country || property.Country || "");
  const buildingFeatures = Array.isArray(property.Building_Features)
    ? property.Building_Features.map((item) =>
        normalizeString(item?.name || item?.label || item?.id || item)
      ).filter(Boolean)
    : extractFeatureTokens(
        property.building_features ||
          property.Building_Features_Options_As_Text ||
          property.building_features_options_as_text ||
          ""
      );

  return {
    id,
    unique_id: uniqueId,
    property_name: propertyName || address || uniqueId || id,
    lot_number: normalizeString(property.lot_number || property.Lot_Number || ""),
    unit_number: normalizeString(property.unit_number || property.Unit_Number || ""),
    address_1: normalizeString(property.address_1 || property.Address_1 || ""),
    address_2: normalizeString(property.address_2 || property.Address_2 || ""),
    address,
    city: normalizeString(property.city || property.City || ""),
    suburb_town: suburb,
    state,
    postal_code: postalCode,
    country,
    property_type: normalizeString(property.property_type || property.Property_Type || ""),
    building_type: normalizeString(property.building_type || property.Building_Type || ""),
    building_type_other: normalizeString(
      property.building_type_other || property.Building_Type_Other || ""
    ),
    foundation_type: normalizeString(property.foundation_type || property.Foundation_Type || ""),
    bedrooms: normalizeString(property.bedrooms || property.Bedrooms || ""),
    manhole:
      property.manhole === true ||
      normalizeString(property.manhole || property.Manhole).toLowerCase() === "true",
    stories: normalizeString(property.stories || property.Stories || ""),
    building_age: normalizeString(property.building_age || property.Building_Age || ""),
    building_features: buildingFeatures,
  };
}

export function usePropertyLookupData(
  plugin,
  { initialProperties = EMPTY_LIST, skipInitialFetch = false } = {}
) {
  const actions = useJobDirectStoreActions();
  const storeProperties = useJobDirectSelector(selectProperties);

  const normalizedInitialProperties = useMemo(
    () => (initialProperties || []).map((item) => normalizeProperty(item)),
    [initialProperties]
  );
  const properties = useMemo(
    () =>
      dedupeRecords(
        (storeProperties || []).map((item) => normalizeProperty(item)),
        createPropertyLookupKey
      ),
    [storeProperties]
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!normalizedInitialProperties.length) return;
    if (
      properties.length &&
      areListsEqualByKey(properties, normalizedInitialProperties, createPropertyLookupKey)
    ) {
      return;
    }
    if (!properties.length) {
      actions.replaceEntityCollection("properties", normalizedInitialProperties);
    }
  }, [actions, properties, normalizedInitialProperties]);

  useEffect(() => {
    if (!plugin) return undefined;

    const releasePropertiesSubscription = registerSharedLookupSubscription({
      key: "lookup:properties",
      start: () =>
        subscribePropertiesForSearch({
          plugin,
          onChange: (records) => {
            const normalized = (records || []).map((item) => normalizeProperty(item));
            actions.replaceEntityCollection(
              "properties",
              dedupeRecords(normalized, createPropertyLookupKey)
            );
          },
          onError: (lookupError) => {
            console.error("[JobDirect] Property lookup subscription failed", lookupError);
          },
        }),
    });

    return () => {
      releasePropertiesSubscription();
    };
  }, [actions, plugin]);

  useEffect(() => {
    let isActive = true;
    if (!plugin) {
      return undefined;
    }

    if (skipInitialFetch) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (!isActive) return;
        const normalizedProperties = (records || []).map((item) => normalizeProperty(item));
        actions.replaceEntityCollection(
          "properties",
          dedupeRecords(normalizedProperties, createPropertyLookupKey)
        );
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading property lookup data", error);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [actions, plugin, skipInitialFetch]);

  const addProperty = useCallback((newProperty) => {
    const normalized = normalizeProperty(newProperty);
    actions.upsertEntityRecord("properties", normalized, { idField: "id" });
    return normalized;
  }, [actions]);

  return {
    properties,
    isLookupLoading: isLoading,
    addProperty,
  };
}
