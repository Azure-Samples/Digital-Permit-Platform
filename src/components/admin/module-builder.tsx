"use client";

import { useState } from "react";
import type {
  FormSection,
  DocumentRequirement,
  WorkflowStage,
  ChecklistItem,
  FeeSchedule,
  FieldType,
} from "@/types/module";

interface ModuleBuilderProps {
  moduleKey: string;
  displayName: string;
  category: string;
  moduleId: string;
  version: {
    id: string;
    version: number;
    visibility: string;
    publicDescription: string | null;
    helpText: string | null;
    beforeYouStartText: string | null;
    applicationTypes: string[];
    paymentMode: string;
    feeSchedule: FeeSchedule | null;
    formSchema: FormSection[];
    documentRequirements: DocumentRequirement[];
    workflowDefinition: WorkflowStage[];
    reviewChecklist: ChecklistItem[];
    acceptingApplications: boolean;
    submissionMailbox: string | null;
  };
}

type ActiveTab =
  | "general"
  | "form"
  | "documents"
  | "workflow"
  | "checklist"
  | "fees"
  | "preview";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "date",
  "checkbox",
  "select",
  "radio",
  "postcode",
  "address",
  "number",
  "currency",
  "upload",
  "email",
  "phone",
  "repeatable",
];

export function ModuleBuilder({
  moduleKey,
  displayName,
  category,
  moduleId,
  version,
}: ModuleBuilderProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // State for all configurable aspects
  const [general, setGeneral] = useState({
    visibility: version.visibility,
    publicDescription: version.publicDescription ?? "",
    helpText: version.helpText ?? "",
    beforeYouStartText: version.beforeYouStartText ?? "",
    applicationTypes: version.applicationTypes,
    paymentMode: version.paymentMode,
    acceptingApplications: version.acceptingApplications,
    submissionMailbox: version.submissionMailbox ?? "",
  });

  const [formSchema, setFormSchema] = useState<FormSection[]>(
    version.formSchema
  );
  const [docRequirements, setDocRequirements] = useState<DocumentRequirement[]>(
    version.documentRequirements
  );
  const [workflowDef, setWorkflowDef] = useState<WorkflowStage[]>(
    version.workflowDefinition
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    version.reviewChecklist
  );
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>(
    version.feeSchedule ?? {}
  );

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "form", label: "Form builder" },
    { key: "documents", label: "Documents" },
    { key: "workflow", label: "Workflow" },
    { key: "checklist", label: "Review checklist" },
    { key: "fees", label: "Fees" },
    { key: "preview", label: "Preview" },
  ];

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...general,
          formSchema,
          documentRequirements: docRequirements,
          workflowDefinition: workflowDef,
          reviewChecklist: checklist,
          feeSchedule,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save");
      }
    } catch {
      alert("Failed to save module version");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="govuk-tag mb-2">{category}</span>
          <h1 className="mt-1">{displayName}</h1>
          <p className="text-govuk-dark-grey text-sm">
            Module: {moduleKey} · Version: v{version.version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-govuk-green font-bold text-sm">
              ✓ Saved as new version
            </span>
          )}
          <button type="button"
            className="govuk-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Publish new version"}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-govuk-mid-grey mb-6">
        <nav className="flex flex-wrap gap-0">
          {tabs.map((tab) => (
            <button type="button"
              key={tab.key}
              className={`px-4 py-3 text-sm font-bold border-b-4 transition-colors ${
                activeTab === tab.key
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-dark-grey hover:text-govuk-blue"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General settings */}
      {activeTab === "general" && (
        <div className="max-w-2xl space-y-6">
          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-visibility">Visibility</label>
            <select
              id="module-visibility"
              className="govuk-select"
              value={general.visibility}
              onChange={(e) =>
                setGeneral({ ...general, visibility: e.target.value })
              }
            >
              <option value="PUBLIC">Public</option>
              <option value="STAFF_ONLY">Staff only</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-public-description">Public description</label>
            <textarea
              id="module-public-description"
              className="govuk-textarea"
              value={general.publicDescription}
              onChange={(e) =>
                setGeneral({ ...general, publicDescription: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-help-text">Help text</label>
            <textarea
              id="module-help-text"
              className="govuk-textarea"
              value={general.helpText}
              onChange={(e) =>
                setGeneral({ ...general, helpText: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-before-you-start">
              &quot;Before you start&quot; guidance
            </label>
            <textarea
              id="module-before-you-start"
              className="govuk-textarea"
              value={general.beforeYouStartText}
              onChange={(e) =>
                setGeneral({ ...general, beforeYouStartText: e.target.value })
              }
              rows={5}
            />
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-payment-mode">Payment mode</label>
            <select
              id="module-payment-mode"
              className="govuk-select"
              value={general.paymentMode}
              onChange={(e) =>
                setGeneral({ ...general, paymentMode: e.target.value })
              }
            >
              <option value="NO_FEE">No fee</option>
              <option value="EXTERNAL_REDIRECT">External redirect</option>
              <option value="MANUAL_REFERENCE">Manual reference</option>
              <option value="RECEIPT_UPLOAD">Receipt upload</option>
              <option value="API_INTEGRATION">API integration</option>
            </select>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label" htmlFor="module-submission-mailbox">Submission mailbox</label>
            <input
              id="module-submission-mailbox"
              type="email"
              className="govuk-input"
              value={general.submissionMailbox}
              onChange={(e) =>
                setGeneral({ ...general, submissionMailbox: e.target.value })
              }
            />
          </div>

          <div className="govuk-form-group">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="accepting"
                className="h-5 w-5"
                checked={general.acceptingApplications}
                onChange={(e) =>
                  setGeneral({
                    ...general,
                    acceptingApplications: e.target.checked,
                  })
                }
              />
              <label htmlFor="accepting" className="font-bold">
                Accepting applications
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Form builder */}
      {activeTab === "form" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Form sections</h2>
            <button type="button"
              className="govuk-button govuk-button--secondary text-sm"
              onClick={() =>
                setFormSchema([
                  ...formSchema,
                  {
                    key: `section_${formSchema.length + 1}`,
                    title: `New section ${formSchema.length + 1}`,
                    fields: [],
                  },
                ])
              }
            >
              Add section
            </button>
          </div>

          <div className="space-y-6">
            {formSchema.map((section, sIdx) => (
              <div
                key={sIdx}
                className="bg-white border border-govuk-mid-grey p-4"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <div className="govuk-form-group mb-2">
                      <label className="govuk-label text-sm" htmlFor={`section-${sIdx}-key`}>
                        Section key
                      </label>
                      <input
                        id={`section-${sIdx}-key`}
                        type="text"
                        className="govuk-input text-sm"
                        value={section.key}
                        onChange={(e) => {
                          const updated = [...formSchema];
                          updated[sIdx] = { ...section, key: e.target.value };
                          setFormSchema(updated);
                        }}
                      />
                    </div>
                    <div className="govuk-form-group mb-2">
                      <label className="govuk-label text-sm" htmlFor={`section-${sIdx}-title`}>
                        Section title
                      </label>
                      <input
                        id={`section-${sIdx}-title`}
                        type="text"
                        className="govuk-input"
                        value={section.title}
                        onChange={(e) => {
                          const updated = [...formSchema];
                          updated[sIdx] = {
                            ...section,
                            title: e.target.value,
                          };
                          setFormSchema(updated);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {sIdx > 0 && (
                      <button type="button"
                        className="text-sm text-govuk-blue underline"
                        onClick={() => {
                          const updated = [...formSchema];
                          [updated[sIdx - 1], updated[sIdx]] = [
                            updated[sIdx],
                            updated[sIdx - 1],
                          ];
                          setFormSchema(updated);
                        }}
                      >
                        ↑
                      </button>
                    )}
                    {sIdx < formSchema.length - 1 && (
                      <button type="button"
                        className="text-sm text-govuk-blue underline"
                        onClick={() => {
                          const updated = [...formSchema];
                          [updated[sIdx], updated[sIdx + 1]] = [
                            updated[sIdx + 1],
                            updated[sIdx],
                          ];
                          setFormSchema(updated);
                        }}
                      >
                        ↓
                      </button>
                    )}
                    <button type="button"
                      className="text-sm text-govuk-red underline"
                      onClick={() =>
                        setFormSchema(formSchema.filter((_, i) => i !== sIdx))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-3 ml-4">
                  {section.fields.map((field, fIdx) => (
                    <div
                      key={fIdx}
                      className="border border-govuk-mid-grey p-3 bg-govuk-light-grey"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold" htmlFor={`section-${sIdx}-field-${fIdx}-key`}>Key</label>
                          <input
                            id={`section-${sIdx}-field-${fIdx}-key`}
                            type="text"
                            className="govuk-input text-sm"
                            value={field.key}
                            onChange={(e) => {
                              const updated = [...formSchema];
                              updated[sIdx].fields[fIdx] = {
                                ...field,
                                key: e.target.value,
                              };
                              setFormSchema(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold" htmlFor={`section-${sIdx}-field-${fIdx}-label`}>Label</label>
                          <input
                            id={`section-${sIdx}-field-${fIdx}-label`}
                            type="text"
                            className="govuk-input text-sm"
                            value={field.label}
                            onChange={(e) => {
                              const updated = [...formSchema];
                              updated[sIdx].fields[fIdx] = {
                                ...field,
                                label: e.target.value,
                              };
                              setFormSchema(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold" htmlFor={`section-${sIdx}-field-${fIdx}-type`}>Type</label>
                          <select
                            id={`section-${sIdx}-field-${fIdx}-type`}
                            className="govuk-select text-sm"
                            value={field.type}
                            onChange={(e) => {
                              const updated = [...formSchema];
                              updated[sIdx].fields[fIdx] = {
                                ...field,
                                type: e.target.value as FieldType,
                              };
                              setFormSchema(updated);
                            }}
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field.required ?? false}
                            onChange={(e) => {
                              const updated = [...formSchema];
                              updated[sIdx].fields[fIdx] = {
                                ...field,
                                required: e.target.checked,
                              };
                              setFormSchema(updated);
                            }}
                          />
                          Required
                        </label>
                        <input
                          type="text"
                          className="govuk-input text-sm flex-1"
                          placeholder="Hint text"
                          value={field.hint ?? ""}
                          onChange={(e) => {
                            const updated = [...formSchema];
                            updated[sIdx].fields[fIdx] = {
                              ...field,
                              hint: e.target.value,
                            };
                            setFormSchema(updated);
                          }}
                        />
                        <button type="button"
                          className="text-govuk-red text-sm underline"
                          onClick={() => {
                            const updated = [...formSchema];
                            updated[sIdx].fields = section.fields.filter(
                              (_, i) => i !== fIdx
                            );
                            setFormSchema(updated);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <button type="button"
                    className="govuk-button govuk-button--secondary text-xs"
                    onClick={() => {
                      const updated = [...formSchema];
                      updated[sIdx].fields = [
                        ...section.fields,
                        {
                          key: `field_${section.fields.length + 1}`,
                          label: "New field",
                          type: "text" as FieldType,
                          required: false,
                        },
                      ];
                      setFormSchema(updated);
                    }}
                  >
                    + Add field
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document requirements */}
      {activeTab === "documents" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Document requirements</h2>
            <button type="button"
              className="govuk-button govuk-button--secondary text-sm"
              onClick={() =>
                setDocRequirements([
                  ...docRequirements,
                  {
                    key: `doc_${docRequirements.length + 1}`,
                    label: "New document",
                    required: true,
                    verificationStatus: "needs_council_confirmation",
                  },
                ])
              }
            >
              Add requirement
            </button>
          </div>

          <div className="space-y-4">
            {docRequirements.map((doc, idx) => (
              <div
                key={idx}
                className="bg-white border border-govuk-mid-grey p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold" htmlFor={`document-${idx}-key`}>Key</label>
                    <input
                      id={`document-${idx}-key`}
                      type="text"
                      className="govuk-input text-sm"
                      value={doc.key}
                      onChange={(e) => {
                        const updated = [...docRequirements];
                        updated[idx] = { ...doc, key: e.target.value };
                        setDocRequirements(updated);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold" htmlFor={`document-${idx}-label`}>Label</label>
                    <input
                      id={`document-${idx}-label`}
                      type="text"
                      className="govuk-input text-sm"
                      value={doc.label}
                      onChange={(e) => {
                        const updated = [...docRequirements];
                        updated[idx] = { ...doc, label: e.target.value };
                        setDocRequirements(updated);
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-xs font-bold" htmlFor={`document-${idx}-description`}>Description</label>
                  <input
                    id={`document-${idx}-description`}
                    type="text"
                    className="govuk-input text-sm"
                    value={doc.description ?? ""}
                    onChange={(e) => {
                      const updated = [...docRequirements];
                      updated[idx] = { ...doc, description: e.target.value };
                      setDocRequirements(updated);
                    }}
                  />
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={doc.required}
                      onChange={(e) => {
                        const updated = [...docRequirements];
                        updated[idx] = { ...doc, required: e.target.checked };
                        setDocRequirements(updated);
                      }}
                    />
                    Required
                  </label>
                  <select
                    className="govuk-select text-sm"
                    value={doc.verificationStatus}
                    onChange={(e) => {
                      const updated = [...docRequirements];
                      updated[idx] = {
                        ...doc,
                        verificationStatus: e.target.value as any,
                      };
                      setDocRequirements(updated);
                    }}
                  >
                    <option value="verified_public_page">
                      Verified – public page
                    </option>
                    <option value="verified_form_pack">
                      Verified – form pack
                    </option>
                    <option value="verified_policy">Verified – policy</option>
                    <option value="needs_council_confirmation">
                      Needs council confirmation
                    </option>
                  </select>
                  <button type="button"
                    className="text-govuk-red text-sm underline ml-auto"
                    onClick={() =>
                      setDocRequirements(
                        docRequirements.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow */}
      {activeTab === "workflow" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Workflow stages</h2>
            <button type="button"
              className="govuk-button govuk-button--secondary text-sm"
              onClick={() =>
                setWorkflowDef([
                  ...workflowDef,
                  {
                    key: `stage_${workflowDef.length + 1}`,
                    label: "New stage",
                    order: workflowDef.length + 1,
                    type: "review",
                  },
                ])
              }
            >
              Add stage
            </button>
          </div>

          <div className="space-y-3">
            {workflowDef.map((stage, idx) => (
              <div
                key={idx}
                className="bg-white border border-govuk-mid-grey p-4 flex flex-wrap gap-3 items-end"
              >
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-bold" htmlFor={`workflow-${idx}-key`}>Key</label>
                  <input
                    id={`workflow-${idx}-key`}
                    type="text"
                    className="govuk-input text-sm"
                    value={stage.key}
                    onChange={(e) => {
                      const updated = [...workflowDef];
                      updated[idx] = { ...stage, key: e.target.value };
                      setWorkflowDef(updated);
                    }}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold" htmlFor={`workflow-${idx}-label`}>Label</label>
                  <input
                    id={`workflow-${idx}-label`}
                    type="text"
                    className="govuk-input text-sm"
                    value={stage.label}
                    onChange={(e) => {
                      const updated = [...workflowDef];
                      updated[idx] = { ...stage, label: e.target.value };
                      setWorkflowDef(updated);
                    }}
                  />
                </div>
                <div className="w-[140px]">
                  <label className="text-xs font-bold" htmlFor={`workflow-${idx}-type`}>Type</label>
                  <select
                    id={`workflow-${idx}-type`}
                    className="govuk-select text-sm"
                    value={stage.type}
                    onChange={(e) => {
                      const updated = [...workflowDef];
                      updated[idx] = { ...stage, type: e.target.value as any };
                      setWorkflowDef(updated);
                    }}
                  >
                    <option value="validation">Validation</option>
                    <option value="review">Review</option>
                    <option value="inspection">Inspection</option>
                    <option value="consultation">Consultation</option>
                    <option value="hearing">Hearing</option>
                    <option value="training">Training</option>
                    <option value="decision">Decision</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="w-[100px]">
                  <label className="text-xs font-bold" htmlFor={`workflow-${idx}-sla`}>SLA (days)</label>
                  <input
                    id={`workflow-${idx}-sla`}
                    type="number"
                    className="govuk-input text-sm"
                    value={stage.slaBusinessDays ?? ""}
                    onChange={(e) => {
                      const updated = [...workflowDef];
                      updated[idx] = {
                        ...stage,
                        slaBusinessDays: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      };
                      setWorkflowDef(updated);
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {idx > 0 && (
                    <button type="button"
                      className="text-sm text-govuk-blue"
                      onClick={() => {
                        const updated = [...workflowDef];
                        [updated[idx - 1], updated[idx]] = [
                          updated[idx],
                          updated[idx - 1],
                        ];
                        setWorkflowDef(updated);
                      }}
                    >
                      ↑
                    </button>
                  )}
                  <button type="button"
                    className="text-sm text-govuk-red underline"
                    onClick={() =>
                      setWorkflowDef(workflowDef.filter((_, i) => i !== idx))
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review checklist */}
      {activeTab === "checklist" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2>Review checklist items</h2>
            <button type="button"
              className="govuk-button govuk-button--secondary text-sm"
              onClick={() =>
                setChecklist([
                  ...checklist,
                  {
                    key: `check_${checklist.length + 1}`,
                    label: "New checklist item",
                    required: true,
                  },
                ])
              }
            >
              Add item
            </button>
          </div>

          <div className="space-y-3">
            {checklist.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-govuk-mid-grey p-3 flex flex-wrap gap-3 items-end"
              >
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs font-bold" htmlFor={`checklist-${idx}-key`}>Key</label>
                  <input
                    id={`checklist-${idx}-key`}
                    type="text"
                    className="govuk-input text-sm"
                    value={item.key}
                    onChange={(e) => {
                      const updated = [...checklist];
                      updated[idx] = { ...item, key: e.target.value };
                      setChecklist(updated);
                    }}
                  />
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <label className="text-xs font-bold" htmlFor={`checklist-${idx}-label`}>Label</label>
                  <input
                    id={`checklist-${idx}-label`}
                    type="text"
                    className="govuk-input text-sm"
                    value={item.label}
                    onChange={(e) => {
                      const updated = [...checklist];
                      updated[idx] = { ...item, label: e.target.value };
                      setChecklist(updated);
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => {
                      const updated = [...checklist];
                      updated[idx] = { ...item, required: e.target.checked };
                      setChecklist(updated);
                    }}
                  />
                  Required
                </label>
                <button type="button"
                  className="text-sm text-govuk-red underline"
                  onClick={() =>
                    setChecklist(checklist.filter((_, i) => i !== idx))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fees */}
      {activeTab === "fees" && (
        <div className="max-w-lg">
          <h2>Fee schedule</h2>
          <p className="govuk-hint mb-4">
            Set fees by application type. Leave empty for no fee.
          </p>
          {(general.applicationTypes.length > 0
            ? general.applicationTypes
            : ["new"]
          ).map((type) => (
            <div key={type} className="govuk-form-group">
              <label className="govuk-label" htmlFor={`fee-${type}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)} fee (£)
              </label>
              <input
                id={`fee-${type}`}
                type="number"
                className="govuk-input max-w-[200px]"
                step="0.01"
                value={
                  typeof feeSchedule[type] === "number"
                    ? (feeSchedule[type] as number)
                    : ""
                }
                onChange={(e) =>
                  setFeeSchedule({
                    ...feeSchedule,
                    [type]: e.target.value ? Number(e.target.value) : 0,
                  })
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {activeTab === "preview" && (
        <div className="max-w-2xl">
          <h2>Module preview</h2>
          <div className="bg-white border border-govuk-mid-grey p-6">
            <pre className="text-xs overflow-auto max-h-[600px]">
              {JSON.stringify(
                {
                  moduleKey,
                  displayName,
                  category,
                  general,
                  formSchema,
                  documentRequirements: docRequirements,
                  workflowDefinition: workflowDef,
                  reviewChecklist: checklist,
                  feeSchedule,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
