import { useCallback, useEffect, useState } from "react";
import { fetchUserById } from "../api/userManagementApi.js";
import { updateUser } from "../api/userManagementMutations.js";

export function useUserDetail({ userId } = {}) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchUserById({ userId });
      setUser(result);
    } catch (err) {
      console.error("[useUserDetail] failed", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveUser = useCallback(
    async (payload) => {
      if (!userId) return;
      setIsSaving(true);
      try {
        await updateUser({ userId, payload });
        await load();
      } finally {
        setIsSaving(false);
      }
    },
    [userId, load]
  );

  return { user, isLoading, isSaving, error, saveUser, refreshUser: load };
}
