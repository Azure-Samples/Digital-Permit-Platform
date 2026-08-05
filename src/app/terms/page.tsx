import Link from "next/link";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";

export default function TermsPage() {
  return (
    <>
      <GovHeader navigation={getNavigationForRole(null, "/terms")} />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Terms</li>
            </ol>
          </nav>

          <h1>Terms and conditions</h1>
          <div className="govuk-warning-text" role="note">
            <strong>Sample terms:</strong> an adopting organisation must replace
            these with approved service terms and statutory information.
          </div>

          <h2>Reference implementation</h2>
          <p>
            This environment demonstrates software capabilities using synthetic
            data. It is not an official application channel and does not grant,
            vary, renew, suspend, or revoke any real licence or permit.
          </p>

          <h2>No legal advice</h2>
          <p>
            Guidance and AI-generated content can be incomplete or wrong. Users
            must check authoritative legislation, policy, application guidance,
            and instructions from the responsible authority.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Do not upload real personal information, malicious content, secrets,
            or material you are not authorised to use. Do not attempt to bypass
            access controls, disrupt the service, or rely on sample decisions.
          </p>

          <h2>Production action</h2>
          <p>
            Publish approved terms covering official service status,
            availability, account responsibilities, evidence, payments,
            communications, intellectual property, acceptable use, liability,
            complaints, governing law, and contact routes.
          </p>
        </div>
      </main>
      <GovFooter />
    </>
  );
}