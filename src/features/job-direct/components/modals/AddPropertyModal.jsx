import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleAddressLookup } from "../../../../shared/hooks/useGoogleAddressLookup.js";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { findPropertyByName } from "../../sdk/jobDirectSdk.js";

const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

const COUNTRY_OPTIONS = [{ value: "AU", label: "Australia" }];

const PROPERTY_TYPE_OPTIONS = [
  { value: "Residential", label: "Residential" },
  { value: "Commercial", label: "Commercial" },
  { value: "Industrial", label: "Industrial" },
];

const BUILDING_TYPE_OPTIONS = [
  { value: "House", label: "House" },
  { value: "Unit", label: "Unit" },
  { value: "Unit Block", label: "Unit Block" },
  { value: "Offices", label: "Offices" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Other", label: "Other" },
];

const FOUNDATION_TYPE_OPTIONS = [
  { value: "Slab on Ground", label: "Slab on Ground" },
  { value: "Lowset", label: "Lowset" },
  { value: "Highset", label: "Highset" },
];

const BEDROOM_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4+", label: "4+" },
];

const BUILDING_FEATURE_OPTIONS = [
  { value: "713", label: "Brick" },
  { value: "712", label: "Concrete" },
  { value: "711", label: "Flat Roof" },
  { value: "710", label: "Highset" },
  { value: "709", label: "Iron Roof" },
  { value: "708", label: "Lowset" },
  { value: "707", label: "PostWar" },
  { value: "706", label: "Queenslander" },
  { value: "705", label: "Raked Ceiling" },
  { value: "704", label: "Sloping Block" },
  { value: "703", label: "Super 6 / Fibro roof" },
  { value: "702", label: "Tile Roof" },
  { value: "701", label: "Town house" },
  { value: "700", label: "Unit Block" },
  { value: "699", label: "Warehouse" },
  { value: "698", label: "Wood" },
  { value: "697", label: "Wood & Brick" },
];

const BUILDING_FEATURE_LABEL_BY_VALUE = Object.fromEntries(
  BUILDING_FEATURE_OPTIONS.map((option) => [String(option.value), option.label])
);
const BUILDING_FEATURE_VALUE_BY_LABEL = Object.fromEntries(
  BUILDING_FEATURE_OPTIONS.map((option) => [String(option.label).trim().toLowerCase(), String(option.value)])
);

const INITIAL_FORM = {
  id: "",
  unique_id: "",
  property_name: "",
  lot_number: "",
  unit_number: "",
  address_1: "",
  address_2: "",
  suburb_town: "",
  postal_code: "",
  state: "",
  country: "AU",

  property_type: "",
  building_type: "",
  building_type_other: "",
  foundation_type: "",
  bedrooms: "",
  manhole: false,
  stories: "",
  building_age: "",
  building_features: [],
};

function trimValue(value) {
  return String(value || "").trim();
}

function normalizeBuildingFeatureValue(value) {
  const raw = trimValue(value);
  if (!raw) return "";

  if (BUILDING_FEATURE_LABEL_BY_VALUE[raw]) return raw;

  const fromLabel = BUILDING_FEATURE_VALUE_BY_LABEL[raw.toLowerCase()];
  if (fromLabel) return fromLabel;

  const idMatch = raw.match(/\d+/);
  if (idMatch && BUILDING_FEATURE_LABEL_BY_VALUE[idMatch[0]]) return idMatch[0];

  return "";
}

function extractFeatureTokens(value) {
  if (value === null || value === undefined) return [];

  const raw =
    typeof value === "object" && !Array.isArray(value)
      ? value.id || value.value || value.name || value.label || ""
      : value;
  const text = trimValue(raw);
  if (!text) return [];

  return text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => trimValue(item))
    .filter(Boolean);
}

function getBuildingFeatureLabel(value) {
  const normalizedValue = normalizeBuildingFeatureValue(value);
  if (!normalizedValue) return trimValue(value);
  return BUILDING_FEATURE_LABEL_BY_VALUE[normalizedValue] || normalizedValue;
}

