import { useCallback, useEffect, useState } from "react";
import { fetchLinkedServiceProvider } from "../api/userManagementApi.js";

export function useLinkedServiceProvider({ plugin, userId } = {}) {
  const [serviceProvider, setServiceProvider] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!plugin || !userId) return;
    setIsLoading(true);
    try {
      const result = await fetchLinkedServiceProvider({ plugin, userId });
      setServiceProvider(result);
    } catch (err) {
      console.error("[useLinkedServiceProvider] failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [plugin, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { serviceProvider, isLoadingSP: isLoading, refreshSP: load };
}
