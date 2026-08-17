# Responsible AI

## Scope

The optional AI features help users navigate licensing policy and help authorised staff review applications and licence documents. They do not replace legal advice, professional judgement, evidence verification, statutory consultation, a hearing, or an authorised decision maker.

AI is disabled by default in the Azure deployment.

## Included AI experiences

| Experience | Intended user | Purpose |
|---|---|---|
| Applicant assistant | Resident or business | Plain-language, multilingual guidance grounded in the configured policy |
| Policy Copilot | Officer or authorised partner | Answer policy questions and show relevant section references |
| Licence analyser | Officer | Extract and summarise a licence, identify conditions, and compare it with policy |
| Application insight | Officer | Highlight possible policy considerations for an application |

Every output is advisory. The user interface and operating process should make that status clear.

## Intended uses

- explain what the configured policy says in accessible language;
- direct users to relevant application requirements;
- summarise a synthetic or authorised licence document;
- identify potentially relevant policy sections for officer review;
- support consistency and reduce manual search effort;
- produce a review starting point that a qualified person verifies.

## Out-of-scope and prohibited uses

- automatically grant, refuse, suspend, revoke, or condition a licence or permit;
- score an applicant's character, credibility, health, disability, ethnicity, religion, nationality, or other protected/sensitive traits;
- infer facts that are not in approved evidence;
- replace a statutory consultation, inspection, hearing, equality assessment, or legal review;
- provide definitive legal advice;
- process data that the organisation has not approved for the selected model, region, and retention terms;
- use synthetic policy answers as if they were the policy of a real authority;
- conceal AI involvement from users or decision makers.

## System behavior

The sample uses regime-aware retrieval by context rather than an external search index:

1. active Licensing Act and taxi/private-hire policy sections are read from PostgreSQL;
2. the question, application category or document text selects the applicable regime;
3. relevant excerpts are ranked within a shared 48,000-character prompt budget;
4. a system prompt keeps premises and taxi legal tests distinct;
5. the request is sent keylessly to an Azure OpenAI deployment;
6. structured results and namespaced section references are stored and presented for human review.

This lexical pattern is simple and transparent, but it is not semantic retrieval. Larger or more varied policy estates should use an evaluated retrieval approach with chunking, metadata, regime/version filters and citation verification.

## Limitations

- Language models can invent facts, policy text, citations, or certainty.
- Citation extraction detects section-like references; it does not prove that the cited section supports the claim.
- Retrieved excerpts may omit a relevant provision or select a similarly worded section from the wrong context; regime-routing and retrieval recall require evaluation.
- Uploaded PDFs can have poor text extraction, unusual layout, scans, tables, or hidden content.
- The sample does not perform OCR for image-only documents.
- Prompt injection can appear in applicant answers or uploaded documents.
- Multilingual answers may omit nuance or mistranslate legal/service terms.
- The synthetic policy does not represent the law or policy of a real authority.
- Model behavior, safety systems, latency, and cost can change between model versions.
- Fire-and-forget analysis in the web process is not guaranteed across restarts.

## Human oversight

Define a named accountable role for each AI experience. At minimum:

- applicants must be able to reach authoritative guidance or human support;
- officers must review source evidence, policy text, and citations;
- AI must not write the final decision without explicit human confirmation;
- users must be able to correct extracted facts;
- contested or high-impact cases must have a non-AI review route;
- the audit trail should distinguish model output from human findings;
- service owners must be able to disable AI independently of the core platform.

## Data handling

Replace the seeded policy before evaluation or use. Upload the authority's approved documents in **Licensing policy**, selecting the correct Licensing Act or taxi/private-hire regime, review each retained original, and activate it only after approval. Repeat that process for each adopted edition or revision; the application retains previously active versions for traceability and rollback. Policy Copilot retrieves bounded excerpts from the applicable internally indexed policy rather than receiving complete documents. Citation-style references are not proof that a statement is correct; users must be able to inspect the authoritative source document.

Treat prompts, document text, application answers, and model responses according to the highest data classification in the request.

Before enabling AI:

- confirm the Azure service, model, region, deployment type, and contractual data terms;
- minimise fields sent to the model;
- redact unnecessary identifiers and special-category data;
- prevent secrets, SAS URLs, and authentication tokens entering prompts;
- define prompt/response storage and deletion periods;
- review Application Insights and console logging for prompt leakage;
- document whether user conversations are part of the official case record;
- include AI processing in the privacy notice and DPIA where required.

