import Link from "next/link";
import { Sparkles, ShieldCheck, Users, Clock } from "lucide-react";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { getSessionOrNull } from "@/lib/permissions";
import { ApplicantAssistant } from "@/components/ai/applicant-assistant";
import { isAiConfigured } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSessionOrNull();
  const user = session?.user;
  const aiReady = isAiConfigured();

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal"
        navigation={getNavigationForRole(user?.role, "/help")}
        userName={user?.name}
        userRole={user?.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Licensing help</li>
            </ol>
          </nav>

          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-govuk-blue" />
            <h1 className="!mb-0">Licensing help assistant</h1>
          </div>
          <p className="text-govuk-dark-grey max-w-3xl mb-6">
            {aiReady
              ? "Plain-language answers about licensing for your business, grounded in the configured licensing policy."
              : "The optional AI licensing assistant is not enabled in this environment."}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {aiReady ? (
                <ApplicantAssistant />
              ) : (
                <div className="govuk-warning-text" role="status">
                  <strong>Assistant unavailable.</strong> Browse the licence
                  catalogue for application requirements or contact the licensing
                  team for authoritative guidance.
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="bg-white border border-govuk-mid-grey p-4">
                <h2 className="!text-govuk-s">Popular topics</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <Users className="h-5 w-5 text-govuk-blue shrink-0" />
                    Training new staff to sell alcohol
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="h-5 w-5 text-govuk-blue shrink-0" />
                    Challenge 25 and accepting ID
                  </li>
                  <li className="flex gap-2">
                    <Clock className="h-5 w-5 text-govuk-blue shrink-0" />
                    Your licensing hours and conditions
                  </li>
                </ul>
              </div>

              <div className="bg-[#eef6fb] border-l-4 border-govuk-blue p-4 text-sm">
                <p className="font-bold mb-1">Need to apply?</p>
                <p className="mb-2">
                  Browse licences and start an application online.
                </p>
                <Link href="/licences" className="text-govuk-blue">
                  See all licences →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
