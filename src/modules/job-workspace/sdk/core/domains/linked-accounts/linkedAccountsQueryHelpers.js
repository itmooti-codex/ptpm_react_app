export function resolveLinkedAccountType(accountType) {
  const normalizedType = String(accountType || "").trim().toLowerCase();
  return normalizedType === "company" || normalizedType === "entity" ? "Company" : "Contact";
}

export function resolveLinkedAccountModelName(accountType) {
  return resolveLinkedAccountType(accountType) === "Company"
    ? "PeterpmCompany"
    : "PeterpmContact";
}

export const LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS = 8000;
export const LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS = 5000;

export function buildLinkedDealsFallbackQuery(accountType) {
  const resolvedType = resolveLinkedAccountType(accountType);
  return resolvedType === "Company"
    ? `
      query calcCompanies($id: PeterpmCompanyID!) {
        calcCompanies(query: [{ where: { id: $id } }]) {
          Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
          DealsID: field(arg: ["Deals", "id"])
          Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
          Deals_Inquiry_Status: field(arg: ["Deals", "inquiry_status"])
        }
      }
    `
    : `
      query calcContacts($id: PeterpmContactID!) {
        calcContacts(query: [{ where: { id: $id } }]) {
          Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
          DealsID: field(arg: ["Deals", "id"])
          Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
          Deals_Inquiry_Status: field(arg: ["Deals", "inquiry_status"])
        }
      }
    `;
}

export function buildLinkedJobsFallbackQuery(accountType) {
  const resolvedType = resolveLinkedAccountType(accountType);
  return resolvedType === "Company"
    ? `
      query calcCompanies($id: PeterpmCompanyID!) {
        calcCompanies(query: [{ where: { id: $id } }]) {
          JobsID: field(arg: ["Jobs", "id"])
          Jobs_Unique_ID: field(arg: ["Jobs", "unique_id"])
          Jobs_Job_Status: field(arg: ["Jobs", "job_status"])
          Jobs_Quote_Status: field(arg: ["Jobs", "quote_status"])
          Property_Property_Name: field(arg: ["Jobs", "Property", "property_name"])
          Property_Unique_ID: field(arg: ["Jobs", "Property", "unique_id"])
          Property_Address_1: field(arg: ["Jobs", "Property", "address_1"])
          Property_Suburb_Town: field(arg: ["Jobs", "Property", "suburb_town"])
          Property_State: field(arg: ["Jobs", "Property", "state"])
        }
      }
    `
    : `
      query calcContacts($id: PeterpmContactID!) {
        calcContacts(query: [{ where: { id: $id } }]) {
          Jobs_As_Client_IndividualID: field(arg: ["Jobs_As_Client_Individual", "id"])
          Jobs_As_Client_Individual_Unique_ID: field(arg: ["Jobs_As_Client_Individual", "unique_id"])
          Jobs_As_Client_Individual_Job_Status: field(arg: ["Jobs_As_Client_Individual", "job_status"])
          Jobs_As_Client_Individual_Quote_Status: field(arg: ["Jobs_As_Client_Individual", "quote_status"])
          Property_Property_Name: field(arg: ["Jobs_As_Client_Individual", "Property", "property_name"])
          Property_Unique_ID: field(arg: ["Jobs_As_Client_Individual", "Property", "unique_id"])
          Property_Address_1: field(arg: ["Jobs_As_Client_Individual", "Property", "address_1"])
          Property_Suburb_Town: field(arg: ["Jobs_As_Client_Individual", "Property", "suburb_town"])
          Property_State: field(arg: ["Jobs_As_Client_Individual", "Property", "state"])
        }
      }
    `;
}

export function buildLinkedPropertiesFallbackQuery(accountType) {
  const resolvedType = resolveLinkedAccountType(accountType);
  return resolvedType === "Company"
    ? `
      query getCompany($id: PeterpmCompanyID!) {
        getCompany(query: [{ where: { id: $id } }]) {
          Properties {
            id
            unique_id
            property_name
            lot_number
            unit_number
            address_1
            address_2
            address
            city
            suburb_town
            postal_code
            zip_code
            state
            country
            property_type
            building_type
            building_type_other
            foundation_type
            bedrooms
            manhole
            stories
            building_age
            building_features
            building_features_options_as_text
          }
        }
      }
    `
    : `
      query getContact($id: PeterpmContactID!) {
        getContact(query: [{ where: { id: $id } }]) {
          Properties {
            id
            unique_id
            property_name
            lot_number
            unit_number
            address_1
            address_2
            address
            city
            suburb_town
            postal_code
            zip_code
            state
            country
            property_type
            building_type
            building_type_other
            foundation_type
            bedrooms
            manhole
            stories
            building_age
            building_features
            building_features_options_as_text
          }
        }
      }
    `;
}
