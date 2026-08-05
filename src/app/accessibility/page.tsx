import Link from "next/link";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";

export default function AccessibilityPage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "licensing@contoso.gov.uk";

  return (
    <>
      <GovHeader navigation={getNavigationForRole(null, "/accessibility")} />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Accessibility</li>
            </ol>
          </nav>

          <h1>Accessibility statement</h1>
          <div className="govuk-warning-text" role="note">
            <strong>Sample statement:</strong> an adopting organisation must
            replace this page after completing an accessibility audit.
          </div>

          <p>
            This reference implementation aims to be usable with a keyboard,
            screen reader, text zoom, and common assistive technologies. It has
            not been certified as conforming to WCAG 2.2 AA or the GOV.UK Design
            System.
          </p>

          <h2>Known limitations</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Complex dynamic forms require full assistive-technology testing.</li>
            <li>Generated DOCX and uploaded PDF accessibility is not guaranteed.</li>
            <li>The administrator builder has not completed production usability research.</li>
            <li>Third-party identity, payment, and AI interfaces are outside this assessment.</li>
          </ul>

          <h2>Report an accessibility problem</h2>
          <p>
            For this sample environment, contact{" "}
            <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>. Do not
            include passwords, identity documents, health information, or other
            personal data in an email.
          </p>

          <h2>Before production use</h2>
          <p>
            Complete automated and manual WCAG 2.2 AA testing, research with
            users who have access needs, an accessible-document review, and the
            organisation&apos;s required enforcement and escalation process. Publish
            the tested scope, non-compliances, alternatives, and remediation dates.
          </p>
        </div>
      </main>
      <GovFooter />
    </>
  );
}