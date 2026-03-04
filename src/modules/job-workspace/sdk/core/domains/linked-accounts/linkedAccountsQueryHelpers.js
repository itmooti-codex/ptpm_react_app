export function resolveLinkedAccountType(accountType) {
  const normalizedType = String(accountType || "").trim().toLowerCase();
  return normalizedType === "company" || normalizedType === "entity" ? "Company" : "Contact";
}

export function resolveLinkedAccountModelName(accountType) {
  return resolveLinkedAccountType(accountType) === "Company"
    ? "PeterpmCompany"
    : "PeterpmContact";
}

export const LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS = 7000;
export const LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS = 4500;

export function buildLinkedDealsFallbackQuery(accountType) {
  const resolvedType = resolveLinkedAccountType(accountType);
  return resolvedType === "Company"
    ? `
      query calcCompanies($id: PeterpmCompanyID!) {
        calcCompanies(query: [{ where: { id: $id } }]) {
          Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
          DealsID: field(arg: ["Deals", "id"])
          Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
        }
      }
    `
    : `
      query calcContacts($id: PeterpmContactID!) {
        calcContacts(query: [{ where: { id: $id } }]) {
          Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
          DealsID: field(arg: ["Deals", "id"])
          Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
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
          Property_Property_Name: field(arg: ["Jobs", "Property", "property_name"])
        }
      }
    `
    : `
      query calcContacts($id: PeterpmContactID!) {
        calcContacts(query: [{ where: { id: $id } }]) {
          Jobs_As_Client_IndividualID: field(arg: ["Jobs_As_Client_Individual", "id"])
          Jobs_As_Client_Individual_Unique_ID: field(arg: ["Jobs_As_Client_Individual", "unique_id"])
          Property_Property_Name: field(arg: ["Jobs_As_Client_Individual", "Property", "property_name"])
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
