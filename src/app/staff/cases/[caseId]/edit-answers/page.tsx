import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { requireRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { FormSection } from "@/types/module";

export const dynamic = "force-dynamic";

async function saveEditsAction(formData: FormData) {
  "use server";
  const applicationId = formData.get("applicationId") as string;
  const userId = formData.get("userId") as string;
  const editReason = formData.get("editReason") as string;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { moduleVersion: true },
  });
  if (!app) return;

  const currentAnswers = (app.answers as Record<string, unknown>) ?? {};
  const formSchema = (app.moduleVersion.formSchema as unknown as FormSection[]) ?? [];
  const previousAnswers = JSON.parse(JSON.stringify(currentAnswers));

  // Collect all edited field values from form data
  const updatedAnswers = { ...currentAnswers };

  for (const section of formSchema) {
    const sectionKey = section.key;
    const sectionAnswers = {
      ...((currentAnswers[sectionKey] as Record<string, unknown>) ?? {}),
    };

    for (const field of section.fields) {
      if (field.type === "address") {
        const addressParts = ["line1", "line2", "town", "county", "postcode"];
        sectionAnswers[field.key] = Object.fromEntries(
          addressParts
            .map((part) => [
              part,
              formData.get(`${sectionKey}.${field.key}__${part}`)?.toString() ?? "",
            ])
            .filter(([, value]) => value !== "")
        );
        continue;
      }

      const formValue = formData.get(`${sectionKey}.${field.key}`);
      if (formValue !== null) {
        const strVal = formValue.toString();
        if (strVal !== "") {
          sectionAnswers[field.key] = strVal;
        }
      }
    }

    updatedAnswers[sectionKey] = sectionAnswers;
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { answers: updatedAnswers as any },
  });

  // Create a case note documenting the edit
  await prisma.caseNote.create({
    data: {
      applicationId,
      authorId: userId,
      content: `Application answers edited. Reason: ${editReason || "No reason given"}`,
      isInternal: true,
    },
  });

  // Record workflow event
  await prisma.workflowEvent.create({
    data: {
      applicationId,
      fromStage: app.currentStage,
      toStage: app.currentStage ?? "edited",
      action: "answers_edited",
      performedById: userId,
      metadata: { reason: editReason },
    },
  });

  // Audit log with before/after
  await writeAuditLog({
    userId,
    applicationId,
    action: "application.answers.edit",
    entityType: "Application",
    entityId: applicationId,
    previousValues: previousAnswers,
    newValues: updatedAnswers as Record<string, unknown>,
  });

  redirect(`/staff/cases/${applicationId}`);
}

