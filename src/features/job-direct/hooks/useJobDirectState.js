import { useMemo, useState } from "react";
import { MODAL_KEYS, SECTION_ORDER } from "../constants/navigation.js";

function createInitialModalState() {
  return Object.values(MODAL_KEYS).reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

export function useJobDirectState() {
  const [activeSection, setActiveSection] = useState(SECTION_ORDER[0]);
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [modals, setModals] = useState(createInitialModalState);

  const sectionIndex = SECTION_ORDER.indexOf(activeSection);

  const navState = useMemo(
    () => ({
      canGoBack: sectionIndex > 0,
      canGoNext: sectionIndex < SECTION_ORDER.length - 1,
      previous: sectionIndex > 0 ? SECTION_ORDER[sectionIndex - 1] : null,
      next:
        sectionIndex < SECTION_ORDER.length - 1
          ? SECTION_ORDER[sectionIndex + 1]
          : null,
    }),
    [sectionIndex]
  );

  const openModal = (key) => setModals((prev) => ({ ...prev, [key]: true }));
  const closeModal = (key) => setModals((prev) => ({ ...prev, [key]: false }));

  const setSection = (section) => {
    if (!SECTION_ORDER.includes(section)) return;
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
