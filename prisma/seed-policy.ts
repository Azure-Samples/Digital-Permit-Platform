// ─────────────────────────────────────────────────────────────
// Seed: Contoso Council Statement of Licensing Policy 2021–2026
// ─────────────────────────────────────────────────────────────
// A realistic composite policy (Licensing Act 2003) used to ground
// the Policy AI assistant. Includes a Cumulative Impact Assessment
// for the town centre — the classic "no more pubs/clubs" scenario.
// Idempotent: safe to run repeatedly (npm run db:seed:policy).
// ─────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    heading: "Introduction and scope",
    category: "general",
    keywords: ["introduction", "scope", "statement of licensing policy"],
    content:
      "This Statement of Licensing Policy is published by Contoso Council as the licensing authority under section 5 of the Licensing Act 2003. It sets out how the authority will exercise its licensing functions in respect of premises licences, club premises certificates, personal licences and temporary event notices. It takes effect on 7 January 2021 and will be reviewed at least every five years. In carrying out its functions the authority must have regard to this policy and to the statutory guidance issued by the Home Office under section 182 of the Act. Each application will be considered on its own merits.",
  },
  {
    ref: "2.1",
    heading: "The four licensing objectives",
    category: "objectives",
    keywords: ["objectives", "crime", "safety", "nuisance", "children"],
    content:
      "The Licensing Act 2003 requires the authority to promote the four licensing objectives, each of equal importance: (1) the prevention of crime and disorder; (2) public safety; (3) the prevention of public nuisance; and (4) the protection of children from harm. There is no separate public health objective in England. Applicants are expected to demonstrate in their operating schedule how they will promote each objective relevant to their premises and activities.",
  },
  {
    ref: "3.1",
    heading: "Determining applications and the role of conditions",
    category: "conditions",
    keywords: ["conditions", "operating schedule", "representations", "proportionate"],
    content:
      "Where no relevant representations are received, the authority must grant the application subject only to conditions consistent with the operating schedule and the mandatory conditions. Where relevant representations are received from responsible authorities or other persons, the authority may add conditions that are appropriate and proportionate for the promotion of the licensing objectives. Conditions will not be imposed to duplicate other statutory requirements. Applicants are encouraged to discuss their application with responsible authorities before submission.",
  },
  {
    ref: "4.1",
    heading: "Licensing hours",
    category: "hours",
    keywords: ["hours", "opening", "terminal hour", "24 hour"],
    content:
      "The authority does not set fixed closing times. Applications for licensing hours are considered on their merits, having regard to the location of the premises, the type of activities and the potential impact on residents. Shops, stores and supermarkets are normally expected to be permitted to sell alcohol for consumption off the premises during their normal trading hours. Applications for hours that extend significantly beyond those of neighbouring premises, or that fall within the Cumulative Impact Area, will be scrutinised more closely and may attract conditions.",
  },
  {
    ref: "4.2",
    heading: "Off-sales and late-night operation",
    category: "hours",
    keywords: ["off sales", "late night", "off-licence", "corner shop", "supermarket"],
    content:
      "For premises selling alcohol for consumption off the premises (for example convenience stores and corner shops) the authority will pay particular attention to the potential for street drinking, anti-social behaviour and sales to persons who are already intoxicated. Applicants should set out measures such as a Challenge 25 age-verification policy, staff training records, a refusals register, CCTV, and controls on the sale of high-strength beers and ciders above 6.5% ABV where these are associated with street drinking in the area.",
  },
  {
    ref: "5.1",
    heading: "Cumulative Impact Assessment — Contoso Town Centre",
    category: "cumulative_impact",
    keywords: [
      "cumulative impact",
      "town centre",
      "saturation",
      "special policy",
      "pubs",
      "clubs",
    ],
    content:
      "Following evidence from Contoso Police, environmental health and public health of high levels of alcohol-related crime, disorder and ambulance call-outs, the authority has published a Cumulative Impact Assessment for the Contoso Town Centre area (bounded by Market Street, High Street, Bridge Road and the ring road). The evidence shows that the number and density of premises licensed for the on-sale of alcohol — particularly pubs, bars and nightclubs — is having a cumulative impact such that further licensed premises would undermine the licensing objectives, principally the prevention of crime and disorder and the prevention of public nuisance.",
  },
  {
    ref: "5.2",
    heading: "Effect of the Cumulative Impact Assessment",
    category: "cumulative_impact",
    keywords: [
      "rebuttable presumption",
      "refuse",
      "cumulative impact area",
      "special policy",
    ],
    content:
      "Within the Cumulative Impact Area there is a rebuttable presumption that applications for new premises licences or club premises certificates, or variations that would increase the capacity for the sale of alcohol for consumption on the premises or extend hours, will be REFUSED where relevant representations are received. It is for the applicant to demonstrate in their operating schedule why their application would not add to the cumulative impact. The presumption does not apply automatically: the authority must still consider each application on its merits and can only refuse where a relevant representation has been made. The special policy does not relieve responsible authorities or other persons of the need to make representations.",
  },
  {
    ref: "5.3",
    heading: "Applications likely to be exempt from cumulative impact concerns",
    category: "cumulative_impact",
    keywords: ["exempt", "off sales", "restaurant", "small capacity", "cumulative impact"],
    content:
      "The rebuttable presumption is primarily aimed at premises whose main activity is the on-sale of alcohol, such as pubs, bars and nightclubs. Applications that are unlikely to add to cumulative impact — for example small restaurants where alcohol is ancillary to a table meal, shops selling alcohol for consumption off the premises, or premises with a low capacity and early terminal hour — may still be granted within the area, but applicants should still address cumulative impact in their operating schedule and offer appropriate conditions.",
  },
  {
    ref: "6.1",
    heading: "Protection of children from harm",
    category: "children",
    keywords: ["children", "age verification", "challenge 25", "proxy sales", "safeguarding"],
    content:
      "The authority expects all premises selling alcohol to operate an age-verification policy. As a minimum this must satisfy the mandatory condition requiring identification to be checked for anyone who appears to be under 18, but the authority strongly recommends a Challenge 25 scheme under which anyone who appears to be under 25 is asked for photographic identification. Acceptable identification includes a passport, a photocard driving licence, a Ministry of Defence identity card or a Proof of Age Standards Scheme (PASS) accredited card. Premises should keep a refusals register and train staff to recognise and refuse proxy sales (adults buying alcohol on behalf of under-18s).",
  },
  {
    ref: "6.2",
    heading: "Films, age restrictions and access to children",
    category: "children",
    keywords: ["films", "age classification", "children access", "adult entertainment"],
    content:
      "Where premises show films, conditions will require compliance with age classifications issued by the British Board of Film Classification or by the authority. Where premises are used for adult entertainment or activities that are unsuitable for children, the authority may impose conditions restricting the admission of children. The authority will have regard to whether limiting or preventing access by children is appropriate to protect them from harm.",
  },
  {
    ref: "7.1",
    heading: "Prevention of public nuisance",
    category: "conditions",
    keywords: ["nuisance", "noise", "residents", "dispersal", "smoking area", "litter"],
    content:
      "The authority is particularly concerned about the impact of licensed premises on nearby residents. Applicants in or near residential areas should address noise from music and patrons, the use of outdoor and smoking areas (especially after 23:00), dispersal of customers, deliveries and waste collection, and litter. Appropriate conditions may include limiting the use of external areas late at night, keeping doors and windows closed when regulated entertainment takes place, and providing a dispersal policy. The absence of complaints is not conclusive that no nuisance is occurring.",
  },
  {
    ref: "8.1",
    heading: "Prevention of crime and disorder",
    category: "conditions",
    keywords: ["crime", "cctv", "door supervisors", "drugs", "police", "risk assessment"],
    content:
      "Applicants should demonstrate how they will prevent crime and disorder. Depending on the style and scale of operation, appropriate measures may include CCTV to the standard specified by the police (retained for 28 days and provided to police on request), Security Industry Authority licensed door supervisors at peak times, a drugs and weapons policy, participation in a local Pubwatch or Business Improvement District radio scheme, and an incident and refusals log. The police are the authority's main source of advice on crime and disorder and their representations will be given considerable weight.",
  },
  {
    ref: "9.1",
    heading: "Mandatory conditions",
    category: "conditions",
    keywords: [
      "mandatory conditions",
      "dps",
      "tap water",
      "small measures",
      "permitted price",
      "irresponsible promotions",
    ],
    content:
      "Every premises licence and club premises certificate authorising the supply of alcohol is subject to the mandatory conditions set out in the Licensing Act 2003 (Mandatory Licensing Conditions) Order 2010 as amended. These are: (1) no supply of alcohol at a time when there is no designated premises supervisor or the DPS does not hold a valid personal licence; (2) a ban on irresponsible drinks promotions and dispensing alcohol directly into the mouth; (3) free potable water must be provided on request; (4) an age-verification policy must be in place requiring photographic identification from anyone appearing under 18; (5) small measures (a half pint of beer/cider, 25ml or 35ml of spirits, 125ml of wine) must be available and customers made aware of them; and (6) alcohol must not be sold below the permitted price (duty plus VAT).",
  },
  {
    ref: "9.2",
    heading: "Designated Premises Supervisor and personal licences",
    category: "conditions",
    keywords: ["dps", "personal licence", "authorisation", "supervisor"],
    content:
      "Every premises licence authorising the sale of alcohol must specify a Designated Premises Supervisor who holds a valid personal licence. The DPS is the point of day-to-day contact and is accountable for the running of the premises. Every sale of alcohol must be made or authorised by a personal licence holder. Where the DPS changes, an application to vary the DPS must be submitted; the police may object within 14 days on crime and disorder grounds.",
  },
  {
    ref: "10.1",
    heading: "Regulated entertainment and the Live Music Act",
    category: "entertainment",
    keywords: ["regulated entertainment", "live music act", "recorded music", "deregulation"],
    content:
      "Many forms of entertainment have been deregulated. Under the Live Music Act 2012 and subsequent orders, live and recorded music between 08:00 and 23:00 for audiences of up to 500 people at licensed premises and certain workplaces is not licensable and the authority cannot impose conditions on it, although conditions can be reinstated following a review. Applicants only need to licence regulated entertainment that falls outside these exemptions. The authority will focus its attention on the potential for noise nuisance and public safety at larger or later events.",
  },
  {
    ref: "11.1",
    heading: "Late night refreshment",
    category: "hours",
    keywords: ["late night refreshment", "hot food", "takeaway", "23:00", "05:00"],
    content:
      "The supply of hot food or hot drink to the public between 23:00 and 05:00 is a licensable activity known as late night refreshment. The authority may exempt certain premises or areas from this requirement. Applications for late night refreshment, particularly for takeaways near the town centre or residential areas, will be considered for their potential to contribute to public nuisance and crime and disorder, and appropriate conditions such as litter management and CCTV may be applied.",
  },
  {
    ref: "12.1",
    heading: "Temporary Event Notices",
    category: "general",
    keywords: ["ten", "temporary event notice", "500", "168 hours"],
    content:
      "A Temporary Event Notice (TEN) may be used to authorise licensable activities at an event for fewer than 500 people (including staff) lasting no more than 168 hours. A standard TEN must be given to the authority, the police and environmental health at least ten working days before the event; a late TEN requires at least five working days. The police or environmental health may object on the grounds of any of the licensing objectives. There are annual limits on the number of TENs a premises or individual may use.",
  },
  {
    ref: "13.1",
    heading: "Enforcement, reviews and inspections",
    category: "enforcement",
    keywords: ["enforcement", "review", "inspection", "revoke", "suspend"],
    content:
      "The authority operates a risk-based approach to inspection and enforcement, primarily targeting resources at higher-risk premises and working in partnership with the police and other responsible authorities. Where a premises licence is not promoting the licensing objectives, a responsible authority or other person may apply for a review. The authority may, on review, modify the conditions, exclude a licensable activity, remove the DPS, suspend the licence for up to three months, or revoke it. In cases of serious crime or disorder the police may seek an expedited (summary) review.",
  },
  {
    ref: "14.1",
    heading: "Advice for applicants and new businesses",
    category: "applicant_guidance",
    keywords: ["applicant", "new business", "advice", "how to apply", "staff training"],
    content:
      "New applicants are encouraged to contact the licensing team early. A typical premises licence application requires a completed application form, a scale plan of the premises, the correct fee (based on the non-domestic rateable value), and an operating schedule describing the activities, hours and the steps that will be taken to promote the licensing objectives. Applications must be advertised on a blue notice at the premises and in a local newspaper, and copies given to all responsible authorities, during a 28-day consultation period. The council can advise on which activities are licensable and what conditions are likely to be expected.",
  },
  {
    ref: "14.2",
    heading: "Training staff who sell alcohol",
    category: "applicant_guidance",
    keywords: ["staff training", "challenge 25", "corner shop", "new employee", "refusals register"],
    content:
      "Anyone selling alcohol should be trained before they make their first sale and receive refresher training regularly. Training should cover: the licensing objectives; the premises' age-verification (Challenge 25) policy and which forms of photographic ID are acceptable; how to complete and use the refusals register; recognising and refusing proxy sales to under-18s; not serving anyone who is drunk; the licensing hours and any conditions on the licence; and who the DPS and personal licence holders are. Records of training should be kept and made available to the police or the authority on request. Staff should feel confident and supported to refuse a sale.",
  },
];

