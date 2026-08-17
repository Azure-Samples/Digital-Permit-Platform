"use client";

import { useState, useEffect } from "react";
import type { FormField, FormSection } from "@/types/module";
import { evaluateCondition } from "@/lib/conditions";

/** Convert YYYY-MM-DD to DD/MM/YYYY for display, pass through otherwise */
function formatDateForDisplay(val: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  return val;
}

interface DynamicFormProps {
  sections: FormSection[];
  currentSectionIndex: number;
  answers: Record<string, unknown>;
  onSave: (
    sectionKey: string,
    answers: Record<string, unknown>,
  ) => Promise<boolean>;
  onNext: () => void;
  onPrevious: () => void;
  isFirstSection: boolean;
  isLastSection: boolean;
  saving?: boolean;
  saveError?: string | null;
  saveMessage?: string | null;
}

export function DynamicForm({
  sections,
  currentSectionIndex,
  answers,
  onSave,
  onNext,
  onPrevious,
  isFirstSection,
  isLastSection,
  saving = false,
  saveError,
  saveMessage,
}: DynamicFormProps) {
  const section = sections[currentSectionIndex];

  const sectionAnswers =
    section ? ((answers[section.key] as Record<string, unknown>) ?? {}) : {};
  const [localAnswers, setLocalAnswers] =
    useState<Record<string, unknown>>(sectionAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset local answers when the section changes or when returning to a section
  useEffect(() => {
    if (section) {
      const saved = (answers[section.key] as Record<string, unknown>) ?? {};
      setLocalAnswers(saved);
      setErrors({});
    }
  }, [answers, section]);

  if (!section) return null;

  const flatAnswers = Object.values(answers).reduce<Record<string, unknown>>(
    (acc, val) => ({ ...acc, ...(val as Record<string, unknown>) }),
    {}
  );
  const allAnswers = { ...flatAnswers, ...localAnswers };

  function isFieldVisible(field: FormField): boolean {
    if (!field.conditionalOn) return true;
    return evaluateCondition(field.conditionalOn, allAnswers);
  }

  function validateSection(): boolean {
    const newErrors: Record<string, string> = {};
    for (const field of section.fields) {
      if (!isFieldVisible(field)) continue;
      if (field.required && !localAnswers[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
      if (field.validation) {
        const val = localAnswers[field.key];
        if (
          field.validation.minLength &&
          typeof val === "string" &&
          val.length < field.validation.minLength
        ) {
          newErrors[field.key] =
            `Must be at least ${field.validation.minLength} characters`;
        }
        if (
          field.validation.maxLength &&
          typeof val === "string" &&
          val.length > field.validation.maxLength
        ) {
          newErrors[field.key] =
            `Must be no more than ${field.validation.maxLength} characters`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validateSection()) {
      const saved = await onSave(section.key, localAnswers);
      if (saved) onNext();
    }
  }

  async function handleSaveDraft() {
    await onSave(section.key, localAnswers);
  }

  function handleFieldChange(key: string, value: unknown) {
    setLocalAnswers((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset className="govuk-fieldset">
        <legend className="govuk-fieldset__legend">{section.title}</legend>
        {section.description && (
          <p className="govuk-hint">{section.description}</p>
        )}

        {section.fields.map((field) => {
          if (!isFieldVisible(field)) return null;
          return (
            <FieldRenderer
              key={field.key}
              field={field}
              value={localAnswers[field.key]}
              error={errors[field.key]}
              onChange={(value) => handleFieldChange(field.key, value)}
              allAnswers={allAnswers}
            />
          );
        })}
      </fieldset>

      {saveError && (
        <div className="govuk-error-summary mt-6" role="alert">
          <h2 className="govuk-error-summary__title">Your progress was not saved</h2>
          <div className="govuk-error-summary__body">{saveError}</div>
        </div>
      )}

      {saveMessage && !saveError && (
        <div className="govuk-notification-banner mt-6" role="status">
          <div className="govuk-notification-banner__content">
            <p className="font-bold mb-0">{saveMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-8">
        {!isFirstSection && (
          <button
            type="button"
            className="govuk-button govuk-button--secondary"
            onClick={onPrevious}
          >
            Previous
          </button>
        )}
        <button type="submit" className="govuk-button" disabled={saving}>
          {isLastSection ? "Continue to documents" : "Save and continue"}
        </button>
        <button
          type="button"
          className="govuk-button govuk-button--secondary"
          onClick={handleSaveDraft}
          disabled={saving}
        >
          Save draft
        </button>
      </div>
    </form>
  );
}

// ─── Individual field renderer ────────────────────────────────
interface FieldRendererProps {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  allAnswers: Record<string, unknown>;
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
  allAnswers,
}: FieldRendererProps) {
  const groupClass = `govuk-form-group${error ? " govuk-form-group--error" : ""}`;
  const inputClass = `govuk-input${error ? " govuk-input--error" : ""}`;

  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "postcode":
        return (
          <input
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            id={field.key}
            name={field.key}
            className={inputClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            aria-describedby={
              [field.hint ? `${field.key}-hint` : "", error ? `${field.key}-error` : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
        );

      case "textarea":
        return (
          <textarea
            id={field.key}
            name={field.key}
            className={`govuk-textarea${error ? " govuk-input--error" : ""}`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            aria-describedby={error ? `${field.key}-error` : undefined}
          />
        );

      case "number":
      case "currency":
        return (
          <div className={field.type === "currency" ? "flex items-center gap-2" : ""}>
            {field.type === "currency" && (
              <span className="text-lg font-bold">£</span>
            )}
            <input
              type="number"
              id={field.key}
              name={field.key}
              className={`${inputClass} max-w-[200px]`}
              value={(value as number) ?? ""}
              onChange={(e) =>
                onChange(e.target.value ? Number(e.target.value) : "")
              }
              step={field.type === "currency" ? "0.01" : "1"}
              min={field.validation?.min}
              max={field.validation?.max}
              aria-describedby={error ? `${field.key}-error` : undefined}
            />
          </div>
        );

      case "date":
        return (
          <div>
            <input
              type="text"
              id={field.key}
              name={field.key}
              className={`${inputClass} max-w-[250px]`}
              placeholder="DD/MM/YYYY"
              value={formatDateForDisplay((value as string) ?? "")}
              onChange={(e) => {
                const raw = e.target.value;
                // Store in YYYY-MM-DD when complete DD/MM/YYYY entered
                const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (match) {
                  onChange(`${match[3]}-${match[2]}-${match[1]}`);
                } else {
                  // Store raw while typing so user can see their input
                  onChange(raw);
                }
              }}
              aria-describedby={[field.hint ? `${field.key}-hint` : "", error ? `${field.key}-error` : ""].filter(Boolean).join(" ") || undefined}
            />
            <p className="text-xs text-govuk-dark-grey mt-1">For example, 15/03/1985</p>
          </div>
        );

      case "select":
        return (
          <select
            id={field.key}
            name={field.key}
            className="govuk-select"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={error ? `${field.key}-error` : undefined}
          >
            <option value="">Select an option</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "radio":
        return (
          <div className="space-y-2" role="radiogroup" aria-labelledby={`${field.key}-label`}>
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-3">
                <input
                  type="radio"
                  id={`${field.key}-${opt.value}`}
                  name={field.key}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  className="h-5 w-5"
                />
                <label htmlFor={`${field.key}-${opt.value}`} className="text-base">
                  {opt.label}
                </label>
              </div>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={field.key}
              name={field.key}
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="h-5 w-5"
            />
            <label htmlFor={field.key} className="text-base">
              {field.label}
            </label>
          </div>
        );

      case "address": {
        const addr = (value as Record<string, string>) ?? {};
        return (
          <div className="space-y-3">
            {["line1", "line2", "town", "county", "postcode"].map((part) => (
              <div key={part}>
                <label
                  htmlFor={`${field.key}-${part}`}
                  className="govuk-label text-sm"
                >
                  {part === "line1"
                    ? "Address line 1"
                    : part === "line2"
                    ? "Address line 2"
                    : part.charAt(0).toUpperCase() + part.slice(1)}
                </label>
                <input
                  type="text"
                  id={`${field.key}-${part}`}
                  className={`govuk-input ${part === "postcode" ? "max-w-[200px]" : ""}`}
                  value={addr[part] ?? ""}
                  onChange={(e) =>
                    onChange({ ...addr, [part]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        );
      }

      case "repeatable":
        return (
          <RepeatableSection
            field={field}
            value={(value as Record<string, unknown>[]) ?? []}
            onChange={onChange}
            allAnswers={allAnswers}
          />
        );

      case "upload":
        return (
          <div>
            <input
              type="file"
              id={field.key}
              name={field.key}
              className="govuk-input border-0 p-0"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(file.name);
              }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            {value != null && value !== "" && (
              <p className="text-sm text-govuk-dark-grey mt-1">
                Selected: {String(value)}
              </p>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            id={field.key}
            className={inputClass}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  // Checkbox has label inline, skip wrapping label
  if (field.type === "checkbox") {
    return (
      <div className={groupClass}>
        {error && (
          <p className="govuk-error-message" id={`${field.key}-error`}>
            <span className="sr-only">Error:</span> {error}
          </p>
        )}
        {renderInput()}
      </div>
    );
  }

  return (
    <div className={groupClass}>
      <label className="govuk-label" htmlFor={field.key} id={`${field.key}-label`}>
        {field.label}
        {field.required && <span className="text-govuk-red ml-1">*</span>}
      </label>
      {field.hint && (
        <p className="govuk-hint" id={`${field.key}-hint`}>
          {field.hint}
        </p>
      )}
      {error && (
        <p className="govuk-error-message" id={`${field.key}-error`}>
          <span className="sr-only">Error:</span> {error}
        </p>
      )}
      {renderInput()}
    </div>
  );
}

// ─── Repeatable section ───────────────────────────────────────
function RepeatableSection({
  field,
  value,
  onChange,
  allAnswers,
}: {
  field: FormField;
  value: Record<string, unknown>[];
  onChange: (value: unknown) => void;
  allAnswers: Record<string, unknown>;
}) {
  const items = value.length > 0 ? value : [{}];
  const maxRepeats = field.maxRepeats ?? 20;

  function addItem() {
    if (items.length < maxRepeats) {
      onChange([...items, {}]);
    }
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: string, val: unknown) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [key]: val } : item
    );
    onChange(updated);
  }

  return (
    <div className="space-y-6">
      {items.map((item, index) => (
        <div key={index} className="border border-govuk-mid-grey p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold">
              {field.label} {index + 1}
            </h4>
            {items.length > 1 && (
              <button
                type="button"
                className="text-govuk-red text-sm underline"
                onClick={() => removeItem(index)}
              >
                Remove
              </button>
            )}
          </div>
          {field.repeatableSchema?.map((subField) => (
            <FieldRenderer
              key={`${field.key}-${index}-${subField.key}`}
              field={{
                ...subField,
                key: `${field.key}-${index}-${subField.key}`,
              }}
              value={item[subField.key]}
              onChange={(val) => updateItem(index, subField.key, val)}
              allAnswers={allAnswers}
            />
          ))}
        </div>
      ))}
      {items.length < maxRepeats && (
        <button
          type="button"
          className="govuk-button govuk-button--secondary"
          onClick={addItem}
        >
          Add another {field.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
