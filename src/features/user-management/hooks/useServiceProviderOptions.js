import { useCallback, useEffect, useState } from "react";
import { fetchServiceProviderOptions } from "../api/userManagementApi.js";

export function useServiceProviderOptions({ plugin } = {}) {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!plugin) return;
    setIsLoading(true);
    try {
      const result = await fetchServiceProviderOptions({ plugin });
      setOptions(result);
    } catch (err) {
      console.error("[useServiceProviderOptions] failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [plugin]);

  useEffect(() => {
    load();
  }, [load]);

  return { serviceProviderOptions: options, isLoadingOptions: isLoading };
}
