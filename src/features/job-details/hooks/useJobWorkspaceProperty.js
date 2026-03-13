import { useCallback, useEffect, useMemo } from "react";
import { toText } from "@shared/utils/formatters.js";
import {
  fetchLinkedPropertiesByAccount,
  fetchPropertiesForSearch,
  searchPropertiesForLookup,
} from "@modules/details-workspace/exports/api.js";
import {
  mergePropertyLookupRecords,
} from "@modules/details-workspace/exports/api.js";
import {
  fetchPropertyAffiliationsForDetails,
  savePropertyForDetails,
} from "@modules/job-records/exports/api.js";

export function useJobWorkspaceProperty({
  effectiveJobId,
  error,
  isSdkReady,
  linkedProperties,
  loadedPropertyId,
  plugin,
  relatedInquiryId,
  relatedRecordsAccountId,
  relatedRecordsAccountType,
  selectedWorkspacePropertyId,
  setAffiliations,
  setAffiliationsError,
  setAffiliationsLoading,
  setIsAddPropertyOpen,
  setIsLinkedPropertiesLoading,
  setIsWorkspacePropertyLookupLoading,
  setLinkedProperties,
  setLinkedPropertiesError,
  setLoadedPropertyId,
  setMountedWorkspaceTabs,
  setSelectedWorkspacePropertyId,
  setWorkspacePropertyLookupError,
  setWorkspacePropertyLookupRecords,
  setWorkspacePropertySearchValue,
  success,
  workspacePropertyLookupRecords,
  activeWorkspaceTab,
}) {
  // Fetch all properties for search on mount
  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setWorkspacePropertyLookupRecords([]);
      setIsWorkspacePropertyLookupLoading(false);
      setWorkspacePropertyLookupError("");
      return;
    }
    let cancelled = false;
    setIsWorkspacePropertyLookupLoading(true);
    setWorkspacePropertyLookupError("");
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (cancelled) return;
        setWorkspacePropertyLookupRecords(
          mergePropertyLookupRecords(Array.isArray(records) ? records : [])
        );
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to fetch properties for lookup", lookupError);
        setWorkspacePropertyLookupRecords([]);
        setWorkspacePropertyLookupError(lookupError?.message || "Unable to load properties.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsWorkspacePropertyLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

  // Linked properties by account
  useEffect(() => {
    if (!isSdkReady || !plugin || !relatedRecordsAccountId) {
      setLinkedProperties([]);
      setIsLinkedPropertiesLoading(false);
      setLinkedPropertiesError("");
      return;
    }

    let cancelled = false;
    setIsLinkedPropertiesLoading(true);
    setLinkedPropertiesError("");
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    })
      .then((records) => {
        if (cancelled) return;
        const normalized = mergePropertyLookupRecords(Array.isArray(records) ? records : []);
        setLinkedProperties(normalized);
        setWorkspacePropertyLookupRecords((previous) =>
          mergePropertyLookupRecords(previous, normalized)
        );
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading linked properties", loadError);
        setLinkedProperties([]);
        setLinkedPropertiesError(loadError?.message || "Unable to load linked properties.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLinkedPropertiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, relatedRecordsAccountId, relatedRecordsAccountType]);

  const linkedWorkspaceProperties = useMemo(
    () => (Array.isArray(linkedProperties) ? linkedProperties : []),
    [linkedProperties]
  );

  const activeWorkspaceProperty = useMemo(
    () => {
      const selectedId = toText(selectedWorkspacePropertyId || loadedPropertyId);
      if (selectedId) {
        const fromLookup = (Array.isArray(workspacePropertyLookupRecords)
          ? workspacePropertyLookupRecords
          : []
        ).find(
          (property) =>
            toText(property?.id || property?.ID || property?.Property_ID) === selectedId
        );
        const fromLinked = linkedWorkspaceProperties.find(
          (property) =>
            toText(property?.id || property?.ID || property?.Property_ID) === selectedId
        );
        if (fromLookup && fromLinked) return { ...fromLinked, ...fromLookup };
        if (fromLookup) return fromLookup;
        if (fromLinked) return fromLinked;
      }
      return linkedWorkspaceProperties[0] || null;
    },
    [linkedWorkspaceProperties, loadedPropertyId, selectedWorkspacePropertyId, workspacePropertyLookupRecords]
  );

  const workspacePropertySearchItems = useMemo(
    () =>
      (Array.isArray(workspacePropertyLookupRecords) ? workspacePropertyLookupRecords : [])
        .map((property) => {
          const id = toText(property?.id || property?.ID || property?.Property_ID);
          if (!id) return null;
          const uniqueId = toText(property?.unique_id || property?.Unique_ID);
          const propertyName = toText(
            property?.property_name ||
              property?.Property_Name ||
              property?.address_1 ||
              property?.Address_1 ||
              property?.address ||
              property?.Address
          );
          const label = propertyName || uniqueId || `Property #${id}`;
          const meta = [
            uniqueId,
            toText(property?.address_1 || property?.Address_1 || property?.address || property?.Address),
            toText(property?.suburb_town || property?.Suburb_Town || property?.city || property?.City),
            toText(property?.state || property?.State),
            toText(property?.postal_code || property?.Postal_Code),
          ]
            .filter(Boolean)
            .join(" | ");
          return { id, label, meta };
        })
        .filter(Boolean),
    [workspacePropertyLookupRecords]
  );

  // Property selection sync effects
  useEffect(() => {
    const normalizedLoadedPropertyId = toText(loadedPropertyId);
    if (!normalizedLoadedPropertyId) return;
    setSelectedWorkspacePropertyId(normalizedLoadedPropertyId);
  }, [loadedPropertyId]);

  useEffect(() => {
    if (selectedWorkspacePropertyId) return;
    const fallbackPropertyId = toText(
      loadedPropertyId ||
        linkedWorkspaceProperties[0]?.id ||
        linkedWorkspaceProperties[0]?.ID ||
        linkedWorkspaceProperties[0]?.Property_ID
    );
    if (!fallbackPropertyId) return;
    setSelectedWorkspacePropertyId(fallbackPropertyId);
  }, [linkedWorkspaceProperties, loadedPropertyId, selectedWorkspacePropertyId]);

  useEffect(() => {
    if (!selectedWorkspacePropertyId) {
      setWorkspacePropertySearchValue("");
      return;
    }
    const selected = workspacePropertySearchItems.find(
      (item) => toText(item?.id) === toText(selectedWorkspacePropertyId)
    );
    setWorkspacePropertySearchValue(
      toText(selected?.label || activeWorkspaceProperty?.property_name || selectedWorkspacePropertyId)
    );
  }, [
    activeWorkspaceProperty?.property_name,
    selectedWorkspacePropertyId,
    workspacePropertySearchItems,
  ]);

  // Affiliations load effect
  useEffect(() => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!isSdkReady || !plugin || !propertyId) {
      setAffiliations([]);
      setAffiliationsLoading(false);
      setAffiliationsError("");
      return;
    }

    let cancelled = false;
    setAffiliationsLoading(true);
    setAffiliationsError("");
    fetchPropertyAffiliationsForDetails({
      plugin,
      propertyId,
    })
      .then((records) => {
        if (cancelled) return;
        setAffiliations(Array.isArray(records) ? records : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading property affiliations", loadError);
        setAffiliations([]);
        setAffiliationsError(loadError?.message || "Unable to load property contacts.");
      })
      .finally(() => {
        if (cancelled) return;
        setAffiliationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, loadedPropertyId, plugin, selectedWorkspacePropertyId]);

  // Mounted workspace tabs tracking
  useEffect(() => {
    setMountedWorkspaceTabs((previous) => ({
      ...(previous || {}),
      [activeWorkspaceTab]: true,
    }));
  }, [activeWorkspaceTab]);

  const searchWorkspacePropertiesInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setWorkspacePropertyLookupRecords([]);
        setIsWorkspacePropertyLookupLoading(false);
        setWorkspacePropertyLookupError("");
        return [];
      }
      setIsWorkspacePropertyLookupLoading(true);
      setWorkspacePropertyLookupError("");
      try {
        const records = await searchPropertiesForLookup({
          plugin,
          query: toText(query),
          limit: 50,
        });
        const normalized = mergePropertyLookupRecords(Array.isArray(records) ? records : []);
        setWorkspacePropertyLookupRecords((previous) =>
          mergePropertyLookupRecords(previous, normalized)
        );
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Property lookup search failed", lookupError);
        setWorkspacePropertyLookupRecords([]);
        setWorkspacePropertyLookupError(lookupError?.message || "Unable to search properties.");
        return [];
      } finally {
        setIsWorkspacePropertyLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  const handleSelectWorkspacePropertyFromSearch = useCallback(
    async (item) => {
      const propertyId = toText(item?.id);
      if (!propertyId) return;
      setSelectedWorkspacePropertyId(propertyId);
      setWorkspacePropertySearchValue(toText(item?.label));
      if (!plugin || !effectiveJobId) return;
      try {
        await savePropertyForDetails({
          plugin,
          propertyId,
          jobId: effectiveJobId,
          inquiryId: relatedInquiryId || null,
        });
        setLoadedPropertyId(propertyId);
        setLinkedProperties((previous) => {
          const existing = Array.isArray(previous) ? previous : [];
          if (
            existing.some(
              (record) => toText(record?.id || record?.ID || record?.Property_ID) === propertyId
            )
          ) {
            return existing;
          }
          const matchedRecord = (Array.isArray(workspacePropertyLookupRecords)
            ? workspacePropertyLookupRecords
            : []
          ).find((record) => toText(record?.id || record?.ID || record?.Property_ID) === propertyId);
          return matchedRecord
            ? mergePropertyLookupRecords(existing, [matchedRecord])
            : existing;
        });
        success("Property linked", "Property was linked to this job.");
      } catch (saveError) {
        console.error("[JobDetailsBlank] Failed linking property", saveError);
        error("Link failed", saveError?.message || "Unable to link selected property.");
      }
    },
    [effectiveJobId, error, plugin, relatedInquiryId, success, workspacePropertyLookupRecords]
  );

  const handleSelectWorkspacePropertyId = useCallback(
    (nextPropertyId) => {
      const nextId = toText(nextPropertyId);
      if (!nextId) return;
      const selectedItem = workspacePropertySearchItems.find(
        (item) => toText(item?.id) === nextId
      );
      void handleSelectWorkspacePropertyFromSearch({
        id: nextId,
        label: toText(selectedItem?.label || nextId),
      });
    },
    [handleSelectWorkspacePropertyFromSearch, workspacePropertySearchItems]
  );

  return {
    activeWorkspaceProperty,
    handleSelectWorkspacePropertyFromSearch,
    handleSelectWorkspacePropertyId,
    linkedWorkspaceProperties,
    searchWorkspacePropertiesInDatabase,
    workspacePropertySearchItems,
  };
}
