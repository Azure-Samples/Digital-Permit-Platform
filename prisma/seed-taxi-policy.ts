// ─────────────────────────────────────────────────────────────
// Seed: Hackney Carriage and Private Hire Licensing Policy
// ─────────────────────────────────────────────────────────────
// A realistic composite taxi / private-hire policy that grounds the
// Policy AI assistant for the `taxi_private_hire` regime and clears
// the "Taxi policy recommended" readiness warning shown when taxi
// modules are enabled without an active taxi policy.
//
// Framed against the DfT Statutory Taxi and Private Hire Vehicle
// Standards (2020) and best-practice guidance, the Town Police
// Clauses Act 1847 and the Local Government (Miscellaneous
// Provisions) Act 1976. It is a DfT-recommended cohesive policy —
// NOT the statutory section 5 Licensing Act 2003 statement.
//
// Idempotent: safe to run repeatedly (npm run db:seed:taxi-policy).
// Only affects the taxi_private_hire regime; the Licensing Act 2003
// policy is left untouched.
// ─────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REGIME = "taxi_private_hire";
const VERSION_LABEL = "2024–2029";

interface SeedSection {
  ref: string;
  heading: string;
  category: string;
  keywords: string[];
  content: string;
}

const SECTIONS: SeedSection[] = [
  {
    ref: "1.1",
    heading: "Introduction, scope and legal framework",
    category: "general",
    keywords: ["introduction", "scope", "hackney carriage", "private hire", "legal framework"],
    content:
      "This Hackney Carriage and Private Hire Licensing Policy sets out how the licensing authority exercises its functions in respect of hackney carriage (taxi) and private hire drivers, vehicles and operators. The principal legislation is the Town Police Clauses Act 1847 (hackney carriages), the Local Government (Miscellaneous Provisions) Act 1976 (private hire and adopted hackney carriage provisions), the Equality Act 2010 and the Road Traffic Acts. The authority has had regard to the Department for Transport's Statutory Taxi and Private Hire Vehicle Standards (2020) and its Best Practice Guidance. This policy is a DfT-recommended cohesive published policy; it is not the statutory section 5 Statement of Licensing Policy required under the Licensing Act 2003. Each application and licensing decision is considered on its own merits.",
  },
  {
    ref: "2.1",
    heading: "The safeguarding objective and public protection",
    category: "objectives",
    keywords: ["safeguarding", "public protection", "vulnerable", "safety", "fit and proper"],
    content:
      "The overriding aim of the authority when licensing the taxi and private hire trade is the protection of the public. Passengers, including children and vulnerable adults, are frequently carried alone and unsupervised, so the safety and suitability of drivers, vehicles and operators is paramount. Every licensing decision starts from the question of whether granting or retaining a licence would place the safety of the public at risk. Where there is any doubt, the authority will resolve that doubt in favour of protecting the public rather than the interests of the applicant or licence holder.",
  },
  {
    ref: "3.1",
    heading: "The 'fit and proper' test for drivers",
    category: "applicant_guidance",
    keywords: ["fit and proper", "driver", "suitability", "assessment", "honesty"],
    content:
      "A hackney carriage or private hire driver's licence will only be granted where the authority is satisfied that the applicant is a 'fit and proper' person. In deciding this the authority asks itself: 'Would I allow a person for whom I care, regardless of their condition, to travel alone in a vehicle driven by this person at any time of day or night?' The applicant must satisfy the authority as to their honesty, integrity and reliability. The burden of demonstrating suitability rests with the applicant, not the authority.",
  },
  {
    ref: "3.2",
    heading: "Criminal record checks and the barred lists",
    category: "enforcement",
    keywords: ["dbs", "enhanced", "barred list", "criminal record", "update service"],
    content:
      "All applicants for and holders of a driver's licence must undergo an Enhanced Criminal Record Check with a check of both the children's and adults' barred lists through the Disclosure and Barring Service. Drivers must subscribe to the DBS Update Service so the authority can carry out status checks at least every six months. Applicants who have spent time living or working overseas must provide a Certificate of Good Conduct or equivalent from the relevant country. The authority also checks the national register of refusals and revocations (NR3S) before granting or renewing a licence and records relevant decisions on it.",
  },
  {
    ref: "4.1",
    heading: "Assessment of previous convictions and conduct",
    category: "enforcement",
    keywords: ["convictions", "cautions", "rehabilitation", "spent", "conduct"],
    content:
      "The authority assesses previous convictions, cautions, warnings and other relevant information against the suitability thresholds in the DfT Statutory Standards. Because a driver is in a position of trust, the authority may take into account convictions that would otherwise be spent under the Rehabilitation of Offenders Act 1974, as amended for these licensing purposes. As a general guide: applicants with a conviction for a serious sexual, violent, or exploitation offence, or for causing death by driving, will not be licensed; other serious offences will require a substantial conviction-free period before an application is considered. Each case is decided on its individual facts and the guidance is applied as a starting point, not a rigid rule.",
  },
  {
    ref: "5.1",
    heading: "Knowledge, competence and language requirements",
    category: "applicant_guidance",
    keywords: ["knowledge test", "english", "competence", "safeguarding training", "disability awareness"],
    content:
      "Applicants must demonstrate a sufficient standard of spoken and written English to communicate with passengers, read maps and signage, and understand licensing conditions. New driver applicants must pass a knowledge test covering the local area, the Highway Code, fare calculation, licensing conditions and their legal obligations. The authority requires drivers to complete safeguarding awareness training (including recognising and reporting child sexual exploitation and county lines) and disability awareness training before a licence is granted, with periodic refresher training.",
  },
  {
    ref: "6.1",
    heading: "Medical fitness to drive",
    category: "applicant_guidance",
    keywords: ["medical", "group 2", "dvla", "fitness", "health"],
    content:
      "Because they carry members of the public, drivers must meet the DVLA Group 2 (vocational) medical standard, which is higher than the standard for an ordinary car driver. A medical examination is required on first application and at intervals appropriate to the driver's age, with additional assessments where a notifiable condition arises. Drivers must notify the authority and the DVLA of any relevant change in their health. Failure to maintain the required medical standard will result in refusal, suspension or revocation of the licence.",
  },
  {
    ref: "7.1",
    heading: "Vehicle standards, testing and emissions",
    category: "conditions",
    keywords: ["vehicle", "mot", "roadworthiness", "inspection", "emissions", "age limit"],
    content:
      "Licensed vehicles must be safe, comfortable, clean and fit for public use. Vehicles are subject to a compliance inspection to the authority's specification before a licence is granted and at intervals thereafter (in addition to the statutory MOT once the vehicle reaches testing age). The authority operates an age and emissions policy to improve air quality: vehicles must meet the specified minimum emissions standard and any upper age limit, subject to a discretion to relax the age limit for vehicles in exceptional mechanical condition. Any accident, mechanical defect or modification affecting safety must be reported to the authority.",
  },
  {
    ref: "8.1",
    heading: "Wheelchair accessibility and the Equality Act 2010",
    category: "conditions",
    keywords: ["wheelchair", "accessibility", "equality act", "section 165", "assistance dogs", "designated list"],
    content:
      "The authority is committed to an accessible fleet. Drivers of designated wheelchair-accessible vehicles must, under sections 165 and 167 of the Equality Act 2010, carry wheelchair users, provide mobility assistance and not charge extra. Under sections 168 and 170 all taxi and private hire drivers must carry assistance dogs at no additional charge unless they hold a medical exemption certificate. Refusing a reasonable request from a disabled passenger, or making an additional charge, is a criminal offence and will be treated by the authority as a serious matter affecting the driver's fitness to hold a licence.",
  },
  {
    ref: "9.1",
    heading: "Private hire operator licensing and record keeping",
    category: "conditions",
    keywords: ["operator", "booking", "records", "sub-contracting", "insurance"],
    content:
      "A private hire operator must be licensed to accept and dispatch bookings, and may only use licensed drivers and licensed vehicles. Operators must keep accurate records of every booking (including the passenger, driver, vehicle, time and journey) and of every complaint, and retain them for inspection for the period specified by the authority. Operators must satisfy the authority that they are fit and proper, hold appropriate insurance, have policies for safeguarding and data protection, and only sub-contract bookings in accordance with the law. Operators are expected to co-operate with the police and the authority and to report safeguarding concerns promptly.",
  },
  {
    ref: "10.1",
    heading: "In-vehicle CCTV and data protection",
    category: "conditions",
    keywords: ["cctv", "surveillance", "data protection", "privacy", "safety"],
    content:
      "The authority supports the proportionate use of in-vehicle CCTV as a safety measure for passengers and drivers. Where CCTV is installed it must comply with the authority's technical specification, the UK GDPR and the Data Protection Act 2018, with a registered data controller, clear passenger signage, secure encrypted storage, defined retention periods and access only for policing, safeguarding or licensing purposes. The authority keeps under review whether mandatory CCTV is a necessary and proportionate condition in light of local evidence.",
  },
  {
    ref: "11.1",
    heading: "Identification, signage and conduct of drivers",
    category: "conditions",
    keywords: ["badge", "identification", "plates", "conduct", "dress", "behaviour"],
    content:
      "Drivers must display their licence badge and vehicles must display licence plates and any required signage so that passengers and the authority can readily identify them. Drivers are expected to behave in a civil, professional and safe manner, to take the shortest reasonable route, to charge no more than the metered or agreed fare, to keep the vehicle clean and to assist passengers with luggage and mobility where needed. Smoking is prohibited in licensed vehicles. Conduct falling below these standards may be dealt with by advice, penalty points, suspension or revocation.",
  },
  {
    ref: "12.1",
    heading: "Fares, hackney carriage stands and plying for hire",
    category: "hours",
    keywords: ["fares", "tariff", "ranks", "plying for hire", "pre-booked"],
    content:
      "Hackney carriages may ply for hire and stand at appointed ranks, and are subject to the table of fares (tariff) set by the authority and reviewed periodically; the metered fare is the maximum that may be charged for a compellable journey. Private hire vehicles may only be pre-booked through a licensed operator and must not ply for hire, use ranks or accept flag-downs. The distinction between plying for hire and pre-booked work is fundamental to public safety and insurance, and the authority will take enforcement action against illegal plying for hire and against drivers or vehicles working outside the terms of their licence.",
  },
  {
    ref: "13.1",
    heading: "Enforcement, penalty points and the fit-and-proper review",
    category: "enforcement",
    keywords: ["enforcement", "penalty points", "suspension", "revocation", "immediate", "appeal"],
    content:
      "The authority operates a risk-based enforcement and penalty-points scheme. Minor breaches may attract advice or points; the accumulation of points, or a serious matter, triggers a review of the licence. The authority may suspend or revoke a licence where a driver, vehicle or operator no longer meets the required standards. Where it is necessary in the interests of public safety, a driver's licence may be suspended or revoked with immediate effect. A person aggrieved by a refusal, suspension or revocation has a right of appeal to the magistrates' court, except where an immediate decision has been taken on public-safety grounds.",
  },
  {
    ref: "14.1",
    heading: "Cross-border working and continuous safeguarding",
    category: "enforcement",
    keywords: ["cross border", "nr3s", "information sharing", "continuous", "notification"],
    content:
      "Licensed drivers, vehicles and operators may lawfully undertake work across authority boundaries where the driver, vehicle and operator are all licensed by the same authority. The authority shares and receives safeguarding and licensing information with other authorities and the police, including through the national register of taxi and private hire refusals and revocations (NR3S), to prevent a person refused by one authority simply applying to another. Licence holders must notify the authority within the specified period of any arrest, charge, conviction, caution or safeguarding concern, and of any change to the information provided in their application. Safeguarding is treated as a continuous obligation throughout the life of the licence, not merely at the point of grant.",
  },
];

