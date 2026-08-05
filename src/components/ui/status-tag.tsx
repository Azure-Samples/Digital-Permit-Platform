import type { ApplicationStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "govuk-tag govuk-tag--grey" },
  SUBMITTED: { label: "Submitted", className: "govuk-tag" },
  AWAITING_PAYMENT: {
    label: "Awaiting payment",
    className: "govuk-tag govuk-tag--yellow",
  },
  AWAITING_DOCUMENTS: {
    label: "Awaiting documents",
    className: "govuk-tag govuk-tag--yellow",
  },
  UNDER_REVIEW: {
    label: "Under review",
    className: "govuk-tag govuk-tag--purple",
  },
  AWAITING_INSPECTION: {
    label: "Awaiting inspection",
    className: "govuk-tag govuk-tag--orange",
  },
  AWAITING_CONSULTATION: {
    label: "Awaiting consultation",
    className: "govuk-tag govuk-tag--orange",
  },
  AWAITING_HEARING: {
    label: "Awaiting hearing",
    className: "govuk-tag govuk-tag--orange",
  },
  APPROVED: { label: "Approved", className: "govuk-tag govuk-tag--green" },
  REFUSED: { label: "Refused", className: "govuk-tag govuk-tag--red" },
  WITHDRAWN: { label: "Withdrawn", className: "govuk-tag govuk-tag--grey" },
  INCOMPLETE: {
    label: "Incomplete",
    className: "govuk-tag govuk-tag--yellow",
  },
  RETURNED: { label: "Returned", className: "govuk-tag govuk-tag--yellow" },
  CANCELLED: { label: "Cancelled", className: "govuk-tag govuk-tag--grey" },
};

export function StatusTag({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "govuk-tag",
  };
  return <span className={config.className}>{config.label}</span>;
}
