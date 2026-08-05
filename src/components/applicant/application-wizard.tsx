"use client";

import { useState } from "react";
import { DynamicForm } from "@/components/forms/dynamic-form";
import { DocumentUpload } from "@/components/forms/document-upload";
import { ProgressTracker } from "@/components/ui/progress-tracker";
import { GovHeader } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import type { FormSection, DocumentRequirement } from "@/types/module";
import { formatAnswerValue } from "@/lib/format";

interface ApplicationWizardProps {
  applicationId: string;
  referenceNumber: string;
  moduleKey: string;
  moduleName: string;
  formSchema: FormSection[];
  documentRequirements: DocumentRequirement[];
  paymentMode: string;
  feeAmount: number;
  savedAnswers: Record<string, unknown>;
  uploadedDocuments: Array<{
    id: string;
    requirementKey: string;
    originalFilename: string;
    status: string;
  }>;
  userName: string;
}

type WizardStep = "form" | "documents" | "payment" | "declaration" | "review";

export function ApplicationWizard({
  applicationId,
  referenceNumber,
  moduleName,
  formSchema,
  documentRequirements,
  paymentMode,
  feeAmount,
  savedAnswers,
  uploadedDocuments: initialDocuments,
  userName,
}: ApplicationWizardProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(savedAnswers);
  const [uploadedDocuments, setUploadedDocuments] = useState(initialDocuments);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>("form");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Skip payment step if receipt is already captured as a document requirement
  const hasReceiptDocRequirement = documentRequirements.some(
    (d) => d.key === "payment_receipt" || d.key === "receipt"
  );
  const showPaymentStep =
    paymentMode !== "NO_FEE" &&
    paymentMode !== "RECEIPT_UPLOAD" &&
    !hasReceiptDocRequirement;

  // Build step list based on module config
  const steps = [
    ...formSchema.map((s, i) => ({ key: `form-${i}`, label: s.title })),
    { key: "documents", label: "Documents" },
    ...(showPaymentStep
      ? [{ key: "payment", label: "Payment" }]
      : []),
    { key: "declaration", label: "Declaration" },
    { key: "review", label: "Review & submit" },
  ];

  const currentStepKey =
    currentStep === "form"
      ? `form-${currentSectionIndex}`
      : currentStep;

  async function handleSave(sectionKey: string, sectionAnswers: Record<string, unknown>) {
    setSaving(true);
    const updated = { ...answers, [sectionKey]: sectionAnswers };
    setAnswers(updated);

    try {
      await fetch(`/api/applications/${applicationId}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey, answers: sectionAnswers }),
      });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleNextSection() {
    if (currentSectionIndex < formSchema.length - 1) {
      setCompletedSteps((prev) => [...prev, `form-${currentSectionIndex}`]);
      setCurrentSectionIndex((i) => i + 1);
    } else {
      setCompletedSteps((prev) => [
        ...prev,
        `form-${currentSectionIndex}`,
      ]);
      setCurrentStep("documents");
    }
    window.scrollTo(0, 0);
  }

  function handlePrevSection() {
    if (currentStep === "documents") {
      setCurrentStep("form");
      setCurrentSectionIndex(formSchema.length - 1);
    } else if (currentStep === "payment") {
      setCurrentStep("documents");
    } else if (currentStep === "declaration") {
      setCurrentStep(showPaymentStep ? "payment" : "documents");
    } else if (currentStep === "review") {
      setCurrentStep("declaration");
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex((i) => i - 1);
    }
    window.scrollTo(0, 0);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          declarationAccepted,
          paymentReference,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        alert(data.error || "Submission failed");
      }
    } catch (_err) {
      alert("Error submitting application");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <GovHeader serviceName="Licensing Portal" userName={userName} />
        <main className="govuk-main-wrapper" id="main-content">
          <div className="govuk-container max-w-govuk-two-thirds">
            <div className="govuk-panel">
              <h1 className="govuk-panel__title">Application submitted</h1>
              <div className="govuk-panel__body">
                Your reference number:
                <br />
                <strong>{referenceNumber}</strong>
              </div>
            </div>

            <h2>What happens next</h2>
            <p>
              We&apos;ve sent a confirmation email to your registered email
              address.
            </p>
            <p>
              Your application will be reviewed by the licensing team. We may
              contact you if we need further information or documents.
            </p>
            <p>You can track the progress of your application from your dashboard.</p>

            <div className="flex gap-4 mt-8">
              <a href="/dashboard" className="govuk-button no-underline">
                Go to dashboard
              </a>
              <a
                href={`/dashboard/applications/${applicationId}`}
                className="govuk-button govuk-button--secondary no-underline"
              >
                View application
              </a>
            </div>
          </div>
        </main>
        <GovFooter />
      </>
    );
  }

  return (
    <>
      <GovHeader serviceName="Licensing Portal" userName={userName} />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <span className="text-govuk-dark-grey text-sm">
            {moduleName} · Ref: {referenceNumber}
          </span>
          <h1 className="mt-1 mb-4">
            {currentStep === "form"
              ? formSchema[currentSectionIndex]?.title ?? "Application form"
              : currentStep === "documents"
              ? "Upload documents"
              : currentStep === "payment"
              ? "Payment"
              : currentStep === "declaration"
              ? "Declaration"
              : "Review your application"}
          </h1>

          <ProgressTracker
            steps={steps}
            currentStep={currentStepKey}
            completedSteps={completedSteps}
          />

          <div className="max-w-govuk-two-thirds">
            {/* Form sections */}
            {currentStep === "form" && (
              <DynamicForm
                sections={formSchema}
                currentSectionIndex={currentSectionIndex}
                answers={answers}
                onSave={handleSave}
                onNext={handleNextSection}
                onPrevious={handlePrevSection}
                isFirstSection={currentSectionIndex === 0}
                isLastSection={currentSectionIndex === formSchema.length - 1}
                saving={saving}
              />
            )}

            {/* Documents */}
            {currentStep === "documents" && (
              <div>
                <DocumentUpload
                  requirements={documentRequirements}
                  uploadedDocuments={uploadedDocuments}
                  answers={answers}
                  applicationId={applicationId}
                  onUploadComplete={() => {
                    // Refresh documents
                    fetch(`/api/applications/${applicationId}/documents`)
                      .then((r) => r.json())
                      .then(setUploadedDocuments)
                      .catch(console.error);
                  }}
                />
                <div className="flex gap-3 mt-8">
                  <button type="button"
                    className="govuk-button govuk-button--secondary"
                    onClick={handlePrevSection}
                  >
                    Previous
                  </button>
                  {(() => {
                    // Check which required documents are missing (respecting conditional logic)
                    const flatAnswers = Object.values(answers).reduce<Record<string, unknown>>(
                      (acc, val) => ({ ...acc, ...(val as Record<string, unknown>) }),
                      {}
                    );
                    const missingRequired = documentRequirements.filter((req) => {
                      if (!req.required) return false;
                      // Check conditional visibility
                      if (req.conditionalOn) {
                        const fieldVal = flatAnswers[req.conditionalOn.field];
                        const { operator, value } = req.conditionalOn;
                        let visible = true;
                        if (operator === "eq") visible = fieldVal === value;
                        else if (operator === "neq") visible = fieldVal !== value;
                        else if (operator === "exists") visible = fieldVal !== undefined && fieldVal !== null && fieldVal !== "";
                        if (!visible) return false;
                      }
                      // Check if uploaded
                      return !uploadedDocuments.some((d) => d.requirementKey === req.key);
                    });

                    return (
                      <>
                        {missingRequired.length > 0 && (
                          <div className="govuk-warning-text flex-1">
                            <strong>Missing required documents:</strong>
                            <ul className="list-disc ml-6 mt-1 text-sm">
                              {missingRequired.map((r) => (
                                <li key={r.key}>{r.label}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button type="button"
                          className="govuk-button"
                          disabled={missingRequired.length > 0}
                          onClick={() => {
                            setCompletedSteps((p) => [...p, "documents"]);
                            setCurrentStep(
                              showPaymentStep ? "payment" : "declaration"
                            );
                            window.scrollTo(0, 0);
                          }}
                        >
                          Continue
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Payment */}
            {currentStep === "payment" && (
              <div>
                <div className="bg-white border border-govuk-mid-grey p-6 mb-6">
                  <h2>Fee: £{feeAmount.toFixed(2)}</h2>

                  {paymentMode === "EXTERNAL_REDIRECT" && (
                    <div>
                      <p className="mb-4">
                        Click the button below to make your payment on the
                        council&apos;s payment page. You&apos;ll be returned here
                        after payment.
                      </p>
                      <a
                        href="#payment-redirect"
                        className="govuk-button no-underline"
                      >
                        Pay now
                      </a>
                    </div>
                  )}

                  {paymentMode === "MANUAL_REFERENCE" && (
                    <div className="govuk-form-group">
                      <label className="govuk-label" htmlFor="paymentRef">
                        Payment reference number
                      </label>
                      <p className="govuk-hint">
                        Enter the reference number from your payment receipt
                      </p>
                      <input
                        type="text"
                        id="paymentRef"
                        className="govuk-input max-w-md"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                      />
                    </div>
                  )}

                  {paymentMode === "RECEIPT_UPLOAD" && (
                    <div>
                      <p className="mb-4">
                        Please upload a copy of your payment receipt.
                      </p>
                      <input
                        type="file"
                        className="govuk-input border-0 p-0"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button type="button"
                    className="govuk-button govuk-button--secondary"
                    onClick={handlePrevSection}
                  >
                    Previous
                  </button>
                  <button type="button"
                    className="govuk-button"
                    onClick={() => {
                      setCompletedSteps((p) => [...p, "payment"]);
                      setCurrentStep("declaration");
                      window.scrollTo(0, 0);
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Declaration */}
            {currentStep === "declaration" && (
              <div>
                <div className="bg-white border border-govuk-mid-grey p-6 mb-6">
                  <h2>Declaration</h2>
                  <div className="govuk-inset-text mb-6">
                    <p>By submitting this application, I declare that:</p>
                    <ul className="list-disc ml-6 space-y-2 mt-3">
                      <li>
                        The information I have provided is true and accurate to
                        the best of my knowledge.
                      </li>
                      <li>
                        I understand that it is an offence to make a false
                        statement or withhold information for the purpose of
                        obtaining a licence.
                      </li>
                      <li>
                        I give consent for Contoso Council to process my
                        personal data for the purpose of this application in
                        accordance with UK GDPR.
                      </li>
                      <li>
                        I understand that Contoso Council may verify the
                        information provided and share it with relevant
                        authorities where required by law.
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="declaration"
                      className="h-5 w-5 mt-1"
                      checked={declarationAccepted}
                      onChange={(e) =>
                        setDeclarationAccepted(e.target.checked)
                      }
                    />
                    <label htmlFor="declaration" className="font-bold">
                      I confirm that I have read and agree to the above
                      declaration.
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button"
                    className="govuk-button govuk-button--secondary"
                    onClick={handlePrevSection}
                  >
                    Previous
                  </button>
                  <button type="button"
                    className="govuk-button"
                    disabled={!declarationAccepted}
                    onClick={() => {
                      setCompletedSteps((p) => [...p, "declaration"]);
                      setCurrentStep("review");
                      window.scrollTo(0, 0);
                    }}
                  >
                    Continue to review
                  </button>
                </div>
              </div>
            )}

            {/* Review & Submit */}
            {currentStep === "review" && (
              <div>
                <div className="bg-white border border-govuk-mid-grey p-6 mb-6">
                  <h2>Review your application</h2>
                  <p className="text-govuk-dark-grey mb-6">
                    Please review the information below before submitting.
                  </p>

                  {/* Summary of answers by section */}
                  {formSchema.map((section) => {
                    const sectionAnswers = (answers[section.key] as Record<string, unknown>) ?? {};
                    return (
                      <div key={section.key} className="mb-6">
                        <h3 className="border-b border-govuk-mid-grey pb-2 mb-3">
                          {section.title}
                        </h3>
                        <dl className="govuk-summary-list">
                          {section.fields.map((field) => {
                            const val = sectionAnswers[field.key];
                            if (val === undefined || val === null || val === "")
                              return null;
                            return (
                              <div
                                key={field.key}
                                className="govuk-summary-list__row"
                              >
                                <dt className="govuk-summary-list__key">
                                  {field.label}
                                </dt>
                                <dd className="govuk-summary-list__value">
                                  {formatAnswerValue(val, field.key)}
                                </dd>
                                <dd className="govuk-summary-list__actions">
                                  <button type="button"
                                    className="text-govuk-blue text-sm underline"
                                    onClick={() => {
                                      const idx = formSchema.indexOf(section);
                                      setCurrentSectionIndex(idx);
                                      setCurrentStep("form");
                                    }}
                                  >
                                    Change
                                  </button>
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    );
                  })}

                  {/* Documents summary */}
                  <h3 className="border-b border-govuk-mid-grey pb-2 mb-3">
                    Documents
                  </h3>
                  <ul className="space-y-2 mb-6">
                    {uploadedDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-govuk-green">✓</span>
                        {doc.originalFilename}
                      </li>
                    ))}
                  </ul>

                  {showPaymentStep && (
                    <>
                      <h3 className="border-b border-govuk-mid-grey pb-2 mb-3">
                        Payment
                      </h3>
                      <p className="mb-6">Fee: £{feeAmount.toFixed(2)}</p>
                    </>
                  )}
                </div>

                <div className="govuk-warning-text mb-6">
                  <strong>
                    Once submitted, you will not be able to change your answers.
                  </strong>
                  <p className="mt-1">
                    You can still upload additional documents after submission if
                    requested.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button"
                    className="govuk-button govuk-button--secondary"
                    onClick={handlePrevSection}
                  >
                    Previous
                  </button>
                  <button type="button"
                    className="govuk-button"
                    disabled={submitting || !declarationAccepted}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Submitting..." : "Submit application"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
