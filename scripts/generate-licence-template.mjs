import { mkdir, writeFile } from "node:fs/promises";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const outputPath = new URL(
  "../public/templates/private-hire-driver-licence.docx",
  import.meta.url,
);
const standardOutputPath = new URL(
  "../public/templates/standard-licence.docx",
  import.meta.url,
);

const border = { style: BorderStyle.SINGLE, size: 4, color: "B1B4B6" };
const borders = { top: border, bottom: border, left: border, right: border };

function fieldRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 2708, type: WidthType.DXA },
        shading: { fill: "EAF4FB", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, bold: true })] }),
        ],
      }),
      new TableCell({
        borders,
        width: { size: 6318, type: WidthType.DXA },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun(value)] })],
      }),
    ],
  });
}

const document = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 34, bold: true, color: "0B2E5E" },
        paragraph: { spacing: { before: 200, after: 180 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 27, bold: true, color: "0B2E5E" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "conditions",
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "1D70B8" },
              },
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: "CONTOSO COUNCIL  |  DIGITAL PERMIT PLATFORM",
                  bold: true,
                  color: "0B2E5E",
                  size: 20,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun("Synthetic sample template | Page "),
                new TextRun({ children: [PageNumber.CURRENT] }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun("Private Hire Driver Licence")],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [
            new TextRun({
              text: "Local Government (Miscellaneous Provisions) Act 1976",
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 220 },
          children: [
            new TextRun(
              "Contoso Council grants this licence to the person named below, subject to applicable legislation and the authority's published licensing conditions.",
            ),
          ],
        }),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2708, 6318],
          rows: [
            fieldRow("Licence number", "{{lic_no}}"),
            fieldRow("Commencement date", "{{commencement_date}}"),
            fieldRow("Expiry date", "{{expiry_date}}"),
            fieldRow("Licence holder", "{{lic_holder}}"),
            fieldRow("Address", "{{lic_holder_address}}"),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Conditions")],
        }),
        new Paragraph({
          numbering: { reference: "conditions", level: 0 },
          children: [
            new TextRun(
              "The licence holder must notify the licensing authority of a change of address within the period required by law.",
            ),
          ],
        }),
        new Paragraph({
          numbering: { reference: "conditions", level: 0 },
          children: [new TextRun("This licence is not transferable.")],
        }),
        new Paragraph({
          numbering: { reference: "conditions", level: 0 },
          children: [
            new TextRun(
              "The licence holder must comply with the authority's current private hire licensing policy and conditions.",
            ),
          ],
        }),
        new Paragraph({
          spacing: { before: 420, after: 120 },
          children: [new TextRun({ text: "Authorised officer", bold: true })],
        }),
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "505A5F" },
          },
          spacing: { after: 120 },
          children: [new TextRun(" ")],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "Licensing Service, Contoso Council, 1 Civic Square, Contoso, CN1 1AA",
            ),
          ],
        }),
      ],
    },
  ],
});

const standardDocument = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 34, bold: true, color: "0B2E5E" },
        paragraph: { spacing: { before: 200, after: 180 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Arial", size: 27, bold: true, color: "0B2E5E" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 12, color: "1D70B8" },
              },
              spacing: { after: 180 },
              children: [
                new TextRun({ text: "<council_name>", bold: true, color: "0B2E5E" }),
                new TextRun("  |  "),
                new TextRun("<service_name>"),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun("Application <application_reference> | Page "),
                new TextRun({ children: [PageNumber.CURRENT] }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun("<licence_type>")],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [new TextRun({ text: "Licence or permit document", italics: true })],
        }),
        new Paragraph({
          spacing: { after: 220 },
          children: [
            new TextRun(
              "This document confirms that the licensing authority has issued the licence or permit described below.",
            ),
          ],
        }),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2708, 6318],
          rows: [
            fieldRow("Licence number", "<licence_number>"),
            fieldRow("Application reference", "<application_reference>"),
            fieldRow("Application type", "<application_type>"),
            fieldRow("Issue date", "<issue_date>"),
            fieldRow("Expiry date", "<expiry_date>"),
            fieldRow("Licence holder", "<applicant_name>"),
            fieldRow("Address", "<applicant_address>"),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Conditions")],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "Add the statutory conditions and any licence-specific conditions here before uploading this template.",
            ),
          ],
        }),
        new Paragraph({
          spacing: { before: 420 },
          children: [new TextRun({ text: "Authorised officer", bold: true })],
        }),
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "505A5F" },
          },
          children: [new TextRun(" ")],
        }),
        new Paragraph({
          spacing: { before: 180 },
          children: [
            new TextRun("Contact: <support_email> | <support_phone>"),
          ],
        }),
      ],
    },
  ],
});

await mkdir(new URL("../public/templates/", import.meta.url), { recursive: true });
await writeFile(outputPath, await Packer.toBuffer(document));
await writeFile(standardOutputPath, await Packer.toBuffer(standardDocument));
console.log(`Generated ${outputPath.pathname}`);
console.log(`Generated ${standardOutputPath.pathname}`);