export const LICENCE_TEMPLATE_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_LICENCE_TEMPLATE_FILE_SIZE_MB = 5;
export const STANDARD_LICENCE_TEMPLATE_ID = "standard";
export const STANDARD_LICENCE_TEMPLATE_PATH =
  "public/templates/standard-licence.docx";

export interface TemplatePlaceholder {
  key: string;
  label: string;
  description: string;
}

export const SYSTEM_TEMPLATE_PLACEHOLDERS: TemplatePlaceholder[] = [
  {
    key: "council_name",
    label: "Council name",
    description: "The configured licensing authority name",
  },
  {
    key: "service_name",
    label: "Service name",
    description: "The configured licensing service name",
  },
  {
    key: "licence_type",
    label: "Licence type",
    description: "The licence or permit type for this application",
  },
  {
    key: "licence_number",
    label: "Licence number",
    description: "The unique number generated when the document is issued",
  },
  {
    key: "application_reference",
    label: "Application reference",
    description: "The applicant's case reference",
  },
  {
    key: "application_type",
    label: "Application type",
    description: "For example, New, Renewal, Variation, or Transfer",
  },
  {
    key: "issue_date",
    label: "Issue date",
    description: "The date the document is generated, in DD/MM/YYYY format",
  },
  {
    key: "expiry_date",
    label: "Expiry date",
    description: "The calculated expiry date, in DD/MM/YYYY format",
  },
  {
    key: "applicant_name",
    label: "Applicant name",
    description: "The applicant or licence holder's full name",
  },
  {
    key: "applicant_address",
    label: "Applicant address",
    description: "The applicant's address, formatted on separate lines",
  },
  {
    key: "support_email",
    label: "Support email",
    description: "The configured licensing service email address",
  },
  {
    key: "support_phone",
    label: "Support phone",
    description: "The configured licensing service phone number",
  },
];