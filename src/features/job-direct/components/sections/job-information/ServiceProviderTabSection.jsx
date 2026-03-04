import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { useToast } from "../../../../../shared/providers/ToastProvider.jsx";
import { useServiceProviderLookupData } from "../../../hooks/useServiceProviderLookupData.js";
import { useJobDirectSelector } from "../../../hooks/useJobDirectStore.jsx";
import { selectJobEntity } from "../../../state/selectors.js";
import { showMutationErrorToast } from "../../../utils/mutationFeedback.js";
import { SearchDropdownInput } from "./JobInfoFormFields.jsx";
import { getJobPrimaryServiceProviderDetails } from "./jobInfoUtils.js";

export function ServiceProviderTabSection({
  plugin,
  jobData,
  initialProviders = [],
  onSubmitServiceProvider = null,
  onProviderSelectionChange = null,
  recordLabel = "job",
}) {
  const { success, error } = useToast();
  const storeJobData = useJobDirectSelector(selectJobEntity);
  const { serviceProviders, isLookupLoading } = useServiceProviderLookupData(plugin, {
    initialProviders,
    skipInitialFetch: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const persistedProvider = useMemo(
    () => getJobPrimaryServiceProviderDetails(storeJobData || jobData),
    [jobData, storeJobData]
  );
  const persistedProviderId = persistedProvider.id;
  const [selectedProviderId, setSelectedProviderId] = useState(persistedProviderId);
  const [searchValue, setSearchValue] = useState("");
  const normalizedRecordLabel = String(recordLabel || "job").trim().toLowerCase() === "inquiry"
    ? "inquiry"
    : "job";
  const headingText = normalizedRecordLabel === "inquiry"
    ? "Allocate Service Provider"
    : "Assign Service Provider";
  const submitText = normalizedRecordLabel === "inquiry"
    ? "Submit Allocation"
    : "Submit information";

  useEffect(() => {
    setSelectedProviderId(persistedProviderId);
  }, [persistedProviderId]);

  useEffect(() => {
    onProviderSelectionChange?.(String(selectedProviderId || "").trim());
  }, [onProviderSelectionChange, selectedProviderId]);

  const providerItems = useMemo(
    () =>
      (serviceProviders || []).map((item) => ({
        id: item.id,
        label: item.label,
        meta: [item.email, item.sms_number, item.unique_id].filter(Boolean).join(" | "),
      })),
    [serviceProviders]
  );

  useEffect(() => {
    if (!selectedProviderId) {
      setSearchValue("");
      return;
    }
    const selected = (serviceProviders || []).find(
      (item) => String(item.id) === String(selectedProviderId)
    );
    if (selected) {
      setSearchValue(selected.label || "");
      return;
    }
    if (
      persistedProvider.id &&
      String(persistedProvider.id) === String(selectedProviderId) &&
      persistedProvider.label
    ) {
      setSearchValue(persistedProvider.label);
      return;
    }
    setSearchValue((previous) => previous || `Provider #${selectedProviderId}`);
  }, [selectedProviderId, serviceProviders, persistedProvider]);

  const handleSubmitProvider = async () => {
    if (typeof onSubmitServiceProvider !== "function" || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmitServiceProvider();
      success(
        normalizedRecordLabel === "inquiry"
          ? "Inquiry allocation updated"
          : "Service provider updated",
        normalizedRecordLabel === "inquiry"
          ? "Service provider allocation was saved on this inquiry."
          : "Primary service provider was saved on this job."
      );
    } catch (submitError) {
      showMutationErrorToast(error, {
        title: "Save failed",
        error: submitError,
        fallbackMessage:
          normalizedRecordLabel === "inquiry"
            ? "Unable to update inquiry allocation right now."
            : "Unable to update service provider right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-job-section="job-section-service-provider"
      className="grid grid-cols-1 gap-6 xl:grid-cols-[460px]"
    >
      <div className="w-full space-y-4">
        <Card className="space-y-4">
          <div className="text-base font-bold leading-4 text-neutral-700">{headingText}</div>

          <SearchDropdownInput
            label="Service Provider"
            field="service_provider_search"
            value={searchValue}
            placeholder="Search by name, email, phone"
            items={providerItems}
            onValueChange={setSearchValue}
            onSelect={(item) => {
              const nextId = String(item?.id || "").trim();
              setSelectedProviderId(nextId);
              setSearchValue(item?.label || "");
            }}
            hideAddAction
            emptyText={isLookupLoading ? "Loading service providers..." : "No service providers found."}
          />
          <input type="hidden" data-field="primary_service_provider_id" value={selectedProviderId} readOnly />
        </Card>
        <Button
          className="w-full justify-center bg-[#003882] text-white hover:bg-[#003882]"
          variant="primary"
          onClick={handleSubmitProvider}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : submitText}
        </Button>
      </div>
    </div>
  );
}