export default async function EditAnswersPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await requireRole("REVIEWER", "MANAGER", "ADMIN").catch(
    () => null
  );
  if (!session) redirect("/auth/login");

  const resolvedParams = await params;
  const app = await prisma.application.findUnique({
    where: { id: resolvedParams.caseId },
    include: {
      module: { select: { displayName: true } },
      moduleVersion: { select: { formSchema: true } },
    },
  });
  if (!app) return notFound();

  const formSchema =
    (app.moduleVersion.formSchema as unknown as FormSection[]) ?? [];
  const answers = (app.answers as Record<string, unknown>) ?? {};

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Staff"
        navigation={getNavigationForRole(session.user.role, "/staff/queue")}
        userName={session.user.name}
        userRole={session.user.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <Link href={`/staff/cases/${resolvedParams.caseId}`} className="text-sm">
            ← Back to case
          </Link>
          <h1 className="mt-4">Edit application answers</h1>
          <p className="text-govuk-dark-grey mb-2">
            {app.module.displayName} · Ref: {app.referenceNumber}
          </p>

          <div className="govuk-warning-text mb-6">
            <strong>Changes are recorded in the audit log and case timeline.</strong>
            <p className="mt-1 text-sm">
              All edits will be logged with your name, the date, and the reason
              you provide. The previous values are preserved for audit purposes.
            </p>
          </div>

          <form action={saveEditsAction}>
            <input type="hidden" name="applicationId" value={resolvedParams.caseId} />
            <input type="hidden" name="userId" value={session.user.id} />

            {formSchema.map((section) => {
              const sectionAnswers =
                (answers[section.key] as Record<string, unknown>) ?? {};

              return (
                <section
                  key={section.key}
                  className="bg-white border border-govuk-mid-grey p-6 mb-6"
                >
                  <h2>{section.title}</h2>

                  {section.fields.map((field) => {
                    const val = sectionAnswers[field.key];
                    const fieldName = `${section.key}.${field.key}`;

                    // For address fields, render as JSON textarea
                    if (field.type === "address") {
                      const addr = (val as Record<string, string>) ?? {};
                      return (
                        <div key={field.key} className="govuk-form-group">
                          <p className="govuk-label">
                            {field.label}
                          </p>
                          <div className="space-y-2">
                            {["line1", "line2", "town", "county", "postcode"].map(
                              (part) => {
                                const partId = `${fieldName}-${part}`;
                                return (
                                <div key={part}>
                                  <label htmlFor={partId} className="text-xs text-govuk-dark-grey">
                                    {part === "line1"
                                      ? "Address line 1"
                                      : part === "line2"
                                      ? "Address line 2"
                                      : part.charAt(0).toUpperCase() +
                                        part.slice(1)}
                                  </label>
                                  <input
                                    id={partId}
                                    type="text"
                                    name={`${fieldName}__${part}`}
                                    className="govuk-input"
                                    defaultValue={addr[part] ?? ""}
                                  />
                                </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      );
                    }

                    // For textarea/long text
                    if (field.type === "textarea") {
                      return (
                        <div key={field.key} className="govuk-form-group">
                          <label
                            className="govuk-label"
                            htmlFor={fieldName}
                          >
                            {field.label}
                          </label>
                          <textarea
                            id={fieldName}
                            name={fieldName}
                            className="govuk-textarea"
                            rows={3}
                            defaultValue={(val as string) ?? ""}
                          />
                        </div>
                      );
                    }

                    // For select fields
                    if (field.type === "select" || field.type === "radio") {
                      return (
                        <div key={field.key} className="govuk-form-group">
                          <label
                            className="govuk-label"
                            htmlFor={fieldName}
                          >
                            {field.label}
                          </label>
                          <select
                            id={fieldName}
                            name={fieldName}
                            className="govuk-select"
                            defaultValue={(val as string) ?? ""}
                          >
                            <option value="">—</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    // Default: text input
                    return (
                      <div key={field.key} className="govuk-form-group">
                        <label className="govuk-label" htmlFor={fieldName}>
                          {field.label}
                        </label>
                        <input
                          type={
                            field.type === "email"
                              ? "email"
                              : field.type === "number" || field.type === "currency"
                              ? "number"
                              : field.type === "date"
                              ? "text"
                              : "text"
                          }
                          id={fieldName}
                          name={fieldName}
                          className="govuk-input"
                          defaultValue={
                            field.type === "date" && typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)
                              ? val.split("-").reverse().join("/")
                              : (val as string) ?? ""
                          }
                          placeholder={field.type === "date" ? "DD/MM/YYYY" : undefined}
                        />
                      </div>
                    );
                  })}
                </section>
              );
            })}

            <div className="bg-white border border-govuk-mid-grey p-6 mb-6">
              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="editReason">
                  Reason for editing
                </label>
                <p className="govuk-hint">
                  This will be recorded in the case timeline and audit log.
                </p>
                <textarea
                  id="editReason"
                  name="editReason"
                  className="govuk-textarea"
                  rows={3}
                  required
                  placeholder="e.g. Corrected applicant name as per phone call on 12/03/2026"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="govuk-button">
                Save changes
              </button>
              <Link
                href={`/staff/cases/${resolvedParams.caseId}`}
                className="govuk-button govuk-button--secondary no-underline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
