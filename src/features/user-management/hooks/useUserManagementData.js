import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUsers } from "../api/userManagementApi.js";

export function useUserManagementData({ plugin } = {}) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const searchTimeoutRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  const loadUsers = useCallback(async () => {
    if (!plugin) return;
    setIsLoading(true);
    try {
      const result = await fetchUsers({
        plugin,
        page: currentPage,
        pageSize,
        search: debouncedSearch,
      });
      setUsers(result.users);
      if (result.totalCount >= 0) {
        setTotalCount(result.totalCount);
      }
    } catch (err) {
      console.error("[useUserManagementData] failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [plugin, currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  return {
    users,
    isLoading,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    totalCount,
    totalPages,
    refreshUsers: loadUsers,
  };
}
