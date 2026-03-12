import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLinkedPropertiesByAccount, fetchPropertiesForSearch, fetchPropertyRecordById } from "../../../modules/details-workspace/api/core/runtime.js";
import {
  arePropertyRecordCollectionsEqual,
  buildComparablePropertyAddress,
  dedupePropertyLookupRecords,
  mergePropertyCollectionsIfChanged,
  normalizeAddressText,
  resolvePropertyLookupLabel,
} from "@modules/details-workspace/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { joinAddress, toText } from "@shared/utils/formatters.js";
import { readInquiryWorkspacePropertyCache, readInquiryWorkspaceUiCache, writeInquiryWorkspacePropertyCache, writeInquiryWorkspaceUiCache } from "../shared/inquiryWorkspaceCache.js";
import { fetchRelatedJobSummaryById, getRelatedJobRecordKey, mergeRelatedRecordCollections } from "../api/inquiryRelatedRecordsApi.js";
import { buildInquiryPropertyRecord, buildInquiryPropertySearchItems, buildInquiryWorkspaceLookupData } from "../shared/inquiryPropertyWorkspaceHelpers.js";

export function useInquiryPropertyWorkspaceState({
  plugin,
  inquiry,
  safeUid,
  hasUid,
  relatedJobs,
  relatedRecordsAccountId,
  relatedRecordsAccountType,
  inquiryContactId,
  inquiryPrimaryContact,
  inquiryCompanyId,
  inquiryCompany,
  inquiryCompanyPrimaryPerson,
  serviceProviderLookup,
  inquiryTakenByLookup,
  sameAsContactPropertySource,
}) {
  const [propertyLookupRecords, setPropertyLookupRecords] = useState([]);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [isLinkedPropertiesLoading, setIsLinkedPropertiesLoading] = useState(false);
  const [linkedPropertiesError, setLinkedPropertiesError] = useState("");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [isPropertySameAsContact, setIsPropertySameAsContact] = useState(false);
  const [isApplyingSameAsContactProperty, setIsApplyingSameAsContactProperty] = useState(false);
  const [contextualRelatedJobs, setContextualRelatedJobs] = useState([]);
  const [propertyModalState, setPropertyModalState] = useState({ open: false, initialData: null });
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState("create");
  const [appointmentModalEditingId, setAppointmentModalEditingId] = useState("");
  const [appointmentModalDraft, setAppointmentModalDraft] = useState(null);
  const [isUploadsModalOpen, setIsUploadsModalOpen] = useState(false);
  const propertySearchManualEditRef = useRef(false);
  const previousSelectedPropertyIdRef = useRef("");

  const inquiryPropertyRelationRecord = useMemo(
    () => inquiry?.Property || inquiry?.property || {},
    [inquiry?.Property, inquiry?.property]
  );
  const inquiryPropertyId = normalizePropertyId(
    inquiry?.property_id ||
      inquiry?.Property_ID ||
      inquiry?.PropertyID ||
      inquiryPropertyRelationRecord?.id ||
      inquiryPropertyRelationRecord?.ID
  );
  const inquiryPropertyRecord = useMemo(
    () => buildInquiryPropertyRecord({ inquiry, inquiryPropertyRelationRecord, inquiryPropertyId }),
    [inquiry, inquiryPropertyId, inquiryPropertyRelationRecord]
  );
  const normalizedSelectedPropertyId = normalizePropertyId(selectedPropertyId);
  const contextualRelatedJobIds = useMemo(() => {
    const linkedInquiryJobId = toText(
      inquiry?.inquiry_for_job_id || inquiry?.Inquiry_For_Job_ID || inquiry?.Inquiry_for_Job_ID
    );
    const quoteJobId = toText(
      inquiry?.quote_record_id || inquiry?.Quote_Record_ID || inquiry?.Quote_record_ID
    );
    return Array.from(new Set([linkedInquiryJobId, quoteJobId].filter(Boolean)));
  }, [inquiry]);
  const linkedPropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(linkedProperties).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [linkedProperties]
  );
  const propertySearchItems = useMemo(
    () =>
      buildInquiryPropertySearchItems(
        dedupePropertyLookupRecords(propertyLookupRecords),
        resolvePropertyLookupLabel
      ),
    [propertyLookupRecords]
  );
  const activeRelatedProperty = useMemo(() => {
    if (normalizedSelectedPropertyId) {
      const fromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      const fromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      if (fromLookup && fromLinked) return { ...fromLinked, ...fromLookup };
      if (fromLookup) return fromLookup;
      if (fromLinked) return fromLinked;
    }
    if (linkedPropertiesSorted.length) return linkedPropertiesSorted[0];
    return null;
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);
  const uploadsPropertyId = normalizePropertyId(
    activeRelatedProperty?.id || normalizedSelectedPropertyId || inquiryPropertyId
  );
  const workspacePropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(propertyLookupRecords).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [propertyLookupRecords]
  );
  const workspaceLookupData = useMemo(
    () =>
      buildInquiryWorkspaceLookupData({
        inquiryCompany,
        inquiryCompanyId,
        inquiryCompanyPrimaryPerson,
        inquiryContactId,
        inquiryPrimaryContact,
        inquiryTakenByLookup,
        serviceProviderLookup,
        workspacePropertiesSorted,
      }),
    [inquiryCompany, inquiryCompanyId, inquiryCompanyPrimaryPerson, inquiryContactId, inquiryPrimaryContact, inquiryTakenByLookup, serviceProviderLookup, workspacePropertiesSorted]
  );
  const relatedJobsForDisplay = useMemo(
    () => mergeRelatedRecordCollections(relatedJobs, contextualRelatedJobs, getRelatedJobRecordKey),
    [contextualRelatedJobs, relatedJobs]
  );

  useEffect(() => {
    setSelectedPropertyId("");
    setPropertySearchQuery("");
    propertySearchManualEditRef.current = false;
    previousSelectedPropertyIdRef.current = "";
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
    setLinkedProperties([]);
    setLinkedPropertiesError("");
    setPropertyModalState({ open: false, initialData: null });
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsUploadsModalOpen(false);
  }, [safeUid]);

  useEffect(() => {
    if (!hasUid) return;
    const cachedUi = readInquiryWorkspaceUiCache(safeUid);
    if (!cachedUi || typeof cachedUi !== "object") return;
    const cachedPropertyId = normalizePropertyId(cachedUi?.selectedPropertyId || "");
    if (cachedPropertyId) setSelectedPropertyId(cachedPropertyId);
    if (typeof cachedUi?.isPropertySameAsContact === "boolean") {
      setIsPropertySameAsContact(cachedUi.isPropertySameAsContact);
    }
  }, [hasUid, safeUid]);

  useEffect(() => {
    if (!hasUid) return;
    writeInquiryWorkspaceUiCache(safeUid, {
      selectedPropertyId: normalizedSelectedPropertyId || selectedPropertyId,
      isPropertySameAsContact,
    });
  }, [hasUid, isPropertySameAsContact, normalizedSelectedPropertyId, safeUid, selectedPropertyId]);

  useEffect(() => {
    if (!plugin || !relatedRecordsAccountId) {
      setLinkedProperties([]);
      setLinkedPropertiesError("");
      setIsLinkedPropertiesLoading(false);
      return;
    }

    let isMounted = true;
    setLinkedPropertiesError("");
    const cachedPropertyData = readInquiryWorkspacePropertyCache({
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    });
    if (cachedPropertyData) {
      const cachedLinked = dedupePropertyLookupRecords(cachedPropertyData.linkedProperties || []);
      const cachedLookup = dedupePropertyLookupRecords(
        cachedPropertyData.propertyLookupRecords || []
      );
      setLinkedProperties((previous) =>
        arePropertyRecordCollectionsEqual(previous, cachedLinked) ? previous : cachedLinked
      );
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, cachedLookup)
      );
      setIsLinkedPropertiesLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLinkedPropertiesLoading(true);
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        setLinkedProperties((previous) =>
          arePropertyRecordCollectionsEqual(previous, normalizedRecords)
            ? previous
            : normalizedRecords
        );
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
        writeInquiryWorkspacePropertyCache({
          accountType: relatedRecordsAccountType,
          accountId: relatedRecordsAccountId,
          linkedProperties: normalizedRecords,
          propertyLookupRecords: normalizedRecords,
        });
      })
      .catch((loadError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading linked properties", loadError);
        setLinkedProperties([]);
        setLinkedPropertiesError(loadError?.message || "Unable to load linked properties.");
      })
      .finally(() => {
        if (isMounted) setIsLinkedPropertiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [plugin, relatedRecordsAccountId, relatedRecordsAccountType]);

  useEffect(() => {
    if (!relatedRecordsAccountId) return;
    if (!linkedProperties.length && !propertyLookupRecords.length) return;
    writeInquiryWorkspacePropertyCache({
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
      linkedProperties,
      propertyLookupRecords,
    });
  }, [linkedProperties, propertyLookupRecords, relatedRecordsAccountId, relatedRecordsAccountType]);

  useEffect(() => {
    if (!inquiryPropertyId && !resolvePropertyLookupLabel(inquiryPropertyRecord)) return;
    setPropertyLookupRecords((previous) =>
      mergePropertyCollectionsIfChanged(previous, [inquiryPropertyRecord])
    );
    if (resolvePropertyLookupLabel(inquiryPropertyRecord)) {
      setLinkedProperties((previous) =>
        mergePropertyCollectionsIfChanged(previous, [inquiryPropertyRecord])
      );
    }
  }, [inquiryPropertyId, inquiryPropertyRecord]);

  useEffect(() => {
    if (toText(import.meta.env.VITE_PRELOAD_ALL_PROPERTIES).toLowerCase() !== "true" || !plugin) {
      return;
    }
    let isMounted = true;
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (!normalizedRecords.length) return;
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
      })
      .catch((loadError) => {
        if (isMounted) console.error("[InquiryDetails] Failed loading property lookup", loadError);
      });

    return () => {
      isMounted = false;
    };
  }, [plugin]);

  useEffect(() => {
    const normalizedInquiryPropertyId = normalizePropertyId(inquiryPropertyId);
    if (!normalizedInquiryPropertyId) return;
    setSelectedPropertyId((previous) => {
      const normalizedPreviousId = normalizePropertyId(previous);
      return normalizedPreviousId === normalizedInquiryPropertyId ? previous : normalizedInquiryPropertyId;
    });
  }, [inquiryPropertyId]);

  useEffect(() => {
    if (normalizedSelectedPropertyId) {
      const isStillAvailableInLinked = linkedPropertiesSorted.some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      const isStillAvailableInLookup = dedupePropertyLookupRecords(propertyLookupRecords).some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      if (isStillAvailableInLinked || isStillAvailableInLookup) return;
    }
    const fallbackId = inquiryPropertyId || normalizePropertyId(linkedPropertiesSorted[0]?.id);
    setSelectedPropertyId((previous) => {
      const prevId = normalizePropertyId(previous);
      return prevId === fallbackId ? previous : fallbackId;
    });
  }, [inquiryPropertyId, linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);

  useEffect(() => {
    if (!normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = "";
      return;
    }
    const selectedRecord =
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
    if (!selectedRecord) return;
    const nextLabel = resolvePropertyLookupLabel(selectedRecord);
    if (!nextLabel) return;
    if (previousSelectedPropertyIdRef.current !== normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = normalizedSelectedPropertyId;
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(nextLabel);
      return;
    }
    if (propertySearchManualEditRef.current) return;
    if (toText(propertySearchQuery) !== toText(nextLabel)) {
      setPropertySearchQuery(nextLabel);
    }
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords, propertySearchQuery]);

  useEffect(() => {
    if (!plugin || !normalizedSelectedPropertyId) return;
    const selectedRecord =
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
    const hasAddressDetails = Boolean(
      toText(
        selectedRecord?.property_name ||
          selectedRecord?.Property_Name ||
          selectedRecord?.address_1 ||
          selectedRecord?.Address_1 ||
          selectedRecord?.address ||
          selectedRecord?.Address
      ) ||
        toText(
          selectedRecord?.suburb_town ||
            selectedRecord?.Suburb_Town ||
            selectedRecord?.city ||
            selectedRecord?.City
        )
    );
    if (selectedRecord && hasAddressDetails) return;

    let isMounted = true;
    fetchPropertyRecordById({ plugin, propertyId: normalizedSelectedPropertyId })
      .then((record) => {
        if (!isMounted || !record) return;
        const normalizedRecord = normalizePropertyLookupRecord(record);
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedRecord])
        );
        setLinkedProperties((previous) =>
          mergePropertyCollectionsIfChanged(previous || [], [normalizedRecord])
        );
      })
      .catch((fetchError) => {
        if (
          isMounted &&
          !/timed out/i.test(String(fetchError?.message || ""))
        ) {
          console.error("[InquiryDetails] Failed hydrating selected property details", fetchError);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, plugin, propertyLookupRecords]);

  useEffect(() => {
    const sourceComparableAddress = normalizeAddressText(
      joinAddress([
        sameAsContactPropertySource?.address1,
        sameAsContactPropertySource?.suburbTown,
        sameAsContactPropertySource?.state,
        sameAsContactPropertySource?.postalCode,
      ]) || sameAsContactPropertySource?.searchText
    );
    const selectedComparableAddress = buildComparablePropertyAddress(activeRelatedProperty || {});
    const isAddressMatched =
      Boolean(sourceComparableAddress && selectedComparableAddress) &&
      (sourceComparableAddress === selectedComparableAddress ||
        selectedComparableAddress.includes(sourceComparableAddress) ||
        sourceComparableAddress.includes(selectedComparableAddress));
    if (isPropertySameAsContact !== isAddressMatched) {
      setIsPropertySameAsContact(isAddressMatched);
    }
  }, [activeRelatedProperty, isPropertySameAsContact, sameAsContactPropertySource]);

  useEffect(() => {
    let cancelled = false;
    if (!contextualRelatedJobIds.length) {
      setContextualRelatedJobs((previous) => (previous.length ? [] : previous));
      return;
    }

    const accountJobMap = new Map(
      (Array.isArray(relatedJobs) ? relatedJobs : []).map((job) => [toText(job?.id || job?.ID), job])
    );

    Promise.all(
      contextualRelatedJobIds.map(async (jobId) => {
        const normalizedJobId = toText(jobId);
        if (!normalizedJobId) return null;
        const existingJob = accountJobMap.get(normalizedJobId);
        if (existingJob) return existingJob;
        try {
          const fetchedJob = await fetchRelatedJobSummaryById({ plugin, jobId: normalizedJobId });
          return fetchedJob || { id: normalizedJobId };
        } catch (loadError) {
          console.error("[InquiryDetails] Failed to load contextual related job", loadError);
          return { id: normalizedJobId };
        }
      })
    ).then((rows) => {
      if (!cancelled) {
        const nextRows = (Array.isArray(rows) ? rows : []).filter(Boolean);
        setContextualRelatedJobs((previous) => {
          if (
            previous.length === nextRows.length &&
            previous.every(
              (row, index) =>
                toText(row?.id || row?.ID) === toText(nextRows[index]?.id || nextRows[index]?.ID) &&
                toText(row?.unique_id || row?.Unique_ID) ===
                  toText(nextRows[index]?.unique_id || nextRows[index]?.Unique_ID)
            )
          ) {
            return previous;
          }
          return nextRows;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [contextualRelatedJobIds, plugin, relatedJobs]);

  return {
    propertyLookupRecords,
    setPropertyLookupRecords,
    setLinkedProperties,
    isLinkedPropertiesLoading,
    linkedPropertiesError,
    propertySearchQuery,
    setPropertySearchQuery,
    selectedPropertyId,
    setSelectedPropertyId,
    isPropertySameAsContact,
    setIsPropertySameAsContact,
    isApplyingSameAsContactProperty,
    setIsApplyingSameAsContactProperty,
    propertyModalState,
    setPropertyModalState,
    isAppointmentModalOpen,
    setIsAppointmentModalOpen,
    appointmentModalMode,
    setAppointmentModalMode,
    appointmentModalEditingId,
    setAppointmentModalEditingId,
    appointmentModalDraft,
    setAppointmentModalDraft,
    isUploadsModalOpen,
    setIsUploadsModalOpen,
    propertySearchManualEditRef,
    inquiryPropertyId,
    inquiryPropertyRecord,
    linkedPropertiesSorted,
    propertySearchItems,
    activeRelatedProperty,
    uploadsPropertyId,
    workspaceLookupData,
    relatedJobsForDisplay,
  };
}
