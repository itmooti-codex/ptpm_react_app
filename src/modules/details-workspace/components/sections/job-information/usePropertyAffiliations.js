import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../../shared/announcements/announcementEmitter.js";
import {
  useDetailsWorkspaceSelector,
  useDetailsWorkspaceStoreActions,
} from "../../../hooks/useDetailsWorkspaceStore.jsx";
import { selectPropertyAffiliationsByPropertyKey } from "../../../state/selectors.js";
import {
  createAffiliationRecord,
  deleteAffiliationRecord,
  fetchPropertyAffiliationsByPropertyId,
  subscribePropertyAffiliationsByPropertyId,
  updateAffiliationRecord,
} from "../../../api/core/runtime.js";
import { dedupeById, normalizePropertyId } from "./jobInfoUtils.js";

export function usePropertyAffiliations({
  plugin,
  resolvedPropertyId,
  contacts,
  companies,
  announcementJobId,
  announcementInquiryId,
  onAffiliationSaved,
  success,
  error,
}) {
  const storeActions = useDetailsWorkspaceStoreActions();

  const [isAffiliationsLoading, setIsAffiliationsLoading] = useState(false);
  const [affiliationLoadError, setAffiliationLoadError] = useState("");
  const [affiliationModalState, setAffiliationModalState] = useState({
    open: false,
    initialData: null,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const affiliations = useDetailsWorkspaceSelector(
    useCallback(
      (state) => selectPropertyAffiliationsByPropertyKey(state, resolvedPropertyId),
      [resolvedPropertyId]
    )
  );

  const hasCachedAffiliations = useDetailsWorkspaceSelector(
    useCallback((state) => {
      const key = String(resolvedPropertyId || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.propertyAffiliationsByProperty || {},
        key
      );
    }, [resolvedPropertyId])
  );

  const contactLookupById = useMemo(() => {
    const map = new Map();
    (contacts || []).forEach((item) => {
      const key = normalizePropertyId(item?.id);
      if (!key) return;
      map.set(key, item);
    });
    return map;
  }, [contacts]);

  const companyLookupById = useMemo(() => {
    const map = new Map();
    (companies || []).forEach((item) => {
      const key = normalizePropertyId(item?.id);
      if (!key) return;
      map.set(key, item);
    });
    return map;
  }, [companies]);

  const mergePropertyContactsForCurrentProperty = useCallback(
    (records = []) => {
      const currentId = normalizePropertyId(resolvedPropertyId);
      if (!currentId) return;
      const nextRecords = (Array.isArray(records) ? records : []).map((record) => ({
        ...record,
        property_id: normalizePropertyId(record?.property_id) || currentId,
      }));
      storeActions.replaceRelationCollection(
        "propertyAffiliationsByProperty",
        currentId,
        dedupeById(nextRecords)
      );
    },
    [resolvedPropertyId, storeActions]
  );

  useEffect(() => {
    let isActive = true;
    if (!plugin || !resolvedPropertyId) {
      setAffiliationLoadError("");
      setIsAffiliationsLoading(false);
      return undefined;
    }

    setIsAffiliationsLoading(!hasCachedAffiliations);
    setAffiliationLoadError("");

    if (!hasCachedAffiliations) {
      fetchPropertyAffiliationsByPropertyId({ plugin, propertyId: resolvedPropertyId })
        .then((records) => {
          if (!isActive) return;
          mergePropertyContactsForCurrentProperty(records || []);
          setAffiliationLoadError("");
        })
        .catch((fetchError) => {
          if (!isActive) return;
          console.error("[JobDirect] Failed loading property contacts", fetchError);
          setAffiliationLoadError("Unable to load property contacts. Waiting for realtime updates.");
        })
        .finally(() => {
          if (!isActive) return;
          setIsAffiliationsLoading(false);
        });
    }

    const unsubscribe = subscribePropertyAffiliationsByPropertyId({
      plugin,
      propertyId: resolvedPropertyId,
      onChange: (records) => {
        if (!isActive) return;
        mergePropertyContactsForCurrentProperty(records || []);
        setAffiliationLoadError("");
      },
      onError: (subscriptionError) => {
        if (!isActive) return;
        console.error("[JobDirect] Property contact subscription error", subscriptionError);
      },
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [
    hasCachedAffiliations,
    mergePropertyContactsForCurrentProperty,
    plugin,
    resolvedPropertyId,
  ]);

  const openCreateAffiliation = () => {
    if (!resolvedPropertyId) {
      error("Cannot add contact", "Select a property first.");
      return;
    }
    setAffiliationModalState({ open: true, initialData: null });
  };

  const openEditAffiliation = (record) => {
    if (!record) return;
    const contactMatch = contactLookupById.get(normalizePropertyId(record?.contact_id));
    const companyMatch = companyLookupById.get(normalizePropertyId(record?.company_id));
    const accountCompanyMatch = companyLookupById.get(
      normalizePropertyId(record?.company_as_accounts_contact_id)
    );
    setAffiliationModalState({
      open: true,
      initialData: {
        ...record,
        contact_first_name: record?.contact_first_name || contactMatch?.first_name || "",
        contact_last_name: record?.contact_last_name || contactMatch?.last_name || "",
        contact_email: record?.contact_email || contactMatch?.email || "",
        company_name: record?.company_name || companyMatch?.name || "",
        company_as_accounts_contact_name:
          record?.company_as_accounts_contact_name || accountCompanyMatch?.name || "",
      },
    });
  };

  const closeAffiliationModal = () => {
    setAffiliationModalState({ open: false, initialData: null });
  };

  const saveAffiliation = async (payload, context = {}) => {
    if (!plugin) {
      throw new Error("SDK is still initializing. Please try again.");
    }
    if (!resolvedPropertyId) {
      throw new Error("Select a property first.");
    }

    const nextPayload = {
      ...payload,
      property_id: resolvedPropertyId,
    };

    const existingId = normalizePropertyId(context?.id || "");
    const savedRecord = existingId
      ? await updateAffiliationRecord({
          plugin,
          id: existingId,
          payload: nextPayload,
        })
      : await createAffiliationRecord({
          plugin,
          payload: nextPayload,
        });

    const nextAffiliations = (() => {
      const normalizedId = String(savedRecord?.id || "").trim();
      if (!normalizedId) return affiliations;
      const exists = affiliations.some((item) => String(item?.id || "").trim() === normalizedId);
      if (!exists) return dedupeById([savedRecord, ...affiliations]);
      return dedupeById(affiliations.map((item) =>
        String(item?.id || "").trim() === normalizedId ? { ...item, ...savedRecord } : item
      ));
    })();
    storeActions.replaceRelationCollection(
      "propertyAffiliationsByProperty",
      resolvedPropertyId,
      nextAffiliations
    );

    onAffiliationSaved?.();

    success(
      existingId ? "Property contact updated" : "Property contact added",
      existingId
        ? "Property contact details were updated."
        : "Property contact was linked to this property."
    );
    const savedAffiliationId = normalizePropertyId(savedRecord?.id || savedRecord?.ID || existingId);
    await emitAnnouncement({
      plugin,
      eventKey: existingId
        ? ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_UPDATED
        : ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_ADDED,
      quoteJobId: announcementJobId,
      inquiryId: announcementInquiryId,
      focusId: savedAffiliationId,
      dedupeEntityId:
        savedAffiliationId || `${announcementJobId}:${announcementInquiryId}:${resolvedPropertyId}`,
      title: existingId ? "Property contact updated" : "Property contact added",
      content: existingId
        ? "Property contact details were updated."
        : "Property contact was linked to this property.",
      logContext: "job-direct:PropertyTabSection:saveAffiliation",
    });
  };

  const confirmDeleteAffiliation = async () => {
    if (!plugin || !deleteTarget?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteAffiliationRecord({ plugin, id: deleteTarget.id });
      storeActions.replaceRelationCollection(
        "propertyAffiliationsByProperty",
        resolvedPropertyId,
        affiliations.filter(
          (item) => String(item?.id || "").trim() !== String(deleteTarget.id).trim()
        )
      );
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_DELETED,
        quoteJobId: announcementJobId,
        inquiryId: announcementInquiryId,
        focusId: normalizePropertyId(deleteTarget?.id),
        dedupeEntityId: `${normalizePropertyId(deleteTarget?.id)}:deleted`,
        title: "Property contact removed",
        content: "A property contact link was removed.",
        logContext: "job-direct:PropertyTabSection:confirmDeleteAffiliation",
      });
      success("Property contact deleted", "Property contact link was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting property contact", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete property contact.");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    affiliations,
    isAffiliationsLoading,
    affiliationLoadError,
    affiliationModalState,
    deleteTarget,
    isDeleting,
    contactLookupById,
    companyLookupById,
    openCreateAffiliation,
    openEditAffiliation,
    closeAffiliationModal,
    saveAffiliation,
    confirmDeleteAffiliation,
    setDeleteTarget,
  };
}
