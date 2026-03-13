import { useCallback, useEffect, useMemo } from "react";
import {
  fetchCompaniesForSearch,
  fetchContactsForSearch,
  findContactByEmail,
  searchCompaniesForLookup,
  searchContactsForLookup,
} from "../../api/core/runtime.js";
import { fetchCompanyById, fetchContactById, findCompanyByName } from "./contactDetailsApi.js";
import {
  mergeLookupRecords,
  trimValue,
  mapContactRecordToForm,
  mapCompanyRecordToForm,
  formatDisplayName,
  normalizeRelationRecord,
} from "./contactDetailsUtils.js";

export function useContactDetailsLookups({
  open,
  isEntity,
  plugin,
  useTopLookupSearch,
  enableInlineDuplicateLookup,
  saveOnLookupSelect,
  onSave,
  form,
  setForm,
  setContactSearch,
  setCompanySearch,
  lookupContacts,
  lookupCompanies,
  setLookupContacts,
  setLookupCompanies,
  setIsLookupLoading,
  setIsLookupSearching,
  setIsContactLookupLoading,
  setIsCompanyLookupLoading,
  setIsPrimaryPersonLookupLoading,
  setExistingContactRecord,
  setExistingCompanyRecord,
  setExistingPrimaryPersonRecord,
  setSelectedLookupContact,
  setSelectedPrimaryPersonContact,
  selectedLookupContact,
  isSaving,
  setIsSaving,
  setSaveError,
  onClose,
  showErrorToast,
  existingLookupRef,
  companyLookupRef,
  primaryPersonLookupRef,
}) {
  // Effect: load top-level lookup data when modal opens
  useEffect(() => {
    if (!open || !useTopLookupSearch || !plugin?.switchTo) return undefined;
    let isMounted = true;
    setIsLookupLoading(true);

    Promise.all([
      fetchContactsForSearch({ plugin }),
      fetchCompaniesForSearch({ plugin }),
    ])
      .then(([contactRecords, companyRecords]) => {
        if (!isMounted) return;
        setLookupContacts(Array.isArray(contactRecords) ? contactRecords : []);
        setLookupCompanies(Array.isArray(companyRecords) ? companyRecords : []);
      })
      .catch((lookupError) => {
        if (!isMounted) return;
        console.error("[JobDirect] Failed to load top-level lookup data", lookupError);
        setLookupContacts([]);
        setLookupCompanies([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLookupLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, plugin, useTopLookupSearch, setIsLookupLoading, setLookupContacts, setLookupCompanies]);

  // Effect: inline duplicate lookup for contact by email
  useEffect(() => {
    if (!open || !enableInlineDuplicateLookup || isEntity || !plugin?.switchTo) return undefined;

    const normalizedEmail = trimValue(form.email).toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setIsContactLookupLoading(false);
      setExistingContactRecord(null);
      setSelectedLookupContact({ id: "", email: "" });
      if (existingLookupRef.current.matchedId) {
        existingLookupRef.current.matchedId = "";
        setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
      }
      return undefined;
    }

    existingLookupRef.current.requestKey = normalizedEmail;
    setIsContactLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findContactByEmail({ plugin, email: normalizedEmail });
        if (existingLookupRef.current.requestKey !== normalizedEmail) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Contact_ID);
        if (!matchedId) {
          setExistingContactRecord(null);
          setSelectedLookupContact({ id: "", email: "" });
          if (existingLookupRef.current.matchedId) {
            existingLookupRef.current.matchedId = "";
            setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
          }
          return;
        }
        existingLookupRef.current.matchedId = matchedId;
        setExistingContactRecord(matched);
        setSelectedLookupContact({
          id: matchedId,
          email: trimValue(matched?.email || matched?.Email),
        });
        setForm((previous) => {
          if (trimValue(previous.id) === matchedId) return previous;
          return mapContactRecordToForm(matched, previous);
        });
      } catch (lookupError) {
        if (existingLookupRef.current.requestKey !== normalizedEmail) return;
        console.error("[JobDirect] Contact duplicate lookup failed", lookupError);
      } finally {
        if (existingLookupRef.current.requestKey === normalizedEmail) {
          setIsContactLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enableInlineDuplicateLookup, open, isEntity, plugin, form.email, existingLookupRef, setForm, setExistingContactRecord, setIsContactLookupLoading, setSelectedLookupContact]);

  // Effect: inline duplicate lookup for company by name
  useEffect(() => {
    if (useTopLookupSearch || !open || !enableInlineDuplicateLookup || !isEntity || !plugin?.switchTo) return undefined;

    const normalizedName = trimValue(form.company_name);
    if (!normalizedName) {
      setIsCompanyLookupLoading(false);
      setExistingCompanyRecord(null);
      if (companyLookupRef.current.matchedId) {
        companyLookupRef.current.matchedId = "";
        setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
      }
      return undefined;
    }

    companyLookupRef.current.requestKey = normalizedName.toLowerCase();
    setIsCompanyLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findCompanyByName({ plugin, name: normalizedName });
        if (companyLookupRef.current.requestKey !== normalizedName.toLowerCase()) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Company_ID);
        if (!matchedId) {
          setExistingCompanyRecord(null);
          if (companyLookupRef.current.matchedId) {
            companyLookupRef.current.matchedId = "";
            setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
          }
          return;
        }
        companyLookupRef.current.matchedId = matchedId;
        setExistingCompanyRecord(matched);
        setForm((previous) => {
          if (trimValue(previous.id) === matchedId) return previous;
          return mapCompanyRecordToForm(matched, previous);
        });
      } catch (lookupError) {
        if (companyLookupRef.current.requestKey !== normalizedName.toLowerCase()) return;
        console.error("[JobDirect] Company duplicate lookup failed", lookupError);
      } finally {
        if (companyLookupRef.current.requestKey === normalizedName.toLowerCase()) {
          setIsCompanyLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [useTopLookupSearch, open, enableInlineDuplicateLookup, isEntity, plugin, form.company_name, companyLookupRef, setForm, setExistingCompanyRecord, setIsCompanyLookupLoading]);

  // Effect: primary person lookup by email (entity mode)
  useEffect(() => {
    if (!open || !enableInlineDuplicateLookup || !isEntity || !plugin?.switchTo) return undefined;

    const normalizedEmail = trimValue(form.email).toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setIsPrimaryPersonLookupLoading(false);
      setExistingPrimaryPersonRecord(null);
      setSelectedPrimaryPersonContact((previous) =>
        trimValue(previous.id) || trimValue(previous.email)
          ? { id: "", email: "" }
          : previous
      );
      primaryPersonLookupRef.current = { requestKey: "", matchedId: "" };
      return undefined;
    }

    primaryPersonLookupRef.current.requestKey = normalizedEmail;
    setIsPrimaryPersonLookupLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findContactByEmail({ plugin, email: normalizedEmail });
        if (primaryPersonLookupRef.current.requestKey !== normalizedEmail) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Contact_ID);
        if (!matchedId) {
          setExistingPrimaryPersonRecord(null);
          setSelectedPrimaryPersonContact((previous) =>
            trimValue(previous.id) || trimValue(previous.email)
              ? { id: "", email: "" }
              : previous
          );
          primaryPersonLookupRef.current.matchedId = "";
          return;
        }
        primaryPersonLookupRef.current.matchedId = matchedId;
        setExistingPrimaryPersonRecord(matched);
        setSelectedPrimaryPersonContact({
          id: matchedId,
          email: trimValue(matched?.email || matched?.Email),
        });
        setForm((previous) => ({
          ...previous,
          first_name: trimValue(matched?.first_name || matched?.First_Name || previous.first_name),
          last_name: trimValue(matched?.last_name || matched?.Last_Name || previous.last_name),
          email: trimValue(matched?.email || matched?.Email || previous.email),
          sms_number: trimValue(
            matched?.sms_number ||
              matched?.SMS_Number ||
              matched?.office_phone ||
              matched?.Office_Phone ||
              previous.sms_number
          ),
        }));
      } catch (lookupError) {
        if (primaryPersonLookupRef.current.requestKey !== normalizedEmail) return;
        console.error("[JobDirect] Primary person email lookup failed", lookupError);
      } finally {
        if (primaryPersonLookupRef.current.requestKey === normalizedEmail) {
          setIsPrimaryPersonLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, enableInlineDuplicateLookup, isEntity, plugin, form.email, primaryPersonLookupRef, setForm, setExistingPrimaryPersonRecord, setIsPrimaryPersonLookupLoading, setSelectedPrimaryPersonContact]);

  const searchContacts = useCallback(
    async (query) => {
      const normalizedQuery = trimValue(query);
      if (!useTopLookupSearch || !plugin?.switchTo || normalizedQuery.length < 2) return [];
      setIsLookupSearching(true);
      try {
        const records = await searchContactsForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const resolvedRecords = Array.isArray(records) ? records : [];
        setLookupContacts((previous) => mergeLookupRecords(previous, resolvedRecords));
        return resolvedRecords;
      } catch (lookupError) {
        console.error("[JobDirect] Contact top lookup search failed", lookupError);
        return [];
      } finally {
        setIsLookupSearching(false);
      }
    },
    [plugin, useTopLookupSearch, setIsLookupSearching, setLookupContacts]
  );

  const searchCompanies = useCallback(
    async (query) => {
      const normalizedQuery = trimValue(query);
      if (!useTopLookupSearch || !plugin?.switchTo || normalizedQuery.length < 2) return [];
      setIsLookupSearching(true);
      try {
        const records = await searchCompaniesForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const resolvedRecords = Array.isArray(records) ? records : [];
        setLookupCompanies((previous) => mergeLookupRecords(previous, resolvedRecords));
        return resolvedRecords;
      } catch (lookupError) {
        console.error("[JobDirect] Company top lookup search failed", lookupError);
        return [];
      } finally {
        setIsLookupSearching(false);
      }
    },
    [plugin, useTopLookupSearch, setIsLookupSearching, setLookupCompanies]
  );

  const saveLookupSelection = useCallback(
    async (payload, context) => {
      if (isSaving || typeof onSave !== "function") return;
      setIsSaving(true);
      setSaveError("");
      try {
        await onSave(payload, context);
        onClose?.();
      } catch (error) {
        const message = error?.message || "Unable to link selected record right now.";
        setSaveError(message);
        showErrorToast("Save failed", message);
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, onClose, onSave, setSaveError, setIsSaving, showErrorToast]
  );

  const handleContactLookupSelect = useCallback(
    async (item) => {
      const contactId = trimValue(item?.id);
      if (!contactId) return;
      setContactSearch(trimValue(item?.label));
      if (saveOnLookupSelect && typeof onSave === "function") {
        void saveLookupSelection(
          {
            id: contactId,
            first_name: trimValue(item?.first_name),
            last_name: trimValue(item?.last_name),
            email: trimValue(item?.email),
            sms_number: trimValue(item?.sms_number),
          },
          { mode: "individual" }
        );
        return;
      }
      const resolvedEmail = trimValue(item?.email);
      setSelectedLookupContact({ id: contactId, email: resolvedEmail });
      if (!plugin?.switchTo) {
        setForm((previous) => ({
          ...previous,
          id: contactId,
          first_name: trimValue(item?.first_name) || previous.first_name,
          last_name: trimValue(item?.last_name) || previous.last_name,
          email: resolvedEmail || previous.email,
          sms_number: trimValue(item?.sms_number) || previous.sms_number,
        }));
        return;
      }
      setIsLookupSearching(true);
      try {
        const detailedRecord = await fetchContactById({ plugin, contactId });
        const resolvedRecord = detailedRecord || item || {};
        setSelectedLookupContact({
          id: contactId,
          email: trimValue(resolvedRecord?.email || resolvedRecord?.Email),
        });
        setForm((previous) => mapContactRecordToForm(resolvedRecord, previous));
      } catch (lookupError) {
        console.error("[JobDirect] Contact detail prefill failed", lookupError);
        setForm((previous) => ({
          ...previous,
          id: contactId,
          first_name: trimValue(item?.first_name) || previous.first_name,
          last_name: trimValue(item?.last_name) || previous.last_name,
          email: resolvedEmail || previous.email,
          sms_number: trimValue(item?.sms_number) || previous.sms_number,
        }));
      } finally {
        setIsLookupSearching(false);
      }
    },
    [onSave, plugin, saveLookupSelection, saveOnLookupSelect, setContactSearch, setForm, setIsLookupSearching, setSelectedLookupContact]
  );

  const handleCompanyLookupSelect = useCallback(
    async (item) => {
      const companyId = trimValue(item?.id);
      if (!companyId) return;
      setCompanySearch(trimValue(item?.label));
      setSelectedLookupContact({ id: "", email: "" });
      if (saveOnLookupSelect && typeof onSave === "function") {
        void saveLookupSelection(
          {
            id: companyId,
            name: trimValue(item?.name) || trimValue(item?.label),
          },
          { mode: "entity" }
        );
        return;
      }
      if (!plugin?.switchTo) {
        setForm((previous) => ({
          ...previous,
          id: companyId,
          company_name: trimValue(item?.name) || trimValue(item?.label) || previous.company_name,
          company_account_type: trimValue(item?.account_type) || previous.company_account_type,
        }));
        return;
      }
      setIsLookupSearching(true);
      try {
        const detailedRecord = await fetchCompanyById({ plugin, companyId });
        setForm((previous) => {
          const next = mapCompanyRecordToForm(detailedRecord || item || {}, previous);
          return {
            ...next,
            first_name: previous.first_name,
            last_name: previous.last_name,
            email: previous.email,
            sms_number: previous.sms_number,
          };
        });
      } catch (lookupError) {
        console.error("[JobDirect] Company detail prefill failed", lookupError);
        setForm((previous) => ({
          ...previous,
          id: companyId,
          company_name: trimValue(item?.name) || trimValue(item?.label) || previous.company_name,
          company_account_type: trimValue(item?.account_type) || previous.company_account_type,
        }));
      } finally {
        setIsLookupSearching(false);
      }
    },
    [onSave, plugin, saveLookupSelection, saveOnLookupSelect, setCompanySearch, setForm, setIsLookupSearching, setSelectedLookupContact]
  );

  const contactItems = useMemo(
    () =>
      (lookupContacts || [])
        .map((contact) => {
          const id = trimValue(contact?.id || contact?.ID || contact?.Contact_ID);
          const firstName = trimValue(contact?.first_name || contact?.First_Name);
          const lastName = trimValue(contact?.last_name || contact?.Last_Name);
          const email = trimValue(contact?.email || contact?.Email);
          const smsNumber = trimValue(
            contact?.sms_number || contact?.SMS_Number || contact?.office_phone || contact?.Office_Phone
          );
          const label = formatDisplayName(firstName, lastName) || email || smsNumber || id;
          const meta = [email, smsNumber, id].filter(Boolean).join(" | ");
          return { id, label, meta, first_name: firstName, last_name: lastName, email, sms_number: smsNumber };
        })
        .filter((item) => Boolean(item.id || item.label)),
    [lookupContacts]
  );

  const companyItems = useMemo(
    () =>
      (lookupCompanies || [])
        .map((company) => {
          const id = trimValue(company?.id || company?.ID || company?.Company_ID);
          const name = trimValue(company?.name || company?.Name);
          const accountType = trimValue(company?.account_type || company?.Account_Type);
          const primary = normalizeRelationRecord(company?.primary || company?.Primary_Person);
          const primaryFirstName = trimValue(
            primary?.first_name || primary?.First_Name || company?.Primary_Person_First_Name
          );
          const primaryLastName = trimValue(
            primary?.last_name || primary?.Last_Name || company?.Primary_Person_Last_Name
          );
          const primaryName = formatDisplayName(primaryFirstName, primaryLastName);
          const primaryEmail = trimValue(primary?.email || primary?.Email || company?.Primary_Person_Email);
          const primarySms = trimValue(
            primary?.sms_number || primary?.SMS_Number || primary?.office_phone || primary?.Office_Phone ||
            company?.Primary_Person_SMS_Number || company?.Primary_Person_Office_Phone
          );
          const meta = [accountType, primaryName, primaryEmail, primarySms, id].filter(Boolean).join(" | ");
          return {
            id,
            label: name || id,
            meta,
            name,
            account_type: accountType,
            primary: { first_name: primaryFirstName, last_name: primaryLastName, email: primaryEmail, sms_number: primarySms },
          };
        })
        .filter((item) => Boolean(item.id || item.label)),
    [lookupCompanies]
  );

  return {
    searchContacts,
    searchCompanies,
    handleContactLookupSelect,
    handleCompanyLookupSelect,
    contactItems,
    companyItems,
  };
}
