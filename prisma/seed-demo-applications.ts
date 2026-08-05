// ─────────────────────────────────────────────────────────────
// Seed: demo applications for the Policy Copilot
// ─────────────────────────────────────────────────────────────
// Adds a spread of premises-licence applications (and a personal
// licence) with realistic answers so the per-application AI policy
// insight produces varied, meaningful results:
//   • town-centre nightclub in the Cumulative Impact Area  -> red/amber
//   • suburban corner-shop off-sales                       -> green
//   • town-centre restaurant (alcohol ancillary)           -> green/amber
//   • late-night takeaway near the town centre             -> amber
//   • rural community function room                         -> green
// Out-of-scope types (taxi, animals, gambling…) already exist in the
// main seed and now correctly show "Outside the scope of this policy".
// Idempotent: removes prior PL-DEMO / PERS-DEMO apps and recreates.
//   npm run db:seed:demo
// ─────────────────────────────────────────────────────────────
import { PrismaClient, type ApplicationStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface DemoApp {
  ref: string;
  moduleKey: string;
  status: ApplicationStatus;
  currentStage: string | null;
  assignToReviewer?: boolean;
  answers: Record<string, unknown>;
}

const PREMISES: DemoApp[] = [
  {
    ref: "PL-DEMO-0001",
    moduleKey: "premises_licence_new",
    status: "SUBMITTED",
    currentStage: "consultation",
    assignToReviewer: true,
    answers: {
      applicant: {
        applicant_type: "company",
        name: "Riverside Leisure Group Ltd",
        email: "licensing@riversideleisure.example",
        phone: "01234 700111",
        address: "Unit 7, Contoso Business Park, Contoso, CN4 9ZZ",
      },
      premises: {
        premises_name: "The Old Vault Bar & Nightclub",
        premises_address: "12–14 Market Street, Contoso Town Centre",
        premises_postcode: "CN1 2AB",
        premises_description:
          "Two-floor late-night bar and nightclub with a capacity of 350. Located in the heart of the town centre on Market Street. Proposed hours for the sale of alcohol and regulated entertainment: Monday–Thursday 10:00–00:00, Friday & Saturday 10:00–02:30, Sunday 12:00–00:00. Vertical drinking with a dance floor and DJ booth.",
        rateable_value: "D",
      },
      activities: {
        sell_alcohol: true,
        alcohol_on_off: "on",
        live_music: true,
        recorded_music: true,
        dance: true,
        late_night: true,
      },
      dps: {
        dps_name: "Sarah Louise Bennett",
        dps_licence_number: "PL/CON/2019/00231",
        dps_issuing_authority: "Contoso Council",
      },
    },
  },
  {
    ref: "PL-DEMO-0002",
    moduleKey: "premises_licence_new",
    status: "SUBMITTED",
    currentStage: "validation",
    assignToReviewer: true,
    answers: {
      applicant: {
        applicant_type: "individual",
        name: "Aisha Rahman",
        email: "aisha.rahman@example.com",
        phone: "01234 700222",
        address: "45 Oak Lane, Elmfield, CN7 4RT",
      },
      premises: {
        premises_name: "Contoso Village Stores",
        premises_address: "45 Oak Lane, Elmfield (suburban, approx. 2 miles from the town centre)",
        premises_postcode: "CN7 4RT",
        premises_description:
          "Small convenience store applying to sell alcohol for consumption OFF the premises during normal shop opening hours 08:00–22:00 daily. A Challenge 25 age-verification policy will operate, a refusals register kept, staff trained before their first sale, and CCTV retained for 28 days. No high-strength beers/ciders above 6.5% ABV.",
        rateable_value: "A",
      },
      activities: {
        sell_alcohol: true,
        alcohol_on_off: "off",
      },
      dps: {
        dps_name: "Aisha Rahman",
        dps_licence_number: "PL/CON/2022/00876",
        dps_issuing_authority: "Contoso Council",
      },
    },
  },
  {
    ref: "PL-DEMO-0003",
    moduleKey: "premises_licence_new",
    status: "UNDER_REVIEW",
    currentStage: "consultation",
    assignToReviewer: true,
    answers: {
      applicant: {
        applicant_type: "company",
        name: "Riverside Kitchen Ltd",
        email: "hello@riversidekitchen.example",
        phone: "01234 700333",
        address: "3 Bridge Road, Contoso, CN1 3CD",
      },
      premises: {
        premises_name: "The Riverside Kitchen",
        premises_address: "3 Bridge Road, Contoso Town Centre",
        premises_postcode: "CN1 3CD",
        premises_description:
          "A 50-cover family restaurant. Alcohol is served ONLY to customers taking a table meal (ancillary to food) — no vertical drinking. Proposed hours 11:00–23:00 daily. Background recorded music only. Low capacity, table service throughout.",
        rateable_value: "C",
      },
      activities: {
        sell_alcohol: true,
        alcohol_on_off: "on",
        recorded_music: true,
      },
      dps: {
        dps_name: "Marco Rossi",
        dps_licence_number: "PL/CON/2021/00544",
        dps_issuing_authority: "Contoso Council",
      },
    },
  },
  {
    ref: "PL-DEMO-0004",
    moduleKey: "premises_licence_new",
    status: "SUBMITTED",
    currentStage: "validation",
    answers: {
      applicant: {
        applicant_type: "individual",
        name: "Mehmet Yilmaz",
        email: "mehmet.yilmaz@example.com",
        phone: "01234 700444",
        address: "8 High Street, Contoso, CN1 2EF",
      },
      premises: {
        premises_name: "Star Kebab & Pizza",
        premises_address: "8 High Street, Contoso Town Centre",
        premises_postcode: "CN1 2EF",
        premises_description:
          "Hot food takeaway (late night refreshment) proposing to open until 03:00 on Friday and Saturday and 01:00 on other nights. Located on the High Street within the town centre, close to several pubs and nightclubs. Predominantly serves customers leaving late-night venues.",
        rateable_value: "B",
      },
      activities: {
        late_night: true,
      },
      dps: {
        dps_name: "",
        dps_licence_number: "",
        dps_issuing_authority: "",
      },
    },
  },
  {
    ref: "PL-DEMO-0005",
    moduleKey: "premises_licence_new",
    status: "SUBMITTED",
    currentStage: "consultation",
    answers: {
      applicant: {
        applicant_type: "club",
        name: "Elmfield Community Association",
        email: "committee@elmfieldca.example",
        phone: "01234 700555",
        address: "Village Hall, Green Lane, Elmfield, CN7 5GH",
      },
      premises: {
        premises_name: "The Meadow Function Room",
        premises_address: "Village Hall, Green Lane, Elmfield (rural village, 4 miles from town centre)",
        premises_postcode: "CN7 5GH",
        premises_description:
          "Community hall used for occasional private functions (weddings, birthdays) with a bar. Alcohol on-sales during events only, 12:00–23:30. Live and recorded music for events. Rural residential village; nearest neighbour 40m away. Written dispersal and noise-management plan in place.",
        rateable_value: "A",
      },
      activities: {
        sell_alcohol: true,
        alcohol_on_off: "on",
        live_music: true,
        recorded_music: true,
        dance: true,
      },
      dps: {
        dps_name: "Margaret Powell",
        dps_licence_number: "PL/CON/2020/00390",
        dps_issuing_authority: "Contoso Council",
      },
    },
  },
];

const OTHERS: DemoApp[] = [
  {
    ref: "PERS-DEMO-0001",
    moduleKey: "personal_licence_new",
    status: "SUBMITTED",
    currentStage: "validation",
    answers: {
      details: {
        name: "Daniel O'Connor",
        email: "daniel.oconnor@example.com",
        address: "22 Kingsway, Contoso, CN2 6JL",
        dob: "1990-04-12",
        qualification: "APLH — Award for Personal Licence Holders (Level 2)",
        has_convictions: "no",
      },
    },
  },
];

async function main() {
  console.log("→ Seeding demo applications for the Policy Copilot…");

  const applicant = await prisma.user.findUnique({
    where: { email: "applicant@example.com" },
  });
  const reviewer = await prisma.user.findUnique({
    where: { email: "reviewer@example.com" },
  });
  if (!applicant) throw new Error("Seed the base data first (applicant@example.com missing).");

  const all = [...PREMISES, ...OTHERS];

  // Idempotent: remove any previous demo apps (cascades to events/insights).
  const refs = all.map((a) => a.ref);
  const removed = await prisma.application.deleteMany({
    where: { referenceNumber: { in: refs } },
  });
  if (removed.count) console.log(`  cleared ${removed.count} previous demo application(s)`);

  let created = 0;
  for (const demo of all) {
    const module = await prisma.licenceModule.findUnique({
      where: { moduleKey: demo.moduleKey },
      include: { versions: { where: { isActive: true }, take: 1 } },
    });
    if (!module || module.versions.length === 0) {
      console.warn(`  ! module ${demo.moduleKey} has no active version — skipping ${demo.ref}`);
      continue;
    }
    const version = module.versions[0];

    const app = await prisma.application.create({
      data: {
        referenceNumber: demo.ref,
        moduleId: module.id,
        moduleVersionId: version.id,
        applicationType: "new",
        applicantId: applicant.id,
        status: demo.status,
        currentStage: demo.currentStage,
        submittedAt: new Date(),
        answers: demo.answers as object,
        assignedOfficerId: demo.assignToReviewer && reviewer ? reviewer.id : null,
      },
    });

    await prisma.workflowEvent.create({
      data: {
        applicationId: app.id,
        fromStage: null,
        toStage: demo.currentStage ?? "validation",
        action: "submit",
        performedById: applicant.id,
      },
    });
    created++;
  }

  console.log(`✔ Seeded ${created} demo application(s): ${PREMISES.length} premises + ${OTHERS.length} personal licence.`);
  console.log("  Try them in the staff work queue → open a case → Generate AI insight.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
