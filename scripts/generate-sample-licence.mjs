// Generate a sample premises licence PDF from the .txt source so the
// "upload a licence" flow can be tested end-to-end with a real PDF.
// Run: node scripts/generate-sample-licence.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "public/templates/sample-premises-licence.txt");
const out = join(root, "public/templates/sample-premises-licence.pdf");

const text = readFileSync(src, "utf-8");

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Courier);
const fontSize = 9;
const lineHeight = 12;
const margin = 50;
const pageWidth = 595.28; // A4
const pageHeight = 841.89;
const maxWidth = pageWidth - margin * 2;

// Wrap a single logical line to fit the page width.
function wrap(line) {
  if (line.trim() === "") return [""];
  const words = line.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

let page = pdf.addPage([pageWidth, pageHeight]);
let y = pageHeight - margin;

for (const rawLine of text.split("\n")) {
  for (const line of wrap(rawLine)) {
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }
}

const bytes = await pdf.save();
writeFileSync(out, bytes);
console.log(`✔ Wrote ${out} (${pdf.getPageCount()} pages, ${bytes.length} bytes)`);
