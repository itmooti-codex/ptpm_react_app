import { useCallback, useEffect, useState } from "react";
import { fetchUserById } from "../api/userManagementApi.js";
import { updateUser } from "../api/userManagementMutations.js";

export function useUserDetail({ plugin, userId } = {}) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!plugin || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchUserById({ plugin, userId });
      setUser(result);
    } catch (err) {
      console.error("[useUserDetail] failed", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [plugin, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveUser = useCallback(
    async (payload) => {
      if (!plugin || !userId) return;
      setIsSaving(true);
      try {
        await updateUser({ plugin, userId, payload });
        await load();
      } finally {
        setIsSaving(false);
      }
    },
    [plugin, userId, load]
  );

  return { user, isLoading, isSaving, error, saveUser, refreshUser: load };
}
