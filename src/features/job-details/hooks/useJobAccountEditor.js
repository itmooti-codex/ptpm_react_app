import { useCallback, useMemo } from "react";
import { toText, compactStringFields } from "@shared/utils/formatters.js";
import {
  createCompanyRecord,
  createContactRecord,
} from "@modules/details-workspace/exports/api.js";
import {
  updateCompanyFieldsById,
  updateContactFieldsById,
  updateJobFieldsById,
} from "@modules/job-records/exports/api.js";
import {
  formatCompanyLookupLabel,
  formatContactLookupLabel,
} from "@shared/utils/formatters.js";

export function useJobAccountEditor({
  accountCompany,
  accountCompanyPrimary,
  accountPrimaryContact,
  effectiveJobId,
  isCompanyAccount,
  loadedAccountType,
  loadedClientEntityId,
  loadedClientIndividualId,
  openContactDetailsModal,
  plugin,
  searchCompaniesInDatabase,
  searchContactsInDatabase,
  setContactModalState,
  setJobEmailContactSearchValue,
  setLoadedAccountType,
  setLoadedClientEntityId,
  setLoadedClientIndividualId,
  setSelectedJobEmailContactId,
  success,
}) {
  const accountEditorContactInitialValues = useMemo(
    () => ({
      id: toText(accountPrimaryContact?.id || accountPrimaryContact?.ID),
      first_name: toText(accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name),
      last_name: toText(accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name),
      email: toText(accountPrimaryContact?.email || accountPrimaryContact?.Email),
      sms_number: toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number),
      address: toText(accountPrimaryContact?.address || accountPrimaryContact?.Address),
      city: toText(accountPrimaryContact?.city || accountPrimaryContact?.City),
      state: toText(accountPrimaryContact?.state || accountPrimaryContact?.State),
      zip_code: toText(accountPrimaryContact?.zip_code || accountPrimaryContact?.Zip_Code),
      country: "AU",
      postal_country: "AU",
    }),
    [accountPrimaryContact]
  );

  const accountEditorCompanyInitialValues = useMemo(
    () => ({
      id: toText(accountCompany?.id || accountCompany?.ID),
      company_name: toText(accountCompany?.name || accountCompany?.Name),
      company_type: toText(accountCompany?.type || accountCompany?.Type),
      company_description: toText(accountCompany?.description || accountCompany?.Description),
      company_phone: toText(accountCompany?.phone || accountCompany?.Phone),
      company_address: toText(accountCompany?.address || accountCompany?.Address),
      company_city: toText(accountCompany?.city || accountCompany?.City),
      company_state: toText(accountCompany?.state || accountCompany?.State),
      company_postal_code: toText(
        accountCompany?.postal_code || accountCompany?.Postal_Code || accountCompany?.zip_code
      ),
      company_industry: toText(accountCompany?.industry || accountCompany?.Industry),
      company_annual_revenue: toText(
        accountCompany?.annual_revenue || accountCompany?.Annual_Revenue
      ),
      company_number_of_employees: toText(
        accountCompany?.number_of_employees || accountCompany?.Number_of_Employees
      ),
      company_account_type: toText(
        accountCompany?.account_type || accountCompany?.Account_Type || loadedAccountType
      ),
      primary_person_contact_id: toText(accountCompanyPrimary?.id || accountCompanyPrimary?.ID),
      first_name: toText(accountCompanyPrimary?.first_name || accountCompanyPrimary?.First_Name),
      last_name: toText(accountCompanyPrimary?.last_name || accountCompanyPrimary?.Last_Name),
      email: toText(accountCompanyPrimary?.email || accountCompanyPrimary?.Email),
      sms_number: toText(accountCompanyPrimary?.sms_number || accountCompanyPrimary?.SMS_Number),
      country: "AU",
      postal_country: "AU",
    }),
    [accountCompany, accountCompanyPrimary, loadedAccountType]
  );

  const closeContactDetailsModal = useCallback(() => {
    setContactModalState((previous) => ({
      ...previous,
      open: false,
    }));
  }, []);

  const handleOpenAccountEditor = useCallback(() => {
    if (!plugin || !effectiveJobId) return;
    const currentMode = isCompanyAccount ? "entity" : "individual";

    const handleSaveAccount = async (draftRecord, context = {}) => {
      const mode = toText(context?.mode || currentMode).toLowerCase() === "entity"
        ? "entity"
        : "individual";

      if (mode === "entity") {
        const companyName = toText(draftRecord?.name);
        if (!companyName) {
          throw new Error("Company name is required.");
        }
        const companyPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          name: companyName,
        };
        delete companyPayload.id;
        delete companyPayload.ID;
        delete companyPayload.Company_ID;
        delete companyPayload.primary_contact_id;
        delete companyPayload.Primary_Contact_ID;
        if (companyPayload?.Primary_Person && typeof companyPayload.Primary_Person === "object") {
          const compactPrimaryPerson = compactStringFields(companyPayload.Primary_Person);
          if (Object.keys(compactPrimaryPerson).length) {
            companyPayload.Primary_Person = compactPrimaryPerson;
          } else {
            delete companyPayload.Primary_Person;
          }
        }
        const existingCompanyId = toText(
          draftRecord?.id || draftRecord?.ID || draftRecord?.Company_ID
        );

        let companyId = existingCompanyId;
        if (existingCompanyId) {
          await updateCompanyFieldsById({
            plugin,
            companyId: existingCompanyId,
            payload: companyPayload,
          });
        } else {
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          companyId = toText(createdCompany?.id || createdCompany?.ID);
        }
        if (!companyId) {
          throw new Error("Unable to resolve company ID.");
        }
        const preservedContactId = toText(loadedClientIndividualId);

        await updateJobFieldsById({
          plugin,
          jobId: effectiveJobId,
          payload: {
            account_type: "Company",
            Account_Type: "Company",
            client_entity_id: companyId,
            Client_Entity_ID: companyId,
            client_individual_id: preservedContactId || null,
            Client_Individual_ID: preservedContactId || null,
          },
        });
        setLoadedAccountType("Company");
        setLoadedClientEntityId(companyId);
        setLoadedClientIndividualId(preservedContactId || "");
        success("Job updated", "Company account was linked and contact was preserved.");
        return;
      }

      const existingContactId = toText(
        draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
      );
      const contactPayload = {
        ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
      };
      delete contactPayload.id;
      delete contactPayload.ID;
      delete contactPayload.Contact_ID;
      const savedContact = existingContactId
        ? await updateContactFieldsById({
            plugin,
            contactId: existingContactId,
            payload: contactPayload,
          }).then(() => ({ id: existingContactId }))
        : await createContactRecord({
            plugin,
            payload: contactPayload,
          });
      const contactId = toText(savedContact?.id || savedContact?.ID || existingContactId);
      if (!contactId) {
        throw new Error("Unable to resolve contact ID.");
      }
      const preservedCompanyId = toText(loadedClientEntityId);

      await updateJobFieldsById({
        plugin,
        jobId: effectiveJobId,
        payload: {
          account_type: "Contact",
          Account_Type: "Contact",
          client_individual_id: contactId,
          Client_Individual_ID: contactId,
          client_entity_id: preservedCompanyId || null,
          Client_Entity_ID: preservedCompanyId || null,
        },
      });
      setLoadedAccountType("Contact");
      setLoadedClientIndividualId(contactId);
      setLoadedClientEntityId(preservedCompanyId || "");
      success("Job updated", "Contact account was linked and company was preserved.");
    };

    openContactDetailsModal({
      mode: currentMode,
      onSave: handleSaveAccount,
      allowModeSwitch: true,
      titleVerb: "Update",
      initialValues:
        currentMode === "entity"
          ? accountEditorCompanyInitialValues
          : accountEditorContactInitialValues,
      onModeChange: (nextMode) => {
        const normalizedMode = toText(nextMode).toLowerCase() === "entity" ? "entity" : "individual";
        setContactModalState((previous) => ({
          ...previous,
          mode: normalizedMode,
          initialValues:
            normalizedMode === "entity"
              ? accountEditorCompanyInitialValues
              : accountEditorContactInitialValues,
        }));
      },
    });
  }, [
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    effectiveJobId,
    isCompanyAccount,
    loadedClientEntityId,
    loadedClientIndividualId,
    openContactDetailsModal,
    plugin,
    success,
  ]);

  const handleAddJobEmailContact = useCallback(() => {
    const mode = isCompanyAccount ? "entity" : "individual";
    openContactDetailsModal({
      mode,
      titleVerb: "Add",
      allowModeSwitch: false,
      onSave: async (draftRecord) => {
        if (!plugin) {
          throw new Error("SDK plugin is not ready.");
        }

        if (mode === "entity") {
          const companyPayload = {
            ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          };
          delete companyPayload.id;
          delete companyPayload.ID;
          delete companyPayload.Company_ID;
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          const createdCompanyId = toText(createdCompany?.id || createdCompany?.ID);
          await searchCompaniesInDatabase("");
          if (createdCompanyId) {
            setSelectedJobEmailContactId(createdCompanyId);
            setJobEmailContactSearchValue(
              formatCompanyLookupLabel({
                ...createdCompany,
                id: createdCompanyId,
              })
            );
          }
          return;
        }

        const contactPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
        };
        delete contactPayload.id;
        delete contactPayload.ID;
        delete contactPayload.Contact_ID;
        const createdContact = await createContactRecord({
          plugin,
          payload: contactPayload,
        });
        const createdContactId = toText(createdContact?.id || createdContact?.ID);
        await searchContactsInDatabase("");
        if (createdContactId) {
          setSelectedJobEmailContactId(createdContactId);
          setJobEmailContactSearchValue(
            formatContactLookupLabel({
              ...createdContact,
              id: createdContactId,
            })
          );
        }
      },
    });
  }, [
    isCompanyAccount,
    openContactDetailsModal,
    plugin,
    searchCompaniesInDatabase,
    searchContactsInDatabase,
  ]);

  return {
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    closeContactDetailsModal,
    handleAddJobEmailContact,
    handleOpenAccountEditor,
  };
}
