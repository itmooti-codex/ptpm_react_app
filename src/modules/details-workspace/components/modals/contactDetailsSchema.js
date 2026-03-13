export const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

export const COUNTRY_OPTIONS = [
  { value: "AU", label: "Australia" },
];

export const COMPANY_TYPE_OPTIONS = [
  { value: "Family/Individual", label: "Family/Individual" },
  { value: "Business", label: "Business" },
];

export const COMPANY_INDUSTRY_OPTIONS = [
  { value: "Education", label: "Education" },
  { value: "Telecom", label: "Telecom" },
  { value: "Software", label: "Software" },
  { value: "Automotive", label: "Automotive" },
  { value: "Hospitality", label: "Hospitality" },
  { value: "Accounting", label: "Accounting" },
  { value: "Restaurant", label: "Restaurant" },
  { value: "Printing", label: "Printing" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Engineering", label: "Engineering" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Food + Agriculture", label: "Food + Agriculture" },
  { value: "Insurance", label: "Insurance" },
  { value: "Pharma", label: "Pharma" },
  { value: "Clothing", label: "Clothing" },
  { value: "Marketing + Advertising", label: "Marketing + Advertising" },
  { value: "Retail", label: "Retail" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Transport", label: "Transport" },
  { value: "Construction", label: "Construction" },
  { value: "Finance", label: "Finance" },
  { value: "Manufacturing", label: "Manufacturing" },
];

export const COMPANY_ACCOUNT_TYPE_OPTIONS = [
  { value: "Body Corp", label: "Body Corp" },
  { value: "Body Corp Company", label: "Body Corp Company" },
  { value: "Business & Gov", label: "Business & Gov" },
  { value: "Closed Real Estate", label: "Closed Real Estate" },
  { value: "School/Childcare", label: "School/Childcare" },
  { value: "Real Estate Agent", label: "Real Estate Agent" },
  { value: "Tenant to Pay", label: "Tenant to Pay" },
  { value: "Wildlife Rescue", label: "Wildlife Rescue" },
];

export const COMPANY_ANNUAL_REVENUE_OPTIONS = [
  { value: "> 100m", label: "> 100m" },
  { value: "50m - 100m", label: "50m - 100m" },
  { value: "20m - 50m", label: "20m - 50m" },
  { value: "5m - 20m", label: "5m - 20m" },
  { value: "1m - 5m", label: "1m - 5m" },
  { value: "< 1m", label: "< 1m" },
];

export const COMPANY_EMPLOYEE_COUNT_OPTIONS = [
  { value: "< 10", label: "< 10" },
  { value: "10 - 50", label: "10 - 50" },
  { value: "50 - 200", label: "50 - 200" },
  { value: "200 - 1000", label: "200 - 1000" },
  { value: "1000 +", label: "1000 +" },
];

export const INITIAL_FORM = {
  id: "",
  company_name: "",
  company_type: "",
  company_description: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_postal_code: "",
  company_industry: "",
  company_annual_revenue: "",
  company_number_of_employees: "",
  company_account_type: "",
  popup_comment: "",

  first_name: "",
  last_name: "",
  email: "",
  sms_number: "",

  lot_number: "",
  unit_number: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "AU",

  postal_address: "",
  postal_city: "",
  postal_state: "",
  postal_country: "AU",
  postal_code: "",
};

export const ADDRESS_TO_POSTAL_FIELD = {
  address: "postal_address",
  city: "postal_city",
  state: "postal_state",
  country: "postal_country",
  zip_code: "postal_code",
};
