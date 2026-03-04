import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchServiceProvidersForSearch,
  subscribeServiceProvidersForSearch,
} from "../sdk/jobDirectSdk.js";
import { buildLookupDisplayLabel } from "../../../shared/utils/lookupLabel.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "./useJobDirectStore.jsx";
import { selectServiceProviders } from "../state/selectors.js";
import { registerSharedLookupSubscription } from "./lookupRealtimeRegistry.js";

const EMPTY_LIST = [];

function normalizeString(value) {
  return String(value || "").trim();
}

function createServiceProviderLookupKey(provider = {}) {
  if (provider.id) return `service-provider-id:${provider.id}`;
  return [
    "service-provider",
    normalizeString(provider.unique_id),
    normalizeString(provider.first_name),
    normalizeString(provider.last_name),
    normalizeString(provider.email),
    normalizeString(provider.sms_number),
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

function normalizeServiceProvider(provider = {}) {
  const id = normalizeString(provider.id || provider.ID || "");
  const uniqueId = normalizeString(provider.unique_id || provider.Unique_ID || "");
  const firstName = normalizeString(
    provider.first_name ||
      provider.First_Name ||
      provider.contact_information_first_name ||
      provider.Contact_Information_First_Name ||
      provider.Contact_Information?.first_name
  );
  const lastName = normalizeString(
    provider.last_name ||
      provider.Last_Name ||
      provider.contact_information_last_name ||
      provider.Contact_Information_Last_Name ||
      provider.Contact_Information?.last_name
  );
  const email = normalizeString(
    provider.email ||
      provider.Email ||
      provider.contact_information_email ||
      provider.Contact_Information_Email ||
      provider.Contact_Information?.email
  );
  const smsNumber = normalizeString(
    provider.sms_number ||
      provider.SMS_Number ||
      provider.contact_information_sms_number ||
      provider.Contact_Information_SMS_Number ||
      provider.Contact_Information?.sms_number
  );

  return {
    id,
    unique_id: uniqueId,
    first_name: firstName,
    last_name: lastName,
    email,
    sms_number: smsNumber,
    phone: smsNumber,
    label: buildLookupDisplayLabel(
      [firstName, lastName].filter(Boolean).join(" ").trim(),
      email,
      smsNumber,
      uniqueId || (id ? `Provider #${id}` : "")
    ),
  };
}

export function useServiceProviderLookupData(
  plugin,
  { initialProviders = EMPTY_LIST, skipInitialFetch = false } = {}
) {
  const actions = useJobDirectStoreActions();
  const storeProviders = useJobDirectSelector(selectServiceProviders);

  const normalizedInitialProviders = useMemo(
    () => (initialProviders || []).map((item) => normalizeServiceProvider(item)),
    [initialProviders]
  );

  const serviceProviders = useMemo(
    () =>
      dedupeRecords(
        (storeProviders || []).map((item) => normalizeServiceProvider(item)),
        createServiceProviderLookupKey
      ),
    [storeProviders]
  );

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!normalizedInitialProviders.length) return;
    if (
      serviceProviders.length &&
      areListsEqualByKey(
        serviceProviders,
        normalizedInitialProviders,
        createServiceProviderLookupKey
      )
    ) {
      return;
    }
    if (!serviceProviders.length) {
      actions.replaceEntityCollection("serviceProviders", normalizedInitialProviders);
    }
  }, [actions, serviceProviders, normalizedInitialProviders]);

  useEffect(() => {
    if (!plugin) return undefined;

    const releaseServiceProviderSubscription = registerSharedLookupSubscription({
      key: "lookup:service-providers",
      start: () =>
        subscribeServiceProvidersForSearch({
          plugin,
          onChange: (records) => {
            const normalized = (records || []).map((item) => normalizeServiceProvider(item));
            actions.replaceEntityCollection(
              "serviceProviders",
              dedupeRecords(normalized, createServiceProviderLookupKey)
            );
          },
          onError: (lookupError) => {
            console.error("[JobDirect] Service provider lookup subscription failed", lookupError);
          },
        }),
    });

    return () => {
      releaseServiceProviderSubscription();
    };
  }, [actions, plugin]);

  useEffect(() => {
    let isActive = true;
    if (!plugin) return undefined;

    if (skipInitialFetch && serviceProviders.length > 0) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    fetchServiceProvidersForSearch({ plugin })
      .then((records) => {
        if (!isActive) return;
        const normalized = (records || []).map((item) => normalizeServiceProvider(item));
        actions.replaceEntityCollection(
          "serviceProviders",
          dedupeRecords(normalized, createServiceProviderLookupKey)
        );
      })
      .catch((lookupError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading service provider lookup data", lookupError);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [actions, plugin, serviceProviders.length, skipInitialFetch]);

  const addServiceProvider = useCallback(
    (newProvider) => {
      const normalized = normalizeServiceProvider(newProvider);
      actions.upsertEntityRecord("serviceProviders", normalized, { idField: "id" });
      return normalized;
    },
    [actions]
  );

  return {
    serviceProviders,
    isLookupLoading: isLoading,
    addServiceProvider,
  };
}
