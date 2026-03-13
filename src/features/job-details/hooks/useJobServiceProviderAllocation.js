import { useCallback, useEffect, useMemo } from "react";
import {
  toText,
  formatServiceProviderAllocationLabel,
  formatServiceProviderInputLabel,
} from "@shared/utils/formatters.js";
import { updateJobFieldsById } from "@modules/job-records/exports/api.js";
import { JOB_TAKEN_BY_FIELD_ALIASES } from "../shared/jobDetailsConstants.js";
import { fetchJobTakenByValue } from "../api/jobDetailsDataApi.js";

export function useJobServiceProviderAllocation({
  allocatedJobTakenById,
  allocatedServiceProviderId,
  configuredAdminProviderId,
  effectiveJobId,
  error,
  isAllocatingServiceProvider,
  isJobAllocationPrefillResolved,
  isLoadedJobTakenByMissing,
  isNewJob,
  isSavingJobTakenBy,
  isSdkReady,
  jobTakenByAutofillRef,
  jobTakenByLookup,
  plugin,
  selectedJobTakenById,
  selectedServiceProviderId,
  serviceProviderLookup,
  serviceProviderPrefilledRef,
  serviceProviderSearch,
  setAllocatedJobTakenById,
  setAllocatedServiceProviderId,
  setIsAllocatingServiceProvider,
  setIsLoadedJobTakenByMissing,
  setIsSavingJobTakenBy,
  setJobTakenBySearch,
  setSelectedJobTakenById,
  setSelectedServiceProviderId,
  setServiceProviderSearch,
  success,
}) {
  const serviceProviderItems = useMemo(
    () =>
      (Array.isArray(serviceProviderLookup) ? serviceProviderLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email || provider?.work_email || provider?.Work_Email),
            sms_number: toText(
              provider?.sms_number || provider?.mobile_number || provider?.Mobile_Number
            ),
          };
        })
        .filter(Boolean),
    [serviceProviderLookup]
  );

  const jobTakenByItems = useMemo(
    () =>
      (Array.isArray(jobTakenByLookup) ? jobTakenByLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email || provider?.work_email || provider?.Work_Email),
            sms_number: toText(
              provider?.sms_number || provider?.mobile_number || provider?.Mobile_Number
            ),
          };
        })
        .filter(Boolean),
    [jobTakenByLookup]
  );

  const jobTakenByStoredId = toText(allocatedJobTakenById);
  const jobTakenByIdResolved = jobTakenByStoredId || configuredAdminProviderId;
  const jobTakenBySelectedLookupRecord = useMemo(
    () =>
      (Array.isArray(jobTakenByLookup) ? jobTakenByLookup : []).find(
        (provider) => toText(provider?.id || provider?.ID) === jobTakenByIdResolved
      ) || null,
    [jobTakenByIdResolved, jobTakenByLookup]
  );
  const jobTakenByPrefillLabel = useMemo(() => {
    if (!jobTakenByIdResolved) return "";
    if (jobTakenBySelectedLookupRecord) {
      return formatServiceProviderInputLabel(jobTakenBySelectedLookupRecord);
    }
    return `Provider #${jobTakenByIdResolved}`;
  }, [jobTakenByIdResolved, jobTakenBySelectedLookupRecord]);

  const updateJobTakenByWithFallback = useCallback(
    async ({ jobId, providerId } = {}) => {
      const normalizedJobId = toText(jobId);
      const normalizedProviderId = toText(providerId);
      if (!plugin?.switchTo || !normalizedJobId) {
        throw new Error("Job ID is missing.");
      }
      if (!normalizedProviderId) {
        throw new Error("Select admin first.");
      }
      const jobModel = plugin.switchTo("PeterpmJob");
      if (!jobModel?.query) {
        throw new Error("Job context is not ready.");
      }

      let lastError = null;
      for (const fieldName of JOB_TAKEN_BY_FIELD_ALIASES) {
        try {
          await updateJobFieldsById({
            plugin,
            jobId: normalizedJobId,
            payload: {
              [fieldName]: normalizedProviderId,
            },
          });

          const verified = await fetchJobTakenByValue({
            jobModel,
            jobId: normalizedJobId,
          });
          if (!verified?.resolved || toText(verified?.value) === normalizedProviderId) {
            return true;
          }
          lastError = new Error(`Unable to verify ${fieldName} update.`);
        } catch (mutationError) {
          lastError = mutationError;
        }
      }

      throw lastError || new Error("Unable to update job taken by.");
    },
    [plugin]
  );

  // Service provider prefill effect
  useEffect(() => {
    if (serviceProviderPrefilledRef.current) return;

    const providerId = toText(allocatedServiceProviderId);
    if (!providerId) return;
    if (!serviceProviderItems.length) return;

    const selectedId = toText(selectedServiceProviderId);
    if (selectedId && selectedId !== providerId) {
      serviceProviderPrefilledRef.current = true;
      return;
    }

    const matchedProvider = serviceProviderItems.find(
      (item) => toText(item?.id) === providerId
    );

    setSelectedServiceProviderId(providerId);
    setServiceProviderSearch(
      toText(matchedProvider?.valueLabel || matchedProvider?.label) || `Provider #${providerId}`
    );
    serviceProviderPrefilledRef.current = true;
  }, [allocatedServiceProviderId, selectedServiceProviderId, serviceProviderItems]);

  // Job taken by prefill sync effect
  useEffect(() => {
    const currentId = toText(jobTakenBySelectedLookupRecord?.id || jobTakenByIdResolved);
    setSelectedJobTakenById(currentId);
    setJobTakenBySearch(currentId ? jobTakenByPrefillLabel : "");
  }, [jobTakenByIdResolved, jobTakenByPrefillLabel, jobTakenBySelectedLookupRecord?.id]);

  // Auto-assign job taken by when missing
  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    if (isNewJob) return;
    if (!isJobAllocationPrefillResolved) return;
    if (!isLoadedJobTakenByMissing) return;
    if (!effectiveJobId) return;
    if (!configuredAdminProviderId) return;

    const marker = `${effectiveJobId}:${configuredAdminProviderId}`;
    if (jobTakenByAutofillRef.current.has(marker)) return;
    jobTakenByAutofillRef.current.add(marker);

    let cancelled = false;
    updateJobTakenByWithFallback({
      jobId: effectiveJobId,
      providerId: configuredAdminProviderId,
    })
      .then(() => {
        if (cancelled) return;
        setAllocatedJobTakenById(configuredAdminProviderId);
        setIsLoadedJobTakenByMissing(false);
      })
      .catch((autoAssignError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to auto-set job taken by", autoAssignError);
        jobTakenByAutofillRef.current.delete(marker);
      });

    return () => {
      cancelled = true;
    };
  }, [
    configuredAdminProviderId,
    effectiveJobId,
    isNewJob,
    isJobAllocationPrefillResolved,
    isLoadedJobTakenByMissing,
    isSdkReady,
    plugin,
    updateJobTakenByWithFallback,
  ]);

  const handleConfirmServiceProviderAllocation = useCallback(async () => {
    if (isAllocatingServiceProvider) return;
    if (!plugin || !isSdkReady) {
      error("Allocation failed", "Job context is not ready.");
      return;
    }

    const jobId = toText(effectiveJobId);
    if (!jobId) {
      error("Allocation failed", "Job ID is missing.");
      return;
    }

    const providerId = toText(selectedServiceProviderId);
    if (!providerId) {
      error("Allocation failed", "Select a service provider first.");
      return;
    }

    setIsAllocatingServiceProvider(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          primary_service_provider_id: providerId,
        },
      });
      setAllocatedServiceProviderId(providerId);
      success("Service provider allocated", "Job was updated with selected service provider.");
    } catch (allocationError) {
      console.error("[JobDetailsBlank] Service provider allocation failed", allocationError);
      error("Allocation failed", allocationError?.message || "Unable to allocate service provider.");
    } finally {
      setIsAllocatingServiceProvider(false);
    }
  }, [
    error,
    effectiveJobId,
    isAllocatingServiceProvider,
    isSdkReady,
    plugin,
    selectedServiceProviderId,
    success,
  ]);

  const handleConfirmJobTakenBy = useCallback(async () => {
    if (isSavingJobTakenBy) return;
    if (!plugin || !isSdkReady) {
      error("Save failed", "Job context is not ready.");
      return;
    }

    const jobId = toText(effectiveJobId);
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }

    const providerId = toText(selectedJobTakenById);
    if (!providerId) {
      error("Save failed", "Select admin first.");
      return;
    }

    setIsSavingJobTakenBy(true);
    try {
      await updateJobTakenByWithFallback({
        jobId,
        providerId,
      });
      setAllocatedJobTakenById(providerId);
      setIsLoadedJobTakenByMissing(false);
      success("Job taken by updated", "Job was updated with selected admin.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Job taken by update failed", saveError);
      error("Save failed", saveError?.message || "Unable to update job taken by.");
    } finally {
      setIsSavingJobTakenBy(false);
    }
  }, [
    effectiveJobId,
    error,
    isSavingJobTakenBy,
    isSdkReady,
    plugin,
    selectedJobTakenById,
    success,
    updateJobTakenByWithFallback,
  ]);

  return {
    handleConfirmJobTakenBy,
    handleConfirmServiceProviderAllocation,
    jobTakenByIdResolved,
    jobTakenByItems,
    jobTakenByPrefillLabel,
    jobTakenBySelectedLookupRecord,
    jobTakenByStoredId,
    serviceProviderItems,
    updateJobTakenByWithFallback,
  };
}
