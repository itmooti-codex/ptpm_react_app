import { useEffect, useMemo } from "react";
import { toText } from "@shared/utils/formatters.js";

export function useInquiryWorkspaceTabs({
  activeWorkspaceTab,
  previousVisibleWorkspaceTabsKeyRef,
  setActiveWorkspaceTab,
  setMountedWorkspaceTabs,
  visibleWorkspaceTabs,
}) {
  const visibleWorkspaceTabsKey = useMemo(
    () => visibleWorkspaceTabs.map((tab) => tab.id).join("|"),
    [visibleWorkspaceTabs]
  );

  useEffect(() => {
    if (!visibleWorkspaceTabs.length) return;
    const firstVisibleTabId = visibleWorkspaceTabs[0].id;
    const hasVisibleTabSetChanged =
      previousVisibleWorkspaceTabsKeyRef.current !== visibleWorkspaceTabsKey;
    if (hasVisibleTabSetChanged) {
      previousVisibleWorkspaceTabsKeyRef.current = visibleWorkspaceTabsKey;
      setActiveWorkspaceTab(firstVisibleTabId);
      return;
    }
    const isActiveVisible = visibleWorkspaceTabs.some((tab) => tab.id === activeWorkspaceTab);
    if (!isActiveVisible) {
      setActiveWorkspaceTab(firstVisibleTabId);
    }
  }, [
    activeWorkspaceTab,
    previousVisibleWorkspaceTabsKeyRef,
    setActiveWorkspaceTab,
    visibleWorkspaceTabs,
    visibleWorkspaceTabsKey,
  ]);

  useEffect(() => {
    const normalizedActiveTab = toText(activeWorkspaceTab);
    if (!normalizedActiveTab) return;
    setMountedWorkspaceTabs((previous) => {
      if (previous[normalizedActiveTab]) return previous;
      return {
        ...previous,
        [normalizedActiveTab]: true,
      };
    });
  }, [activeWorkspaceTab, setMountedWorkspaceTabs]);

  useEffect(() => {
    if (!visibleWorkspaceTabs.length) return;
    const visibleIds = visibleWorkspaceTabs.map((tab) => tab.id);
    const firstVisibleTabId = visibleIds[0];
    setMountedWorkspaceTabs((previous) => {
      const next = {};
      visibleIds.forEach((tabId) => {
        if (previous[tabId] || tabId === activeWorkspaceTab || tabId === firstVisibleTabId) {
          next[tabId] = true;
        }
      });
      const previousKeys = Object.keys(previous).filter((key) => previous[key]);
      const nextKeys = Object.keys(next).filter((key) => next[key]);
      if (
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => next[key])
      ) {
        return previous;
      }
      return next;
    });
  }, [activeWorkspaceTab, setMountedWorkspaceTabs, visibleWorkspaceTabs]);

  return visibleWorkspaceTabs;
}