function normalizeFeatures(features) {
  const tokens = Array.isArray(features)
    ? features.flatMap((item) => extractFeatureTokens(item))
    : typeof features === "string"
      ? extractFeatureTokens(features)
      : [];

  if (!tokens.length) return [];

  return Array.from(
    new Set(tokens.map((item) => normalizeBuildingFeatureValue(item)).filter(Boolean))
  );
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = trimValue(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function mapInitialDataToForm(initialData = null) {
  if (!initialData || typeof initialData !== "object") return { ...INITIAL_FORM };

  return {
    ...INITIAL_FORM,
    id: trimValue(initialData.id || initialData.ID || ""),
    unique_id: trimValue(initialData.unique_id || initialData.Unique_ID || ""),
    property_name: trimValue(
      initialData.property_name ||
        initialData.Property_Name ||
        initialData.Property_Property_Name ||
        ""
    ),
    lot_number: trimValue(initialData.lot_number || initialData.Lot_Number || ""),
    unit_number: trimValue(initialData.unit_number || initialData.Unit_Number || ""),
    address_1: trimValue(initialData.address_1 || initialData.Address_1 || initialData.address || ""),
    address_2: trimValue(initialData.address_2 || initialData.Address_2 || ""),
    suburb_town: trimValue(
      initialData.suburb_town || initialData.Suburb_Town || initialData.city || initialData.City || ""
    ),
    postal_code: trimValue(
      initialData.postal_code || initialData.Postal_Code || initialData.zip_code || initialData.Zip_Code || ""
    ),
    state: trimValue(initialData.state || initialData.State || ""),
    country: trimValue(initialData.country || initialData.Country || "AU") || "AU",
    property_type: trimValue(initialData.property_type || initialData.Property_Type || ""),
    building_type: trimValue(initialData.building_type || initialData.Building_Type || ""),
    building_type_other: trimValue(
      initialData.building_type_other || initialData.Building_Type_Other || ""
    ),
    foundation_type: trimValue(initialData.foundation_type || initialData.Foundation_Type || ""),
    bedrooms: trimValue(initialData.bedrooms || initialData.Bedrooms || ""),
    manhole: parseBoolean(initialData.manhole || initialData.Manhole),
    stories: trimValue(initialData.stories || initialData.Stories || ""),
    building_age: trimValue(initialData.building_age || initialData.Building_Age || ""),
    building_features: normalizeFeatures(
      initialData.building_features ||
        initialData.Building_Features ||
        initialData.building_features_options_as_text ||
        initialData.Building_Features_Options_As_Text ||
        []
    ),
  };
}

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        className={`flex w-full items-center justify-between bg-[color:var(--color-light)] px-4 py-3 text-left transition-colors hover:bg-[#eaf0f7] ${
          isOpen ? "rounded-t" : "rounded"
        }`}
        onClick={onToggle}
      >
        <span className="type-subheadline-2 text-slate-800">{title}</span>
        <span
          className={`inline-block text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}

export function AddPropertyModal({ open, onClose, onSave, initialData = null, plugin = null }) {
  const { error: showErrorToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [existingPropertyRecord, setExistingPropertyRecord] = useState(null);
  const [openSections, setOpenSections] = useState({
    information: true,
    description: true,
  });
  const existingLookupRef = useRef({
    requestKey: "",
    matchedId: "",
  });
  const isEditing = Boolean(initialData && Object.keys(initialData).length);

  useEffect(() => {
    if (!open) return;
    setIsSaving(false);
    setSaveError("");
    setOpenSections({ information: true, description: true });
    setExistingPropertyRecord(null);
    existingLookupRef.current = {
      requestKey: "",
      matchedId: "",
    };
    setForm(mapInitialDataToForm(initialData));
  }, [open, initialData]);

  useEffect(() => {
    if (!open || isEditing || !plugin?.switchTo) return undefined;

    const targetName = trimValue(form.property_name);
    if (!targetName) {
      setExistingPropertyRecord(null);
      if (existingLookupRef.current.matchedId) {
        existingLookupRef.current.matchedId = "";
        setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
      }
      return undefined;
    }

    existingLookupRef.current.requestKey = targetName.toLowerCase();
    const timeoutId = window.setTimeout(async () => {
      try {
        const matched = await findPropertyByName({ plugin, propertyName: targetName });
        if (existingLookupRef.current.requestKey !== targetName.toLowerCase()) return;
        const matchedId = trimValue(matched?.id || matched?.ID || matched?.Property_ID);
        if (!matchedId) {
          setExistingPropertyRecord(null);
          if (existingLookupRef.current.matchedId) {
            existingLookupRef.current.matchedId = "";
            setForm((previous) => (trimValue(previous.id) ? { ...previous, id: "" } : previous));
          }
          return;
        }
        existingLookupRef.current.matchedId = matchedId;
        setExistingPropertyRecord(matched);
        setForm((previous) => {
          if (trimValue(previous.id) === matchedId) return previous;
          const mapped = mapInitialDataToForm(matched);
          return {
            ...previous,
            ...mapped,
            property_name: trimValue(mapped.property_name || targetName) || targetName,
          };
        });
      } catch (lookupError) {
        if (existingLookupRef.current.requestKey !== targetName.toLowerCase()) return;
        console.error("[JobDirect] Property duplicate lookup failed", lookupError);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, isEditing, plugin, form.property_name]);

  const updateField = (field) => (event) => {
    const nextValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleAddressLookupSelected = useCallback((parsed) => {
    setForm((prev) => ({
      ...prev,
      property_name: parsed.formatted_address || prev.property_name,
      lot_number: parsed.lot_number || prev.lot_number,
      unit_number: parsed.unit_number || prev.unit_number,
      address_1: parsed.address || prev.address_1,
      suburb_town: parsed.city || prev.suburb_town,
      state: parsed.state || prev.state,
      postal_code: parsed.zip_code || prev.postal_code,
      country: "AU",
    }));
  }, []);

  const addressLookupRef = useGoogleAddressLookup({
    enabled: open,
    country: "au",
    onAddressSelected: handleAddressLookupSelected,
  });

  const toggleFeature = (featureValue) => {
    setForm((prev) => {
      const exists = prev.building_features.includes(featureValue);
      return {
        ...prev,
        building_features: exists
          ? prev.building_features.filter((feature) => feature !== featureValue)
          : [...prev.building_features, featureValue],
      };
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (typeof onSave !== "function") {
      onClose?.();
      return;
    }

    const payload = {
      id: trimValue(form.id),
      unique_id: trimValue(form.unique_id),
      property_name: trimValue(form.property_name),
      lot_number: trimValue(form.lot_number),
      unit_number: trimValue(form.unit_number),
      address_1: trimValue(form.address_1),
      address_2: trimValue(form.address_2),
      suburb_town: trimValue(form.suburb_town),
      postal_code: trimValue(form.postal_code),
      state: trimValue(form.state),
      country: trimValue(form.country),

      property_type: trimValue(form.property_type),
      building_type: trimValue(form.building_type),
      building_type_other: trimValue(form.building_type_other),
      foundation_type: trimValue(form.foundation_type),
      bedrooms: trimValue(form.bedrooms),
      manhole: Boolean(form.manhole),
      stories: trimValue(form.stories),
      building_age: trimValue(form.building_age),
      building_features: form.building_features,
    };

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(payload);
      onClose?.();
    } catch (error) {
      const message = error?.message || "Unable to save property right now.";
      setSaveError(message);
      showErrorToast("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Property" : "Add Property"}
      widthClass="max-w-6xl max-h-[calc(100vh-4rem)] my-8 overflow-hidden"
      footer={
        <div className="flex justify-end gap-2">
          {saveError ? (
            <div className="mr-auto self-center text-xs text-[color:var(--color-danger)]">{saveError}</div>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEditing ? "Update Property" : "Save Property"}
          </Button>
        </div>
      }
    >
      <div className="max-h-[calc(100vh-20rem)] space-y-4 overflow-y-auto pr-1">
        <AccordionSection
          title="Property Information"
          isOpen={openSections.information}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              information: !prev.information,
            }))
          }
        >
          <InputField
            label="Address Lookup"
            placeholder="Search address"
            inputRef={addressLookupRef}
            data-property-field="address_lookup"
          />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <InputField
                label="Property Name"
                value={form.property_name}
                onChange={updateField("property_name")}
                data-property-field="property_name"
              />
              {!isEditing && trimValue(existingPropertyRecord?.id || existingPropertyRecord?.ID) ? (
                <div className="mt-1 text-xs text-amber-700">
                  This property already exists. Saving will update the existing property.
                </div>
              ) : null}
            </div>
            <InputField
              label="Lot Number"
              value={form.lot_number}
              onChange={updateField("lot_number")}
              data-property-field="lot_number"
            />
            <InputField
              label="Unit Number"
              value={form.unit_number}
              onChange={updateField("unit_number")}
              data-property-field="unit_number"
            />
            <InputField
              label="Address 1"
              value={form.address_1}
              onChange={updateField("address_1")}
              className="md:col-span-2"
              data-property-field="address_1"
            />
            <InputField
              label="Address 2"
              value={form.address_2}
              onChange={updateField("address_2")}
              className="md:col-span-2"
              data-property-field="address_2"
            />
            <InputField
              label="Suburb/Town"
              value={form.suburb_town}
              onChange={updateField("suburb_town")}
              data-property-field="suburb_town"
            />
            <InputField
              label="Postal Code"
              value={form.postal_code}
              onChange={updateField("postal_code")}
              data-property-field="postal_code"
            />
            <SelectField
              label="State"
              options={STATE_OPTIONS}
              value={form.state}
              onChange={updateField("state")}
              data-property-field="state"
            />
            <SelectField
              label="Country"
              options={COUNTRY_OPTIONS}
              value={form.country}
              onChange={updateField("country")}
              data-property-field="country"
            />
          </div>
        </AccordionSection>

        <AccordionSection
          title="Property Description"
          isOpen={openSections.description}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              description: !prev.description,
            }))
          }
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <SelectField
                label="Property Type"
                options={PROPERTY_TYPE_OPTIONS}
                value={form.property_type}
                onChange={updateField("property_type")}
                data-property-field="property_type"
              />
              <SelectField
                label="Building Type"
                options={BUILDING_TYPE_OPTIONS}
                value={form.building_type}
                onChange={updateField("building_type")}
                data-property-field="building_type"
              />
              <InputField
                label="Building Type: Other"
                value={form.building_type_other}
                onChange={updateField("building_type_other")}
                data-property-field="building_type_other"
              />
              <SelectField
                label="Foundation Type"
                options={FOUNDATION_TYPE_OPTIONS}
                value={form.foundation_type}
                onChange={updateField("foundation_type")}
                data-property-field="foundation_type"
              />
              <SelectField
                label="Bedrooms"
                options={BEDROOM_OPTIONS}
                value={form.bedrooms}
                onChange={updateField("bedrooms")}
                data-property-field="bedrooms"
              />
              <CheckboxField
                label="Manhole"
                checked={form.manhole}
                onChange={updateField("manhole")}
                data-property-field="manhole"
              />
              <InputField
                label="Stories"
                value={form.stories}
                onChange={updateField("stories")}
                data-property-field="stories"
              />
              <InputField
                label="Building Age"
                value={form.building_age}
                onChange={updateField("building_age")}
                data-property-field="building_age"
              />
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 text-sm font-semibold text-neutral-700">Building Features</div>
              <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {BUILDING_FEATURE_OPTIONS.map((option) => {
                    const checked = form.building_features.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-2 text-sm ${
                          checked
                            ? "border-sky-700 bg-sky-50 text-sky-900"
                            : "border-slate-200 bg-white text-neutral-700 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(option.value)}
                          className="h-4 w-4 accent-[#003882]"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {form.building_features.length ? (
                <div className="mt-2 text-xs text-slate-500">
                  Selected:{" "}
                  {form.building_features.map((feature) => getBuildingFeatureLabel(feature)).join(", ")}
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">No building features selected.</div>
              )}
              <div className="sr-only">
                {form.building_features.map((feature) => (
                  <span key={feature} data-property-field="building_feature_selected">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AccordionSection>
      </div>
    </Modal>
  );
}
