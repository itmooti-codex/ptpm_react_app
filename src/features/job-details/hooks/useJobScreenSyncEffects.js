import { useEffect } from "react";
import { toText } from "@shared/utils/formatters.js";
import { isCompanyAccountType } from "@shared/utils/accountTypeUtils.js";

export function useJobScreenSyncEffects({
  accountsContactItems,
  isQuoteCompanyAccount,
  jobEmailFallbackLabel,
  jobEmailItems,
  loadedAccountsContactId,
  loadedClientEntityId,
  loadedClientIndividualId,
  menuRootRef,
  openMenu,
  resolvedJobEmailSelectionLabel,
  selectedAccountsContactId,
  selectedJobEmailContactId,
  setAccountsContactSearchValue,
  setJobEmailContactSearchValue,
  setOpenMenu,
  setSelectedAccountsContactId,
  setSelectedJobEmailContactId,
}) {
  // Outside click for menu
  useEffect(() => {
    if (!openMenu) return undefined;
    const handleOutsideClick = (event) => {
      if (!menuRootRef.current || menuRootRef.current.contains(event.target)) return;
      setOpenMenu("");
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenu]);

  // Job email contact selection sync
  useEffect(() => {
    const nextJobEmailId = isQuoteCompanyAccount
      ? toText(loadedClientEntityId)
      : toText(loadedClientIndividualId);
    setSelectedJobEmailContactId(nextJobEmailId);
  }, [isQuoteCompanyAccount, loadedClientEntityId, loadedClientIndividualId]);

  // Accounts contact sync
  useEffect(() => {
    setSelectedAccountsContactId(toText(loadedAccountsContactId));
  }, [loadedAccountsContactId]);

  // Accounts contact legacy ID migration
  useEffect(() => {
    const currentSelectedId = toText(selectedAccountsContactId);
    if (!currentSelectedId || !accountsContactItems.length) return;
    if (accountsContactItems.some((item) => toText(item?.id) === currentSelectedId)) return;
    const legacyMatch = accountsContactItems.find((item) =>
      Array.isArray(item?.legacyIds) ? item.legacyIds.includes(currentSelectedId) : false
    );
    if (!legacyMatch?.id) return;
    setSelectedAccountsContactId(toText(legacyMatch.id));
  }, [accountsContactItems, selectedAccountsContactId]);

  // Job email search value sync
  useEffect(() => {
    if (!selectedJobEmailContactId) {
      setJobEmailContactSearchValue("");
      return;
    }
    const selected = jobEmailItems.find(
      (item) => toText(item?.id) === toText(selectedJobEmailContactId)
    );
    setJobEmailContactSearchValue(
      toText(selected?.label || jobEmailFallbackLabel || selectedJobEmailContactId)
    );
  }, [jobEmailFallbackLabel, jobEmailItems, selectedJobEmailContactId]);

  // Accounts contact search value sync
  useEffect(() => {
    if (!selectedAccountsContactId) {
      setAccountsContactSearchValue("");
      return;
    }
    const selected = accountsContactItems.find(
      (item) => toText(item?.id) === toText(selectedAccountsContactId)
    );
    setAccountsContactSearchValue(toText(selected?.label || selectedAccountsContactId));
  }, [accountsContactItems, selectedAccountsContactId]);
}