## Safety and security controls

The sample provides role checks, keyless Azure authentication, bounded chat history, policy grounding, and safe Markdown rendering. A production design should add:

- Azure AI Content Safety or approved equivalent where appropriate;
- prompt-injection and untrusted-document handling;
- schema validation and rejection of malformed structured output;
- output length and token budgets;
- per-user/tenant rate limits and abuse monitoring;
- timeout, retry, circuit-breaker, and cost controls;
- model deployment change control;
- secure prompt/version registry;
- offline fallback when AI is unavailable;
- independent citation verification for high-impact output.

Policy activation is independent of document length. The complete retained source remains authoritative, while the included retrieval layer ranks indexed sections for each request and supplies at most 48,000 relevant characters to the model. Treat this bounded lexical retrieval as a reference implementation: evaluate recall, citation accuracy and adversarial queries against each council's approved statement before production use. Scanned/image-only policies have no searchable grounding until OCR text or a text-based replacement is supplied.

## Evaluation plan

Build a representative, approved dataset before pilot. Do not use production personal data unless the evaluation environment and lawful basis are approved.

### Quality dimensions

| Dimension | Example measure |
|---|---|
| Groundedness | Every material claim is supported by supplied policy/evidence |
| Citation accuracy | Section exists and supports the adjacent claim |
| Completeness | Required policy factors and document conditions are covered |
| Factual extraction | Holder, activities, hours, conditions, and dates match source |
| Relevance | Answer addresses the user's actual question without unrelated content |
| Uncertainty | Model identifies missing evidence and avoids invented certainty |
| Multilingual quality | Meaning, tone, caveats, and service terms are preserved |
| Safety | Harmful, discriminatory, privacy-invasive, or disallowed output is prevented |
| Robustness | Handles malformed files, long input, prompt injection, and out-of-scope questions |
| Operational | Latency, availability, token use, retry rate, and cost meet agreed targets |

### Test categories

- clear policy questions with known answers;
- ambiguous questions requiring clarification;
- questions outside the configured policy;
- conflicting policy sections and exceptions;
- incomplete applications and missing evidence;
- licences with unusual hours, conditions, or formatting;
- prompt injection embedded in documents and user messages;
- English and every supported target language;
- protected-characteristic and equality-sensitive scenarios;
- adversarial requests for decisions, legal advice, or hidden system instructions;
- service/model timeout and unavailable-model behavior.

Set pass thresholds and escalation rules with service, legal, policy, equality, privacy, security, and operational owners. Track both average quality and worst-case high-impact failures.

## Monitoring and change control

Monitor:

- use by experience, role, and language;
- failure, timeout, and retry rates;
- token consumption and cost;
- user feedback and correction frequency;
- unsupported or out-of-scope questions;
- citation validation failures;
- harmful-content and prompt-injection events;
- decision outcomes for evidence of automation bias or disparate impact.

Re-evaluate after changes to model version, prompt, policy corpus, retrieval, schema, user group, data class, or decision workflow. Keep an immediate disable path through `ENABLE_AI=false` and UI/service configuration.

## Transparency

User-facing AI experiences should state:

- that the response is generated by AI;
- the source policy/version used;
- that answers can be wrong or incomplete;
- how to verify authoritative information;
- how to report a problem or request human help;
- whether the interaction is stored with the case.

## Approval checklist

- [ ] Intended and prohibited uses are approved.
- [ ] Accountable service and model owners are named.
- [ ] Data classes, region, retention, privacy notice, and DPIA are approved.
- [ ] Policy content is authoritative, versioned, and tested.
- [ ] Evaluation dataset, thresholds, and high-impact failure criteria are approved.
- [ ] Human review and appeal/escalation routes are operational.
- [ ] Safety, security, abuse, cost, and availability controls are tested.
- [ ] Monitoring and incident response are in place.
- [ ] Model/prompt/policy change control and rollback are rehearsed.
- [ ] Accessibility and multilingual behavior are tested with users.

Useful Microsoft guidance:

- [Microsoft Responsible AI Standard](https://www.microsoft.com/ai/responsible-ai)
- [Azure OpenAI transparency note](https://learn.microsoft.com/legal/cognitive-services/openai/transparency-note)
- [Azure AI Content Safety](https://learn.microsoft.com/azure/ai-services/content-safety/overview)
