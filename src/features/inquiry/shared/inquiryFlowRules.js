const INQUIRY_RULES_BY_TYPE = {
  "General Inquiry": {
    showServiceInquiry: false,
    showPropertySearch: false,
    showHowCanWeHelp: true,
    showHowDidYouHear: true,
  },
  "Service Request or Quote": {
    showServiceInquiry: true,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: true,
  },
  "Product or Service Information": {
    showServiceInquiry: true,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: true,
  },
  "Customer Support or Technical Assistance": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: false,
  },
  "Billing and Payment": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: false,
  },
  "Appointment Scheduling or Rescheduling": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: false,
  },
  "Feedback or Suggestions": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: false,
  },
  "Partnership or Collaboration Inquiry": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: false,
    showHowDidYouHear: true,
  },
  "Job Application or Career Opportunities": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: false,
    showHowDidYouHear: true,
  },
  "Complaint or Issue Reporting": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: true,
    showHowDidYouHear: false,
  },
  "Media or Press Inquiry": {
    showServiceInquiry: false,
    showPropertySearch: true,
    showHowCanWeHelp: false,
    showHowDidYouHear: true,
  },
};

const DEFAULT_RULE = {
  showServiceInquiry: false,
  showPropertySearch: false,
  showHowCanWeHelp: true,
  showHowDidYouHear: true,
};

export function getInquiryFlowRule(typeValue = "") {
  const normalized = String(typeValue || "").trim();
  if (!normalized) return DEFAULT_RULE;
  return INQUIRY_RULES_BY_TYPE[normalized] || DEFAULT_RULE;
}

export function shouldShowOtherSourceField(howDidYouHear = "") {
  return String(howDidYouHear || "").trim().toLowerCase() === "other";
}
