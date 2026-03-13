import { useCallback, useEffect, useMemo } from "react";
import { buildLookupDisplayLabel } from "../../../../../shared/utils/lookupLabel.js";
import {
  APPOINTMENT_STATUS_OPTIONS,
} from "../../../constants/options.js";
import { useContactEntityLookupData } from "../../../hooks/useContactEntityLookupData.js";
import { usePropertyLookupData } from "../../../hooks/usePropertyLookupData.js";
import { useServiceProviderLookupData } from "../../../hooks/useServiceProviderLookupData.js";
import { toText } from "@shared/utils/formatters.js";
import {
  getAppointmentEventColorValue,
  resolveAppointmentMappedOption,
} from "./appointmentTabHelpers.js";

export function useAppointmentLookups({
  plugin,
  preloadedLookupData,
  normalizedPrefill,
  normalizeTextValue,
  form,
  defaultEventColor,
  emptyForm,
  formatDateTimeLocalInput,
  deriveDurationFromRecord,
  setDraftState,
}) {
  const {
    contacts,
    searchContacts,
    isLookupLoading: isContactLookupLoading,
  } = useContactEntityLookupData(plugin, {
    initialContacts: preloadedLookupData?.contacts || [],
    initialCompanies: preloadedLookupData?.companies || [],
    skipInitialFetch: true,
  });
  const {
    properties,
    searchProperties,
    isLookupLoading: isPropertyLookupLoading,
  } = usePropertyLookupData(plugin, {
    initialProperties: preloadedLookupData?.properties || [],
    skipInitialFetch: true,
  });
  const { serviceProviders, isLookupLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookupData(plugin, {
      initialProviders: preloadedLookupData?.serviceProviders || [],
      skipInitialFetch: true,
    });

  const locationItems = useMemo(() => {
    const mapped = (properties || []).map((record) => {
      const id = String(record?.id || record?.ID || record?.Property_ID || "").trim();
      const label =
        String(record?.property_name || record?.Property_Name || "").trim() ||
        String(record?.unique_id || record?.Unique_ID || "").trim() ||
        (id ? `Property #${id}` : "Property");
      return {
        id,
        label,
        meta: [
          record?.unique_id || record?.Unique_ID,
          record?.address_1 || record?.address || record?.Address_1 || record?.Address,
          record?.suburb_town || record?.city || record?.Suburb_Town || record?.City,
          record?.state || record?.State,
          record?.postal_code || record?.zip_code || record?.Postal_Code || record?.Zip_Code,
        ]
          .filter(Boolean)
          .join(" | "),
      };
    });

    if (
      normalizedPrefill.locationId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.locationId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.locationId,
        label: normalizedPrefill.locationLabel || `Property #${normalizedPrefill.locationId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [properties, normalizedPrefill, normalizeTextValue]);

  const hostItems = useMemo(() => {
    const mapped = (serviceProviders || []).map((record) => {
      const info = record?.Contact_Information || record?.contact_information || {};
      const id = String(record?.id || record?.ID || "").trim();
      const firstName =
        record?.first_name || record?.Contact_Information_First_Name || info?.first_name || info?.First_Name;
      const lastName =
        record?.last_name || record?.Contact_Information_Last_Name || info?.last_name || info?.Last_Name;
      const email =
        record?.email ||
        record?.contact_information_email ||
        record?.Contact_Information_Email ||
        info?.email ||
        info?.Email;
      const mobile =
        record?.sms_number ||
        record?.contact_information_sms_number ||
        record?.Contact_Information_SMS_Number ||
        info?.sms_number ||
        info?.SMS_Number;

      return {
        id,
        label: buildLookupDisplayLabel(
          [firstName, lastName].filter(Boolean).join(" ").trim(),
          email,
          mobile,
          record?.unique_id || record?.Unique_ID || (id ? `Provider #${id}` : "Service Provider")
        ),
        meta: [email, mobile, record?.unique_id || record?.Unique_ID].filter(Boolean).join(" | "),
      };
    });

    if (
      normalizedPrefill.hostId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.hostId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.hostId,
        label: normalizedPrefill.hostLabel || `Provider #${normalizedPrefill.hostId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [serviceProviders, normalizedPrefill, normalizeTextValue]);

  const guestItems = useMemo(() => {
    const mapped = (contacts || []).map((record) => {
      const id = String(record?.id || record?.ID || record?.Contact_ID || "").trim();
      const firstName = record?.first_name || record?.First_Name;
      const lastName = record?.last_name || record?.Last_Name;
      const email = record?.email || record?.Email;
      const mobile =
        record?.sms_number ||
        record?.SMS_Number ||
        record?.office_phone ||
        record?.Office_Phone;

      return {
        id,
        label: buildLookupDisplayLabel(
          [firstName, lastName].filter(Boolean).join(" ").trim(),
          email,
          mobile,
          id ? `Contact #${id}` : "Contact"
        ),
        meta: [email, mobile].filter(Boolean).join(" | "),
      };
    });

    if (
      normalizedPrefill.guestId &&
      !mapped.some((item) => normalizeTextValue(item.id) === normalizedPrefill.guestId)
    ) {
      mapped.unshift({
        id: normalizedPrefill.guestId,
        label: normalizedPrefill.guestLabel || `Contact #${normalizedPrefill.guestId}`,
        meta: "Prefilled",
      });
    }

    return mapped;
  }, [contacts, normalizedPrefill, normalizeTextValue]);

  const locationItemById = useMemo(() => {
    const next = new Map();
    locationItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [locationItems]);

  const hostItemById = useMemo(() => {
    const next = new Map();
    hostItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [hostItems]);

  const guestItemById = useMemo(() => {
    const next = new Map();
    guestItems.forEach((item) => {
      const id = toText(item?.id);
      if (!id) return;
      next.set(id, item);
    });
    return next;
  }, [guestItems]);

  const shouldAutoReplaceHostQuery = useCallback(
    (currentQuery, hostId, resolvedLabel) => {
      const current = normalizeTextValue(currentQuery);
      const id = normalizeTextValue(hostId);
      const next = normalizeTextValue(resolvedLabel);
      if (!id || !next) return false;
      if (!current) return true;
      if (current === next) return false;
      if (current === id) return true;
      if (
        current === normalizeTextValue(`Provider #${id}`) ||
        current === normalizeTextValue(`Provider#${id}`) ||
        (current.startsWith("provider") && current.includes(id))
      ) {
        return true;
      }
      return false;
    },
    [normalizeTextValue]
  );

  // Auto-host-label effect
  useEffect(() => {
    const selectedHostId = normalizeTextValue(form.host_id);
    if (!selectedHostId) return;
    const matchedHost = hostItems.find(
      (item) => normalizeTextValue(item.id) === selectedHostId
    );
    const resolvedHostLabel = matchedHost?.label || "";
    if (!resolvedHostLabel) return;

    setDraftState((previous) => {
      if (
        !shouldAutoReplaceHostQuery(
          previous.hostQuery,
          selectedHostId,
          resolvedHostLabel
        )
      ) {
        return previous;
      }
      return {
        ...previous,
        hostQuery: resolvedHostLabel,
      };
    });
  }, [form.host_id, hostItems, normalizeTextValue, setDraftState, shouldAutoReplaceHostQuery]);

  const resolveLocationLabel = useCallback(
    (record) =>
      normalizeTextValue(record?.location_name) ||
      locationItems.find(
        (item) => normalizeTextValue(item.id) === normalizeTextValue(record?.location_id)
      )?.label ||
      "",
    [locationItems, normalizeTextValue]
  );

  const resolveHostLabel = useCallback(
    (record) =>
      [record?.host_first_name, record?.host_last_name].filter(Boolean).join(" ").trim() ||
      hostItems.find(
        (item) => normalizeTextValue(item.id) === normalizeTextValue(record?.host_id)
      )?.label ||
      "",
    [hostItems, normalizeTextValue]
  );

  const resolveGuestLabel = useCallback(
    (record) =>
      [record?.primary_guest_first_name, record?.primary_guest_last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      guestItems.find(
        (item) =>
          normalizeTextValue(item.id) ===
          normalizeTextValue(record?.primary_guest_contact_id || record?.primary_guest_id)
      )?.label ||
      "",
    [guestItems, normalizeTextValue]
  );

  const buildDraftFromRecord = useCallback(
    (record) => {
      const appointmentId = normalizeTextValue(record?.id || record?.ID);
      if (!appointmentId) return null;
      const duration = deriveDurationFromRecord(record);
      return {
        form: {
          ...emptyForm,
          status:
            normalizeTextValue(
              resolveAppointmentMappedOption(APPOINTMENT_STATUS_OPTIONS, record?.status)?.value
            ) ||
            normalizeTextValue(record?.status) ||
            "New",
          type: normalizeTextValue(record?.type) || "select none",
          title: normalizeTextValue(record?.title),
          start_time: formatDateTimeLocalInput(record?.start_time),
          description: normalizeTextValue(record?.description),
          location_id: normalizeTextValue(record?.location_id),
          host_id: normalizeTextValue(record?.host_id),
          primary_guest_contact_id: normalizeTextValue(
            record?.primary_guest_contact_id || record?.primary_guest_id
          ),
          event_color:
            normalizeTextValue(getAppointmentEventColorValue(record)) || defaultEventColor,
          duration_hours: duration.hours,
          duration_minutes: duration.minutes,
        },
        locationQuery: resolveLocationLabel(record),
        hostQuery: resolveHostLabel(record),
        guestQuery: resolveGuestLabel(record),
        editingAppointmentId: appointmentId,
      };
    },
    [
      defaultEventColor,
      deriveDurationFromRecord,
      emptyForm,
      formatDateTimeLocalInput,
      normalizeTextValue,
      resolveGuestLabel,
      resolveHostLabel,
      resolveLocationLabel,
    ]
  );

  const startEditing = useCallback(
    (record) => {
      const nextDraftState = buildDraftFromRecord(record);
      if (!nextDraftState) return;
      setDraftState(nextDraftState);
    },
    [buildDraftFromRecord, setDraftState]
  );

  return {
    contacts,
    searchContacts,
    isContactLookupLoading,
    properties,
    searchProperties,
    isPropertyLookupLoading,
    serviceProviders,
    isServiceProviderLookupLoading,
    locationItems,
    hostItems,
    guestItems,
    locationItemById,
    hostItemById,
    guestItemById,
    resolveLocationLabel,
    resolveHostLabel,
    resolveGuestLabel,
    buildDraftFromRecord,
    startEditing,
  };
}
