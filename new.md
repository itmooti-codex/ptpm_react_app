Announcements

On load we fetch announcements using following query and conditions

query calcAnnouncements(
  $notified_contact_id: PeterpmContactID!
) {
  calcAnnouncements(
    query: [
      {
        where: { notified_contact_id: $notified_contact_id }
      }
      { andWhere: { status: "Published" } }
    ]
  ) {
    ID: field(arg: ["id"])
    Status: field(arg: ["status"])
    Title: field(arg: ["title"])
    Publish_Date_Time: field(arg: ["publish_date_time"])
    Type: field(arg: ["type"])
    Content: field(arg: ["content"])
    Quote_Job_ID: field(arg: ["quote_job_id"])
    Inquiry_ID: field(arg: ["inquiry_id"])
    Comment_ID: field(arg: ["comment_id"])
    Post_ID: field(arg: ["post_id"])
    Notified_Contact_ID: field(arg: ["notified_contact_id"])
    Is_Read: field(arg: ["is_read"])

Extra_id: field(arg: ["Extra_id"])
  }
}

For field dropdowns option, check below

query getAnnouncements {
  getAnnouncements{
    id
    status

# options for status are

# Draft

# Published

# Archived

    title
    publish_date_time
    type

# options for type are

# Inquiry

# Comment

# Post

# Quote/Job

# Appointment

# Activity

    content
    quote_job_id
    inquiry_id
    comment_id
    post_id
    notified_contact_id
    is_read

extra_id
  }
}

Now we need to identfify every point in this whole app which can be used to create announcements. For example

1) New inquiry created
2) New quote created
3) Quote sent
4) Quote accepted
5) Payment states
6) Post/Comment created
7) Activity added
8) Material added
9) Appointment scheduled
10) Appointment completed
11) Tasks added
12) Task completed
13) Uploads added

You will very deeply scan this project and figure out every point where we need to create announcements

Then we will use following query to create annoucnement

mutation createAnnouncement(
  $payload: AnnouncementCreateInput = null
) {
  createAnnouncement(payload: $payload) {
    id
    status
    title
    publish_date_time
    type
    content
    quote_job_id
    inquiry_id
    comment_id
    post_id
    notified_contact_id
    is_read

extra_id
  }
}

here based on how announcement is created, we send type and respective id

Lets say a new inquiry is created, we create announcement with Type Inquiry and send this inquiry id to inquiry_id

Now we need to send notified contact id each time we create announcement and this is basically service provider

This would also mean we don't actually have to create announcement unless we have service provider related to the trigger

So we can skip new inquiry creation but as soon as service provider is allocated, we create announcemnt along with service provider id

This goes for everything.

All activities, material, uploads, appointment, property, they all are within job or deal and job or deal would have service provider. so we would use that service provider id

Now notified contact id does not actually take service provider id but the contact id of the service provider

Service Provider and Contact table are in 1 to 1 relationship

We can get contact id of service provider

query calcServiceProviders($id: PeterpmServiceProviderID!) {
  calcServiceProviders(query: [{ where: { id: $id } }]) {
    Contact_Information_ID: field(
      arg: ["contact_information_id"]
    )
  }
}

This contact information id is what we send tin notified contact id

Next thing we need to implment is click behavior on announcemnt record. We mark them as complete but now we also need to take user to respective place. So, lets say user is notified a new inquiry is allocated to you. Then when they clcik on it, they can be taken to details page of that inquiry
Simialry if they are notified about activity, we can take to the deatils page where that activity was created, switch to activity tab and mayve even hoghlight the activity id. for such cases, we can use extra_id field to hold such ids. we already have post or inquiry or job or comment id in our queyr but dont have for materiasl or uploads or activity or taslk. so on create, we can use extra id field to populate ids. This is to just ensure user can properly navigate to the record from annoucnement

In this project, annoucnement, notification and alert mean exactly same thing

for type also, use Activity when it is Activity, Material, Uploads or Tasks

Be creative on title and content

Now we check notified contact id to fetch notification. And we need that somewhere in our frontnend app to check against. USe id from user config.js file
