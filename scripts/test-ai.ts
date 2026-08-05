// Self-contained smoke test for the Policy AI pipeline against the real
// Azure OpenAI resource. Avoids the "@/" alias so it runs under tsx.
//   export AZURE_CONFIG_DIR="$HOME/.azure-work" && npx tsx --env-file=.env scripts/test-ai.ts
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { DefaultAzureCredential } from "@azure/identity";
import { PrismaClient } from "@prisma/client";
import {
  licenceSummaryPrompt,
  compliancePrompt,
  officerChatPrompt,
  applicantChatPrompt,
} from "../src/lib/ai/prompts";

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

  const policy = await prisma.licensingPolicy.findFirst({
    where: { isActive: true },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!policy) throw new Error("No active policy — run npm run db:seed:policy");
  const grounding = [
    `POLICY: ${policy.title} (${policy.councilName})`,
    ...policy.sections.map((s) => `[${s.ref}] ${s.heading}\n${s.content}`),
  ].join("\n\n");

  const licence = readFileSync("public/templates/sample-premises-licence.txt", "utf-8");

  console.log("① Analysing licence…");
  const t0 = Date.now();
  const summaryRes = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: licenceSummaryPrompt() },
      { role: "user", content: `Summarise the following licence document:\n\n${licence}` },
    ],
  });
  const summary = JSON.parse(summaryRes.choices[0].message.content!);
  console.log(`   ✔ ${Date.now() - t0}ms, ${summaryRes.usage?.total_tokens} tokens`);
  console.log("   documentType:", summary.documentType);
  console.log("   premises:", summary.premisesName, "| DPS:", summary.designatedPremisesSupervisor?.name);
  console.log("   activities:", summary.licensableActivities?.length);
  console.log("   mandatory conditions assessed:", summary.mandatoryConditions?.length);
  console.log("   atAGlance:", summary.atAGlance);

  console.log("\n② Assessing compliance vs policy…");
  const t1 = Date.now();
  const compRes = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: compliancePrompt(grounding) },
      { role: "user", content: `Assess this against the policy:\n\n${JSON.stringify(summary)}` },
    ],
  });
  const compliance = JSON.parse(compRes.choices[0].message.content!);
  console.log(`   ✔ ${Date.now() - t1}ms, ${compRes.usage?.total_tokens} tokens`);
  console.log("   overall:", compliance.overall, "-", compliance.overallLabel);
  console.log("   headline:", compliance.headline);
  console.log("   checks:", compliance.checks?.map((c: any) => `${c.area} [${c.rating}] ${c.policyRef ?? ""}`).join("; "));

  console.log("\n③ Officer chat (CIA question)…");
  const chatRes = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: "system", content: officerChatPrompt(grounding, JSON.stringify(summary)) },
      { role: "user", content: "Is this premises in the cumulative impact area and what does that mean for a variation to extend hours?" },
    ],
  });
  console.log("   Q: Is this in the CIA? →");
  console.log(`   ${chatRes.choices[0].message.content!.replace(/\n/g, "\n   ")}`);

  console.log("\n④ Applicant chat in Bengali (train new staff)…");
  const bnRes = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 600,
    messages: [
      { role: "system", content: applicantChatPrompt(grounding, "Bengali") },
      { role: "user", content: "I just employed a new person in my corner shop. What do I need to train them on before they can sell alcohol?" },
    ],
  });
  console.log(`   ${bnRes.choices[0].message.content!.slice(0, 600).replace(/\n/g, "\n   ")}`);

  console.log("\n✅ All AI stages succeeded.");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
