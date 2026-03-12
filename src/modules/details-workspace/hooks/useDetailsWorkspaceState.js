import { useMemo, useState } from "react";
import { MODAL_KEYS, SECTION_ORDER } from "../constants/navigation.js";

function createInitialModalState() {
  return Object.values(MODAL_KEYS).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

export function useJobDirectState({ sectionOrder = SECTION_ORDER } = {}) {
  const resolvedSectionOrder =
    Array.isArray(sectionOrder) && sectionOrder.length > 0 ? sectionOrder : SECTION_ORDER;
  const [activeSection, setActiveSection] = useState(resolvedSectionOrder[0]);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [modals, setModals] = useState(createInitialModalState);

  const sectionIndex = resolvedSectionOrder.indexOf(activeSection);

  const navState = useMemo(
    () => ({
      canGoBack: sectionIndex > 0,
      canGoNext: sectionIndex < resolvedSectionOrder.length - 1,
      previous: sectionIndex > 0 ? resolvedSectionOrder[sectionIndex - 1] : null,
      next:
        sectionIndex < resolvedSectionOrder.length - 1
          ? resolvedSectionOrder[sectionIndex + 1]
          : null,
    }),
    [sectionIndex, resolvedSectionOrder]
  );

  const openModal = (key) => setModals((prev) => ({ ...prev, [key]: true }));
  const closeModal = (key) => setModals((prev) => ({ ...prev, [key]: false }));

  const setSection = (section) => {
    if (!resolvedSectionOrder.includes(section)) return;
    setActiveSection(section);
  };

  const goBack = () => {
    if (!navState.previous) return;
    setActiveSection(navState.previous);
  };

  const goNext = () => {
    if (!navState.next) return;
    setActiveSection(navState.next);
  };

  return {
    activeSection,
    activeTab,
    sidebarCollapsed,
    modals,
    navState,
    setActiveTab,
    setSidebarCollapsed,
    setSection,
    goBack,
    goNext,
    openModal,
    closeModal,
  };
}
