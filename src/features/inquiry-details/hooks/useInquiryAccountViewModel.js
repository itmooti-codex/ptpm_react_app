import { useMemo } from "react";
import { isLikelyEmailValue, isLikelyPhoneValue } from "@shared/utils/accountTypeUtils.js";
import {
  fullName,
  joinAddress,
  toGoogleMapsHref,
  toMailHref,
  toTelHref,
  toText,
} from "@shared/utils/formatters.js";

export function useInquiryAccountViewModel({
  inquiry,
  inquiryAccountType,
  inquiryBodyCorpCompany,
  inquiryCompany,
  inquiryCompanyId,
  inquiryCompanyPrimaryPerson,
  inquiryContactId,
  inquiryPrimaryContact,
  isCompanyAccount,
  safeUid,
}) {
  const accountContactName = fullName(
    inquiryPrimaryContact?.first_name,
    inquiryPrimaryContact?.last_name
  );
  const accountContactEmail = toText(inquiryPrimaryContact?.email);
  const accountContactPhone = toText(inquiryPrimaryContact?.sms_number);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail)
    ? toMailHref(accountContactEmail)
    : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone)
    ? toTelHref(accountContactPhone)
    : "";
  const accountContactAddress = joinAddress([
    inquiryPrimaryContact?.address,
    inquiryPrimaryContact?.city,
    inquiryPrimaryContact?.state,
    inquiryPrimaryContact?.zip_code,
  ]);
  const accountContactAddressHref = toGoogleMapsHref(accountContactAddress);

  const accountCompanyName = toText(inquiryCompany?.name || inquiryCompany?.Name);
  const accountCompanyPhone = toText(inquiryCompany?.phone || inquiryCompany?.Phone);
  const accountCompanyPhoneHref = isLikelyPhoneValue(accountCompanyPhone)
    ? toTelHref(accountCompanyPhone)
    : "";
  const accountCompanyAddress = joinAddress([
    inquiryCompany?.address || inquiryCompany?.Address,
    inquiryCompany?.city || inquiryCompany?.City,
    inquiryCompany?.state || inquiryCompany?.State,
    inquiryCompany?.postal_code ||
      inquiryCompany?.Postal_Code ||
      inquiryCompany?.zip_code ||
      inquiryCompany?.Zip_Code,
  ]);
  const accountCompanyAddressHref = toGoogleMapsHref(accountCompanyAddress);

  const accountCompanyPrimaryName = fullName(
    inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name,
    inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
  );
  const accountCompanyPrimaryEmail = toText(
    inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email
  );
  const accountCompanyPrimaryEmailHref = isLikelyEmailValue(accountCompanyPrimaryEmail)
    ? toMailHref(accountCompanyPrimaryEmail)
    : "";
  const accountCompanyPrimaryPhone = toText(
    inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
  );
  const accountCompanyPrimaryPhoneHref = isLikelyPhoneValue(accountCompanyPrimaryPhone)
    ? toTelHref(accountCompanyPrimaryPhone)
    : "";

  const accountBodyCorpName = toText(inquiryBodyCorpCompany?.name || inquiryBodyCorpCompany?.Name);
  const accountBodyCorpType = toText(inquiryBodyCorpCompany?.type || inquiryBodyCorpCompany?.Type);
  const accountBodyCorpPhone = toText(
    inquiryBodyCorpCompany?.phone || inquiryBodyCorpCompany?.Phone
  );
  const accountBodyCorpPhoneHref = isLikelyPhoneValue(accountBodyCorpPhone)
    ? toTelHref(accountBodyCorpPhone)
    : "";
  const accountBodyCorpAddress = joinAddress([
    inquiryBodyCorpCompany?.address || inquiryBodyCorpCompany?.Address,
    inquiryBodyCorpCompany?.city || inquiryBodyCorpCompany?.City,
    inquiryBodyCorpCompany?.state || inquiryBodyCorpCompany?.State,
    inquiryBodyCorpCompany?.postal_code || inquiryBodyCorpCompany?.Postal_Code,
  ]);
  const accountBodyCorpAddressHref = toGoogleMapsHref(accountBodyCorpAddress);

  const hasBodyCorpDetails = Boolean(
    accountBodyCorpName || accountBodyCorpType || accountBodyCorpPhone || accountBodyCorpAddress
  );
  const hasAccountContactFields = Boolean(
    accountContactName || accountContactEmail || accountContactPhone || accountContactAddress
  );
  const hasAccountCompanyFields = Boolean(
    accountCompanyName ||
      accountCompanyPhone ||
      accountCompanyPrimaryName ||
      accountCompanyPrimaryEmail ||
      accountCompanyPrimaryPhone ||
      accountCompanyAddress
  );

  const sameAsContactPropertySource = useMemo(() => {
    const contactStreet = toText(inquiryPrimaryContact?.address);
    const contactCity = toText(inquiryPrimaryContact?.city);
    const contactState = toText(inquiryPrimaryContact?.state);
    const contactPostalCode = toText(inquiryPrimaryContact?.zip_code);
    const companyStreet = toText(inquiryCompany?.address || inquiryCompany?.Address);
    const companyCity = toText(inquiryCompany?.city || inquiryCompany?.City);
    const companyState = toText(inquiryCompany?.state || inquiryCompany?.State);
    const companyPostalCode = toText(
      inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
    );

    const preferCompanyAddress = isCompanyAccount;
    const primaryStreet = preferCompanyAddress ? companyStreet : contactStreet;
    const primaryCity = preferCompanyAddress ? companyCity : contactCity;
    const primaryState = preferCompanyAddress ? companyState : contactState;
    const primaryPostalCode = preferCompanyAddress ? companyPostalCode : contactPostalCode;
    const secondaryStreet = preferCompanyAddress ? contactStreet : companyStreet;
    const secondaryCity = preferCompanyAddress ? contactCity : companyCity;
    const secondaryState = preferCompanyAddress ? contactState : companyState;
    const secondaryPostalCode = preferCompanyAddress ? contactPostalCode : companyPostalCode;

    const fallbackStreet = primaryStreet || secondaryStreet;
    const fallbackCity = primaryCity || secondaryCity;
    const fallbackState = primaryState || secondaryState;
    const fallbackPostalCode = primaryPostalCode || secondaryPostalCode;
    const hasPrimaryAddress = Boolean(primaryStreet || primaryCity || primaryPostalCode);
    const formatted = joinAddress([fallbackStreet, fallbackCity, fallbackState, fallbackPostalCode]);

    return {
      sourceType: hasPrimaryAddress
        ? preferCompanyAddress
          ? "company"
          : "contact"
        : preferCompanyAddress
          ? "contact"
          : "company",
      address1: fallbackStreet || formatted,
      suburbTown: fallbackCity,
      state: fallbackState,
      postalCode: fallbackPostalCode,
      propertyName:
        fallbackStreet ||
        formatted ||
        accountContactName ||
        accountCompanyName ||
        `Property ${safeUid || ""}`.trim(),
      searchText: formatted || fallbackStreet,
    };
  }, [
    accountCompanyName,
    accountContactName,
    inquiryCompany,
    inquiryPrimaryContact,
    isCompanyAccount,
    safeUid,
  ]);

  const accountBindingKey = useMemo(
    () => [toText(inquiryAccountType), toText(inquiryContactId), toText(inquiryCompanyId)].join("|"),
    [inquiryAccountType, inquiryCompanyId, inquiryContactId]
  );

  const accountEditorContactInitialValues = useMemo(
    () => ({
      id: toText(inquiryPrimaryContact?.id),
      first_name: toText(inquiryPrimaryContact?.first_name),
      last_name: toText(inquiryPrimaryContact?.last_name),
      email: toText(inquiryPrimaryContact?.email),
      sms_number: toText(inquiryPrimaryContact?.sms_number),
      address: toText(inquiryPrimaryContact?.address),
      city: toText(inquiryPrimaryContact?.city),
      state: toText(inquiryPrimaryContact?.state),
      zip_code: toText(inquiryPrimaryContact?.zip_code),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiryPrimaryContact]
  );

  const accountEditorCompanyInitialValues = useMemo(
    () => ({
      id: toText(inquiryCompany?.id),
      company_name: toText(inquiryCompany?.name || inquiryCompany?.Name),
      company_type: toText(inquiryCompany?.type || inquiryCompany?.Type),
      company_description: toText(inquiryCompany?.description || inquiryCompany?.Description),
      company_phone: toText(inquiryCompany?.phone || inquiryCompany?.Phone),
      company_address: toText(inquiryCompany?.address || inquiryCompany?.Address),
      company_city: toText(inquiryCompany?.city || inquiryCompany?.City),
      company_state: toText(inquiryCompany?.state || inquiryCompany?.State),
      company_postal_code: toText(
        inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
      ),
      company_industry: toText(inquiryCompany?.industry || inquiryCompany?.Industry),
      company_annual_revenue: toText(
        inquiryCompany?.annual_revenue || inquiryCompany?.Annual_Revenue
      ),
      company_number_of_employees: toText(
        inquiryCompany?.number_of_employees || inquiryCompany?.Number_of_Employees
      ),
      company_account_type: toText(
        inquiryCompany?.account_type ||
          inquiryCompany?.Account_Type ||
          inquiry?.Company_Account_Type
      ),
      primary_person_contact_id: toText(
        inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID
      ),
      first_name: toText(
        inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name
      ),
      last_name: toText(
        inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
      ),
      email: toText(inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email),
      sms_number: toText(
        inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
      ),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiry?.Company_Account_Type, inquiryCompany, inquiryCompanyPrimaryPerson]
  );

  return {
    accountBindingKey,
    accountBodyCorpAddress,
    accountBodyCorpAddressHref,
    accountBodyCorpName,
    accountBodyCorpPhone,
    accountBodyCorpPhoneHref,
    accountBodyCorpType,
    accountCompanyAddress,
    accountCompanyAddressHref,
    accountCompanyName,
    accountCompanyPhone,
    accountCompanyPhoneHref,
    accountCompanyPrimaryEmail,
    accountCompanyPrimaryEmailHref,
    accountCompanyPrimaryName,
    accountCompanyPrimaryPhone,
    accountCompanyPrimaryPhoneHref,
    accountContactAddress,
    accountContactAddressHref,
    accountContactEmail,
    accountContactEmailHref,
    accountContactName,
    accountContactPhone,
    accountContactPhoneHref,
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    hasAccountCompanyFields,
    hasAccountContactFields,
    hasBodyCorpDetails,
    sameAsContactPropertySource,
  };
}
