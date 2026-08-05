// ─────────────────────────────────────────────────────────────
// Generate a LONG, complex, realistic premises licence PDF.
// Purpose: a demo asset that shows how dense and hard-to-read real
// licensing documents are, before the app distils them at a glance.
// Run:  node scripts/generate-complex-licence.mjs
// Out:  public/templates/complex-premises-licence.pdf
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public/templates/complex-premises-licence.pdf");

const A4 = [595.28, 841.89];
const MX = 58; // horizontal margin
const M_TOP = 66;
const M_BOTTOM = 62;
const CW = A4[0] - MX * 2; // content width
const INK = rgb(0.1, 0.1, 0.13);
const GREY = rgb(0.42, 0.42, 0.45);
const HAIR = rgb(0.72, 0.72, 0.74);

const pdf = await PDFDocument.create();
const roman = await pdf.embedFont(StandardFonts.TimesRoman);
const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

// ── layout state ─────────────────────────────────────────────
const pages = [[]];
let y = A4[1] - M_TOP;
const cur = () => pages[pages.length - 1];
const push = (o) => cur().push(o);
function newPage() {
  pages.push([]);
  y = A4[1] - M_TOP;
}
function ensure(space) {
  if (y - space < M_BOTTOM) newPage();
}

function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const space = font.widthOfTextAtSize(" ", size);
  const lines = [];
  let line = [];
  let w = 0;
  for (const word of words) {
    const ww = font.widthOfTextAtSize(word, size);
    if (line.length && w + space + ww > maxWidth) {
      lines.push(line);
      line = [word];
      w = ww;
    } else {
      w = line.length ? w + space + ww : ww;
      line.push(word);
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function para(text, opts = {}) {
  const { font = roman, size = 9.5, lh = 12.4, indent = 0, justify = true, gapAfter = 5 } = opts;
  const x0 = MX + indent;
  const maxW = CW - indent;
  const lines = wrap(text, font, size, maxW);
  lines.forEach((words, i) => {
    ensure(lh);
    push({ t: "line", x: x0, y, size, font, words, justify: justify && i !== lines.length - 1, lineWidth: maxW });
    y -= lh;
  });
  y -= gapAfter;
}

function heading(text, level = 1) {
  const size = level === 1 ? 12 : 10.2;
  const gapBefore = level === 1 ? 13 : 8;
  const lh = size + 3;
  y -= gapBefore;
  const lines = wrap(text, bold, size, CW);
  ensure(lines.length * lh + 15); // keep with next line
  for (const words of lines) {
    push({ t: "line", x: MX, y, size, font: bold, words, justify: false, lineWidth: CW });
    y -= lh;
  }
  y -= 4;
}

function centered(text, font, size, gapAfter = 0) {
  ensure(size + 4);
  const w = font.widthOfTextAtSize(text, size);
  push({ t: "text", x: (A4[0] - w) / 2, y, size, font, text });
  y -= size + 4 + gapAfter;
}

function kv(k, v) {
  const labelW = 150;
  const size = 9.5;
  const lh = 12.6;
  const vLines = wrap(v, roman, size, CW - labelW);
  ensure(Math.max(lh, vLines.length * lh));
  push({ t: "text", x: MX, y, size, font: bold, text: k });
  let vy = y;
  for (const words of vLines) {
    push({ t: "line", x: MX + labelW, y: vy, size, font: roman, words, justify: false, lineWidth: CW - labelW });
    vy -= lh;
  }
  y = vy - 1.5;
}

function rule(gap = 6) {
  ensure(gap + 3);
  push({ t: "rule", y: y + 2 });
  y -= gap + 5;
}
function space(h = 6) {
  y -= h;
}

// clause helper: "9.3   text"
let CN = { a: 0, b: 0 };
function resetClause(a) {
  CN = { a, b: 0 };
}
function clause(text) {
  CN.b += 1;
  para(`${CN.a}.${CN.b}   ${text}`, { justify: true, gapAfter: 4.5 });
}
function subclause(text) {
  para(text, { indent: 22, justify: true, gapAfter: 3.5 });
}

// ═════════════════════════════════════════════════════════════
// CONTENT
// ═════════════════════════════════════════════════════════════
centered("CONTOSO COUNCIL", bold, 17, 2);
centered("LICENSING ACT 2003", roman, 11, 1);
centered("PREMISES LICENCE", bold, 13, 1);
centered("(Sections 18 and 23)", italic, 9.5, 4);
rule();

kv("Premises Licence Number:", "CON/PL/2025/0192");
kv("Name of premises:", "The Regent Quarter");
kv("Address of premises:", "1 Market Square, Contoso Town Centre, CN1 1AA");
kv("Telephone number:", "01234 555 019");
kv("This licence replaces:", "Premises Licence CON/PL/2016/0431 (surrendered on grant of this licence following a full variation and review determined 14 April 2025).");
space(2);
kv("Name and registered address of the holder of the premises licence:", "Regent Quarter Hospitality Group PLC, 40 Corporate Way, Contoso, CN4 8QP");
kv("Registered company number:", "07421196");
kv("Name of designated premises supervisor (DPS):", "Mr Jonathan Peter Hargreaves");
kv("DPS personal licence number and issuing authority:", "PL/CON/2018/00762, issued by Contoso Council");
kv("Date this licence was granted:", "22 April 2025");
kv("Annual fee band (non-domestic rateable value):", "Band E (over GBP 125,001) - subject to the multiplier applicable to premises used exclusively or primarily for the supply of alcohol for consumption on the premises");
rule();
para(
  "This licence is granted by Contoso Council in its capacity as the licensing authority for the area in which the premises are situated, in accordance with the Licensing Act 2003 (the Act), the Licensing Act 2003 (Premises licences and club premises certificates) Regulations 2005, and the licensing authority's Statement of Licensing Policy published under section 5 of the Act. This document, together with the plan(s) referred to in Annex 5 and all Annexes and Schedules appended hereto, constitutes the premises licence. The licence is subject to the mandatory conditions set out in Annex 1 and to the further conditions set out in Annexes 2, 3 and 4. It is an offence under section 136 of the Act to carry on or knowingly allow a licensable activity otherwise than in accordance with this licence.",
  { gapAfter: 3 }
);

// PART 1
heading("PART 1  -  LICENSABLE ACTIVITIES AUTHORISED BY THIS LICENCE");
para(
  "The premises comprise a multi-floor entertainment and hospitality complex situated within the Contoso Town Centre. The premises are internally divided into a number of trading areas, each of which is authorised for the licensable activities and during the hours set out below. Where an activity or timing is specific to a defined area, that area is identified by reference to the plan(s) at Annex 5. Save where expressly stated, all licensable activities are provided indoors. Terminology used in this Part has the meaning given to it in sections 1, 2 and 14 and in Schedule 1 (provision of regulated entertainment) and Schedule 2 (provision of late night refreshment) to the Act."
);

heading("Area 1 - Ground Floor Bar and Brasserie (\"The Square Room\")", 2);
para("Sale by retail of alcohol (for consumption both on and off the premises):", { gapAfter: 2 });
subclause("Monday to Thursday: 09:00 to 00:00 (midnight)");
subclause("Friday and Saturday: 09:00 to 01:00");
subclause("Sunday: 10:00 to 00:00 (midnight)");
para("Provision of late night refreshment (indoors): every day 23:00 to 01:00.", { gapAfter: 2 });
para("Recorded music (indoors, background only): every day 09:00 to the close of licensable activities.", { gapAfter: 4 });

heading("Area 2 - First Floor Cocktail Lounge and Private Dining (\"The Mezzanine\")", 2);
para("Sale by retail of alcohol (on the premises only):", { gapAfter: 2 });
subclause("Monday to Thursday: 12:00 to 00:30");
subclause("Friday and Saturday: 12:00 to 01:30");
subclause("Sunday and Bank Holiday Sundays: 12:00 to 00:30");
para("Live music, recorded music and performances of dance (indoors): Sunday to Thursday 18:00 to 00:00; Friday and Saturday 18:00 to 01:00.", { gapAfter: 4 });

heading("Area 3 - Basement Nightclub (\"The Vault\")", 2);
para("Sale by retail of alcohol (on the premises only):", { gapAfter: 2 });
subclause("Thursday: 21:00 to 03:00");
subclause("Friday and Saturday: 21:00 to 03:30");
subclause("Sunday immediately preceding a Bank Holiday Monday: 21:00 to 03:00");
subclause("The Vault shall not open for licensable activities on Monday, Tuesday or Wednesday save under a Temporary Event Notice.");
para("Live music, recorded music, performances of dance and the provision of facilities for dancing (indoors): on the days the Vault is authorised to sell alcohol, from 21:00 until 30 minutes after the close of alcohol sales.", { gapAfter: 2 });
para("Provision of late night refreshment (indoors): 23:00 to 03:30 on the days the Vault is authorised to open.", { gapAfter: 4 });

heading("Area 4 - Rooftop Terrace (\"The Skyline\")", 2);
para("Sale by retail of alcohol (on the premises only, outdoors):", { gapAfter: 2 });
subclause("Every day: 11:00 to 22:30, save that the use of the Rooftop Terrace by customers shall cease at 22:00 during the period 1 October to 31 March inclusive.");
para("Recorded music (outdoors, background only): every day 11:00 to 22:00. No live music, amplified vocals or the playing of recorded music above background level is permitted on the Rooftop Terrace at any time.", { gapAfter: 4 });

heading("Area 5 - Function Suites (\"The Regency Suite\" and \"The Windsor Suite\")", 2);
para("Sale by retail of alcohol (on the premises only), and the provision of regulated entertainment comprising live music, recorded music and performances of dance (indoors), in each case for pre-booked private functions only:", { gapAfter: 2 });
subclause("Sunday to Thursday: 10:00 to 00:30");
subclause("Friday and Saturday: 10:00 to 01:30");
subclause("On not more than 12 occasions per calendar year, the terminal hour for the Function Suites may be extended to 02:00 subject to not less than 14 days' prior written notification to the licensing authority and the police.");
para("Provision of late night refreshment (indoors): every day 23:00 to the close of licensable activities.", { gapAfter: 3 });

heading("PART 2  -  HOURS THE PREMISES ARE OPEN TO THE PUBLIC");
para("Ground Floor Bar and Brasserie: Monday to Thursday 08:00 to 00:30; Friday and Saturday 08:00 to 01:30; Sunday 09:00 to 00:30.");
para("First Floor Cocktail Lounge: Sunday to Thursday 12:00 to 01:00; Friday and Saturday 12:00 to 02:00.");
para("Basement Nightclub: Thursday 21:00 to 03:30; Friday and Saturday 21:00 to 04:00; otherwise closed save under a Temporary Event Notice.");
para("Rooftop Terrace: every day 11:00 to 23:00 (11:00 to 22:30 during 1 October to 31 March).");
para("Function Suites: Sunday to Thursday 10:00 to 01:00; Friday and Saturday 10:00 to 02:00.");
para(
  "The premises benefit from the extended hours automatically applied by any Order made under section 172 of the Act (relaxation of opening hours for occasions of exceptional international, national or local significance). Nothing in this Part authorises any licensable activity outside the hours specified in Part 1.",
  { gapAfter: 2 }
);

// ANNEX 1
heading("ANNEX 1  -  MANDATORY CONDITIONS");
para(
  "The following conditions are imposed by operation of law by virtue of sections 19 to 21 of the Act and the Licensing Act 2003 (Mandatory Licensing Conditions) Order 2010 as amended by the Licensing Act 2003 (Mandatory Licensing Conditions) (Amendment) Order 2014. They apply in addition to, and prevail in the event of any inconsistency with, the conditions in Annexes 2 to 4.",
  { gapAfter: 5 }
);
resetClause("M1");
para(
  "M1   No supply of alcohol may be made under this licence (a) at a time when there is no designated premises supervisor in respect of this licence, or (b) at a time when the designated premises supervisor does not hold a personal licence or the personal licence is suspended.",
  { gapAfter: 4.5 }
);
para(
  "M2   Every supply of alcohol under this licence must be made or authorised by a person who holds a personal licence.",
  { gapAfter: 4.5 }
);
para(
  "M3   (1) The responsible person must ensure that staff on relevant premises do not carry out, arrange or participate in any irresponsible promotions in relation to the premises. (2) In this paragraph, an irresponsible promotion means any one or more of the following activities, or substantially similar activities, carried on for the purpose of encouraging the sale or supply of alcohol for consumption on the premises in a manner which carries a significant risk of leading or contributing to crime and disorder, prejudice to public safety, public nuisance, or harm to children: (a) games or other activities which require or encourage, or are designed to require or encourage, individuals to (i) drink a quantity of alcohol within a time limit (other than to drink alcohol sold or supplied on the premises before the cessation of the period in which the responsible person is authorised to sell or supply alcohol), or (ii) drink as much alcohol as possible (whether within a time limit or otherwise); (b) provision of unlimited or unspecified quantities of alcohol free or for a fixed or discounted fee to the public or to a group defined by a particular characteristic in a manner which carries a significant risk of leading or contributing to crime and disorder, prejudice to public safety, public nuisance, or harm to children; (c) provision of free or discounted alcohol or any other thing as a prize to encourage or reward the purchase and consumption of alcohol over a period of 24 hours or less in a manner which carries such a significant risk; (d) selling or supplying alcohol in association with promotional posters or flyers on, or in the vicinity of, the premises which can reasonably be considered to condone, encourage or glamorise anti-social behaviour or to refer to the effects of drunkenness in any favourable manner; (e) dispensing alcohol directly by one person into the mouth of another (other than where that other person is unable to drink without assistance by reason of disability).",
  { gapAfter: 4.5 }
);
para(
  "M4   The responsible person must ensure that free potable water is provided on request to customers where it is reasonably available.",
  { gapAfter: 4.5 }
);
para(
  "M5   (1) The premises licence holder or club premises certificate holder must ensure that an age verification policy is adopted in respect of the premises in relation to the sale or supply of alcohol. (2) The designated premises supervisor in relation to the premises licence must ensure that the supply of alcohol at the premises is carried on in accordance with the age verification policy. (3) The policy must require individuals who appear to the responsible person to be under 18 years of age (or such older age as may be specified in the policy) to produce on request, before being served alcohol, identification bearing their photograph, date of birth and either (a) a holographic mark, or (b) an ultraviolet feature.",
  { gapAfter: 4.5 }
);
para(
  "M6   (1) The responsible person must ensure that (a) where any of the following alcoholic drinks is sold or supplied for consumption on the premises (except where the drink is sold or supplied having been made up in advance ready for sale or supply in a securely closed container) it is available to customers in the following measures: (i) beer or cider: half pint; (ii) gin, rum, vodka or whisky: 25 ml or 35 ml; and (iii) still wine in a glass: 125 ml; (b) these measures are displayed in a menu, price list or other printed material which is available to customers on the premises; and (c) where a customer does not in relation to a sale of alcohol specify the quantity of alcohol to be sold, the customer is made aware that the measures referred to in paragraph (a) are available.",
  { gapAfter: 4.5 }
);
para(
  "M7   (1) A relevant person shall ensure that no alcohol is sold or supplied for consumption on or off the premises for a price which is less than the permitted price. (2) For the purposes of the condition, 'permitted price' is the price found by applying the formula P = D + (D x V), where P is the permitted price, D is the amount of duty chargeable in relation to the alcohol as if the duty were charged on the date of the sale or supply of the alcohol, and V is the rate of value added tax chargeable in relation to the alcohol as if the alcohol were supplied on the date of the sale or supply. (3) Where the permitted price would (but for this sub-paragraph) not be a whole number of pennies, the price shall be taken to be the price actually charged rounded up to the nearest penny. (4) Where the permitted price on a day (the first day) would be different from the permitted price on the next day (the second day) as a result of a change to the rate of any duty or value added tax, the permitted price which applied on the first day applies to sales or supplies of alcohol until the expiry of the period of 14 days beginning on the second day.",
  { gapAfter: 3 }
);
para(
  "M8   Where the premises licence authorises the supply of alcohol, the licence holder shall ensure that a Security Industry Authority licensed door supervisor is present in accordance with the conditions of Annex 2 whenever door supervision is required by those conditions; any individual carrying out a security activity within the meaning of the Private Security Industry Act 2001 must be licensed by the Security Industry Authority.",
  { gapAfter: 3 }
);

// ANNEX 2
heading("ANNEX 2  -  CONDITIONS CONSISTENT WITH THE OPERATING SCHEDULE");
para(
  "The following conditions have been imposed to reflect the operating schedule submitted by the applicant and, where indicated, to give effect to measures agreed with, or offered in response to representations by, the responsible authorities. They are grouped by reference to the four licensing objectives but each condition promotes one or more of those objectives. In this Annex, 'the premises licence holder' includes any person to whom the licence is transferred and any person for the time being managing the premises on the holder's behalf.",
  { gapAfter: 5 }
);

heading("Part A  -  General and Management", 2);
resetClause(1);
clause("A written statement of the terms of this licence, together with a plan of the premises, shall be kept at the premises at all times and shall be produced to a constable or an authorised officer of a relevant authority on request. A copy of the summary of this licence, or a certified copy thereof, and the name and contact details of the nominated person who holds a copy of the licence, shall be prominently displayed at the premises.");
clause("The premises licence holder shall nominate in writing a person or persons who may be contacted at all material times in respect of matters arising under this licence, and shall provide the name and a 24-hour contact telephone number of that person to the licensing authority and the police, updating the same within 48 hours of any change.");
clause("All persons employed or engaged at the premises who are involved in the sale or supply of alcohol, the provision of late night refreshment, the admission of persons to the premises, or the supervision of customers, shall be trained in the terms and conditions of this licence, the four licensing objectives, the age verification policy, the refusals procedure, the recognition of proxy sales, the recognition of persons who are drunk, the drugs and search policies, the dispersal policy and the actions to be taken in the event of an emergency, before commencing their duties, with documented refresher training at intervals of not more than six months. A written record of all such training, signed and dated by the member of staff and by the trainer, shall be kept for a minimum of 24 months and shall be produced on request.");
clause("A daily written or electronic register shall be maintained recording (a) the personal licence holders on duty; (b) the door supervisors on duty (see Part B); (c) any refusals of sale or admission; (d) any incidents of crime, disorder, ejection, first aid, drug seizure or use of force; and (e) any failure or maintenance of the closed circuit television system. Each such register shall be retained for not less than 12 months and produced to the police or an authorised officer on request.");

heading("Part B  -  The Prevention of Crime and Disorder", 2);
resetClause(9);
clause("A closed circuit television (CCTV) system shall be installed, operated and maintained at the premises to a specification agreed in writing with Contoso Constabulary. The system shall (a) provide coverage of all public areas (including the immediate exterior of each entrance and exit, all points of sale, all stairwells, the smoking area and the Rooftop Terrace); (b) operate at all times the premises are open for any licensable activity and for a period of not less than 60 minutes thereafter; (c) record continuously and to a standard capable of producing clear, identifiable images in all lighting conditions; (d) accurately record the time and date; and (e) retain recordings for a minimum of 31 days.");
clause("A member of staff who is trained in the operation of the CCTV system and able to (a) reproduce and download images to a removable medium in a viewable format, and (b) provide such images to a constable or authorised officer, shall be present on the premises at all times the premises are open to the public. Any request for the download of images shall be complied with immediately, or in any event within 24 hours, subject to the provisions of the Data Protection Act 2018 and the constable providing lawful basis for the request.");
clause("From 21:00 each Friday and Saturday, from 21:00 on any day on which the Basement Nightclub is open, and at all times when the premises are authorised to sell alcohol after 00:00, a minimum of two Security Industry Authority (SIA) licensed door supervisors shall be on duty at the principal entrance, with a minimum of one further SIA licensed door supervisor for every 75 customers on the premises or part thereof above 150 customers. A register recording the full name, SIA licence number and times of duty of each door supervisor shall be maintained and available for inspection.");
clause("An electronic proof-of-age and identity scanning system shall be in operation at the principal entrance to the Basement Nightclub at all times the Nightclub is open, capturing an image of the identification presented and, where the system permits, of the person presenting it, and retaining such data for not less than 28 days in accordance with data protection law. Entry to the Basement Nightclub after 23:00 shall be refused to any person who declines to be scanned.");
clause("A written search policy shall be maintained and implemented. Random searches of customers, and searches on reasonable suspicion, may be conducted as a condition of entry to the Basement Nightclub, using trained SIA door staff and, where available, a passive drugs detection dog operated by a licensed provider. Signage advising customers that searches are in operation and that a zero-tolerance drugs policy applies shall be displayed at the entrance.");
clause("A written drugs and psychoactive substances policy shall be maintained. Any controlled drug or article surrendered, found or seized on the premises shall be placed in a secure, tamper-evident drugs safe, recorded in the incident register, and surrendered to the police at regular intervals not exceeding 28 days, the drugs safe being accessible only to the DPS or nominated managers.");
clause("The premises shall subscribe to and participate in any local Pubwatch scheme and any town centre radio link or 'Nightsafe' scheme operating in the Contoso Town Centre, and shall operate a functioning radio handset in communication with that scheme and with the CCTV control at all times the premises are open after 22:00.");
clause("A 'Challenge 25' age verification policy shall operate throughout the premises (see also Part E). No alcohol shall be sold or supplied to any person who is, or who the responsible person reasonably believes to be, purchasing alcohol on behalf of a person under the age of 18 (a proxy sale).");
clause("Open containers of alcohol shall not be permitted to be taken from the premises, save that this shall not apply to the off-sales authorised in the Ground Floor Bar and Brasserie where alcohol is supplied in sealed containers. No customer shall be permitted to leave the Basement Nightclub or the Rooftop Terrace in possession of any glass or open drinks container.");
clause("A record of all persons excluded or banned from the premises (whether under a Pubwatch scheme or otherwise) shall be maintained, and reasonable steps shall be taken to refuse admission to any such person.");

heading("Part C  -  Public Safety", 2);
resetClause(19);
clause("The maximum number of persons (including staff) accommodated at the premises at any one time shall not exceed the following limits, which have been assessed by reference to the premises fire risk assessment and the available means of escape: Ground Floor Bar and Brasserie 240; First Floor Cocktail Lounge 120; Basement Nightclub 300; Rooftop Terrace 90; Regency Suite 150; Windsor Suite 100. The premises licence holder shall implement a reliable means of monitoring and controlling occupancy (such as clicker counters or an electronic system) at all times the Basement Nightclub or Rooftop Terrace is in use, and shall keep a record of peak occupancy.");
clause("A suitable and sufficient fire risk assessment, and risk assessments in respect of the licensable activities (including crowd management, the use of special effects, and the Rooftop Terrace), shall be undertaken, reviewed at intervals of not more than 12 months and following any material change, and produced to an authorised officer on request. All means of escape shall be maintained unobstructed, immediately available and clearly identified; all fire safety and emergency lighting systems shall be maintained in efficient working order and tested in accordance with the relevant British Standards.");
clause("Save for bottles displayed or served at table with waiter or waitress service in the Brasserie, the Mezzanine and the Function Suites, all drinks in the Basement Nightclub and on the Rooftop Terrace, and all drinks served after 23:00 in any part of the premises, shall be served in toughened, tempered or polycarbonate glasses or vessels. No glass bottles shall be permitted on the dance floor of the Basement Nightclub.");
clause("At least one member of staff trained in first aid to a standard recognised by the Health and Safety Executive shall be on duty at all times the premises are open to the public, and an adequately stocked first aid kit shall be maintained at a location known to all staff. Provision shall be made for the welfare of vulnerable customers, including access to drinking water, a designated welfare space and a means of arranging safe transport home.");
clause("Where any temporary electrical installation, staging, rigging, pyrotechnic, laser, smoke, haze or other special effect is used, it shall be installed, operated and removed by competent persons in accordance with the manufacturer's instructions and the relevant guidance, and shall not be positioned so as to obstruct any means of escape or to cause a nuisance beyond the premises.");
clause("A documented crowd management and queue management plan shall be implemented on any occasion when queuing is anticipated, so as to maintain free passage on the public highway, prevent congestion at the entrances and manage the safe ingress and egress of customers, including safe management of the smoking area and the interface between the Basement Nightclub exit and the public highway.");

heading("Part D  -  The Prevention of Public Nuisance", 2);
resetClause(25);
clause("A written noise management plan, agreed with the Council's Environmental Health service, shall be implemented and reviewed annually. The plan shall address the control of amplified and non-amplified music and vocals, the operation of any noise limiter, the management of patron noise (including in the smoking area and on the Rooftop Terrace), deliveries and collections, plant and ventilation noise, and the receipt and handling of complaints. Music noise emanating from the premises shall not be audible so as to cause a nuisance at the facade of the nearest noise-sensitive premises.");
clause("A noise limiter shall be fitted to the musical amplification system serving the Basement Nightclub, the First Floor Cocktail Lounge and each Function Suite, set at a level agreed in writing with an authorised officer of the Environmental Health service, and the settings shall be secured against unauthorised interference and shall not be altered without the prior written agreement of that service.");
clause("All external doors and windows (other than for the immediate access and egress of persons) shall be kept closed after 21:00, or whenever regulated entertainment involving amplified music or vocals is taking place, whichever is the earlier; a lobby or other acoustic mitigation shall be maintained at the principal entrance to the Basement Nightclub.");
clause("Use of the Rooftop Terrace by customers shall cease, and the Terrace shall be cleared of customers, by 22:30 (22:00 during 1 October to 31 March). No drinks or glassware shall be taken onto the Terrace after those times. Prominent notices shall be displayed on the Terrace and at the exits requesting customers to respect the amenity of nearby residents and to leave the area quietly.");
clause("The designated external smoking area shall be limited to a maximum of 30 persons at any one time and shall not be used after 01:00. No music, other than incidental sound from within the premises, shall be relayed to the smoking area. A member of staff shall supervise the smoking area at times of peak use to control noise and the removal of drinks and glassware.");
clause("A written dispersal policy, agreed with the police and the Environmental Health service, shall be implemented to secure the gradual and orderly dispersal of customers from the premises and the immediate vicinity at the end of trading. From 30 minutes before the close of the Basement Nightclub, the sale of alcohol shall cease, the volume and tempo of music shall be progressively reduced, full lighting shall be gradually raised, and staff shall actively encourage customers to leave quietly.");
clause("On each night the Basement Nightclub is authorised to trade beyond 01:00, the premises licence holder shall provide a licensed and briefed taxi marshal or SIA door supervisor to manage any taxi rank or pick-up point immediately outside the premises between 01:00 and 30 minutes after the premises close.");
clause("No deliveries to, or collections from, the premises (including the delivery of goods and the collection of waste, glass and recycling) shall take place between 22:00 and 07:00. Bottling out, the movement of kegs and bottles, and the emptying of bins shall not be carried out in the open air between those hours. Refuse and recyclable materials shall be stored so as to prevent nuisance from noise or odour and shall not be left on the public highway.");
clause("A telephone number for a nominated manager shall be made available to local residents and to the Environmental Health service for the reporting of noise or nuisance, and a log of all complaints received and the action taken shall be maintained and produced to an authorised officer on request.");

heading("Part E  -  The Protection of Children from Harm", 2);
resetClause(34);
clause("A 'Challenge 25' proof-of-age scheme shall be operated at all times throughout the premises, whereby any person who appears to the responsible person to be under 25 years of age shall be required to produce, before being sold or supplied alcohol, valid photographic identification proving that person to be aged 18 or over. The only forms of identification acceptable for this purpose are a valid passport, a photocard driving licence bearing the holder's photograph, a Ministry of Defence Form 90 (Defence Identity Card), a national identity card issued by an EEA state, or a proof-of-age card bearing the 'PASS' hologram.");
clause("Prominent signage advising customers of the operation of the Challenge 25 scheme and of the acceptable forms of identification shall be displayed at each entrance, at each point of sale and in the customer toilets. A refusals register recording each refusal to sell or supply alcohol (including the date, time, member of staff, and reason) shall be maintained, whether in written or electronic form, and shall be checked and countersigned by the DPS or a nominated manager not less than weekly.");
clause("No person under the age of 18 shall be admitted to, or permitted to remain in, the Basement Nightclub at any time, nor in the First Floor Cocktail Lounge after 20:00, nor in any part of the premises after 21:00 unless (in the Ground Floor Bar and Brasserie or a Function Suite) taking a table meal in the company of, and under the supervision of, a responsible adult aged 18 or over.");
clause("Accompanied children shall be permitted in the Ground Floor Bar and Brasserie until 21:00 for the purpose of taking a table meal. At no time shall a person under the age of 16 be on the premises unless in the company of, and under the supervision of, a responsible adult aged 18 or over.");
clause("Where any film is exhibited, the premises licence holder shall adopt and enforce the age restrictions corresponding to the classification recommended by the British Board of Film Classification or, in the case of an unclassified film, by the licensing authority, and shall not admit any person appearing to be under the relevant age to any exhibition of a film classified or restricted for older persons.");
clause("No adult entertainment, and no entertainment or services of an adult or sexual nature, shall be provided at the premises. All staff shall receive safeguarding awareness training appropriate to the night time economy, including the recognition of, and response to, child sexual exploitation, vulnerability and 'spiking', and the premises shall co-operate with any local safeguarding partnership or 'Ask for Angela' or equivalent scheme.");

// ANNEX 3
heading("ANNEX 3  -  CONDITIONS ATTACHED AFTER A HEARING");
para(
  "The following conditions were attached to this licence by a Licensing Sub-Committee of Contoso Council following a hearing held on 14 April 2025 to determine an application to vary the premises licence, in respect of which relevant representations were received from Contoso Constabulary and from the Council's Environmental Health service on the grounds of the prevention of crime and disorder and the prevention of public nuisance, and one representation from an other person residing in the vicinity. Having heard from the applicant and the parties, and having had regard to the Statement of Licensing Policy and to the guidance issued under section 182 of the Act, the Sub-Committee determined to grant the variation subject to the conditions in Annexes 2 and 4 and to the following additional conditions, which it considered appropriate and proportionate for the promotion of the licensing objectives.",
  { gapAfter: 5 }
);
resetClause("H");
para("H1   The premises shall install and maintain the electronic proof-of-age and identity scanning system referred to in condition 12 within 28 days of the grant of this variation, and shall not operate the Basement Nightclub beyond 03:00 until that system is operational and has been inspected by the police.", { gapAfter: 4.5 });
para("H2   The terminal hour for the sale of alcohol in the Basement Nightclub on Friday and Saturday is granted at 03:30 by way of a trial period expiring 12 months from the date of grant. The licensing authority may review the position at the expiry of the trial. Nothing in this condition fetters the right of any responsible authority or other person to apply for a review of the licence under section 51 of the Act at any time.", { gapAfter: 4.5 });
para("H3   The premises licence holder shall convene and attend a meeting of interested residents and the responsible authorities not less than once in every six months for the purpose of reviewing the operation of the premises and the effectiveness of the dispersal and noise management plans, and shall keep a note of each such meeting.", { gapAfter: 4.5 });
para("H4   In recognition that the premises are situated within the Contoso Town Centre Cumulative Impact Area identified in the Statement of Licensing Policy, the premises licence holder shall not make any application to increase the capacity of, or to extend the licensable hours applicable to, any part of the premises without first consulting the police and the Environmental Health service; and the grant of this variation shall not be treated as establishing any precedent in respect of the said Cumulative Impact Area.", { gapAfter: 3 });

// ANNEX 4
heading("ANNEX 4  -  CONDITIONS CONSISTENT WITH THE OPERATING SCHEDULE (SUPPLEMENTARY)");
para(
  "The following supplementary conditions apply in respect of specific licensable activities and are to be read together with Annex 2.",
  { gapAfter: 5 }
);
resetClause(40);
clause("Live music: any performance of live music shall be provided in accordance with the noise management plan; the deregulating effect of the Live Music Act 2012 and the Legislative Reform (Entertainment Licensing) Order 2014 is noted, but for the avoidance of doubt the conditions of this licence relating to the prevention of public nuisance and public safety continue to apply to any regulated entertainment provided outside the scope of those deregulating provisions.");
clause("Provision of late night refreshment: hot food and hot drink supplied for consumption off the premises after 23:00 shall be supplied only in recyclable or biodegradable packaging, and a litter patrol shall be undertaken of the frontage and the immediate vicinity at the close of trading and again the following morning; a sufficient number of litter bins shall be provided at the exits.");
clause("Off-sales (Ground Floor Bar and Brasserie only): alcohol for consumption off the premises shall be supplied only in sealed containers and shall not be consumed in the vicinity of the premises; no super-strength beer, lager or cider of 6.5% ABV or above shall be sold for consumption off the premises, save for premium or craft products supplied in containers of 330ml or less as part of a range.");
clause("The premises licence holder shall carry out right to work checks in respect of all persons employed at the premises in accordance with the Immigration, Asylum and Nationality Act 2006 and the Immigration Act 2016, and shall retain evidence of such checks; the licensing authority and the Home Office (Immigration Enforcement) are responsible authorities under the Act.");

// ANNEX 5
heading("ANNEX 5  -  PLANS");
para(
  "The plans of the premises to which this licence relates are the plans numbered RQ/2025/01 (Ground Floor), RQ/2025/02 (First Floor and Mezzanine), RQ/2025/03 (Basement Nightclub), RQ/2025/04 (Rooftop Terrace) and RQ/2025/05 (Function Suites), each dated 3 February 2025 and deposited with the licensing authority, which show the extent of the licensed area, the position of the fixed structures, the location of the CCTV cameras, the means of escape, and the designated external smoking area.",
  { gapAfter: 3 }
);

// SCHEDULE
heading("SCHEDULE 1  -  SEASONAL AND NON-STANDARD TIMINGS");
para("Notwithstanding the timings in Part 1, and without the need for a Temporary Event Notice, the licensable activities and the hours the premises are open to the public may be extended as follows, subject to compliance with all conditions of this licence:");
para("(a) On the night of 24 December into 25 December (Christmas Eve into Christmas Day): licensable activities and opening may continue until the times ordinarily authorised on a Friday or Saturday, irrespective of the day of the week on which Christmas Eve falls.", { indent: 14, gapAfter: 3 });
para("(b) On the night of 31 December into 1 January (New Year's Eve into New Year's Day): the sale of alcohol, the provision of regulated entertainment and late night refreshment, and the opening of the premises to the public, are authorised from the start of permitted hours on 31 December until 04:00 on 1 January, and the terminal hour for the Basement Nightclub is extended to 05:00.", { indent: 14, gapAfter: 3 });
para("(c) On the night preceding each Bank Holiday, and on the nights of any occasion designated by Order under section 172 of the Act: licensable activities and opening may continue until the times ordinarily authorised on a Friday or Saturday.", { indent: 14, gapAfter: 3 });

// INFORMATIVES
heading("SCHEDULE 2  -  INFORMATIVES (NOT PART OF THE CONDITIONS)");
para("The following notes are provided for the assistance of the premises licence holder and do not form part of the conditions of this licence:");
para("(i) It is an offence under section 136 of the Act to carry on a licensable activity otherwise than in accordance with this licence, and under section 140 knowingly to allow disorderly conduct on the premises; under section 141 knowingly to sell alcohol to a person who is drunk; under section 146 to sell alcohol to a child; and under section 147A persistently to sell alcohol to children.", { indent: 14, gapAfter: 3 });
para("(ii) The smoke-free provisions of the Health Act 2006 and regulations made thereunder apply to the enclosed and substantially enclosed parts of the premises. The premises licence holder should have regard to the Equality Act 2010 in relation to access for disabled persons and the provision of reasonable adjustments.", { indent: 14, gapAfter: 3 });
para("(iii) This licence does not authorise the provision of gaming or gaming machines otherwise than in accordance with the Gambling Act 2005; the provision of any sexual entertainment venue; or any activity requiring separate consent under planning or building control legislation. The hours authorised by this licence are without prejudice to any restriction imposed by any planning permission relating to the premises.", { indent: 14, gapAfter: 3 });
para("(iv) A responsible authority or any other person may apply to the licensing authority under section 51 of the Act for a review of this premises licence. The premises licence holder is reminded of the continuing duty to notify the licensing authority of any change of name or address, and to apply to vary the licence to specify a new designated premises supervisor before the existing DPS ceases to be involved in the running of the premises.", { indent: 14, gapAfter: 6 });

rule();
para("END OF LICENCE.  Issued under the seal of Contoso Council Licensing Authority on 22 April 2025. This is a controlled document; the master copy is held by the Licensing Section, Contoso Council, Civic Centre, Contoso, CN1 1BX.", { font: italic, justify: false, gapAfter: 2 });

// ═════════════════════════════════════════════════════════════
// RENDER
// ═════════════════════════════════════════════════════════════
function drawLine(page, o) {
  if (!o.justify || o.words.length === 1) {
    page.drawText(o.words.join(" "), { x: o.x, y: o.y, size: o.size, font: o.font, color: INK });
    return;
  }
  const wordsW = o.words.reduce((s, w) => s + o.font.widthOfTextAtSize(w, o.size), 0);
  const gaps = o.words.length - 1;
  const extra = (o.lineWidth - wordsW) / gaps;
  if (extra > o.font.widthOfTextAtSize(" ", o.size) * 3) {
    // avoid extreme stretching on unusually short lines
    page.drawText(o.words.join(" "), { x: o.x, y: o.y, size: o.size, font: o.font, color: INK });
    return;
  }
  let cx = o.x;
  for (const w of o.words) {
    page.drawText(w, { x: cx, y: o.y, size: o.size, font: o.font, color: INK });
    cx += o.font.widthOfTextAtSize(w, o.size) + extra;
  }
}

const total = pages.length;
pages.forEach((ops, idx) => {
  const page = pdf.addPage(A4);
  if (idx > 0) {
    page.drawText("Premises Licence No. CON/PL/2025/0192  -  The Regent Quarter, 1 Market Square, Contoso", {
      x: MX, y: A4[1] - 42, size: 8, font: italic, color: GREY,
    });
    page.drawLine({ start: { x: MX, y: A4[1] - 48 }, end: { x: A4[0] - MX, y: A4[1] - 48 }, thickness: 0.5, color: HAIR });
  }
  page.drawLine({ start: { x: MX, y: M_BOTTOM - 16 }, end: { x: A4[0] - MX, y: M_BOTTOM - 16 }, thickness: 0.5, color: HAIR });
  page.drawText("Contoso Council Licensing Authority", { x: MX, y: M_BOTTOM - 28, size: 8, font: italic, color: GREY });
  const pn = `Page ${idx + 1} of ${total}`;
  page.drawText(pn, { x: A4[0] - MX - roman.widthOfTextAtSize(pn, 8), y: M_BOTTOM - 28, size: 8, font: roman, color: GREY });

  for (const o of ops) {
    if (o.t === "rule") {
      page.drawLine({ start: { x: MX, y: o.y }, end: { x: A4[0] - MX, y: o.y }, thickness: 0.6, color: rgb(0.55, 0.55, 0.58) });
    } else if (o.t === "text") {
      page.drawText(o.text, { x: o.x, y: o.y, size: o.size, font: o.font, color: INK });
    } else if (o.t === "line") {
      drawLine(page, o);
    }
  }
});

const bytes = await pdf.save();
writeFileSync(OUT, bytes);
console.log(`Wrote ${OUT}`);
console.log(`Pages: ${total}, size: ${(bytes.length / 1024).toFixed(0)} KB`);
