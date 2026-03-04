export const APPOINTMENT_JOB_SELECT_FIELDS = [
  "id",
  "status",
  "type",
  "title",
  "description",
  "start_time",
  "end_time",
  "event_colour",
  "duration_hours",
  "duration_minutes",
  "job_id",
  "location_id",
  "host_id",
  "primary_guest_id",
];

export const APPOINTMENT_INQUIRY_SELECT_FIELDS = [
  ...APPOINTMENT_JOB_SELECT_FIELDS,
  "inquiry_id",
];

export function applyAppointmentIncludes(query) {
  return query
    .include("Location", (locationQuery) =>
      locationQuery.deSelectAll().select(["id", "property_name"])
    )
    .include("Host", (hostQuery) =>
      hostQuery
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (contactQuery) =>
          contactQuery
            .deSelectAll()
            .select(["first_name", "last_name", "email", "sms_number"])
        )
    )
    .include("Primary_Guest", (guestQuery) =>
      guestQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    );
}

export function buildInquiryAppointmentsFallbackQuery() {
  return `
    query calcAppointments($unique_id: StringScalar_0_8!) {
      calcAppointments(
        query: [
          {
            where: {
              Inquiry: [{ where: { unique_id: $unique_id } }]
            }
          }
        ]
      ) {
        ID: field(arg: ["id"])
        Status: field(arg: ["status"])
        Type: field(arg: ["type"])
        Title: field(arg: ["title"])
        Description: field(arg: ["description"])
        Start_Time: field(arg: ["start_time"])
        End_Time: field(arg: ["end_time"])
        Duration_Hours: field(arg: ["duration_hours"])
        Duration_Minutes: field(arg: ["duration_minutes"])
        Event_Colour: field(arg: ["event_colour"])
        Job_ID: field(arg: ["job_id"])
        Inquiry_ID: field(arg: ["inquiry_id"])
        Location_ID: field(arg: ["location_id"])
        Host_ID: field(arg: ["host_id"])
        Primary_Guest_ID: field(arg: ["primary_guest_id"])
        Location_Property_Name: field(arg: ["Location", "property_name"])
        Host_Contact_Information_First_Name: field(
          arg: ["Host", "Contact_Information", "first_name"]
        )
        Host_Contact_Information_Last_Name: field(
          arg: ["Host", "Contact_Information", "last_name"]
        )
        Primary_Guest_First_Name: field(arg: ["Primary_Guest", "first_name"])
        Primary_Guest_Last_Name: field(arg: ["Primary_Guest", "last_name"])
      }
    }
  `;
}
