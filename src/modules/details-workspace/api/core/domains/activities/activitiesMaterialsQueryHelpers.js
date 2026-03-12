export const ACTIVITY_RECORD_SELECT_FIELDS = [
  "id",
  "service_id",
  "task",
  "option",
  "quantity",
  "activity_price",
  "activity_text",
  "activity_status",
  "status",
  "date_required",
  "quoted_price",
  "quoted_text",
  "note",
  "warranty",
  "include_in_quote_subtotal",
  "include_in_quote",
  "invoice_to_client",
  "quote_accepted",
];

export const MATERIAL_RECORD_SELECT_FIELDS = [
  "id",
  "material_name",
  "status",
  "total",
  "tax",
  "description",
  "created_at",
  "transaction_type",
  "service_provider_id",
  "file",
  "receipt",
];

export const ACTIVITY_SERVICE_SELECT_FIELDS = [
  "id",
  "service_name",
  "service_description",
  "description",
  "Price_Guide",
  "service_price",
  "standard_warranty",
  "primary_service_id",
  "service_type",
];

export function applyActivityServiceInclude(query) {
  return query.include("Service", (serviceQuery) =>
    serviceQuery
      .deSelectAll()
      .select(["id", "service_name"])
      .include("Primary_Service", (psQuery) =>
        psQuery.deSelectAll().select(["id", "service_name"])
      )
  );
}

export function applyMaterialProviderInclude(query) {
  return query.include("Service_Provider", (providerQuery) =>
    providerQuery
      .deSelectAll()
      .select(["id"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
  );
}
