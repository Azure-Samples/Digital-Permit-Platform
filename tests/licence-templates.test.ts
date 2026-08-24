import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Document, Footer, Header, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import {
  LICENCE_TEMPLATE_MIME_TYPE,
} from "../src/lib/licence-template-fields";
import {
  buildLicenceTemplateData,
  getApplicationTemplatePlaceholders,
  inspectLicenceTemplate,
  renderLicenceTemplate,
} from "../src/lib/licence-templates";
import { mergeDraftAnswers } from "../src/lib/modules/applications";
import type { FormSection } from "../src/types/module";

async function readDocumentText(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  const entries = Object.values(archive.files).filter(
    (entry) =>
      !entry.dir &&
      /^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.name),
  );
  const xml = (
    await Promise.all(entries.map((entry) => entry.async("string")))
  ).join(" ");
  let previous: string;
  let stripped = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  do {
    previous = stripped;
    stripped = stripped.replace(/<[^<>]*>/g, "");
  } while (stripped !== previous);
  return stripped.replace(/\s+/g, " ").trim();
}

describe("licence templates", () => {
  it("accepts genuine DOCX files and discovers angle-bracket fields", async () => {
    const document = new Document({
      sections: [
        {
          headers: {
            default: new Header({ children: [new Paragraph("<council_name>")] }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph("<application_reference>")],
            }),
          },
          children: [
            new Paragraph("Licence <licence_number> for <applicant_name>"),
          ],
        },
      ],
    });
    const bytes = await Packer.toBuffer(document);
    const result = await inspectLicenceTemplate({
      filename: "../Council licence.docx",
      mimeType: LICENCE_TEMPLATE_MIME_TYPE,
      bytes,
    });

    assert.equal(result.filename, "Council licence.docx");
    assert.deepEqual(result.placeholders, [
      "applicant_name",
      "application_reference",
      "council_name",
      "licence_number",
    ]);
  });

  it("rejects files that only have a DOCX extension", async () => {
    await assert.rejects(
      inspectLicenceTemplate({
        filename: "not-a-template.docx",
        mimeType: LICENCE_TEMPLATE_MIME_TYPE,
        bytes: Buffer.from("not a zip"),
      }),
      /not a valid DOCX/,
    );
  });

  it("lists application fields and builds formatted merge data", () => {
    const formSchema: FormSection[] = [
      {
        key: "personal",
        title: "Personal details",
        fields: [
          { key: "date_of_birth", label: "Date of birth", type: "date" },
          { key: "email", label: "Email address", type: "email" },
          { key: "middle_name", label: "Middle name", type: "text" },
        ],
      },
    ];
    const placeholders = getApplicationTemplatePlaceholders(formSchema);
    assert.deepEqual(
      placeholders.map(({ key }) => key),
      ["date_of_birth", "email", "middle_name"],
    );

    const data = buildLicenceTemplateData({
      answers: {
        personal: { date_of_birth: "1985-03-15", email: "alex@example.com" },
      },
      formSchema,
      moduleName: "Street trading consent",
      referenceNumber: "SC-ST-2026-0001",
      applicationType: "new",
      licenceNumber: "ST/2026/00001",
      issueDate: new Date("2026-08-11T12:00:00.000Z"),
      expiryDate: new Date("2027-08-11T12:00:00.000Z"),
      applicantName: "Alex Morgan",
      applicantProfile: {
        addressLine1: "1 High Street",
        town: "Shrewsbury",
        postcode: "sy1 1aa",
      },
    });

    assert.equal(data.date_of_birth, "15/03/1985");
    assert.equal(data.middle_name, "");
    assert.equal(data.applicant_address, "1 High Street\nShrewsbury\nSY1 1AA");
    assert.equal(data.licence_type, "Street trading consent");
    assert.equal(data.lic_no, data.licence_number);
  });

  it("renders new angle-bracket and legacy brace fields", async () => {
    const document = new Document({
      sections: [
        {
          headers: {
            default: new Header({ children: [new Paragraph("<council_name>")] }),
          },
          footers: {
            default: new Footer({
              children: [new Paragraph("<application_reference>")],
            }),
          },
          children: [new Paragraph("<licence_number> / {{lic_holder}}")],
        },
      ],
    });
    const template = await Packer.toBuffer(document);
    const rendered = await renderLicenceTemplate(template, {
      licence_number: "ST/2026/00001",
      lic_holder: "Alex Morgan",
      council_name: "Example Council",
      application_reference: "DP-ST-2026-0001",
    });
    const text = await readDocumentText(rendered);
    assert.match(text, /ST\/2026\/00001 \/ Alex Morgan/);
    assert.match(text, /Example Council/);
    assert.match(text, /DP-ST-2026-0001/);
  });
});

describe("application drafts", () => {
  it("replaces the current section without losing other saved sections", () => {
    assert.deepEqual(
      mergeDraftAnswers(
        { personal: { name: "Alex" }, vehicle: { registration: "OLD" } },
        "vehicle",
        { registration: "NEW", colour: "Blue" },
      ),
      {
        personal: { name: "Alex" },
        vehicle: { registration: "NEW", colour: "Blue" },
      },
    );
  });
});