# Customisation

Customise in layers. Prefer configuration for service rules and small branding changes; use code only for new platform behavior or integrations.

## Branding and service content

Set public values through `.env` locally or `azd env set` in Azure:

```bash
azd env set NEXT_PUBLIC_APP_NAME "Example Council Permit Platform"
azd env set NEXT_PUBLIC_SUPPORT_EMAIL "permits@example.gov.uk"
azd env set NEXT_PUBLIC_SUPPORT_PHONE "0300 123 4567"
```

Replace:

- `public/contoso_logo.svg` with an approved, accessible organisation mark;
- `public/favicon.svg` and `src/app/favicon.svg` with approved icons;
- synthetic footer and policy content;
- default metadata in `src/app/layout.tsx` where required.

Do not add Microsoft or government branding without the necessary trademark and brand approvals. Preserve meaningful alternative text and test mobile header behavior after changing logo dimensions.

## Add or change a licence or permit module

For demonstration, use the administrator module builder:

1. create or open a module;
2. edit general content and availability;
3. define form sections and fields;
4. define document requirements and conditional rules;
5. configure workflow stages and SLA targets;
6. define the review checklist and fees;
7. preview and publish a new version;
8. test a new application against that version.

For repeatable environment bootstrap, add or update a seed in `prisma/`. Keep seeds idempotent and synthetic.

### Module design checklist

- Confirm the legal power and responsible authority.
- Use plain language and accessible field labels/hints.
- Collect only data required for the purpose.
- Define each document's necessity and retention period.
- Validate conditional branches, including missing or unexpected values.
- Model officer work and exceptional paths, not only the happy path.
- Define SLA clocks and whether weekends/bank holidays apply. The sample counts weekdays and does not model public holidays.
- Validate fees and payment exemptions with service owners.
- Define applicant-visible stage names and notification expectations.
- Test version changes against applications already in progress.

## Configure identity

The included identity design separates:

- residents and businesses through Microsoft Entra External ID self-service sign-up and sign-in;
- workforce users through tenant-scoped Microsoft Entra ID;
- reviewer, manager, and administrator access through signed application-role claims;
- synthetic credentials behind an explicit server-side demo setting.

Follow [Identity](identity.md) to create app registrations, associate an External ID user flow, define workforce roles, register exact callbacks, and switch Azure to `AUTHENTICATION_MODE=entra`.

When adapting the design to GOV.UK One Login or another approved identity service, preserve the security invariants:

1. link accounts by validated immutable issuer and subject identifiers, never email alone;
2. prevent all public identity providers from assigning staff roles;
3. map staff roles from signed authoritative claims rather than browser input;
4. fail closed on duplicate contact addresses and unsupported roles;
5. define audited account linking, email change, deprovisioning, role review, and break-glass operations;
6. test session expiry, revocation, tenant boundaries, and privilege changes;
7. disable demo credentials, demo UI, and synthetic user seeding in production-intent environments.

## Integrate payments

The domain model supports external redirect, manual reference, receipt upload, API integration, and no-fee modes. The sample does not process card data.

For an external payment provider:

- create a payment request server-side;
- bind it to application ID, amount, and an idempotency key;
- redirect to the provider-hosted payment page;
- validate signed callbacks server-side;
- reconcile status independently of the browser return;
- record audit events without storing cardholder data;
- handle refunds, duplicate callbacks, abandoned journeys, and changed fees.

Complete PCI DSS scoping with the organisation and payment provider.

## Implement notifications

The worker currently logs queued notification work. Replace the placeholder with Azure Communication Services or an approved provider.

Required considerations:

- template approval and localisation;
- recipient address validation;
- retry and dead-letter behavior;
- delivery status and bounce handling;
- no sensitive case detail in subject lines or SMS;
- user communication preferences where applicable;
- operational alerts for sustained failure;
- retention and redaction of message content.

## Implement malware scanning

The document-scan worker currently simulates a successful scan. Do not treat this as malware protection.

Recommended patterns include Defender for Storage malware scanning or a managed scanning service. A secure flow should:

1. upload into a quarantined location;
2. mark the database record pending;
3. process the scan result asynchronously;
4. block applicant/staff download until clean;
5. isolate or delete malicious content;
6. alert and audit without exposing the file;
7. handle scanner outage and timeout explicitly.

## Replace the policy and AI model

The seeded Statement of Licensing Policy is fictional. A manager or administrator should open **Policy Copilot > Manage policy versions**, import the approved PDF, DOCX, Markdown, or text document, review its parsed sections, then activate that version. The previous version remains available for rollback. Test citation mappings before enabling AI for users.

When changing models:

- verify regional availability and quota;
- validate structured-output compatibility;
- rerun quality and safety evaluations;
- compare latency and cost;
- review deprecation dates and upgrade policy;
- update Bicep model name/version and application deployment setting together.

See [Responsible AI](responsible-ai.md).

## Change the licence document

Edit `scripts/generate-licence-template.mjs`, then run:

```bash
npm run templates:generate
```

The template uses `docx-templates` placeholders:

- `{{lic_no}}`
- `{{commencement_date}}`
- `{{expiry_date}}`
- `{{lic_holder}}`
- `{{lic_holder_address}}`

Validate legal wording, accessibility, print rendering, signatures, document metadata, and template path before production use. Keep real signatures and personal data outside source control.

## Add a platform feature

Use the existing ownership boundaries:

- reusable UI in `src/components`;
- route handlers/pages in `src/app`;
- domain behavior in `src/lib`;
- shared domain types in `src/types`;
- persisted changes through Prisma migrations;
- asynchronous work through typed queue payloads and workers.

Add tests that exercise the rule boundary. Update architecture, security, operations, and configuration documentation when the feature changes a contract.

## Accessibility and content

The interface follows a GOV.UK-inspired visual pattern but is not certified as conforming to the GOV.UK Design System or WCAG.

Before launch:

- complete automated and manual WCAG 2.2 AA testing;
- test keyboard-only, screen reader, zoom/reflow, contrast, error recovery, and timeout behavior;
- run research with users who have access needs;
- publish an accurate accessibility statement;
- establish a process for accessibility defects and content review.

## Localisation

The applicant AI can answer in configured languages, but the full application UI is English-only. Production localisation requires translated interface content, module configuration, notifications, validation messages, documents, right-to-left layouts where relevant, and a governance process for translation changes.
