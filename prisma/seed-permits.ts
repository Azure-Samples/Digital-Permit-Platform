// ─────────────────────────────────────────────────────────────
// Seed data – Digital Permit Platform (DPP): parking, travel & mobility permits
// Adds the Blue Badge (disabled person's parking permit) to the config-driven
// module registry, so it flows through the same apply → review → decision
// pipeline as every licence.
//
// Requirements modelled on the standard UK Blue Badge scheme (Department for
// Transport / GOV.UK guidance), administered by local councils.
//
// Run: npm run db:seed:permits   (idempotent – safe to re-run)
// ─────────────────────────────────────────────────────────────
import {
  PrismaClient,
  PaymentMode,
  ModuleVisibility,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY = "Parking and mobility permits";

async function main() {
  console.log("🅿️  Seeding Digital Permit Platform – mobility permits...\n");

  // ─── Team ────────────────────────────────────────────────────
  const mobilityTeam = await prisma.team.upsert({
    where: { name: "Blue Badge and Mobility" },
    update: {},
    create: {
      name: "Blue Badge and Mobility",
      email: "bluebadge@contoso.gov.uk",
      description:
        "Blue Badge disabled parking permits and other mobility/travel permits",
    },
  });
  console.log("✓ Team ready: Blue Badge and Mobility");

  // ─── createModule helper (mirrors prisma/seed.ts) ────────────
  async function createModule(
    moduleKey: string,
    displayName: string,
    category: string,
    sortOrder: number,
    versionData: Record<string, unknown>
  ) {
    const mod = await prisma.licenceModule.upsert({
      where: { moduleKey },
      update: { displayName, category, sortOrder },
      create: { moduleKey, displayName, category, sortOrder, enabled: true },
    });

    const existing = await prisma.moduleVersion.findFirst({
      where: { moduleId: mod.id, version: 1 },
    });

    if (!existing) {
      await prisma.moduleVersion.create({
        data: {
          moduleId: mod.id,
          version: 1,
          isActive: true,
          publishedAt: new Date(),
          visibility: ModuleVisibility.PUBLIC,
          ...(versionData as any),
        },
      });
      console.log(`✓ Created module: ${displayName}`);
    } else {
      console.log(`• Module already present (v1 kept): ${displayName}`);
    }

    return mod;
  }

  // ═══════════════════════════════════════════════════════════
  // BLUE BADGE – disabled person's parking permit
  // ═══════════════════════════════════════════════════════════
  await createModule(
    "blue_badge",
    "Blue Badge – disabled person's parking permit",
    CATEGORY,
    1,
    {
      publicDescription:
        "Apply for a Blue Badge, the disabled parking permit that lets you park closer to where you need to go. Blue Badges are for people with a permanent or long-term disability or health condition — including hidden (non-visible) conditions — that affects their mobility. A badge normally lasts up to 3 years. It costs up to £10 and is only charged if your application is successful.",
      helpText:
        "You may be automatically eligible if you receive certain benefits (for example the higher rate mobility component of DLA, or PIP with 8+ points for 'moving around'). If you are not automatically eligible, we can still assess you — you may be asked to attend an independent mobility assessment.",
      beforeYouStartText:
        "Before you start, you will need:\n• A recent digital photo of the badge holder (passport-style, taken in the last month)\n• Proof of identity (birth or marriage certificate, valid passport, or driving licence)\n• Proof of address dated within the last 12 months (Council Tax or utility bill, or a government letter)\n• The badge holder's National Insurance number (not needed if they are under 16)\n• If you get a qualifying benefit: your official award letter showing the mobility component or points\n• If you are being assessed: details of a health or social care professional who knows about your condition\n• A debit or credit card to pay the £10 fee if your application is approved",
      applicationTypes: ["new", "renewal"],
      paymentMode: PaymentMode.EXTERNAL_REDIRECT,
      feeSchedule: { new: 10, renewal: 10 },
      owningTeamId: mobilityTeam.id,
      submissionMailbox: "bluebadge@contoso.gov.uk",
      acceptingApplications: true,
      verificationStatus: VerificationStatus.VERIFIED_PUBLIC_PAGE,

      formSchema: [
        {
          key: "who_for",
          title: "Who is this application for?",
          description:
            "A Blue Badge belongs to a person, not a vehicle. Tell us who the badge is for.",
          fields: [
            {
              key: "applying_for",
              label: "Who are you applying for?",
              type: "radio",
              required: true,
              options: [
                { value: "myself", label: "Myself" },
                {
                  value: "someone_else",
                  label: "Someone I care for (including a child)",
                },
                {
                  value: "organisation",
                  label:
                    "An organisation that transports disabled people (organisational badge)",
                },
              ],
            },
            {
              key: "relationship",
              label: "Your relationship to the badge holder",
              type: "text",
              hint: "For example, parent, partner, carer",
              conditionalOn: {
                field: "applying_for",
                operator: "eq",
                value: "someone_else",
              },
            },
            {
              key: "organisation_name",
              label: "Organisation name",
              type: "text",
              conditionalOn: {
                field: "applying_for",
                operator: "eq",
                value: "organisation",
              },
            },
          ],
        },
        {
          key: "personal_details",
          title: "Badge holder's details",
          description: "The personal details of the person the badge is for.",
          fields: [
            {
              key: "title",
              label: "Title",
              type: "select",
              required: false,
              options: [
                { value: "mr", label: "Mr" },
                { value: "mrs", label: "Mrs" },
                { value: "ms", label: "Ms" },
                { value: "miss", label: "Miss" },
                { value: "mx", label: "Mx" },
                { value: "dr", label: "Dr" },
              ],
            },
            { key: "first_name", label: "First name", type: "text", required: true },
            { key: "last_name", label: "Last name", type: "text", required: true },
            {
              key: "previous_names",
              label: "Previous names (if any)",
              type: "text",
              hint: "Include maiden name and any other names the badge holder has used",
            },
            {
              key: "date_of_birth",
              label: "Date of birth",
              type: "date",
              required: true,
            },
            {
              key: "national_insurance",
              label: "National Insurance number",
              type: "text",
              hint: "For example, QQ 12 34 56 C. Leave blank if the badge holder is under 16.",
            },
          ],
        },
        {
          key: "contact_details",
          title: "Contact details and address",
          fields: [
            {
              key: "address",
              label: "Home address",
              type: "address",
              required: true,
              hint: "The Blue Badge holder must normally live in the council area",
            },
            { key: "email", label: "Email address", type: "email", required: true },
            { key: "phone", label: "Phone number", type: "phone", required: true },
          ],
        },
        {
          key: "eligibility_route",
          title: "Your eligibility",
          description:
            "There are two ways to qualify for a Blue Badge. Some people qualify automatically because of a benefit they receive; others are assessed by the council.",
          fields: [
            {
              key: "route",
              label: "How do you qualify for a Blue Badge?",
              type: "radio",
              required: true,
              options: [
                {
                  value: "automatic",
                  label:
                    "I automatically qualify because I receive a qualifying benefit",
                },
                {
                  value: "assessment",
                  label:
                    "I need to be assessed by the council (I don't automatically qualify)",
                },
                {
                  value: "not_sure",
                  label: "I'm not sure — please assess my eligibility",
                },
              ],
            },
          ],
        },
        {
          key: "automatic_eligibility",
          title: "Qualifying benefit",
          description:
            "Tell us which benefit means you automatically qualify. You will need to upload your award letter as evidence.",
          conditionalOn: { field: "route", operator: "eq", value: "automatic" },
          fields: [
            {
              key: "qualifying_benefit",
              label: "Which of these applies to you?",
              type: "select",
              required: true,
              options: [
                {
                  value: "dla_higher_mobility",
                  label:
                    "Higher rate of the mobility component of Disability Living Allowance (DLA)",
                },
                {
                  value: "pip_moving_8",
                  label:
                    "PIP – 8 or more points for the 'moving around' activity",
                },
                {
                  value: "pip_journey_10e",
                  label:
                    "PIP – 10 points for 'planning and following a journey' (descriptor E: overwhelming psychological distress)",
                },
                {
                  value: "severely_sight_impaired",
                  label: "Registered as severely sight impaired (blind)",
                },
                {
                  value: "wpms",
                  label: "War Pensioners' Mobility Supplement (WPMS)",
                },
                {
                  value: "afcs",
                  label:
                    "Armed Forces Compensation Scheme (tariff 1–8) with a certified permanent and substantial disability",
                },
              ],
            },
            {
              key: "benefit_reference",
              label: "Benefit reference or claim number (if known)",
              type: "text",
            },
            {
              key: "award_end_date",
              label: "Date your award ends",
              type: "date",
              hint: "Shown on your award letter. Leave blank if the award has no end date.",
            },
          ],
        },
        {
          key: "assessment_eligibility",
          title: "About your disability or health condition",
          description:
            "Tell us how your disability or health condition affects your ability to walk. This helps us decide whether you need a mobility assessment.",
          conditionalOn: { field: "route", operator: "neq", value: "automatic" },
          fields: [
            {
              key: "assessment_reason",
              label: "Which of these best describes your situation?",
              type: "select",
              required: true,
              options: [
                {
                  value: "walking_difficulty",
                  label:
                    "I cannot walk or find walking very difficult because of a permanent and substantial disability",
                },
                {
                  value: "hidden_disability",
                  label:
                    "I have a non-visible (hidden) disability that causes very considerable psychological distress, or a risk of serious harm, when walking",
                },
                {
                  value: "both_arms",
                  label:
                    "I have a severe disability in both arms, drive regularly, and cannot operate a parking meter",
                },
                {
                  value: "child_under_3",
                  label:
                    "This is for a child under 3 who must be kept near a vehicle for medical equipment or urgent treatment",
                },
                {
                  value: "terminal_illness",
                  label:
                    "I have a terminal illness that seriously limits my mobility",
                },
              ],
            },
            {
              key: "condition_description",
              label:
                "Describe your disability or health condition and how it affects your mobility",
              type: "textarea",
              required: true,
              hint: "Include how far you can walk, how walking affects you, and any pain or symptoms",
            },
            {
              key: "walking_distance",
              label:
                "How far can you walk without stopping or experiencing severe discomfort?",
              type: "select",
              options: [
                { value: "under_50", label: "Less than 50 metres" },
                { value: "50_80", label: "50 to 80 metres" },
                { value: "80_200", label: "80 to 200 metres" },
                { value: "over_200", label: "More than 200 metres" },
              ],
            },
            {
              key: "uses_walking_aids",
              label: "Do you use any walking aids?",
              type: "radio",
              options: [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ],
            },
            {
              key: "walking_aids_detail",
              label: "Which walking aids do you use?",
              type: "textarea",
              hint: "For example, walking stick, crutches, walking frame, wheelchair, mobility scooter, prosthesis",
              conditionalOn: {
                field: "uses_walking_aids",
                operator: "eq",
                value: "yes",
              },
            },
            {
              key: "hp_name",
              label: "Health or social care professional's name",
              type: "text",
              hint: "Someone who knows about your condition, such as a GP, consultant, physiotherapist or occupational therapist",
            },
            {
              key: "hp_role",
              label: "Their role or job title",
              type: "text",
            },
            {
              key: "hp_contact",
              label: "Their contact details (surgery, address or phone)",
              type: "textarea",
            },
            {
              key: "consent_contact_hp",
              label:
                "I consent to the council contacting this professional about my application",
              type: "checkbox",
            },
          ],
        },
        {
          key: "current_badge",
          title: "Current or previous Blue Badge",
          fields: [
            {
              key: "holds_current_badge",
              label: "Do you currently hold a Blue Badge?",
              type: "radio",
              required: true,
              options: [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ],
            },
            {
              key: "current_badge_number",
              label: "Current badge number",
              type: "text",
              conditionalOn: {
                field: "holds_current_badge",
                operator: "eq",
                value: "yes",
              },
            },
            {
              key: "current_badge_expiry",
              label: "Current badge expiry date",
              type: "date",
              conditionalOn: {
                field: "holds_current_badge",
                operator: "eq",
                value: "yes",
              },
            },
            {
              key: "previously_refused",
              label: "Have you ever had a Blue Badge refused or withdrawn?",
              type: "radio",
              required: true,
              options: [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ],
            },
            {
              key: "refusal_details",
              label: "Please provide details",
              type: "textarea",
              conditionalOn: {
                field: "previously_refused",
                operator: "eq",
                value: "yes",
              },
            },
          ],
        },
        {
          key: "declarations",
          title: "Declarations and consent",
          fields: [
            {
              key: "info_true",
              label:
                "I confirm the information I have given is true and complete to the best of my knowledge",
              type: "checkbox",
              required: true,
            },
            {
              key: "misuse_understood",
              label:
                "I understand that misusing a Blue Badge is a criminal offence that can lead to a fine of up to £1,000 and the badge being withdrawn",
              type: "checkbox",
              required: true,
            },
            {
              key: "data_consent",
              label:
                "I consent to the council verifying my eligibility, including checking my benefit entitlement with the Department for Work and Pensions (DWP)",
              type: "checkbox",
              required: true,
            },
          ],
        },
      ],

      documentRequirements: [
        {
          key: "photo",
          label: "Recent digital photograph of the badge holder",
          description:
            "Passport-style, in colour, taken within the last month against a plain background",
          required: true,
          acceptedMimeTypes: ["image/jpeg", "image/png"],
          maxSizeMb: 10,
          verificationStatus: "verified_public_page",
        },
        {
          key: "proof_identity",
          label: "Proof of identity",
          description:
            "Birth or marriage certificate, valid passport, or driving licence",
          required: true,
          verificationStatus: "verified_public_page",
        },
        {
          key: "proof_address",
          label: "Proof of address",
          description:
            "Council Tax bill, utility bill dated within the last 12 months, or a government letter",
          required: true,
          verificationStatus: "verified_public_page",
        },
        {
          key: "proof_benefit",
          label: "Proof of your qualifying benefit",
          description:
            "Your official award letter showing the mobility component or points (for example your PIP or DLA award letter)",
          required: true,
          conditionalOn: { field: "route", operator: "eq", value: "automatic" },
          verificationStatus: "verified_public_page",
        },
        {
          key: "cvi",
          label: "Certificate of Vision Impairment (CVI)",
          description:
            "Confirmation that you are registered as severely sight impaired (blind)",
          required: false,
          conditionalOn: {
            field: "qualifying_benefit",
            operator: "eq",
            value: "severely_sight_impaired",
          },
          verificationStatus: "verified_public_page",
        },
        {
          key: "medical_evidence",
          label: "Supporting medical evidence",
          description:
            "Any letters, care plans, prescriptions or assessment reports that support your application",
          required: false,
          conditionalOn: { field: "route", operator: "neq", value: "automatic" },
          verificationStatus: "verified_public_page",
        },
      ],

      workflowDefinition: [
        {
          key: "validation",
          label: "Application validation",
          order: 1,
          type: "validation",
          slaBusinessDays: 5,
          visibleToApplicant: true,
        },
        {
          key: "eligibility_check",
          label: "Eligibility check (benefit verification)",
          order: 2,
          type: "review",
          slaBusinessDays: 10,
          visibleToApplicant: true,
        },
        {
          key: "mobility_assessment",
          label: "Independent mobility assessment (if required)",
          order: 3,
          type: "inspection",
          slaBusinessDays: 30,
          reminderDays: 7,
          visibleToApplicant: true,
        },
        {
          key: "decision",
          label: "Decision",
          order: 4,
          type: "decision",
          slaBusinessDays: 5,
          visibleToApplicant: true,
        },
        {
          key: "payment_production",
          label: "Payment and badge production",
          order: 5,
          type: "custom",
          slaBusinessDays: 10,
          visibleToApplicant: true,
        },
      ],

      reviewChecklist: [
        { key: "identity_verified", label: "Badge holder identity verified", required: true },
        { key: "address_in_area", label: "Address confirmed within the council area", required: true },
        { key: "photo_ok", label: "Photograph meets the required standard", required: true },
        { key: "eligibility_route_confirmed", label: "Eligibility route confirmed (automatic or assessed)", required: true },
        { key: "benefit_verified", label: "Qualifying benefit verified with DWP (automatic route)", required: false },
        { key: "mobility_assessment_done", label: "Mobility assessment completed and passed (assessed route)", required: false },
        { key: "not_held_elsewhere", label: "No valid Blue Badge held elsewhere / no recent misuse", required: true },
        { key: "fee_paid", label: "£10 fee paid (collected once approved)", required: true },
        { key: "badge_produced", label: "Badge produced and issued", required: false },
      ],

      decisionTemplates: {
        approve:
          "Your Blue Badge application has been approved. Please pay the £10 fee to complete your application. Your badge will be posted to you within 10 working days of payment. Your badge is valid for up to 3 years — we will remind you before it expires.",
        refuse:
          "We are unable to issue you a Blue Badge on this occasion because you do not currently meet the eligibility criteria. Your decision letter explains why and how to request a review. You can reapply if your circumstances change.",
        conditions:
          "This Blue Badge is issued to the named holder only. It must only be displayed when the holder is travelling in the vehicle, or when someone is collecting/dropping off the holder. Misuse is a criminal offence.",
      },

      notificationTemplates: [
        {
          key: "on_submit",
          channel: "email",
          subject: "We have received your Blue Badge application",
          bodyTemplate:
            "Dear {{firstName}},\n\nThank you for your Blue Badge application ({{reference}}). We will check your details and contact you if we need anything else. You do not need to pay unless your application is approved.\n\nContoso Council Blue Badge team",
          trigger: "on_submit",
        },
        {
          key: "on_approve",
          channel: "email",
          subject: "Your Blue Badge application has been approved",
          bodyTemplate:
            "Dear {{firstName}},\n\nGood news — your Blue Badge application ({{reference}}) has been approved. Please pay the £10 fee to receive your badge. It will be posted within 10 working days.\n\nContoso Council Blue Badge team",
          trigger: "on_approve",
        },
      ],

      retentionPolicy: {
        retentionMonths: 96,
        deleteDocumentsAfterMonths: 48,
      },
    }
  );

  console.log("\n✅ Digital Permit Platform mobility permits seeded.\n");
}

main()
  .catch((e) => {
    console.error("❌ Permit seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
