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

export const COUNTRY_OPTIONS = [{ value: "AU", label: "Australia" }];

export const PROPERTY_TYPE_OPTIONS = [
  { value: "Residential", label: "Residential" },
  { value: "Commercial", label: "Commercial" },
  { value: "Industrial", label: "Industrial" },
];

export const BUILDING_TYPE_OPTIONS = [
  { value: "House", label: "House" },
  { value: "Unit", label: "Unit" },
  { value: "Unit Block", label: "Unit Block" },
  { value: "Offices", label: "Offices" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Other", label: "Other" },
];

export const FOUNDATION_TYPE_OPTIONS = [
  { value: "Slab on Ground", label: "Slab on Ground" },
  { value: "Lowset", label: "Lowset" },
  { value: "Highset", label: "Highset" },
];

export const BEDROOM_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4+", label: "4+" },
];

export const BUILDING_FEATURE_OPTIONS = [
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

export const BUILDING_FEATURE_LABEL_BY_VALUE = Object.fromEntries(
  BUILDING_FEATURE_OPTIONS.map((option) => [String(option.value), option.label])
);
export const BUILDING_FEATURE_VALUE_BY_LABEL = Object.fromEntries(
  BUILDING_FEATURE_OPTIONS.map((option) => [String(option.label).trim().toLowerCase(), String(option.value)])
);

export const INITIAL_FORM = {
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
