"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Braces,
  Check,
  Copy,
  Download,
  FileText,
  Files,
  ListChecks,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  MAX_LICENCE_TEMPLATE_FILE_SIZE_MB,
  SYSTEM_TEMPLATE_PLACEHOLDERS,
  type TemplatePlaceholder,
} from "@/lib/licence-template-fields";

interface LicenceModuleOption {
  id: string;
  moduleKey: string;
  displayName: string;
  category: string;
  enabled: boolean;
  applicationFields: TemplatePlaceholder[];
}

interface LicenceTemplateItem {
  id: string;
  name: string;
  description: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  placeholders: string[];
  createdAt: string;
  uploaderName: string | null;
  assignments: Array<{
    moduleId: string;
    moduleName: string;
  }>;
}

type ManagerView = "templates" | "coverage" | "guide";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LicencePicker({
  idPrefix,
  modules,
  selectedIds,
  onChange,
}: {
  idPrefix: string;
  modules: LicenceModuleOption[];
  selectedIds: Set<string>;
  onChange: (selectedIds: Set<string>) => void;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const filteredModules = modules.filter(
    (module) =>
      !deferredSearch ||
      module.displayName.toLowerCase().includes(deferredSearch) ||
      module.category.toLowerCase().includes(deferredSearch) ||
      module.moduleKey.toLowerCase().includes(deferredSearch),
  );
  const groupedModules = filteredModules.reduce<Record<string, LicenceModuleOption[]>>(
    (groups, module) => {
      const categoryModules = groups[module.category] ?? [];
      categoryModules.push(module);
      groups[module.category] = categoryModules;
      return groups;
    },
    {},
  );

  function toggle(moduleId: string) {
    const next = new Set(selectedIds);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    onChange(next);
  }

  function selectShown() {
    const next = new Set(selectedIds);
    for (const module of filteredModules) next.add(module.id);
    onChange(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="flex-1 min-w-[220px]">
          <label className="govuk-label text-sm font-bold" htmlFor={`${idPrefix}-search`}>
            Find licence types
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-govuk-dark-grey"
              aria-hidden="true"
            />
            <input
              id={`${idPrefix}-search`}
              className="govuk-input pl-10"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or category"
            />
          </div>
        </div>
        <div className="flex gap-3 pb-1 text-sm">
          <button type="button" className="underline font-bold" onClick={selectShown}>
            Select shown
          </button>
          <button type="button" className="underline" onClick={() => onChange(new Set())}>
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm font-bold mb-2" aria-live="polite">
        {selectedIds.size} of {modules.length} licence types selected
      </p>

      <div className="border border-govuk-mid-grey max-h-[360px] overflow-y-auto bg-white">
        {filteredModules.length === 0 ? (
          <p className="p-4 mb-0">No licence types match that search.</p>
        ) : (
          Object.entries(groupedModules)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([category, categoryModules]) => (
              <fieldset key={category} className="border-b border-govuk-mid-grey last:border-b-0 p-4">
                <legend className="font-bold px-1">{category}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-2">
                  {categoryModules.map((module) => (
                    <label key={module.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={selectedIds.has(module.id)}
                        onChange={() => toggle(module.id)}
                      />
                      <span>
                        <span className="block font-bold">{module.displayName}</span>
                        {!module.enabled && (
                          <span className="text-sm text-govuk-dark-grey">Disabled</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))
        )}
      </div>
    </div>
  );
}

export function LicenceTemplateManager({
  modules,
  templates,
}: {
  modules: LicenceModuleOption[];
  templates: LicenceTemplateItem[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ManagerView>("templates");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templateName, setTemplateName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingModuleIds, setEditingModuleIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [coverageSearch, setCoverageSearch] = useState("");
  const deferredCoverageSearch = useDeferredValue(coverageSearch.toLowerCase());
  const [guideModuleId, setGuideModuleId] = useState(modules[0]?.id ?? "");
  const [copiedField, setCopiedField] = useState("");

  const customCoveredModuleIds = new Set(
    templates.flatMap((template) =>
      template.assignments.map((assignment) => assignment.moduleId),
    ),
  );
  const coverageModules = modules.filter(
    (module) =>
      !deferredCoverageSearch ||
      module.displayName.toLowerCase().includes(deferredCoverageSearch) ||
      module.category.toLowerCase().includes(deferredCoverageSearch),
  );
  const guideModule = modules.find((module) => module.id === guideModuleId);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  async function uploadTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (selectedIds.size === 0) {
      setError("Select at least one licence type for this template.");
      return;
    }

    setUploading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    for (const moduleId of selectedIds) formData.append("moduleIds", moduleId);

    try {
      const response = await fetch("/api/admin/licence-templates", {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Template upload failed.");

      form.reset();
      setTemplateName("");
      setSelectedIds(new Set());
      setMessage("Template uploaded and assigned successfully.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Template upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  function startEditing(template: LicenceTemplateItem) {
    clearFeedback();
    setEditingTemplateId(template.id);
    setEditingModuleIds(
      new Set(template.assignments.map((assignment) => assignment.moduleId)),
    );
  }

  async function saveAssignments(templateId: string) {
    clearFeedback();
    if (editingModuleIds.size === 0) {
      setError("Select at least one licence type for this template.");
      return;
    }
    setBusyTemplateId(templateId);
    try {
      const response = await fetch(`/api/admin/licence-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleIds: [...editingModuleIds] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Assignments could not be saved.");
      setEditingTemplateId(null);
      setMessage("Template assignments updated.");
      router.refresh();
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Assignments could not be saved.",
      );
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function deleteTemplate(template: LicenceTemplateItem) {
    if (!window.confirm(`Delete "${template.name}"? Generated licence documents will not be affected.`)) {
      return;
    }
    clearFeedback();
    setBusyTemplateId(template.id);
    try {
      const response = await fetch(`/api/admin/licence-templates/${template.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Template could not be deleted.");
      setMessage("Template deleted.");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Template could not be deleted.",
      );
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function copyField(key: string) {
    await navigator.clipboard.writeText(`<${key}>`);
    setCopiedField(key);
  }

  const tabs: Array<{
    key: ManagerView;
    label: string;
    icon: typeof Files;
  }> = [
    { key: "templates", label: "Templates", icon: Files },
    { key: "coverage", label: "Licence coverage", icon: ListChecks },
    { key: "guide", label: "Field guide", icon: Braces },
  ];

  return (
    <section aria-labelledby="template-workspace-title" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-govuk-black pb-5">
        <div>
          <h2 id="template-workspace-title" className="mb-1">
            Document templates
          </h2>
          <p className="text-govuk-dark-grey mb-0">
            Every licence type includes the standard template. Upload tailored DOCX files where needed.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="block text-2xl font-bold">{modules.length}</span>
            licence types covered
          </div>
          <div>
            <span className="block text-2xl font-bold">{templates.length + 1}</span>
            templates available
          </div>
          <div>
            <span className="block text-2xl font-bold">{customCoveredModuleIds.size}</span>
            with tailored templates
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-3 border-b border-govuk-mid-grey"
        role="tablist"
        aria-label="Template management views"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`inline-flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 border-b-4 px-2 py-2 text-center text-sm font-bold sm:min-h-12 sm:flex-row sm:gap-2 sm:px-4 sm:py-3 sm:text-base ${
                active
                  ? "border-govuk-blue bg-govuk-light-grey"
                  : "border-transparent hover:border-govuk-mid-grey"
              }`}
              onClick={() => {
                setView(tab.key);
                clearFeedback();
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {(error || message) && (
        <div
          className={error ? "govuk-error-summary mt-6" : "govuk-notification-banner mt-6"}
          role={error ? "alert" : "status"}
        >
          <div className={error ? "govuk-error-summary__body" : "govuk-notification-banner__content"}>
            <p className="font-bold mb-0">{error || message}</p>
          </div>
        </div>
      )}

      {view === "templates" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-10 pt-8">
          <section aria-labelledby="upload-template-title">
            <h3 id="upload-template-title">Upload a template</h3>
            <p className="govuk-hint">
              One DOCX can be assigned to one, several, or all licence types.
            </p>
            <form onSubmit={uploadTemplate} encType="multipart/form-data">
              <div className="govuk-form-group">
                <label className="govuk-label font-bold" htmlFor="licence-template-file">
                  DOCX file
                </label>
                <p className="govuk-hint">
                  Microsoft Word DOCX, up to {MAX_LICENCE_TEMPLATE_FILE_SIZE_MB}MB.
                </p>
                <input
                  id="licence-template-file"
                  name="file"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required
                  onChange={(event) => {
                    const filename = event.target.files?.[0]?.name;
                    if (filename && !templateName) {
                      setTemplateName(filename.replace(/\.docx$/i, ""));
                    }
                  }}
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label font-bold" htmlFor="licence-template-name">
                  Template name
                </label>
                <input
                  id="licence-template-name"
                  name="name"
                  className="govuk-input"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label font-bold" htmlFor="licence-template-description">
                  Description (optional)
                </label>
                <textarea
                  id="licence-template-description"
                  name="description"
                  className="govuk-textarea"
                  rows={3}
                  maxLength={500}
                  placeholder="For example, premises licence with mandatory conditions"
                />
              </div>

              <div className="govuk-form-group">
                <span className="govuk-label font-bold">Assign to licence types</span>
                <LicencePicker
                  idPrefix="upload-licences"
                  modules={modules}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                />
              </div>

              <button
                type="submit"
                className="govuk-button inline-flex items-center gap-2"
                disabled={uploading}
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
                {uploading ? "Uploading..." : "Upload and assign"}
              </button>
            </form>
          </section>

          <section aria-labelledby="template-library-title">
            <h3 id="template-library-title">Template library</h3>
            <article className="border-t-4 border-govuk-blue py-5">
              <div className="flex items-start gap-3">
                <FileText className="h-6 w-6 shrink-0 text-govuk-blue" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h4 className="mb-1">Standard licence template</h4>
                  <p className="text-sm text-govuk-dark-grey mb-2">
                    Built in and available to all {modules.length} licence types.
                  </p>
                  <span className="govuk-tag">Default</span>
                </div>
                <a
                  href="/templates/standard-licence.docx"
                  download
                  className="p-2 text-govuk-blue"
                  aria-label="Download standard licence template"
                  title="Download standard template"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                </a>
              </div>
            </article>

            {templates.length === 0 ? (
              <p className="border-t border-govuk-mid-grey py-5">
                No tailored templates have been uploaded yet.
              </p>
            ) : (
              templates.map((template) => (
                <article key={template.id} className="border-t border-govuk-mid-grey py-5">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 shrink-0 text-govuk-dark-grey" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h4 className="mb-1 break-words">{template.name}</h4>
                      {template.description && <p className="text-sm mb-2">{template.description}</p>}
                      <p className="text-sm text-govuk-dark-grey mb-2 break-words">
                        {template.originalFilename} | {formatFileSize(template.fileSizeBytes)} | Uploaded {new Date(template.createdAt).toLocaleDateString("en-GB")}
                        {template.uploaderName ? ` by ${template.uploaderName}` : ""}
                      </p>
                      <p className="text-sm mb-2">
                        <strong>{template.assignments.length}</strong> licence type{template.assignments.length === 1 ? "" : "s"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {template.assignments.slice(0, 4).map((assignment) => (
                          <span key={assignment.moduleId} className="govuk-tag govuk-tag--grey">
                            {assignment.moduleName}
                          </span>
                        ))}
                        {template.assignments.length > 4 && (
                          <span className="text-sm self-center">
                            +{template.assignments.length - 4} more
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-govuk-dark-grey mt-3 mb-0">
                        {template.placeholders.length > 0
                          ? `${template.placeholders.length} angle-bracket fields found`
                          : "No angle-bracket fields detected"}
                      </p>
                      <button
                        type="button"
                        className="underline font-bold text-sm mt-3"
                        onClick={() => startEditing(template)}
                      >
                        Change licence types
                      </button>
                    </div>
                    <div className="flex shrink-0">
                      <a
                        href={`/api/admin/licence-templates/${template.id}/download`}
                        className="p-2 text-govuk-blue"
                        aria-label={`Download ${template.name}`}
                        title="Download template"
                      >
                        <Download className="h-5 w-5" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        className="p-2 text-govuk-red"
                        aria-label={`Delete ${template.name}`}
                        title="Delete template"
                        disabled={busyTemplateId === template.id}
                        onClick={() => deleteTemplate(template)}
                      >
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {editingTemplateId === template.id && (
                    <div className="mt-5 border-l-4 border-govuk-blue bg-govuk-light-grey p-4">
                      <h5 className="font-bold mb-3">Assign {template.name}</h5>
                      <LicencePicker
                        idPrefix={`edit-${template.id}`}
                        modules={modules}
                        selectedIds={editingModuleIds}
                        onChange={setEditingModuleIds}
                      />
                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          type="button"
                          className="govuk-button mb-0"
                          disabled={busyTemplateId === template.id}
                          onClick={() => saveAssignments(template.id)}
                        >
                          {busyTemplateId === template.id ? "Saving..." : "Save assignments"}
                        </button>
                        <button
                          type="button"
                          className="govuk-button govuk-button--secondary mb-0"
                          onClick={() => setEditingTemplateId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {view === "coverage" && (
        <section className="pt-8" aria-labelledby="coverage-title">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <div>
              <h3 id="coverage-title" className="mb-1">Licence coverage</h3>
              <p className="text-govuk-dark-grey mb-0">
                Every type can use the standard document and can have any number of tailored templates.
              </p>
            </div>
            <div className="min-w-[260px]">
              <label className="govuk-label text-sm font-bold" htmlFor="coverage-search">
                Find a licence type
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-govuk-dark-grey" aria-hidden="true" />
                <input
                  id="coverage-search"
                  type="search"
                  className="govuk-input pl-10"
                  value={coverageSearch}
                  onChange={(event) => setCoverageSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="govuk-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Licence type</th>
                  <th>Category</th>
                  <th>Available templates</th>
                </tr>
              </thead>
              <tbody>
                {coverageModules.map((module) => {
                  const assignedTemplates = templates.filter((template) =>
                    template.assignments.some(
                      (assignment) => assignment.moduleId === module.id,
                    ),
                  );
                  return (
                    <tr key={module.id}>
                      <td>
                        <strong>{module.displayName}</strong>
                        {!module.enabled && (
                          <span className="block text-sm text-govuk-dark-grey">Disabled</span>
                        )}
                      </td>
                      <td className="text-sm">{module.category}</td>
                      <td>
                        <span className="govuk-tag mr-2 mb-2">Standard</span>
                        {assignedTemplates.map((template) => (
                          <span key={template.id} className="govuk-tag govuk-tag--grey mr-2 mb-2">
                            {template.name}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === "guide" && (
        <section className="pt-8" aria-labelledby="field-guide-title">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] gap-10">
            <div>
              <h3 id="field-guide-title">Add fields in Microsoft Word</h3>
              <ol className="list-decimal ml-6 space-y-3">
                <li>Download the standard template or open your own DOCX file.</li>
                <li>
                  Type a field as ordinary text using angle brackets, for example{" "}
                  <code className="bg-govuk-light-grey px-1">{"<applicant_name>"}</code>.
                </li>
                <li>Keep the complete field name together and do not add spaces inside the brackets.</li>
                <li>Upload the DOCX and select every licence type that should use it.</li>
                <li>Generate a test document from an approved case before operational use.</li>
              </ol>
              <div className="border-l-4 border-govuk-blue bg-govuk-light-grey p-4 mt-6">
                <p className="font-bold mb-1">Use plain text, not Word mail merge</p>
                <p className="mb-0 text-sm">
                  The platform replaces these fields itself. A field with no saved answer is left blank.
                </p>
              </div>
              <a
                href="/templates/standard-licence.docx"
                download
                className="govuk-button govuk-button--secondary inline-flex items-center gap-2 mt-6 no-underline"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Download starter template
              </a>
            </div>

            <div>
              <h3>Fields available to every template</h3>
              <div className="overflow-x-auto">
                <table className="govuk-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Field to type</th>
                      <th>Value inserted</th>
                      <th><span className="sr-only">Copy</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                      <tr key={placeholder.key}>
                        <td>
                          <code className="bg-govuk-light-grey px-1">{`<${placeholder.key}>`}</code>
                        </td>
                        <td>
                          <strong className="block">{placeholder.label}</strong>
                          <span className="text-sm text-govuk-dark-grey">{placeholder.description}</span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="p-2 text-govuk-blue"
                            aria-label={`Copy <${placeholder.key}>`}
                            title="Copy field"
                            onClick={() => copyField(placeholder.key)}
                          >
                            {copiedField === placeholder.key ? (
                              <Check className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <Copy className="h-5 w-5" aria-hidden="true" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mt-8">Application fields for a licence type</h3>
              <div className="govuk-form-group max-w-xl">
                <label className="govuk-label font-bold" htmlFor="guide-licence-type">
                  Licence type
                </label>
                <select
                  id="guide-licence-type"
                  className="govuk-select w-full"
                  value={guideModuleId}
                  onChange={(event) => setGuideModuleId(event.target.value)}
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {guideModule?.applicationFields.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px border border-govuk-mid-grey bg-govuk-mid-grey">
                  {guideModule.applicationFields.map((placeholder) => (
                    <div key={placeholder.key} className="flex items-center justify-between gap-3 bg-white p-3">
                      <div className="min-w-0">
                        <code className="break-all">{`<${placeholder.key}>`}</code>
                        <span className="block text-sm text-govuk-dark-grey">{placeholder.label}</span>
                      </div>
                      <button
                        type="button"
                        className="p-2 shrink-0 text-govuk-blue"
                        aria-label={`Copy <${placeholder.key}>`}
                        title="Copy field"
                        onClick={() => copyField(placeholder.key)}
                      >
                        {copiedField === placeholder.key ? (
                          <Check className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Copy className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No application fields are configured for this licence type.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}