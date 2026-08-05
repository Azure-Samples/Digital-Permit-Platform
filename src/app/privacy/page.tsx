import Link from "next/link";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";

export default function PrivacyPage() {
  return (
    <>
      <GovHeader navigation={getNavigationForRole(null, "/privacy")} />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Privacy</li>
            </ol>
          </nav>

          <h1>Privacy notice</h1>
          <div className="govuk-warning-text" role="note">
            <strong>Sample notice:</strong> this is not a valid privacy notice
            for a real authority or production service.
          </div>

          <p>
            The accelerator uses fictional Contoso data for demonstration. Do
            not enter real personal, payment, medical, criminal-record, or
            identity data into an unassessed sample environment.
          </p>

          <h2>Data a real service may process</h2>
          <p>
            Applications can include contact details, addresses, identity and
            eligibility evidence, business or premises information, payments,
            officer notes, decisions, messages, uploaded documents, audit data,
            and optional AI prompts and responses.
          </p>

          <h2>What an adopting organisation must publish</h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>the data controller and data-protection contact;</li>
            <li>purposes and lawful bases for each licence or permit;</li>
            <li>required and optional data, including special-category data;</li>
            <li>recipients, processors, locations, and international transfers;</li>
            <li>retention and deletion rules for records, documents, logs, and AI conversations;</li>
            <li>individual rights, complaint routes, and automated-decision information;</li>
            <li>cookie, session, and telemetry use;</li>
            <li>how optional AI processing affects the service.</li>
          </ul>

          <h2>Production action</h2>
          <p>
            Complete a data inventory, lawful-basis review, records of processing,
            retention schedule, security assessment, and DPIA where required.
            Configure the platform to collect only approved data before launch.
          </p>
        </div>
      </main>
      <GovFooter />
    </>
  );
}