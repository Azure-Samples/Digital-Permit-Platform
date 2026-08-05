// Validate the complex demo licence end-to-end: extract text and run
// the real summary + compliance prompts against Azure OpenAI.
//   export AZURE_CONFIG_DIR="$HOME/.azure-work" && npx tsx --env-file=.env scripts/test-complex.ts
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { DefaultAzureCredential } from "@azure/identity";
import { PrismaClient } from "@prisma/client";
import { licenceSummaryPrompt, compliancePrompt } from "../src/lib/ai/prompts";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const prisma = new PrismaClient();
const MODEL = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";

function client(): OpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const credential = new DefaultAzureCredential();
  const scope = "https://cognitiveservices.azure.com/.default";
  const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  return new OpenAI({
    apiKey: "placeholder",
    baseURL: `${base}openai/deployments/${MODEL}`,
    defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-10-21" },
    fetch: async (url, init) => {
      const token = await credential.getToken(scope);
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token.token}`);
      headers.delete("api-key");
      return fetch(url as any, { ...init, headers });
    },
  });
}

async function main() {
  const openai = client();
  const buf = readFileSync("public/templates/complex-premises-licence.pdf");
  const { text } = await pdfParse(buf);
  console.log(`Extracted ${text.length} chars from the complex licence PDF.`);

  const policy = await prisma.licensingPolicy.findFirst({
    where: { isActive: true },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  const grounding = [
    `POLICY: ${policy!.title} (${policy!.councilName})`,
    ...policy!.sections.map((s) => `[${s.ref}] ${s.heading}\n${s.content}`),
  ].join("\n\n");

  console.log("\nAnalysing (at a glance)...");
  const sRes = await openai.chat.completions.create({
    model: MODEL, temperature: 0.1, max_tokens: 3200, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: licenceSummaryPrompt() },
      { role: "user", content: `Summarise the following licence document:\n\n${text.slice(0, 40000)}` },
    ],
  });
  const s = JSON.parse(sRes.choices[0].message.content!);
  console.log("  documentType   :", s.documentType);
  console.log("  premises       :", s.premisesName);
  console.log("  holder         :", s.licenceHolder);
  console.log("  DPS            :", s.designatedPremisesSupervisor?.name, "-", s.designatedPremisesSupervisor?.personalLicenceNumber);
  console.log("  activities     :", (s.licensableActivities || []).length, "->", (s.licensableActivities || []).slice(0, 3).map((a: any) => a.activity).join(" | "));
  console.log("  mandatory cond :", (s.mandatoryConditions || []).length, "assessed;", (s.mandatoryConditions || []).filter((m: any) => m.present).length, "present");
  console.log("  op-schedule    :", (s.operatingScheduleConditions || []).length, "conditions summarised");
  console.log("  RA conditions  :", (s.responsibleAuthorityConditions || []).length);
  console.log("  officer actions:", (s.officerActions || []).length);
  console.log("  AT A GLANCE    :", s.atAGlance);

  console.log("\nAssessing compliance vs policy...");
  const cRes = await openai.chat.completions.create({
    model: MODEL, temperature: 0.1, max_tokens: 1600, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: compliancePrompt(grounding) },
      { role: "user", content: `Assess this against the policy:\n\n${JSON.stringify(s)}` },
    ],
  });
  const c = JSON.parse(cRes.choices[0].message.content!);
  console.log("  overall  :", c.overall, "-", c.overallLabel);
  console.log("  headline :", c.headline);
  console.log("  checks   :", (c.checks || []).map((x: any) => `${x.area}[${x.rating}]`).join(", "));

  console.log("\nOK - the app distils this 8-page document into the above at-a-glance view.");
}

main().catch((e) => { console.error("ERR", e); process.exit(1); }).finally(() => prisma.$disconnect());
