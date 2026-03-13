import { useCallback, useMemo, useState } from "react";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { showMutationErrorToast } from "../../utils/mutationFeedback.js";
import { fetchServicesForActivities } from "../../api/core/runtime.js";
import { toText } from "@shared/utils/formatters.js";
import {
  normalizeServiceRecord,
  buildPrefilledActivityText,
} from "./activitiesUtils.js";

export function useActivitiesServices({ plugin, activities, serviceById: _serviceByIdExternal }) {
  // serviceById is derived here; we expose it so callers can use it
  const { error } = useToast();
  const [services, setServices] = useState([]);

  const serviceById = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      map.set(service.id, service);
    });
    return map;
  }, [services]);

  const primaryServices = useMemo(
    () => services.filter((service) => service.type !== "option"),
    [services]
  );

  const primaryServiceByTask = useMemo(() => {
    const map = new Map();
    (activities || []).forEach((activity) => {
      const task = toText(activity?.task || activity?.Task);
      if (!task || map.has(task)) return;
      const rawServiceId = toText(activity?.service_id || activity?.Service_ID);
      if (!rawServiceId) return;
      const matched = serviceById.get(rawServiceId) || null;
      const primaryServiceId =
        matched?.type === "option" && matched?.parentId
          ? toText(matched.parentId)
          : rawServiceId;
      if (primaryServiceId) {
        map.set(task, primaryServiceId);
      }
    });
    return map;
  }, [activities, serviceById]);

  const applyPrimaryServiceSelection = useCallback(
    (previous, primaryServiceId) => {
      const normalizedPrimaryId = toText(primaryServiceId);
      const primaryService = serviceById.get(normalizedPrimaryId) || null;
      const optionCandidates = services.filter(
        (item) => item.type === "option" && item.parentId === normalizedPrimaryId
      );

      if (!normalizedPrimaryId) {
        return {
          ...previous,
          primaryServiceId: "",
          optionServiceId: "",
          service_id: "",
          activity_price: "",
          warranty: "",
          activity_text: "",
        };
      }

      if (optionCandidates.length) {
        const preferredOption =
          optionCandidates.find((item) => toText(item.id) === toText(previous.optionServiceId)) ||
          optionCandidates[0];
        return {
          ...previous,
          primaryServiceId: normalizedPrimaryId,
          optionServiceId: preferredOption.id,
          service_id: preferredOption.id,
          activity_price: toText(preferredOption.price),
          warranty: toText(preferredOption.warranty),
          activity_text: buildPrefilledActivityText(preferredOption),
        };
      }

      return {
        ...previous,
        primaryServiceId: normalizedPrimaryId,
        optionServiceId: "",
        service_id: primaryService?.id || normalizedPrimaryId,
        activity_price: toText(primaryService?.price),
        warranty: toText(primaryService?.warranty),
        activity_text: buildPrefilledActivityText(primaryService),
      };
    },
    [serviceById, services]
  );

  const handlePrimaryServiceChange = useCallback(
    (event) => {
      const primaryServiceId = toText(event.target.value);
      return primaryServiceId;
    },
    []
  );

  const handleOptionServiceChange = useCallback(
    (optionServiceId) => {
      const optionService = serviceById.get(optionServiceId) || null;
      return {
        optionServiceId,
        service_id: optionServiceId,
        activity_price: toText(optionService?.price),
        warranty: toText(optionService?.warranty),
        activity_text: buildPrefilledActivityText(optionService),
      };
    },
    [serviceById]
  );

  const loadServices = useCallback(async () => {
    if (!plugin) {
      setServices([]);
      return;
    }
    try {
      const records = await fetchServicesForActivities({ plugin });
      const normalized = (Array.isArray(records) ? records : [])
        .map((item) => normalizeServiceRecord(item))
        .filter(Boolean);
      setServices(normalized);
    } catch (loadError) {
      console.error("[JobDirect] Failed to load services", loadError);
      showMutationErrorToast(error, {
        title: "Unable to load services",
        error: loadError,
        fallbackMessage: "Please try again.",
      });
    }
  }, [plugin, error]);

  return {
    services,
    serviceById,
    primaryServices,
    primaryServiceByTask,
    applyPrimaryServiceSelection,
    handlePrimaryServiceChange,
    handleOptionServiceChange,
    loadServices,
  };
}