async function main() {
  console.log("→ Seeding Statement of Licensing Policy…");

  const councilName = process.env.NEXT_PUBLIC_APP_NAME?.includes("Council")
    ? "Contoso Council"
    : "Contoso Council";

  // Deactivate any existing active policy so there is a single source of truth.
  await prisma.licensingPolicy.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const existing = await prisma.licensingPolicy.findFirst({
    where: { versionLabel: "2021–2026", regime: "licensing_act_2003" },
  });

  if (existing) {
    await prisma.policySection.deleteMany({ where: { policyId: existing.id } });
    await prisma.licensingPolicy.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  }

  const policy =
    existing ??
    (await prisma.licensingPolicy.create({
      data: {
        councilName,
        title: "Statement of Licensing Policy 2021–2026",
        regime: "licensing_act_2003",
        versionLabel: "2021–2026",
        effectiveFrom: new Date("2021-01-07"),
        effectiveTo: new Date("2026-01-06"),
        isActive: true,
        summary:
          "Contoso Council's policy for exercising its functions under the Licensing Act 2003. It explains how the council promotes the four licensing objectives, sets out expectations on hours, conditions and the protection of children, and includes a Cumulative Impact Assessment for the town centre where there is a rebuttable presumption to refuse new alcohol-led premises.",
      },
    }));

  await prisma.policySection.createMany({
    data: SECTIONS.map((s, i) => ({
      policyId: policy.id,
      ref: s.ref,
      heading: s.heading,
      content: s.content,
      category: s.category,
      keywords: s.keywords,
      sortOrder: i,
    })),
  });

  console.log(
    `✔ Policy "${policy.title}" seeded with ${SECTIONS.length} sections (id ${policy.id}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
