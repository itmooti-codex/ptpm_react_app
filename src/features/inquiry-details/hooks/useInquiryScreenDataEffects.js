import { useCallback, useEffect } from "react";
import {
  createInquiryRecordFromPayload,
  fetchInquiryLiteById,
  fetchInquiryLiteByUid,
  fetchServiceNameById,
  normalizeMutationIdentifier,
} from "../api/inquiryCoreApi.js";
import { fetchServiceProviderById } from "../api/inquiryLookupApi.js";
import { fetchJobIdByUniqueId } from "../api/inquiryRelatedRecordsApi.js";
import {
  resolveJobDetailsContext,
  updateInquiryFieldsById,
} from "../../../modules/job-records/exports/api.js";
import { fetchServicesForActivities } from "../../../modules/details-workspace/api/core/runtime.js";
import { toPromiseLike } from "@modules/details-workspace/api/core/transport.js";
import { toText } from "@shared/utils/formatters.js";

export function useInquiryScreenDataEffects({
  configuredAdminProviderId,
  error,
  hasServiceProviderRelationDetails,
  hasUid,
  inquiryDetailsForm,
  inquiryNumericId,
  inquiryTakenByAutofillRef,
  inquiryTakenByIdResolved,
  inquiryTakenByLookup,
  inquiryTakenByStoredId,
  isInquiryDetailsModalOpen,
  isQuickInquiryBookingMode,
  isQuickInquiryProvisioning,
  isSdkReady,
  navigate,
  plugin,
  quickInquiryProvisioningRequestedRef,
  relatedJobIdByUid,
  relatedJobsForDisplay,
  safeUid,
  serviceProviderIdResolved,
  serviceInquiryLabelById,
  setInquiryServiceOptions,
  setInquiryTakenByFallback,
  setIsContextLoading,
  setIsInquiryServiceLookupLoading,
  setIsQuickInquiryProvisioning,
  setRelatedJobIdByUid,
  setResolvedInquiry,
  setServiceInquiryLabelById,
  setServiceInquiryName,
  setServiceProviderFallback,
  statusServiceInquiryId,
  trackRecentActivity,
}) {
  const refreshResolvedInquiry = useCallback(async () => {
    if (!plugin || !inquiryNumericId) return null;
    const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
    if (refreshed) {
      setResolvedInquiry(refreshed);
    }
    return refreshed || null;
  }, [inquiryNumericId, plugin, setResolvedInquiry]);

  useEffect(() => {
    if (!isQuickInquiryBookingMode) {
      quickInquiryProvisioningRequestedRef.current = false;
      setIsQuickInquiryProvisioning(false);
      return;
    }
    if (!isSdkReady || !plugin?.switchTo) return;
    if (inquiryNumericId || isQuickInquiryProvisioning) return;
    if (quickInquiryProvisioningRequestedRef.current) return;
    quickInquiryProvisioningRequestedRef.current = true;
    setIsQuickInquiryProvisioning(true);

    createInquiryRecordFromPayload({
      plugin,
      payload: {
        inquiry_status: "New Inquiry",
        account_type: "Contact",
        Inquiry_Taken_By_id: configuredAdminProviderId
          ? normalizeMutationIdentifier(configuredAdminProviderId)
          : null,
      },
    })
      .then((createdInquiry) => {
        const createdId = toText(createdInquiry?.id || createdInquiry?.ID);
        const nextUid = toText(createdInquiry?.unique_id);
        if (!nextUid) {
          throw new Error("Inquiry was created but unique ID was not returned.");
        }
        trackRecentActivity({
          action: "Created new inquiry",
          path: `/inquiry-details/${encodeURIComponent(nextUid)}`,
          pageType: "inquiry-details",
          pageName: "Inquiry Details",
          metadata: {
            inquiry_id: createdId,
            inquiry_uid: nextUid,
          },
        });
        navigate(`/inquiry-details/${encodeURIComponent(nextUid)}`, { replace: true });
      })
      .catch((provisionError) => {
        quickInquiryProvisioningRequestedRef.current = false;
        console.error("[InquiryDetails] Failed background quick inquiry creation", provisionError);
        error("Create failed", provisionError?.message || "Unable to create inquiry.");
      })
      .finally(() => {
        setIsQuickInquiryProvisioning(false);
      });
  }, [
    configuredAdminProviderId,
    error,
    inquiryNumericId,
    isQuickInquiryBookingMode,
    isQuickInquiryProvisioning,
    isSdkReady,
    navigate,
    plugin,
    quickInquiryProvisioningRequestedRef,
    setIsQuickInquiryProvisioning,
    trackRecentActivity,
  ]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !isSdkReady || !plugin) return;

    let isMounted = true;
    setIsInquiryServiceLookupLoading(true);
    const loadServices = async () => {
      try {
        let records = await fetchServicesForActivities({ plugin });
        records = Array.isArray(records) ? records : [];
        if (!records.length) {
          const allServicesQuery = plugin
            .switchTo("PeterpmService")
            .query()
            .deSelectAll()
            .select(["id", "service_name", "service_type"])
            .noDestroy();
          allServicesQuery.getOrInitQueryCalc?.();
          const response = await toPromiseLike(allServicesQuery.fetchDirect());
          const rows = response?.resp || response?.data || [];
          records = Array.isArray(rows) ? rows : [];
        }
        if (!isMounted) return;
        const mapped = records
          .map((record) => ({
            id: toText(record?.id || record?.ID),
            name: toText(record?.service_name || record?.Service_Name),
            type: toText(record?.service_type || record?.Service_Type),
          }))
          .filter((record) => record.id && record.name)
          .filter((record) => !record.type || record.type.toLowerCase() === "primary")
          .sort((a, b) => a.name.localeCompare(b.name));
        setInquiryServiceOptions(mapped.map((record) => ({ value: record.id, label: record.name })));
        setServiceInquiryLabelById(Object.fromEntries(mapped.map((record) => [record.id, record.name])));
      } catch (serviceError) {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading service options", serviceError);
        setInquiryServiceOptions([]);
        setServiceInquiryLabelById({});
      } finally {
        if (!isMounted) return;
        setIsInquiryServiceLookupLoading(false);
      }
    };
    loadServices();

    return () => {
      isMounted = false;
    };
  }, [
    isInquiryDetailsModalOpen,
    isSdkReady,
    plugin,
    setInquiryServiceOptions,
    setIsInquiryServiceLookupLoading,
    setServiceInquiryLabelById,
  ]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !plugin?.switchTo) return;
    const selectedServiceId = toText(inquiryDetailsForm.service_inquiry_id);
    if (!selectedServiceId) return;
    if (serviceInquiryLabelById[selectedServiceId]) return;

    let isActive = true;
    fetchServiceNameById({ plugin, serviceId: selectedServiceId })
      .then((resolvedLabel) => {
        if (!isActive || !resolvedLabel) return;
        setServiceInquiryLabelById((previous) => ({
          ...previous,
          [selectedServiceId]: resolvedLabel,
        }));
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, [
    inquiryDetailsForm.service_inquiry_id,
    isInquiryDetailsModalOpen,
    plugin,
    serviceInquiryLabelById,
    setServiceInquiryLabelById,
  ]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !hasUid) {
      setResolvedInquiry(null);
      return;
    }

    let cancelled = false;
    setIsContextLoading(true);
    resolveJobDetailsContext({ plugin, uid: safeUid, sourceTab: "inquiry" })
      .then(async (context) => {
        if (cancelled) return;
        const fromContext =
          context?.inquiry ||
          context?.job?.Inquiry_Record ||
          context?.job?.inquiry_record ||
          null;
        if (fromContext) {
          const contextInquiryId = toText(fromContext?.id || fromContext?.ID);
          const enrichedFromContextId = contextInquiryId
            ? await fetchInquiryLiteById({ plugin, id: contextInquiryId })
            : null;
          if (cancelled) return;
          if (enrichedFromContextId) {
            setResolvedInquiry(enrichedFromContextId);
            return;
          }

          const contextInquiryUid = toText(fromContext?.unique_id || fromContext?.Unique_ID || safeUid);
          const enrichedFromContextUid = contextInquiryUid
            ? await fetchInquiryLiteByUid({ plugin, uid: contextInquiryUid })
            : null;
          if (cancelled) return;
          if (enrichedFromContextUid) {
            setResolvedInquiry(enrichedFromContextUid);
            return;
          }

          setResolvedInquiry(fromContext);
          return;
        }

        const liteByUid = await fetchInquiryLiteByUid({ plugin, uid: safeUid });
        if (cancelled) return;
        if (liteByUid) {
          setResolvedInquiry(liteByUid);
          return;
        }

        if (/^\d+$/.test(safeUid)) {
          const liteById = await fetchInquiryLiteById({ plugin, id: safeUid });
          if (cancelled) return;
          if (liteById) {
            setResolvedInquiry(liteById);
            return;
          }
        }

        setResolvedInquiry(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed loading inquiry context", loadError);
        setResolvedInquiry(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasUid, isSdkReady, plugin, safeUid, setIsContextLoading, setResolvedInquiry]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceInquiryName("");
      return;
    }
    if (!statusServiceInquiryId) {
      setServiceInquiryName("");
      return;
    }

    let cancelled = false;
    fetchServiceNameById({ plugin, serviceId: statusServiceInquiryId })
      .then((name) => {
        if (!cancelled) {
          setServiceInquiryName(toText(name));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServiceInquiryName("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, setServiceInquiryName, statusServiceInquiryId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceProviderFallback(null);
      return;
    }
    if (!serviceProviderIdResolved || hasServiceProviderRelationDetails) {
      setServiceProviderFallback(null);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: serviceProviderIdResolved })
      .then((providerRecord) => {
        if (!cancelled) {
          setServiceProviderFallback(providerRecord || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServiceProviderFallback(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasServiceProviderRelationDetails,
    isSdkReady,
    plugin,
    serviceProviderIdResolved,
    setServiceProviderFallback,
  ]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setInquiryTakenByFallback(null);
      return;
    }
    if (!inquiryTakenByIdResolved) {
      setInquiryTakenByFallback(null);
      return;
    }
    const fromLookup = (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []).find(
      (provider) => toText(provider?.id || provider?.ID) === inquiryTakenByIdResolved
    );
    if (fromLookup) {
      setInquiryTakenByFallback(fromLookup);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: inquiryTakenByIdResolved })
      .then((providerRecord) => {
        if (!cancelled) {
          setInquiryTakenByFallback(providerRecord || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInquiryTakenByFallback(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    inquiryTakenByIdResolved,
    inquiryTakenByLookup,
    isSdkReady,
    plugin,
    setInquiryTakenByFallback,
  ]);

  useEffect(() => {
    if (!plugin || !Array.isArray(relatedJobsForDisplay) || !relatedJobsForDisplay.length) return;
    const unresolvedUids = relatedJobsForDisplay
      .map((job) => ({
        id: toText(job?.id || job?.ID),
        uid: toText(job?.unique_id || job?.Unique_ID),
      }))
      .filter((row) => !row.id && row.uid && !toText(relatedJobIdByUid[row.uid]));
    if (!unresolvedUids.length) return;

    let cancelled = false;
    Promise.all(
      unresolvedUids.map(async (row) => ({
        uid: row.uid,
        id: await fetchJobIdByUniqueId({ plugin, uniqueId: row.uid }),
      }))
    )
      .then((resolvedRows) => {
        if (cancelled) return;
        setRelatedJobIdByUid((previous) => {
          const next = { ...previous };
          let changed = false;
          resolvedRows.forEach(({ uid, id }) => {
            const normalizedUid = toText(uid);
            const normalizedId = toText(id);
            if (!normalizedUid || !normalizedId || toText(next[normalizedUid]) === normalizedId) return;
            next[normalizedUid] = normalizedId;
            changed = true;
          });
          return changed ? next : previous;
        });
      })
      .catch((resolveError) => {
        if (!cancelled) {
          console.warn("[InquiryDetails] Failed resolving related job ids", resolveError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [plugin, relatedJobIdByUid, relatedJobsForDisplay, setRelatedJobIdByUid]);

  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    if (!inquiryNumericId || !configuredAdminProviderId || inquiryTakenByStoredId) return;

    const marker = `${inquiryNumericId}:${configuredAdminProviderId}`;
    if (inquiryTakenByAutofillRef.current.has(marker)) return;
    inquiryTakenByAutofillRef.current.add(marker);

    let cancelled = false;
    updateInquiryFieldsById({
      plugin,
      inquiryId: inquiryNumericId,
      payload: {
        Inquiry_Taken_By_id: configuredAdminProviderId,
      },
    })
      .then(async () => {
        if (cancelled) return;
        const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
        if (!cancelled && refreshed) {
          setResolvedInquiry(refreshed);
        }
      })
      .catch((autoAssignError) => {
        if (!cancelled) {
          console.error("[InquiryDetails] Failed to auto-set inquiry taken by", autoAssignError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    configuredAdminProviderId,
    inquiryNumericId,
    inquiryTakenByAutofillRef,
    inquiryTakenByStoredId,
    isSdkReady,
    plugin,
    setResolvedInquiry,
  ]);

  return {
    refreshResolvedInquiry,
  };
}
