export const UPLOAD_FILTER_TABS = ["all", "photo", "file", "forms"];
export const UPLOADS_CACHE_TTL_MS = 5 * 60 * 1000;
export const UPLOADS_CACHE_KEY_PREFIX = "ptpm:uploads-section:v1:";
export const PRESTART_FORM_KIND = "prestart";
export const PCA_FORM_KIND = "pca";
export const PRESTART_ACTIVITY_OPTIONS = [
  "Rat Treatment to Ceiling",
  "Possum Proofing to Roof or Floors",
  "Turkey Trapping",
  "Pigeon Proofing",
  "Dead removal",
  "Other",
];
export const PRESTART_CHECKBOX_FIELDS = [
  "f_1_driving_vehicles_on_or_off_roads",
  "f_2_hazardous_chemicals",
  "f_3_non_powered_hand_tools",
  "f_4_powered_hand_tools",
  "f_5_removing_dead_animals",
  "f_6_towing_a_trailer",
  "f_7_use_of_portable_ladders",
  "f_8_working_alone_or_remote",
  "f_9_working_at_heights_using_an_ewp",
  "f_10_working_at_heights",
  "pedestrian_traffic",
  "ground_conditions",
  "asbestos",
  "roof_condition",
  "aboveground_services_inc_powerlines",
  "pets_dangerous_wildlife",
  "weather_storm_rain_hot_cold_or_wind",
  "moisture",
  "degradation",
  "dust",
  "pitch",
  "plan_and_equipment_checked_for_faults",
  "do_you_have_the_right_ppe_for_the_task",
  "ppe_checked_for_faaults_damage_defacts",
  "acknowledgement",
];
export const PRESTART_TEXT_FIELDS = ["write_your_name", "potential_hazard", "action_control"];
export const PCA_CHECKBOX_FIELDS = [
  "rodents",
  "f_1_ramik_50mg_kg_diphacinone",
  "f_2_sorexa_blocks_0_005g_kg_difenacoum",
  "f_3_generation_block_0_025g_kg_difethialone",
  "f_4_first_formula_0_005_brodifacoum",
  "f_5_racumin_0_37_coumateralyl",
  "f_6_alphachloralose",
  "f_7_country_permethrin_1_permethrin",
  "f_8_dragnet_2_permethrin",
  "f_9_sorexa_sachets_0_005g_kg_difenacoum",
  "f_10_contrac_0_005_bromodiolone",
  "f_11_ditrac_0_005_brodifacoum",
  "f_12_biforce_100gm_l_bifenthrin",
];
export const PCA_NUMBER_FIELDS = [
  "rodenticide_blocks_grams",
  "rodenticide_pellets_grams",
  "redenticide_satchets_grams",
  "insecticide_powder_grams",
  "ceiling_void_s",
  "external_walls",
  "garage",
  "kitchen",
  "between_floors",
  "plastic_bait_station_under_house",
];
export const PCA_TEXT_FIELDS = [
  "plastic_bait_station_where_and_number",
  "other_place_description_and_number",
  "other_pest",
  "technicians_comments",
];
export const PCA_DATETIME_FIELDS = ["time_sent_to_occupant_owner"];
export const FORM_KIND_CONFIG = {
  [PRESTART_FORM_KIND]: {
    kind: PRESTART_FORM_KIND,
    title: "Prestart Form",
    shortLabel: "Prestart",
    checkboxFields: PRESTART_CHECKBOX_FIELDS,
    numberFields: [],
    textFields: PRESTART_TEXT_FIELDS,
    datetimeFields: [],
    multilineTextFields: ["potential_hazard", "action_control"],
    includeActivityDescription: true,
  },
  [PCA_FORM_KIND]: {
    kind: PCA_FORM_KIND,
    title: "Pest Control Advice Form",
    shortLabel: "PCA",
    checkboxFields: PCA_CHECKBOX_FIELDS,
    numberFields: PCA_NUMBER_FIELDS,
    textFields: PCA_TEXT_FIELDS,
    datetimeFields: PCA_DATETIME_FIELDS,
    multilineTextFields: ["other_place_description_and_number", "technicians_comments"],
    includeActivityDescription: false,
  },
};
