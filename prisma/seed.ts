// ─────────────────────────────────────────────────────────────
// Seed data – Contoso Council Licensing Portal
// Run: npx tsx prisma/seed.ts
// ─────────────────────────────────────────────────────────────
import { PrismaClient, SystemRole, PaymentMode, ModuleVisibility } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Teams ──────────────────────────────────────────────────
  const taxiTeam = await prisma.team.upsert({
    where: { name: "Taxis and Private Hire" },
    update: {},
    create: {
      name: "Taxis and Private Hire",
      email: "taxis@contoso.gov.uk",
      description: "Taxi, private hire vehicle, and operator licensing",
    },
  });

  const alcoholTeam = await prisma.team.upsert({
    where: { name: "Alcohol and Entertainment" },
    update: {},
    create: {
      name: "Alcohol and Entertainment",
      email: "alcohol@contoso.gov.uk",
      description: "Premises, personal and TEN licensing",
    },
  });

  const generalTeam = await prisma.team.upsert({
    where: { name: "General Licensing" },
    update: {},
    create: {
      name: "General Licensing",
      email: "licensing@contoso.gov.uk",
      description: "General licensing including animals, street trading, gambling, etc.",
    },
  });

  console.log("✓ Teams created");

  // ─── Users ──────────────────────────────────────────────────
  const demoPassword = process.env.DEMO_PASSWORD;

  if (!demoPassword) {
    throw new Error(
      "DEMO_PASSWORD must be set before seeding demo users"
    );
  }

  const pw = await hash(demoPassword, 12);

  const _admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: SystemRole.ADMIN, teamId: generalTeam.id, passwordHash: pw },
    create: {
      email: "admin@example.com",
      passwordHash: pw,
      firstName: "Sarah",
      lastName: "Admin",
      role: SystemRole.ADMIN,
      emailVerified: true,
      teamId: generalTeam.id,
    },
  });

  const _manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: { role: SystemRole.MANAGER, teamId: taxiTeam.id, passwordHash: pw },
    create: {
      email: "manager@example.com",
      passwordHash: pw,
      firstName: "James",
      lastName: "Manager",
      role: SystemRole.MANAGER,
      emailVerified: true,
      teamId: taxiTeam.id,
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@example.com" },
    update: { role: SystemRole.REVIEWER, teamId: generalTeam.id, passwordHash: pw },
    create: {
      email: "reviewer@example.com",
      passwordHash: pw,
      firstName: "Emily",
      lastName: "Reviewer",
      role: SystemRole.REVIEWER,
      emailVerified: true,
      teamId: generalTeam.id,
    },
  });

  const applicant = await prisma.user.upsert({
    where: { email: "applicant@example.com" },
    update: { role: SystemRole.APPLICANT, passwordHash: pw },
    create: {
      email: "applicant@example.com",
      passwordHash: pw,
      firstName: "John",
      lastName: "Smith",
      role: SystemRole.APPLICANT,
      emailVerified: true,
    },
  });

  // Create applicant profile
  await prisma.applicantProfile.upsert({
    where: { userId: applicant.id },
    update: {},
    create: {
      userId: applicant.id,
      applicantType: "individual",
      dateOfBirth: new Date("1985-06-15"),
      addressLine1: "42 High Street",
      town: "Contoso",
      county: "Contoso County",
      postcode: "CN1 1AA",
    },
  });

  console.log("✓ Users created");

  // ─── Module Definitions ─────────────────────────────────────
  // Helper to create module + version
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

    // Check if version exists
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
    }

    return mod;
  }

  // ═══════════════════════════════════════════════════════════
  // TAXIS AND PRIVATE HIRE
  // ═══════════════════════════════════════════════════════════

  const _taxiDriverNew = await createModule("taxi_driver_new", "Taxi driver licence – new application", "Taxis and private hire", 1, {
    publicDescription: "Apply for a new hackney carriage or private hire driver licence. You must pass a DBS check, medical, knowledge test, and driving assessment before a licence can be granted.",
    beforeYouStartText: "Before you start, you will need:\n• A valid UK driving licence (held for at least 12 months)\n• Your DVLA online check code\n• A recent passport-style photo\n• Payment for the application fee\n• Your tax check code (if applicable)\n• Your enhanced DBS certificate (if on the DBS Update Service)",
    applicationTypes: ["new"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { new: 264 },
    owningTeamId: taxiTeam.id,
    submissionMailbox: "taxis@contoso.gov.uk",
    acceptingApplications: true,
    formSchema: [
      {
        key: "personal_details",
        title: "Personal details",
        description: "Your personal information",
        fields: [
          { key: "title", label: "Title", type: "select", required: true, options: [{ value: "mr", label: "Mr" }, { value: "mrs", label: "Mrs" }, { value: "ms", label: "Ms" }, { value: "miss", label: "Miss" }, { value: "dr", label: "Dr" }] },
          { key: "first_name", label: "First name", type: "text", required: true },
          { key: "middle_names", label: "Middle name(s)", type: "text", required: false },
          { key: "last_name", label: "Last name", type: "text", required: true },
          { key: "previous_names", label: "Previous names (if any)", type: "text", hint: "Include maiden name and any other names you have been known by" },
          { key: "date_of_birth", label: "Date of birth", type: "date", required: true },
          { key: "national_insurance", label: "National Insurance number", type: "text", required: true, hint: "For example, QQ 12 34 56 C" },
          { key: "email", label: "Email address", type: "email", required: true },
          { key: "phone", label: "Phone number", type: "phone", required: true },
          { key: "address", label: "Home address", type: "address", required: true },
        ],
      },
      {
        key: "driving_details",
        title: "Driving details",
        description: "Your driving licence and history",
        fields: [
          { key: "driving_licence_number", label: "Driving licence number", type: "text", required: true },
          { key: "licence_held_since", label: "Date you first obtained a full UK driving licence", type: "date", required: true },
          { key: "dvla_check_code", label: "DVLA online check code", type: "text", required: true, hint: "Get your code at www.gov.uk/view-driving-licence. It is valid for 21 days." },
          { key: "endorsements", label: "Do you have any current endorsements or penalty points?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { key: "endorsement_details", label: "Please provide details of endorsements", type: "textarea", conditionalOn: { field: "endorsements", operator: "eq", value: "yes" } },
        ],
      },
      {
        key: "tax_check",
        title: "Tax check",
        fields: [
          { key: "has_tax_check", label: "Do you have a tax check code?", type: "radio", required: true, hint: "A tax check is required if you are renewing or have previously held a licence", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No – this is my first licence application" }] },
          { key: "tax_check_code", label: "Tax check code", type: "text", conditionalOn: { field: "has_tax_check", operator: "eq", value: "yes" }, hint: "Your 9-character tax check code from HMRC" },
        ],
      },
      {
        key: "dbs",
        title: "DBS and right to work",
        description: "Disclosure and Barring Service check",
        fields: [
          { key: "dbs_update_service", label: "Are you registered with the DBS Update Service?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { key: "dbs_certificate_number", label: "DBS certificate number", type: "text", conditionalOn: { field: "dbs_update_service", operator: "eq", value: "yes" } },
          { key: "right_to_work", label: "Do you have the right to work in the UK?", type: "radio", required: true, options: [{ value: "yes_british", label: "Yes – British citizen" }, { value: "yes_settled", label: "Yes – settled status or indefinite leave" }, { value: "yes_visa", label: "Yes – work visa" }, { value: "no", label: "No" }] },
        ],
      },
      {
        key: "declarations",
        title: "Convictions and declarations",
        fields: [
          { key: "has_convictions", label: "Have you ever been convicted of any criminal offence or received a caution?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { key: "conviction_details", label: "Please provide full details", type: "textarea", conditionalOn: { field: "has_convictions", operator: "eq", value: "yes" } },
          { key: "has_pending", label: "Are you currently subject to any pending criminal proceedings?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { key: "pending_details", label: "Please provide details", type: "textarea", conditionalOn: { field: "has_pending", operator: "eq", value: "yes" } },
        ],
      },
    ],
    documentRequirements: [
      { key: "passport_photo", label: "Recent passport-style photograph", required: true, description: "A clear colour photo taken within the last 6 months", verificationStatus: "verified_public_page" },
      { key: "payment_receipt", label: "Payment receipt", required: true, description: "Receipt or confirmation of fee payment (£264)", verificationStatus: "verified_public_page" },
      { key: "dbs_certificate", label: "Enhanced DBS certificate", required: false, description: "Required if you are registered with the DBS Update Service", conditionalOn: { field: "dbs_update_service", operator: "eq", value: "yes" }, verificationStatus: "verified_public_page" },
      { key: "dbs_consent_form", label: "DBS Update Service consent form", required: false, description: "Required to check your DBS status online", conditionalOn: { field: "dbs_update_service", operator: "eq", value: "yes" }, verificationStatus: "verified_public_page" },
      { key: "medical_form", label: "Group 2 medical form", required: false, description: "Can be uploaded later – completed by your GP", verificationStatus: "verified_public_page" },
      { key: "right_to_work_doc", label: "Right to work evidence", required: true, description: "Passport, visa, or share code", verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Application validation", order: 1, type: "validation", slaBusinessDays: 5, visibleToApplicant: true },
      { key: "dbs_check", label: "DBS check", order: 2, type: "review", slaBusinessDays: 10, visibleToApplicant: true },
      { key: "right_to_work", label: "Right to work check", order: 3, type: "review", slaBusinessDays: 5 },
      { key: "driving_assessment", label: "Road safety / driving assessment", order: 4, type: "training", slaBusinessDays: 20, visibleToApplicant: true },
      { key: "knowledge_test", label: "Driver awareness / knowledge course", order: 5, type: "training", slaBusinessDays: 20, visibleToApplicant: true },
      { key: "safeguarding", label: "Safeguarding and disability awareness", order: 6, type: "training", slaBusinessDays: 20, visibleToApplicant: true },
      { key: "medical_received", label: "Medical form received", order: 7, type: "review", slaBusinessDays: 30, visibleToApplicant: true },
      { key: "decision", label: "Decision", order: 8, type: "decision", slaBusinessDays: 5, visibleToApplicant: true },
    ],
    reviewChecklist: [
      { key: "identity_verified", label: "Applicant identity verified", required: true },
      { key: "dvla_checked", label: "DVLA check completed – licence valid", required: true },
      { key: "dbs_satisfactory", label: "DBS check satisfactory", required: true },
      { key: "rtw_confirmed", label: "Right to work confirmed", required: true },
      { key: "medical_satisfactory", label: "Group 2 medical satisfactory", required: true },
      { key: "driving_assessment_passed", label: "Driving assessment passed", required: true },
      { key: "knowledge_test_passed", label: "Knowledge course completed", required: true },
      { key: "safeguarding_passed", label: "Safeguarding training completed", required: true },
      { key: "tax_check_confirmed", label: "Tax check verified (if applicable)", required: false },
      { key: "fit_and_proper", label: "Fit and proper person assessment completed", required: true },
    ],
  });

  await createModule("taxi_driver_renewal", "Taxi driver licence – renewal", "Taxis and private hire", 2, {
    publicDescription: "Renew your existing hackney carriage or private hire driver licence.",
    applicationTypes: ["renewal"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { renewal: 264 },
    owningTeamId: taxiTeam.id,
    acceptingApplications: true,
    formSchema: [
      { key: "personal_details", title: "Personal details", fields: [
        { key: "first_name", label: "First name", type: "text", required: true },
        { key: "last_name", label: "Last name", type: "text", required: true },
        { key: "current_licence_number", label: "Current licence number", type: "text", required: true },
        { key: "email", label: "Email address", type: "email", required: true },
        { key: "phone", label: "Phone number", type: "phone", required: true },
        { key: "address", label: "Home address", type: "address", required: true },
      ]},
      { key: "tax_check", title: "Tax check", fields: [
        { key: "tax_check_code", label: "Tax check code", type: "text", required: true, hint: "A tax check is required for renewals. Get your code from HMRC." },
      ]},
      { key: "declarations", title: "Declarations", fields: [
        { key: "changes_since_last", label: "Have there been any changes to your circumstances since your last application?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        { key: "change_details", label: "Please describe the changes", type: "textarea", conditionalOn: { field: "changes_since_last", operator: "eq", value: "yes" } },
      ]},
    ],
    documentRequirements: [
      { key: "passport_photo", label: "Recent passport-style photograph", required: true, verificationStatus: "verified_public_page" },
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      { key: "medical_form", label: "Group 2 medical (if due)", required: false, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Validation", order: 1, type: "validation", slaBusinessDays: 5 },
      { key: "review", label: "Review", order: 2, type: "review", slaBusinessDays: 10 },
      { key: "decision", label: "Decision", order: 3, type: "decision", slaBusinessDays: 5 },
    ],
    reviewChecklist: [
      { key: "tax_check", label: "Tax check verified", required: true },
      { key: "dbs_valid", label: "DBS still valid", required: true },
      { key: "medical_valid", label: "Medical valid", required: true },
      { key: "fit_proper", label: "Fit and proper assessment", required: true },
    ],
  });

  await createModule("private_hire_vehicle_standard_new", "Private hire vehicle licence – new (standard)", "Taxis and private hire", 3, {
    publicDescription: "Apply for a new standard private hire vehicle licence. Your vehicle must meet the council's age, emissions, and safety requirements.",
    beforeYouStartText: "You will need:\n• Vehicle registration document (V5C) or V5/2 with proof of purchase\n• MOT certificate issued within the previous 10 working days\n• Private hire insurance certificate\n• Public liability insurance (minimum £5,000,000)\n• Proof of vehicle tax\n• Emissions compliance evidence\n• NCAP safety rating or VCA/IAC/IVA evidence\n• Meter calibration certificate (if fitted)\n• Payment receipt",
    applicationTypes: ["new"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { new: 225 },
    owningTeamId: taxiTeam.id,
    acceptingApplications: true,
    formSchema: [
      { key: "applicant_details", title: "Applicant details", fields: [
        { key: "applicant_type", label: "Are you applying as an individual or company?", type: "radio", required: true, options: [{ value: "individual", label: "Individual" }, { value: "company", label: "Company" }] },
        { key: "first_name", label: "First name", type: "text", required: true },
        { key: "last_name", label: "Last name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
        { key: "address", label: "Address", type: "address", required: true },
        { key: "existing_licence_holder", label: "Are you an existing council licence holder?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      ]},
      { key: "vehicle_details", title: "Vehicle details", fields: [
        { key: "registration", label: "Vehicle registration number", type: "text", required: true },
        { key: "make", label: "Make", type: "text", required: true },
        { key: "model", label: "Model", type: "text", required: true },
        { key: "colour", label: "Colour", type: "text", required: true },
        { key: "year", label: "Year of manufacture", type: "number", required: true },
        { key: "engine_type", label: "Engine type", type: "select", required: true, options: [{ value: "petrol", label: "Petrol" }, { value: "diesel", label: "Diesel" }, { value: "hybrid", label: "Hybrid" }, { value: "electric", label: "Electric" }, { value: "lpg", label: "LPG" }] },
        { key: "seats", label: "Number of passenger seats", type: "number", required: true },
        { key: "wheelchair_accessible", label: "Is the vehicle wheelchair accessible?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        { key: "meter_fitted", label: "Is a meter fitted?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      ]},
    ],
    documentRequirements: [
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      { key: "mot", label: "MOT certificate (issued within 10 working days)", required: true, verificationStatus: "verified_public_page" },
      { key: "private_hire_insurance", label: "Private hire insurance certificate", required: true, verificationStatus: "verified_public_page" },
      { key: "public_liability", label: "Public liability insurance (min £5,000,000)", required: true, verificationStatus: "verified_public_page" },
      { key: "v5c", label: "V5C or V5/2 plus proof of purchase", required: true, verificationStatus: "verified_public_page" },
      { key: "emissions_evidence", label: "Emissions / age compliance evidence", required: true, verificationStatus: "verified_public_page" },
      { key: "ncap_evidence", label: "NCAP or VCA / IAC / IVA evidence", required: false, verificationStatus: "verified_public_page" },
      { key: "vehicle_tax", label: "Vehicle tax proof", required: true, verificationStatus: "verified_public_page" },
      { key: "meter_cert", label: "Meter calibration certificate", required: false, conditionalOn: { field: "meter_fitted", operator: "eq", value: "yes" }, verificationStatus: "verified_public_page" },
      { key: "wheelchair_cert", label: "Ramp / wheelchair restraint certificates", required: false, conditionalOn: { field: "wheelchair_accessible", operator: "eq", value: "yes" }, verificationStatus: "verified_public_page" },
      { key: "convictions_form", label: "Convictions form / basic DBS", required: false, description: "Required if not already a council-licensed driver", conditionalOn: { field: "existing_licence_holder", operator: "eq", value: "no" }, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Application validation", order: 1, type: "validation", slaBusinessDays: 5 },
      { key: "fit_proper", label: "Fit and proper checks", order: 2, type: "review", slaBusinessDays: 10 },
      { key: "compliance", label: "Compliance appointment", order: 3, type: "inspection", slaBusinessDays: 15 },
      { key: "plate_issue", label: "Plate issue", order: 4, type: "decision", slaBusinessDays: 5 },
    ],
    reviewChecklist: [
      { key: "docs_complete", label: "All required documents received and valid", required: true },
      { key: "vehicle_age", label: "Vehicle meets age policy", required: true },
      { key: "emissions", label: "Vehicle meets emissions standards", required: true },
      { key: "insurance_valid", label: "Insurance verified", required: true },
      { key: "mot_valid", label: "MOT valid and within date", required: true },
      { key: "applicant_checks", label: "Applicant checks completed", required: true },
    ],
  });

  // Simplified versions for remaining taxi modules
  for (const mod of [
    { key: "private_hire_vehicle_standard_renewal", name: "Private hire vehicle licence – renewal (standard)", sort: 4 },
    { key: "hackney_carriage_vehicle_new", name: "Hackney carriage vehicle licence – new", sort: 5 },
    { key: "hackney_carriage_vehicle_renewal", name: "Hackney carriage vehicle licence – renewal", sort: 6 },
    { key: "executive_private_hire_vehicle_new", name: "Executive private hire vehicle licence – new", sort: 7 },
    { key: "executive_private_hire_vehicle_renewal", name: "Executive private hire vehicle licence – renewal", sort: 8 },
    { key: "novelty_private_hire_vehicle_new", name: "Novelty private hire vehicle licence – new", sort: 9 },
    { key: "novelty_private_hire_vehicle_renewal", name: "Novelty private hire vehicle licence – renewal", sort: 10 },
    { key: "private_hire_operator_new", name: "Private hire operator licence – new", sort: 11 },
    { key: "private_hire_operator_renewal", name: "Private hire operator licence – renewal", sort: 12 },
  ]) {
    await createModule(mod.key, mod.name, "Taxis and private hire", mod.sort, {
      publicDescription: `Apply for a ${mod.name.toLowerCase()}.`,
      applicationTypes: [mod.key.includes("renewal") ? "renewal" : "new"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      feeSchedule: { [mod.key.includes("renewal") ? "renewal" : "new"]: 225 },
      owningTeamId: taxiTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "first_name", label: "First name", type: "text", required: true },
        { key: "last_name", label: "Last name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
      ]}],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
        { key: "supporting_docs", label: "Supporting documents", required: false, description: "See application pack for full requirements", verificationStatus: "needs_council_confirmation" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation", slaBusinessDays: 5 },
        { key: "review", label: "Review", order: 2, type: "review", slaBusinessDays: 10 },
        { key: "decision", label: "Decision", order: 3, type: "decision", slaBusinessDays: 5 },
      ],
      reviewChecklist: [{ key: "full_review", label: "Full application review completed", required: true }],
    });
  }

  console.log("✓ Taxis and private hire modules created");

  // ═══════════════════════════════════════════════════════════
  // ALCOHOL AND ENTERTAINMENT
  // ═══════════════════════════════════════════════════════════

  await createModule("premises_licence_new", "New premises licence", "Alcohol and entertainment", 1, {
    publicDescription: "Apply for a new premises licence to sell alcohol and/or provide regulated entertainment. A 28-day consultation period applies.",
    beforeYouStartText: "You will need:\n• A completed premises plan\n• Payment for the application fee (based on rateable value)\n• Right to work evidence (for individual applicants)\n• Details of designated premises supervisor (DPS)",
    applicationTypes: ["new"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { new: 315 },
    owningTeamId: alcoholTeam.id,
    acceptingApplications: true,
    formSchema: [
      { key: "applicant", title: "Applicant details", fields: [
        { key: "applicant_type", label: "Applicant type", type: "select", required: true, options: [{ value: "individual", label: "Individual" }, { value: "company", label: "Company" }, { value: "partnership", label: "Partnership" }, { value: "club", label: "Club or association" }] },
        { key: "name", label: "Full name / Company name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
        { key: "address", label: "Address", type: "address", required: true },
      ]},
      { key: "premises", title: "Premises details", fields: [
        { key: "premises_name", label: "Trading name of premises", type: "text", required: true },
        { key: "premises_address", label: "Premises address", type: "address", required: true },
        { key: "premises_postcode", label: "Premises postcode", type: "postcode", required: true },
        { key: "premises_description", label: "Description of premises", type: "textarea", required: true },
        { key: "rateable_value", label: "Rateable value band", type: "select", required: true, options: [{ value: "A", label: "Band A (£0 – £4,300)" }, { value: "B", label: "Band B (£4,301 – £33,000)" }, { value: "C", label: "Band C (£33,001 – £87,000)" }, { value: "D", label: "Band D (£87,001 – £125,000)" }, { value: "E", label: "Band E (£125,001+)" }] },
      ]},
      { key: "activities", title: "Licensable activities", fields: [
        { key: "sell_alcohol", label: "Sale of alcohol", type: "checkbox" },
        { key: "alcohol_on_off", label: "Alcohol – on or off the premises?", type: "radio", conditionalOn: { field: "sell_alcohol", operator: "eq", value: true }, options: [{ value: "on", label: "On the premises" }, { value: "off", label: "Off the premises" }, { value: "both", label: "Both on and off" }] },
        { key: "films", label: "Exhibition of films", type: "checkbox" },
        { key: "indoor_sport", label: "Indoor sporting events", type: "checkbox" },
        { key: "live_music", label: "Live music", type: "checkbox" },
        { key: "recorded_music", label: "Recorded music", type: "checkbox" },
        { key: "dance", label: "Performances of dance", type: "checkbox" },
        { key: "late_night", label: "Late night refreshment", type: "checkbox" },
      ]},
      { key: "dps", title: "Designated Premises Supervisor", fields: [
        { key: "dps_name", label: "DPS full name", type: "text", required: true },
        { key: "dps_licence_number", label: "DPS personal licence number", type: "text", required: true },
        { key: "dps_issuing_authority", label: "Personal licence issuing authority", type: "text", required: true },
      ]},
    ],
    documentRequirements: [
      { key: "premises_plan", label: "Premises plan", required: true, verificationStatus: "verified_public_page" },
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      { key: "right_to_work", label: "Right to work evidence", required: false, description: "Required for individual applicants", conditionalOn: { field: "applicant_type", operator: "eq", value: "individual" }, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Application validation", order: 1, type: "validation", slaBusinessDays: 5 },
      { key: "consultation", label: "28-day consultation period", order: 2, type: "consultation", slaBusinessDays: 28, visibleToApplicant: true },
      { key: "representations", label: "Representations review", order: 3, type: "review", slaBusinessDays: 5 },
      { key: "hearing", label: "Licensing hearing (if required)", order: 4, type: "hearing", slaBusinessDays: 20 },
      { key: "decision", label: "Decision", order: 5, type: "decision", slaBusinessDays: 5, visibleToApplicant: true },
    ],
    reviewChecklist: [
      { key: "plan_adequate", label: "Premises plan is adequate", required: true },
      { key: "fee_correct", label: "Correct fee paid", required: true },
      { key: "rtw_checked", label: "Right to work checked (if individual)", required: false },
      { key: "consultation_complete", label: "All RA consultations completed", required: true },
      { key: "representations_reviewed", label: "Representations reviewed", required: true },
      { key: "dps_personal_licence", label: "DPS personal licence verified", required: true },
    ],
  });

  await createModule("personal_licence_new", "New personal licence", "Alcohol and entertainment", 2, {
    publicDescription: "Apply for a personal licence to authorise the sale of alcohol.",
    applicationTypes: ["new"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { new: 37 },
    owningTeamId: alcoholTeam.id,
    acceptingApplications: true,
    formSchema: [{ key: "details", title: "Application details", fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "address", label: "Address", type: "address", required: true },
      { key: "dob", label: "Date of birth", type: "date", required: true },
      { key: "qualification", label: "Name of licensing qualification", type: "text", required: true },
      { key: "has_convictions", label: "Do you have any unspent criminal convictions?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "conviction_details", label: "Conviction details", type: "textarea", conditionalOn: { field: "has_convictions", operator: "eq", value: "yes" } },
    ]}],
    documentRequirements: [
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      { key: "photos", label: "Two recent passport photographs", required: true, verificationStatus: "verified_public_page" },
      { key: "qualification_cert", label: "Accredited licensing qualification certificate", required: true, verificationStatus: "verified_public_page" },
      { key: "dbs", label: "Basic DBS or conviction evidence", required: true, verificationStatus: "verified_public_page" },
      { key: "disclosure_form", label: "Disclosure of convictions form", required: true, verificationStatus: "verified_public_page" },
      { key: "right_to_work", label: "Right to work evidence", required: true, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Validation", order: 1, type: "validation", slaBusinessDays: 5 },
      { key: "review", label: "Review", order: 2, type: "review", slaBusinessDays: 10 },
      { key: "decision", label: "Decision", order: 3, type: "decision" },
    ],
    reviewChecklist: [
      { key: "photos_endorsed", label: "Photos endorsed", required: true },
      { key: "qual_valid", label: "Qualification valid", required: true },
      { key: "dbs_reviewed", label: "DBS reviewed", required: true },
      { key: "rtw_checked", label: "Right to work checked", required: true },
    ],
  });

  await createModule("temporary_event_notice", "Temporary event notice (TEN)", "Alcohol and entertainment", 3, {
    publicDescription: "Give a temporary event notice for licensable activities at a temporary event.",
    applicationTypes: ["notice"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    feeSchedule: { notice: 21 },
    owningTeamId: alcoholTeam.id,
    acceptingApplications: true,
    formSchema: [
      { key: "applicant", title: "Your details", fields: [
        { key: "name", label: "Full name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
        { key: "address", label: "Address", type: "address", required: true },
      ]},
      { key: "event", title: "Event details", fields: [
        { key: "event_name", label: "Event name", type: "text", required: true },
        { key: "event_location", label: "Event location / address", type: "address", required: true },
        { key: "what3words", label: "What3words reference (optional)", type: "text", hint: "e.g. ///filled.count.soap" },
        { key: "event_date_start", label: "Event start date", type: "date", required: true },
        { key: "event_date_end", label: "Event end date", type: "date", required: true },
        { key: "event_times", label: "Event times", type: "text", required: true, hint: "e.g. 12:00 to 23:00" },
        { key: "max_attendees", label: "Maximum number of attendees", type: "number", required: true, hint: "Must not exceed 499" },
        { key: "licensable_activities", label: "Licensable activities at the event", type: "textarea", required: true },
      ]},
    ],
    documentRequirements: [
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      { key: "event_plan", label: "Event plan / map (optional)", required: false, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Validation", order: 1, type: "validation", slaBusinessDays: 2 },
      { key: "consultation", label: "Statutory consultation", order: 2, type: "consultation", slaBusinessDays: 10 },
      { key: "objection_review", label: "Objection review", order: 3, type: "review" },
      { key: "issue_ten", label: "Issue endorsed TEN", order: 4, type: "decision" },
    ],
    reviewChecklist: [
      { key: "limits_ok", label: "Within TEN limits for applicant", required: true },
      { key: "time_ok", label: "Notice period meets statutory minimum", required: true },
      { key: "police_consulted", label: "Police consulted", required: true },
      { key: "eh_consulted", label: "Environmental health consulted", required: true },
    ],
  });

  // Remaining alcohol modules - simplified
  for (const mod of [
    { key: "premises_licence_transfer", name: "Transfer of premises licence", sort: 4 },
    { key: "premises_licence_variation_full", name: "Premises licence variation (full)", sort: 5 },
    { key: "premises_licence_variation_minor", name: "Premises licence variation (minor)", sort: 6 },
    { key: "club_premises_certificate", name: "Club premises certificate", sort: 7 },
    { key: "designated_premises_supervisor_variation", name: "DPS variation", sort: 8 },
    { key: "designated_premises_supervisor_disapplication", name: "DPS disapplication", sort: 9 },
    { key: "notification_of_interest", name: "Notification of interest", sort: 10 },
    { key: "interim_authority_notice", name: "Interim authority notice", sort: 11 },
  ]) {
    await createModule(mod.key, mod.name, "Alcohol and entertainment", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: ["new"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      owningTeamId: alcoholTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Full name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
      ]}],
      documentRequirements: [
        { key: "supporting_docs", label: "Supporting documents", required: false, verificationStatus: "needs_council_confirmation" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "review", label: "Review", order: 2, type: "review" },
        { key: "decision", label: "Decision", order: 3, type: "decision" },
      ],
      reviewChecklist: [{ key: "review", label: "Application reviewed", required: true }],
    });
  }

  console.log("✓ Alcohol and entertainment modules created");

  // ═══════════════════════════════════════════════════════════
  // ANIMALS
  // ═══════════════════════════════════════════════════════════

  const animalModules = [
    { key: "dog_breeding", name: "Dog breeding licence", sort: 1 },
    { key: "hiring_out_horses", name: "Hiring out horses", sort: 2 },
    { key: "animals_for_exhibition", name: "Animals for exhibition", sort: 3 },
    { key: "boarding_cats", name: "Cat boarding licence", sort: 4 },
    { key: "boarding_dogs_kennels", name: "Dog boarding (kennels)", sort: 5 },
    { key: "dog_day_care", name: "Dog day care", sort: 6 },
    { key: "dog_home_boarding", name: "Dog home boarding", sort: 7 },
    { key: "selling_animals_as_pets", name: "Selling animals as pets", sort: 8 },
    { key: "dangerous_wild_animals", name: "Dangerous wild animals licence", sort: 9 },
    { key: "zoo_licence", name: "Zoo licence", sort: 10 },
  ];

  for (const mod of animalModules) {
    await createModule(mod.key, mod.name, "Animals", mod.sort, {
      publicDescription: `Apply for a ${mod.name.toLowerCase()}.`,
      applicationTypes: ["new", "renewal"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      feeSchedule: { new: 250, renewal: 200 },
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [
        { key: "applicant", title: "Applicant details", fields: [
          { key: "name", label: "Full name / Business name", type: "text", required: true },
          { key: "email", label: "Email", type: "email", required: true },
          { key: "phone", label: "Phone", type: "phone", required: true },
          { key: "address", label: "Address", type: "address", required: true },
        ]},
        { key: "premises", title: "Premises details", fields: [
          { key: "premises_address", label: "Premises address (if different)", type: "address" },
          { key: "premises_description", label: "Description of premises and facilities", type: "textarea", required: true },
          ...(mod.key === "dangerous_wild_animals" ? [{ key: "species", label: "Species of animals kept", type: "textarea", required: true }] : []),
          ...(mod.key === "zoo_licence" ? [{ key: "notice_of_intent", label: "Have you submitted a notice of intent?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] }] : []),
        ]},
      ],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
        ...(mod.key === "dangerous_wild_animals" ? [{ key: "public_liability", label: "Public liability insurance", required: true, verificationStatus: "verified_public_page" }] : []),
        { key: "supporting_docs", label: "Supporting documents per application pack", required: false, verificationStatus: "needs_council_confirmation" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation", slaBusinessDays: 5 },
        { key: "inspection", label: "Inspection", order: 2, type: "inspection", slaBusinessDays: 20 },
        ...(mod.key === "dangerous_wild_animals" || mod.key === "zoo_licence" ? [{ key: "vet_inspection", label: "Vet inspection", order: 3, type: "inspection", slaBusinessDays: 30 }] : []),
        { key: "decision", label: "Decision", order: 10, type: "decision", slaBusinessDays: 5 },
      ],
      reviewChecklist: [
        { key: "inspection_passed", label: "Inspection completed satisfactorily", required: true },
        { key: "star_rating", label: "Star rating assigned (where applicable)", required: false },
        { key: "risk_band", label: "Risk band assessed", required: false },
        { key: "conditions_set", label: "Licence conditions reviewed/set", required: true },
      ],
    });
  }

  console.log("✓ Animal modules created");

  // ═══════════════════════════════════════════════════════════
  // REMAINING CATEGORIES (Skin piercing, Street, Gambling, etc.)
  // ═══════════════════════════════════════════════════════════

  // Skin piercing
  for (const mod of [
    { key: "skin_piercing_personal_registration", name: "Skin piercing – personal registration", sort: 1 },
    { key: "skin_piercing_business_registration", name: "Skin piercing – business registration", sort: 2 },
  ]) {
    await createModule(mod.key, mod.name, "Skin piercing", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: ["registration"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      feeSchedule: { registration: mod.key.includes("business") ? 160 : 65 },
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Full name / Business name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "address", label: "Address", type: "address", required: true },
        ...(mod.key.includes("business") ? [{ key: "linked_personal_registrations", label: "Personal registrations to include", type: "repeatable", repeatableSchema: [
          { key: "person_name", label: "Person name", type: "text", required: true },
          { key: "person_email", label: "Email", type: "email" },
        ]}] : []),
      ]}],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "inspection", label: "Inspection", order: 2, type: "inspection" },
        { key: "decision", label: "Decision", order: 3, type: "decision" },
      ],
      reviewChecklist: [{ key: "inspection_done", label: "Inspection completed", required: true }],
    });
  }

  // Street licences
  for (const mod of [
    { key: "street_trading_new", name: "Street trading consent – new", sort: 1, fee: 200 },
    { key: "street_trading_renewal", name: "Street trading consent – renewal", sort: 2, fee: 200 },
    { key: "street_trading_special_event", name: "Street trading – special event", sort: 3, fee: 50 },
    { key: "pavement_licence", name: "Pavement licence", sort: 4, fee: 100 },
    { key: "pavement_permit_new", name: "Pavement permit – new", sort: 5, fee: 100 },
    { key: "pavement_permit_renewal", name: "Pavement permit – renewal", sort: 6, fee: 100 },
    { key: "house_to_house_collection", name: "House to house collection", sort: 7, fee: 0 },
    { key: "street_collection", name: "Street collection", sort: 8, fee: 0 },
    { key: "free_printed_matter", name: "Distribution of free printed matter", sort: 9, fee: 25 },
    { key: "pedlars_certificate_advice", name: "Pedlar's certificate – advice", sort: 10, fee: 0 },
  ]) {
    await createModule(mod.key, mod.name, "Street licences and permits", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: [mod.key.includes("renewal") ? "renewal" : "new"],
      paymentMode: mod.fee > 0 ? PaymentMode.RECEIPT_UPLOAD : PaymentMode.NO_FEE,
      feeSchedule: mod.fee > 0 ? { [mod.key.includes("renewal") ? "renewal" : "new"]: mod.fee } : null,
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Name / Organisation", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
        ...(mod.key.includes("pavement") ? [
          { key: "location", label: "Location / Address", type: "address", required: true },
          { key: "furniture_description", label: "Description of proposed furniture / placement", type: "textarea", required: true },
        ] : []),
        ...(mod.key.includes("street_trading") ? [
          { key: "location", label: "Trading location", type: "text", required: true },
          { key: "items_sold", label: "Goods to be sold", type: "textarea", required: true },
          { key: "food_business", label: "Will you be selling food or drink?", type: "radio", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        ] : []),
        ...(mod.key === "free_printed_matter" ? [
          { key: "permit_period", label: "Permit period", type: "select", required: true, options: [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" }] },
        ] : []),
      ]}],
      documentRequirements: [
        ...(mod.fee > 0 ? [{ key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" as const }] : []),
        ...(mod.key.includes("pavement") ? [
          { key: "site_plan", label: "Site plan", required: true, verificationStatus: "verified_public_page" as const },
          { key: "public_liability", label: "Public liability insurance (£5m)", required: true, verificationStatus: "verified_public_page" as const },
        ] : []),
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "review", label: "Review", order: 2, type: "review" },
        { key: "decision", label: "Decision", order: 3, type: "decision" },
      ],
      reviewChecklist: [{ key: "review", label: "Application reviewed", required: true }],
    });
  }

  // Gambling
  for (const mod of [
    { key: "gambling_premises_licence", name: "Gambling premises licence", sort: 1, fee: 500 },
    { key: "gaming_machine_permit", name: "Gaming machine permit", sort: 2, fee: 300 },
    { key: "club_gaming_or_club_machine_permit", name: "Club gaming / club machine permit", sort: 3, fee: 200 },
    { key: "occasional_use_notice", name: "Occasional use notice", sort: 4, fee: 0 },
    { key: "small_society_lottery_registration", name: "Small society lottery registration", sort: 5, fee: 40 },
    { key: "prize_gaming_permit", name: "Prize gaming permit", sort: 6, fee: 300 },
    { key: "unlicensed_family_entertainment_centre_permit", name: "Unlicensed FEC gaming permit", sort: 7, fee: 300 },
  ]) {
    await createModule(mod.key, mod.name, "Gambling", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: ["new"],
      paymentMode: mod.fee > 0 ? PaymentMode.RECEIPT_UPLOAD : PaymentMode.NO_FEE,
      feeSchedule: mod.fee > 0 ? { new: mod.fee } : null,
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Name / Company", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: true },
        ...(mod.key === "gambling_premises_licence" ? [
          { key: "operating_licence_number", label: "Operating licence number", type: "text", required: true },
          { key: "premises_address", label: "Premises address", type: "address", required: true },
        ] : []),
        ...(mod.key === "occasional_use_notice" ? [
          { key: "location", label: "Location", type: "text", required: true },
          { key: "event_date", label: "Date", type: "date", required: true },
          { key: "event_times", label: "Times", type: "text", required: true },
        ] : []),
      ]}],
      documentRequirements: [
        ...(mod.fee > 0 ? [{ key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" as const }] : []),
        ...(mod.key === "gambling_premises_licence" ? [{ key: "premises_plan", label: "Premises plan", required: true, verificationStatus: "verified_public_page" as const }] : []),
        { key: "supporting_docs", label: "Additional requirements per form pack", required: false, verificationStatus: "needs_council_confirmation" as const },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        ...(mod.key === "gambling_premises_licence" ? [{ key: "consultation", label: "Consultation", order: 2, type: "consultation" }] : []),
        { key: "review", label: "Review", order: 5, type: "review" },
        { key: "decision", label: "Decision", order: 10, type: "decision" },
      ],
      reviewChecklist: [{ key: "review", label: "Application reviewed", required: true }],
    });
  }

  // Caravan sites
  await createModule("caravan_site_licence", "Caravan site licence", "Caravan sites", 1, {
    publicDescription: "Apply for a caravan site licence.",
    applicationTypes: ["new"],
    paymentMode: PaymentMode.RECEIPT_UPLOAD,
    owningTeamId: generalTeam.id,
    acceptingApplications: true,
    formSchema: [{ key: "details", title: "Application details", fields: [
      { key: "name", label: "Applicant name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "site_address", label: "Site address", type: "address", required: true },
      { key: "has_planning", label: "Do you have planning permission?", type: "radio", required: true, options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { key: "planning_reference", label: "Planning reference", type: "text", conditionalOn: { field: "has_planning", operator: "eq", value: "yes" } },
    ]}],
    documentRequirements: [
      { key: "site_plan", label: "Site plan at 1:1500 scale", required: true, verificationStatus: "verified_public_page" },
      { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
    ],
    workflowDefinition: [
      { key: "validation", label: "Validation", order: 1, type: "validation" },
      { key: "review", label: "Review", order: 2, type: "review" },
      { key: "decision", label: "Decision", order: 3, type: "decision" },
    ],
    reviewChecklist: [
      { key: "planning_checked", label: "Planning permission verified", required: true },
      { key: "site_plan_ok", label: "Site plan adequate", required: true },
    ],
  });

  // Explosives and fireworks
  for (const mod of [
    { key: "fireworks_sale_licence", name: "Fireworks sale licence", sort: 1 },
    { key: "explosives_storage_licence", name: "Explosives storage licence", sort: 2 },
  ]) {
    await createModule(mod.key, mod.name, "Explosives and fireworks", mod.sort, {
      publicDescription: `Apply for a ${mod.name.toLowerCase()}.`,
      applicationTypes: ["new"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "premises_address", label: "Premises address", type: "address", required: true },
      ]}],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
        { key: "supporting_docs", label: "Supporting documents", required: false, verificationStatus: "needs_council_confirmation" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "review", label: "Review", order: 2, type: "review" },
        { key: "decision", label: "Decision", order: 3, type: "decision" },
      ],
      reviewChecklist: [{ key: "review", label: "Application reviewed", required: true }],
    });
  }

  // Scrap metal
  for (const mod of [
    { key: "scrap_metal_site_new", name: "Scrap metal dealer – site licence (new)", sort: 1, fee: 400 },
    { key: "scrap_metal_site_renewal", name: "Scrap metal dealer – site licence (renewal)", sort: 2, fee: 400 },
    { key: "scrap_metal_collector_new", name: "Scrap metal collector licence (new)", sort: 3, fee: 300 },
    { key: "scrap_metal_collector_renewal", name: "Scrap metal collector licence (renewal)", sort: 4, fee: 300 },
    { key: "scrap_metal_variations", name: "Scrap metal licence variation", sort: 5, fee: 100 },
  ]) {
    await createModule(mod.key, mod.name, "Scrap metal", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: [mod.key.includes("renewal") ? "renewal" : mod.key.includes("variation") ? "variation" : "new"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      feeSchedule: { [mod.key.includes("renewal") ? "renewal" : mod.key.includes("variation") ? "variation" : "new"]: mod.fee },
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Name / Business name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "address", label: "Address", type: "address", required: true },
        { key: "bank_details", label: "Bank account details (statement or letter on bank letterhead)", type: "text", required: true, hint: "Needed to verify identity and for payments" },
      ]}],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
        { key: "basic_dbs", label: "Basic DBS certificate", required: true, verificationStatus: "verified_public_page" },
        { key: "bank_evidence", label: "Bank account evidence", required: true, verificationStatus: "verified_public_page" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "review", label: "Review", order: 2, type: "review" },
        { key: "decision", label: "Decision", order: 3, type: "decision" },
      ],
      reviewChecklist: [
        { key: "dbs_ok", label: "Basic DBS reviewed", required: true },
        { key: "bank_ok", label: "Bank details verified", required: true },
      ],
    });
  }

  // Sex establishment
  for (const mod of [
    { key: "sex_establishment_new", name: "Sex establishment licence – new", sort: 1 },
    { key: "sex_establishment_renewal", name: "Sex establishment licence – renewal", sort: 2 },
    { key: "sex_establishment_transfer", name: "Sex establishment licence – transfer", sort: 3 },
    { key: "sex_establishment_variation", name: "Sex establishment licence – variation", sort: 4 },
  ]) {
    await createModule(mod.key, mod.name, "Sex establishment", mod.sort, {
      publicDescription: `Apply for ${mod.name.toLowerCase()}.`,
      applicationTypes: [mod.key.includes("renewal") ? "renewal" : mod.key.includes("transfer") ? "transfer" : mod.key.includes("variation") ? "variation" : "new"],
      paymentMode: PaymentMode.RECEIPT_UPLOAD,
      owningTeamId: generalTeam.id,
      acceptingApplications: true,
      formSchema: [{ key: "details", title: "Application details", fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "premises_address", label: "Premises address", type: "address", required: true },
      ]}],
      documentRequirements: [
        { key: "payment_receipt", label: "Payment receipt", required: true, verificationStatus: "verified_public_page" },
        { key: "supporting_docs", label: "Supporting documents per form pack", required: false, verificationStatus: "needs_council_confirmation" },
      ],
      workflowDefinition: [
        { key: "validation", label: "Validation", order: 1, type: "validation" },
        { key: "consultation", label: "Consultation", order: 2, type: "consultation" },
        { key: "review", label: "Review", order: 3, type: "review" },
        { key: "decision", label: "Decision", order: 4, type: "decision" },
      ],
      reviewChecklist: [{ key: "review", label: "Application reviewed", required: true }],
    });
  }

  console.log("✓ All remaining category modules created");

  // ═══════════════════════════════════════════════════════════
  // SAMPLE APPLICATIONS (demo data)
  // ═══════════════════════════════════════════════════════════

  const sampleModuleKeys = [
    "taxi_driver_new",
    "private_hire_vehicle_standard_new",
    "premises_licence_new",
    "temporary_event_notice",
    "pavement_permit_new",
    "gambling_premises_licence",
    "dog_breeding",
    "scrap_metal_collector_new",
    "skin_piercing_business_registration",
  ];

  let appSeq = 1;
  for (const moduleKey of sampleModuleKeys) {
    const mod = await prisma.licenceModule.findUnique({
      where: { moduleKey },
      include: { versions: { where: { isActive: true }, take: 1 } },
    });

    if (!mod || mod.versions.length === 0) continue;

    const version = mod.versions[0];
    const refNumber = `DP-DEMO-202603-${String(appSeq).padStart(5, "0")}`;

    // Check if sample already exists
    const existing = await prisma.application.findUnique({
      where: { referenceNumber: refNumber },
    });

    if (!existing) {
      const sampleApp = await prisma.application.create({
        data: {
          referenceNumber: refNumber,
          moduleId: mod.id,
          moduleVersionId: version.id,
          applicationType: "new",
          applicantId: applicant.id,
          status: appSeq <= 3 ? "SUBMITTED" : appSeq <= 5 ? "UNDER_REVIEW" : "DRAFT",
          currentStage: appSeq <= 5 ? "validation" : null,
          submittedAt: appSeq <= 5 ? new Date() : null,
          answers: {
            details: {
              name: "John Smith",
              email: "applicant@example.com",
              phone: "01234 567890",
            },
            ...(moduleKey === "taxi_driver_new"
              ? {
                  personal_details: {
                    title: "mr",
                    first_name: "John",
                    last_name: "Smith",
                    date_of_birth: "1985-06-15",
                    email: "applicant@example.com",
                    phone: "01234 567890",
                    national_insurance: "AB123456C",
                  },
                  driving_details: {
                    driving_licence_number: "SMITH806156JN9AX",
                    dvla_check_code: "abcd1234abcd",
                    endorsements: "no",
                  },
                }
              : {}),
          },
        },
      });

      // Add workflow event for submitted apps
      if (appSeq <= 5) {
        await prisma.workflowEvent.create({
          data: {
            applicationId: sampleApp.id,
            fromStage: null,
            toStage: "validation",
            action: "submit",
            performedById: applicant.id,
          },
        });
      }

      // Assign reviewer to some
      if (appSeq <= 3) {
        await prisma.application.update({
          where: { id: sampleApp.id },
          data: { assignedOfficerId: reviewer.id },
        });
      }
    }

    appSeq++;
  }

  console.log("✓ Sample applications created");
  console.log("\n✅ Seed complete!\n");
  console.log("Demo users seeded. Use the password supplied in DEMO_PASSWORD.");
  console.log("  Applicant: applicant@example.com");
  console.log("  Reviewer:  reviewer@example.com");
  console.log("  Manager:   manager@example.com");
  console.log("  Admin:     admin@example.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
