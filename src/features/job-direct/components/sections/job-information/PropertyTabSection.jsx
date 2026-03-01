import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import { useContactEntityLookupData } from "../../../hooks/useContactEntityLookupData.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../../hooks/useJobDirectStore.jsx";
import {
  selectPropertyAffiliationsByPropertyKey,
  selectPropertyUploadsByPropertyKey,
} from "../../../state/selectors.js";
import {
  createAffiliationRecord,
  deleteAffiliationRecord,
  deleteUploadRecord,
  fetchPropertyAffiliationsByPropertyId,
  fetchPropertyUploads,
  subscribePropertyAffiliationsByPropertyId,
  subscribePropertyUploadsByPropertyId,
  createPropertyUploadFromFile,
  updateAffiliationRecord,
} from "../../../sdk/jobDirectSdk.js";
import { PropertyAffiliationModal } from "../../modals/PropertyAffiliationModal.jsx";
import {
  EditActionIcon as EditIcon,
  EyeActionIcon as EyeIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import { SearchDropdownInput } from "./JobInfoFormFields.jsx";
import {
  AccordionBlock,
  MapPinIcon,
  PropertyOptionCard,
  StarIcon,
} from "./JobInfoOptionCards.jsx";
import {
  buildPropertyMapLink,
  dedupeById,
  dedupeUploadRecords,
  formatFileSize,
  formatPropertyValue,
  getAffiliationCompanyName,
  getAffiliationContactName,
  getPropertyFeatureText,
  isPrimaryAffiliation,
  normalizePropertyId,
} from "./jobInfoUtils.js";

export function PropertyTabSection({
  plugin,
  preloadedLookupData,
  currentPropertyId,
  onOpenContactDetailsModal,
  accountType,
  selectedAccountId,
  propertySearchValue,
  propertySearchItems,
  onPropertySearchValueChange,
  onSelectPropertyFromSearch,
  onAddProperty,
  activeRelatedProperty,
  linkedProperties,
  isLoading,
  loadError,
  selectedPropertyId,
  onSelectProperty,
  onEditRelatedProperty,
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const { contacts, companies } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });
  const [openSections, setOpenSections] = useState({
    information: false,
    description: false,
  });
  const [isAffiliationsLoading, setIsAffiliationsLoading] = useState(false);
  const [affiliationLoadError, setAffiliationLoadError] = useState("");
  const [affiliationModalState, setAffiliationModalState] = useState({
    open: false,
    initialData: null,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingPropertyUploads, setPendingPropertyUploads] = useState([]);
  const [isPropertyDropActive, setIsPropertyDropActive] = useState(false);
  const [isUploadsLoading, setIsUploadsLoading] = useState(false);
  const [uploadsLoadError, setUploadsLoadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteUploadTarget, setDeleteUploadTarget] = useState(null);
  const [isDeletingUpload, setIsDeletingUpload] = useState(false);
  const uploadsInputRef = useRef(null);
  const pendingPropertyUploadsRef = useRef([]);

  const resolvedPropertyId = normalizePropertyId(
    currentPropertyId || selectedPropertyId || activeRelatedProperty?.id
  );
  const affiliations = useJobDirectSelector(
    useCallback(
      (state) => selectPropertyAffiliationsByPropertyKey(state, resolvedPropertyId),
      [resolvedPropertyId]
    )
  );
  const propertyUploads = useJobDirectSelector(
    useCallback(
      (state) => selectPropertyUploadsByPropertyKey(state, resolvedPropertyId),
      [resolvedPropertyId]
    )
  );
  const hasCachedAffiliations = useJobDirectSelector(
    useCallback((state) => {
      const key = String(resolvedPropertyId || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.propertyAffiliationsByProperty || {},
        key
      );
    }, [resolvedPropertyId])
  );
  const hasCachedPropertyUploads = useJobDirectSelector(
    useCallback((state) => {
      const key = String(resolvedPropertyId || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.propertyUploadsByProperty || {},
        key
      );
    }, [resolvedPropertyId])
  );

  const relatedPropertyMapLink = buildPropertyMapLink(activeRelatedProperty || {});
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
      const currentPropertyId = normalizePropertyId(resolvedPropertyId);
      if (!currentPropertyId) return;
      const nextForCurrentProperty = (Array.isArray(records) ? records : []).map((record) => ({
        ...record,
        property_id: normalizePropertyId(record?.property_id) || currentPropertyId,
      }));
      storeActions.replaceRelationCollection(
        "propertyAffiliationsByProperty",
        currentPropertyId,
        dedupeById(nextForCurrentProperty)
      );
    },
    [resolvedPropertyId, storeActions]
  );
  const mergePropertyUploadsForCurrentProperty = useCallback(
    (records = []) => {
      const currentPropertyId = normalizePropertyId(resolvedPropertyId);
      if (!currentPropertyId) return;
      const nextForCurrentProperty = (Array.isArray(records) ? records : []).map((record) => ({
        ...record,
        property_name_id:
          normalizePropertyId(record?.property_name_id || record?.property_id) ||
          currentPropertyId,
      }));
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        currentPropertyId,
        dedupeUploadRecords(nextForCurrentProperty)
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

  useEffect(() => {
    let isActive = true;
    if (!plugin || !resolvedPropertyId) {
      setUploadsLoadError("");
      setIsUploadsLoading(false);
      return undefined;
    }

    setIsUploadsLoading(!hasCachedPropertyUploads);
    setUploadsLoadError("");
    if (!hasCachedPropertyUploads) {
      fetchPropertyUploads({ plugin, propertyId: resolvedPropertyId })
        .then((records) => {
          if (!isActive) return;
          mergePropertyUploadsForCurrentProperty(records || []);
          setUploadsLoadError("");
        })
        .catch((fetchError) => {
          if (!isActive) return;
          console.error("[JobDirect] Failed loading property uploads", fetchError);
          setUploadsLoadError("Unable to load property uploads. Waiting for realtime updates.");
        })
        .finally(() => {
          if (!isActive) return;
          setIsUploadsLoading(false);
        });
    }

    const unsubscribe = subscribePropertyUploadsByPropertyId({
      plugin,
      propertyId: resolvedPropertyId,
      onChange: (records) => {
        if (!isActive) return;
        mergePropertyUploadsForCurrentProperty(records || []);
        setUploadsLoadError("");
      },
      onError: (subscriptionError) => {
        if (!isActive) return;
        console.error("[JobDirect] Property upload subscription error", subscriptionError);
      },
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [
    hasCachedPropertyUploads,
    mergePropertyUploadsForCurrentProperty,
    plugin,
    resolvedPropertyId,
  ]);

  useEffect(() => {
    pendingPropertyUploadsRef.current = pendingPropertyUploads;
  }, [pendingPropertyUploads]);

  useEffect(
    () => () => {
      pendingPropertyUploadsRef.current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  useEffect(() => {
    setPendingPropertyUploads((previous) => {
      previous.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [resolvedPropertyId]);

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

    success(
      existingId ? "Property contact updated" : "Property contact added",
      existingId
        ? "Property contact details were updated."
        : "Property contact was linked to this property."
    );
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
      success("Property contact deleted", "Property contact link was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting property contact", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete property contact.");
    } finally {
      setIsDeleting(false);
    }
  };

  const triggerUploadFilePicker = () => {
    if (!resolvedPropertyId) {
      error("Cannot upload", "Select a property first.");
      return;
    }
    uploadsInputRef.current?.click();
  };

  const queuePendingPropertyFiles = (files = []) => {
    if (!files.length || !resolvedPropertyId) return;
    setPendingPropertyUploads((previous) => {
      const existingSignatures = new Set(
        previous.map((item) => `${item.name}::${item.size}::${item.type}::${item.lastModified}`)
      );
      const next = [...previous];
      files.forEach((file) => {
        const signature = `${file.name}::${file.size}::${file.type}::${file.lastModified}`;
        if (existingSignatures.has(signature)) return;
        existingSignatures.add(signature);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified || 0,
          previewUrl: URL.createObjectURL(file),
        });
      });
      return next;
    });
  };

  const handleUploadFilesSelected = (event) => {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    queuePendingPropertyFiles(files);
    if (input) input.value = "";
  };

  const handlePropertyDropZoneDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!resolvedPropertyId || isUploading) return;
    if (!isPropertyDropActive) setIsPropertyDropActive(true);
  };

  const handlePropertyDropZoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsPropertyDropActive(false);
  };

  const handlePropertyDropZoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsPropertyDropActive(false);
    if (!resolvedPropertyId || isUploading) return;
    const files = Array.from(event?.dataTransfer?.files || []);
    queuePendingPropertyFiles(files);
  };

  const removePendingPropertyUpload = (pendingId) => {
    setPendingPropertyUploads((previous) => {
      const next = [];
      previous.forEach((item) => {
        if (item.id === pendingId) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return;
        }
        next.push(item);
      });
      return next;
    });
  };

  const savePendingPropertyUploads = async () => {
    if (!plugin || !resolvedPropertyId || !pendingPropertyUploads.length || isUploading) return;

    setIsUploading(true);
    setUploadsLoadError("");
    const created = [];
    const failed = [];

    for (const pending of pendingPropertyUploads) {
      try {
        const saved = await createPropertyUploadFromFile({
          plugin,
          propertyId: resolvedPropertyId,
          file: pending.file,
          uploadPath: `property-uploads/${resolvedPropertyId}`,
        });
        if (saved) created.push(saved);
        if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      } catch (uploadError) {
        failed.push({
          ...pending,
          uploadError: uploadError?.message || "Unable to upload file.",
        });
      }
    }

    if (created.length) {
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        resolvedPropertyId,
        dedupeUploadRecords([...created, ...(propertyUploads || [])])
      );
    }

    setPendingPropertyUploads(failed);

    if (created.length) {
      success(
        created.length > 1 ? "Uploads added" : "Upload added",
        created.length > 1
          ? `${created.length} files were uploaded and linked to this property.`
          : "File was uploaded and linked to this property."
      );
    }

    if (failed.length) {
      const firstMessage = failed[0]?.uploadError || "Unable to upload one or more files.";
      setUploadsLoadError(firstMessage);
      error(
        "Upload failed",
        failed.length === pendingPropertyUploads.length
          ? firstMessage
          : `${failed.length} file(s) failed. ${firstMessage}`
      );
    }

    setIsUploading(false);
  };

  const confirmDeleteUpload = async () => {
    if (!plugin || !deleteUploadTarget?.id || isDeletingUpload) return;
    setIsDeletingUpload(true);
    try {
      await deleteUploadRecord({ plugin, id: deleteUploadTarget.id });
      storeActions.replaceRelationCollection(
        "propertyUploadsByProperty",
        resolvedPropertyId,
        (propertyUploads || []).filter(
          (item) => String(item?.id || "").trim() !== String(deleteUploadTarget.id || "").trim()
        )
      );
      success("Upload deleted", "Property upload was removed.");
      setDeleteUploadTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting property upload", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete upload.");
    } finally {
      setIsDeletingUpload(false);
    }
  };

  return (
    <div
      data-job-section="job-section-property"
      className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]"
    >
      <div className="w-full">
        <Card className="h-fit space-y-6">
          <div className="text-base font-bold leading-4 text-neutral-700">Property</div>
          <SearchDropdownInput
            label="Property Search"
            field="properties"
            value={propertySearchValue}
            placeholder="Search by property name, UID, or address"
            items={propertySearchItems}
            onValueChange={onPropertySearchValueChange}
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

          {selectedAccountId && isLoading ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Loading linked properties...
            </div>
          ) : null}

          {selectedAccountId && !isLoading && loadError ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </div>
          ) : null}

          {selectedAccountId && !isLoading && !loadError && !linkedProperties.length ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              No linked properties found.
            </div>
          ) : null}

          {selectedAccountId && !isLoading && !loadError && linkedProperties.length ? (
            <div className="space-y-2">
              {linkedProperties.map((property, index) => {
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
        <Card className="h-fit space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold leading-4 text-neutral-700">Related Property</div>
            {activeRelatedProperty ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                  onClick={() => onEditRelatedProperty?.(activeRelatedProperty)}
                  aria-label="Edit related property"
                  title="Edit Property"
                >
                  <EditIcon />
                </button>
              </div>
            ) : null}
          </div>

          {activeRelatedProperty ? (
            <div className="space-y-3">
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
                    <div key={item.label} className="space-y-1 border-b border-slate-100 pb-2 last:border-b-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                      <div className="text-sm text-neutral-800">{formatPropertyValue(item.value)}</div>
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
                    <div key={item.label} className="space-y-1 border-b border-slate-100 pb-2 last:border-b-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                      <div className="text-sm text-neutral-800">{formatPropertyValue(item.value)}</div>
                    </div>
                  ))}
                </div>
              </AccordionBlock>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              No related property linked to this job.
            </div>
          )}
        </Card>

        <Card className="h-fit space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold leading-4 text-neutral-700">Property Contacts</div>
            <Button size="sm" variant="outline" onClick={openCreateAffiliation}>
              Add Contact
            </Button>
          </div>

          {!resolvedPropertyId ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Select a property to manage property contacts.
            </div>
          ) : null}

          {resolvedPropertyId && isAffiliationsLoading ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Loading property contacts...
            </div>
          ) : null}

          {resolvedPropertyId && !isAffiliationsLoading && affiliationLoadError ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {affiliationLoadError}
            </div>
          ) : null}

          {resolvedPropertyId && !isAffiliationsLoading && !affiliationLoadError ? (
            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-1/5 px-2 py-2">Primary</th>
                    <th className="w-1/5 px-2 py-2">Role</th>
                    <th className="w-1/5 px-2 py-2">Contact</th>
                    <th className="w-1/5 px-2 py-2">Company</th>
                    <th className="w-1/5 px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!affiliations.length ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-400" colSpan={5}>
                        No property contacts linked yet.
                      </td>
                    </tr>
                  ) : (
                    affiliations.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-3">
                          <span
                            className="inline-flex items-center"
                            title={isPrimaryAffiliation(record) ? "Primary" : "Not Primary"}
                          >
                            <StarIcon active={isPrimaryAffiliation(record)} />
                          </span>
                        </td>
                        <td className="px-2 py-3">{record.role || "-"}</td>
                        <td className="px-2 py-3">
                          {getAffiliationContactName(record) !== "-"
                            ? getAffiliationContactName(record)
                            : contactLookupById.get(normalizePropertyId(record?.contact_id))?.label || "-"}
                        </td>
                        <td className="px-2 py-3">
                          {getAffiliationCompanyName(record) !== "-"
                            ? getAffiliationCompanyName(record)
                            : companyLookupById.get(normalizePropertyId(record?.company_id))?.name || "-"}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex w-full items-center justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                              onClick={() => openEditAffiliation(record)}
                              aria-label="Edit property contact"
                              title="Edit"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                              onClick={() => setDeleteTarget(record)}
                              aria-label="Delete property contact"
                              title="Delete"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <section
          data-section="property-uploads"
          className="grid grid-cols-1 gap-4 xl:grid-cols-[480px_1fr]"
        >
          <Card className="space-y-4">
            <h3 className="type-subheadline text-slate-800">Upload Files</h3>
            <div
              className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
                isPropertyDropActive
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-300 bg-slate-50"
              }`}
              onDragEnter={handlePropertyDropZoneDragOver}
              onDragOver={handlePropertyDropZoneDragOver}
              onDragLeave={handlePropertyDropZoneDragLeave}
              onDrop={handlePropertyDropZoneDrop}
            >
              <p className="text-sm text-slate-500">Drag and drop files here or browse</p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={triggerUploadFilePicker}
                disabled={!resolvedPropertyId || isUploading}
              >
                Choose Files
              </Button>
              <input
                ref={uploadsInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleUploadFilesSelected}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">
                  Pending Uploads ({pendingPropertyUploads.length})
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={savePendingPropertyUploads}
                  disabled={!resolvedPropertyId || !pendingPropertyUploads.length || isUploading}
                >
                  {isUploading ? "Saving..." : "Save Uploads"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="w-1/2 px-2 py-2">Name</th>
                      <th className="w-1/4 px-2 py-2">Size</th>
                      <th className="w-1/4 px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!pendingPropertyUploads.length ? (
                      <tr>
                        <td className="px-2 py-3 text-slate-400" colSpan={3}>
                          No pending files.
                        </td>
                      </tr>
                    ) : (
                      pendingPropertyUploads.map((record) => (
                        <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-2 py-3 break-all">{record.name}</td>
                          <td className="px-2 py-3">{formatFileSize(record.size)}</td>
                          <td className="px-2 py-3">
                            <div className="flex w-full items-center justify-end gap-2">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => {
                                  if (!record.previewUrl) return;
                                  window.open(record.previewUrl, "_blank", "noopener,noreferrer");
                                }}
                                aria-label="View pending upload"
                                title="View"
                                disabled={!record.previewUrl}
                              >
                                <EyeIcon />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                                onClick={() => removePendingPropertyUpload(record.id)}
                                aria-label="Remove pending upload"
                                title="Remove"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="type-subheadline text-slate-800">Existing Uploads</h3>
            </div>

            {!resolvedPropertyId ? (
              <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-400">
                Select a property to manage uploads.
              </div>
            ) : null}

            {resolvedPropertyId && isUploadsLoading ? (
              <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
                Loading property uploads...
              </div>
            ) : null}

            {resolvedPropertyId && !isUploadsLoading && uploadsLoadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                {uploadsLoadError}
              </div>
            ) : null}

            {resolvedPropertyId && !isUploadsLoading && !uploadsLoadError ? (
              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="w-1/4 px-2 py-2">Type</th>
                      <th className="w-2/4 px-2 py-2">Name</th>
                      <th className="w-1/4 px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!propertyUploads.length ? (
                      <tr>
                        <td className="px-2 py-3 text-slate-400" colSpan={3}>
                          No uploads available.
                        </td>
                      </tr>
                    ) : (
                      propertyUploads.map((record, index) => {
                        const uploadId = String(record?.id || "").trim();
                        const uploadUrl = String(record?.url || "").trim();
                        return (
                          <tr
                            key={`${uploadId || uploadUrl || "upload"}-${index}`}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="px-2 py-3">{record?.type || (record?.isPhoto ? "Photo" : "File")}</td>
                            <td className="px-2 py-3 break-all">{record?.name || "Upload"}</td>
                            <td className="px-2 py-3">
                              <div className="flex w-full items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => {
                                    if (!uploadUrl) return;
                                    window.open(uploadUrl, "_blank", "noopener,noreferrer");
                                  }}
                                  aria-label="View upload"
                                  title="View Upload"
                                  disabled={!uploadUrl}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => setDeleteUploadTarget(record)}
                                  aria-label="Delete upload"
                                  title="Delete Upload"
                                  disabled={!uploadId}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        </section>
      </div>

      <PropertyAffiliationModal
        open={affiliationModalState.open}
        onClose={closeAffiliationModal}
        initialData={affiliationModalState.initialData}
        plugin={plugin}
        propertyId={resolvedPropertyId}
        onOpenContactDetailsModal={onOpenContactDetailsModal}
        onSave={saveAffiliation}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Property Contact"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteAffiliation}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this property contact?
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteUploadTarget)}
        onClose={() => {
          if (isDeletingUpload) return;
          setDeleteUploadTarget(null);
        }}
        title="Delete Property Upload"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteUploadTarget(null)}
              disabled={isDeletingUpload}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteUpload}
              disabled={isDeletingUpload}
            >
              {isDeletingUpload ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this property upload?
        </p>
      </Modal>
    </div>
  );
}