async function main() {
  console.log("→ Seeding Hackney Carriage and Private Hire Licensing Policy…");

  const profile = await prisma.councilProfile.findUnique({
    where: { id: "primary" },
    select: { organisationName: true },
  });
  const councilName = profile?.organisationName?.trim() || "Contoso Council";

  // Enforce a single active policy PER REGIME only. The Licensing Act
  // 2003 policy (a different regime) is deliberately left untouched.
  await prisma.licensingPolicy.updateMany({
    where: { regime: REGIME, isActive: true },
    data: { isActive: false },
  });

  const existing = await prisma.licensingPolicy.findFirst({
    where: { regime: REGIME, versionLabel: VERSION_LABEL },
  });

  if (existing) {
    await prisma.policySection.deleteMany({ where: { policyId: existing.id } });
  }

  const policy =
    existing ??
    (await prisma.licensingPolicy.create({
      data: {
        councilName,
        title: "Hackney Carriage and Private Hire Licensing Policy 2024–2029",
        regime: REGIME,
        versionLabel: VERSION_LABEL,
        effectiveFrom: new Date("2024-04-01"),
        effectiveTo: new Date("2029-03-31"),
        isActive: true,
        summary:
          "This council's policy for licensing hackney carriage and private hire drivers, vehicles and operators. It puts the safety of the public first through the 'fit and proper' test, enhanced DBS and barred-list checks, safeguarding and disability-awareness training, Group 2 medical standards, vehicle inspection and emissions requirements, Equality Act duties to disabled passengers, operator record-keeping, penalty points and continuous information sharing (NR3S). It reflects the DfT Statutory Taxi and Private Hire Vehicle Standards and is a DfT-recommended cohesive policy, not the statutory Licensing Act 2003 statement.",
      },
    }));

  if (existing) {
    await prisma.licensingPolicy.update({
      where: { id: existing.id },
      data: { isActive: true, councilName },
    });
  }

  await prisma.policySection.createMany({
    data: SECTIONS.map((section, index) => ({
      policyId: policy.id,
      ref: section.ref,
      heading: section.heading,
      content: section.content,
      category: section.category,
      keywords: section.keywords,
      sortOrder: index,
    })),
  });

  console.log(
    `✔ Taxi policy "${policy.title}" seeded and activated with ${SECTIONS.length} sections (id ${policy.id}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
