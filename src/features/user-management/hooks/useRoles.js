import { useCallback, useEffect, useState } from "react";
import { fetchRoles } from "../api/userManagementApi.js";

export function useRoles({ plugin } = {}) {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!plugin) return;
    setIsLoading(true);
    try {
      const result = await fetchRoles({ plugin });
      setRoles(result);
    } catch (err) {
      console.error("[useRoles] failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [plugin]);

  useEffect(() => {
    load();
  }, [load]);

  return { roles, isLoadingRoles: isLoading, refreshRoles: load };
}
