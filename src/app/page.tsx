import Link from "next/link";
import { GovHeader, getNavigationForRole, } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { getSessionOrNull } from "@/lib/permissions";
import { Car, Wine, PawPrint, Store, Dice5, ClipboardList, Accessibility, Mail, Phone, Clock, Sparkles, Languages } from "lucide-react";
import { AppTour } from "@/components/tour/app-tour";
import { TourLauncher } from "@/components/tour/tour-launcher";
import { isAiConfigured } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionOrNull();
  const user = session?.user;
  const isStaff = user?.role && user.role !== "APPLICANT";
  const appName =
    process.env.NEXT_PUBLIC_APP_NAME || "Digital Permit Platform";
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "licensing@contoso.gov.uk";
  const supportPhone =
    process.env.NEXT_PUBLIC_SUPPORT_PHONE || "0345 678 9000";
  const aiReady = isAiConfigured();

  const navigation = getNavigationForRole(user?.role, "/");

  return (
    <>
      <AppTour />
      <GovHeader
        serviceName={isStaff ? "Licensing Portal – Staff" : "Licensing Portal"}
        navigation={navigation}
        userName={user?.name}
        userRole={user?.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        {/* Hero */}
        <section id="tour-hero" className="bg-[#0b2e5e] text-white py-12 -mt-8 mb-8">
          <div className="govuk-container">
            <p className="uppercase tracking-wide text-sm font-bold text-govuk-light-blue mb-2">
              Digital Permit Platform
            </p>
            <h1 className="text-white text-3xl md:text-4xl mb-4">
              {appName}
            </h1>
            <p className="text-xl text-govuk-light-blue max-w-2xl mb-6">
              Apply for licences and permits online — from alcohol and taxis to
              Blue Badge parking permits. Track your applications, upload
              documents, and manage everything in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link id="tour-browse" href="/licences" className="govuk-button govuk-button--start no-underline">
                Browse licences
                <svg
                  className="ml-2 h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <title>Browse licences</title>
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              {!user && (
                <Link
                  id="tour-account"
                  href="/auth/login"
                  className="govuk-button govuk-button--secondary no-underline"
                >
                  Sign in to your account
                </Link>
              )}
              {user && !isStaff && (
                <Link
                  id="tour-account"
                  href="/dashboard"
                  className="govuk-button govuk-button--secondary no-underline"
                >
                  My applications
                </Link>
              )}
              {isStaff && (
                <Link
                  id="tour-account"
                  href="/staff"
                  className="govuk-button govuk-button--secondary no-underline"
                >
                  Staff dashboard
                </Link>
              )}
              <TourLauncher />
            </div>
          </div>
        </section>

        <div className="govuk-container">
          {/* Categories */}
          <h2>What do you need a licence or permit for?</h2>
          <div id="tour-categories" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {[
              {
                name: "Taxis and private hire",
                desc: "Driver licences, vehicle licences, and operator licences",
                href: "/licences?category=taxis-and-private-hire",
                icon: <Car className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Alcohol and entertainment",
                desc: "Premises licences, personal licences, and temporary event notices",
                href: "/licences?category=alcohol-and-entertainment",
                icon: <Wine className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Animals",
                desc: "Animal boarding, breeding, exhibitions, and dangerous wild animals",
                href: "/licences?category=animals",
                icon: <PawPrint className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Street licences and permits",
                desc: "Street trading, pavement licences, collections, and pedlars",
                href: "/licences?category=street-licences-and-permits",
                icon: <Store className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Gambling",
                desc: "Premises licences, gaming permits, lotteries, and notices",
                href: "/licences?category=gambling",
                icon: <Dice5 className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Parking and mobility",
                desc: "Blue Badge disabled parking permits and other mobility permits",
                href: "/licences?category=parking-and-mobility-permits",
                icon: <Accessibility className="h-8 w-8 text-govuk-blue" />,
              },
              {
                name: "Other licences",
                desc: "Skin piercing, explosives, scrap metal, caravans, and more",
                href: "/licences?category=other",
                icon: <ClipboardList className="h-8 w-8 text-govuk-blue" />,
              },
            ].map((cat) => (
              <Link
                key={cat.name}
                id={cat.name === "Parking and mobility" ? "tour-bluebadge" : undefined}
                href={cat.href}
                className="module-card no-underline hover:border-govuk-blue transition-colors"
              >
                <span className="mb-3 block">{cat.icon}</span>
                <h3 className="module-card__title">{cat.name}</h3>
                <p className="module-card__description">{cat.desc}</p>
                <span className="text-govuk-blue text-sm">
                  View licences →
                </span>
              </Link>
            ))}
          </div>

          {/* AI help assistant banner */}
          {aiReady && (
            <Link
              id="tour-ai-help"
              href="/help"
              className="no-underline block mb-12 border border-govuk-blue bg-[#eef6fb] p-6 hover:bg-[#e2eff8] transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <Sparkles className="h-10 w-10 text-govuk-blue shrink-0" />
                <div className="flex-1">
                  <h3 className="module-card__title !mb-1">
                    Ask the licensing help assistant
                  </h3>
                  <p className="text-govuk-dark-grey mb-0">
                    Get plain-language answers about running a licensed business —
                    training staff, age checks, opening hours and more — in your own
                    language.
                  </p>
                </div>
                <span className="flex items-center gap-2 text-govuk-blue font-bold whitespace-nowrap">
                  <Languages className="h-5 w-5" /> Start now →
                </span>
              </div>
            </Link>
          )}

          {/* Info section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div id="tour-how">
              <h2>How it works</h2>
              <ol className="list-decimal ml-6 space-y-3">
                <li>
                  <strong>Find your licence</strong> – Browse our catalogue or
                  search for the licence type you need.
                </li>
                <li>
                  <strong>Check requirements</strong> – Review what you&apos;ll need
                  before you start, including documents and fees.
                </li>
                <li>
                  <strong>Create an account</strong> – Register for a free
                  account to save your progress and track applications.
                </li>
                <li>
                  <strong>Complete your application</strong> – Fill in the form,
                  upload documents, and pay the fee.
                </li>
                <li>
                  <strong>Track your application</strong> – Monitor progress,
                  respond to requests, and receive your decision.
                </li>
              </ol>
            </div>
            <div>
              <h2>Need help?</h2>
              <div className="govuk-inset-text">
                <p className="mb-3">
                  If you need assistance with your application, contact the
                  licensing team:
                </p>
                <ul className="list-none space-y-2">
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-govuk-blue" />
                    <Link href={`mailto:${supportEmail}`}>
                      {supportEmail}
                    </Link>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-govuk-blue" />
                    {supportPhone}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-govuk-blue" />
                    Monday to Friday, 9am to 5pm (excluding bank holidays)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
