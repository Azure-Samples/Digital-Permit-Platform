import Link from "next/link";
import { redirect } from "next/navigation";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { createLicenceModule } from "@/lib/modules/registry";
import { requireRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function normaliseModuleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function createModuleAction(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/modules/new");

  const moduleKey = normaliseModuleKey(String(formData.get("moduleKey") || ""));
  const displayName = String(formData.get("displayName") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const publicDescription = String(
    formData.get("publicDescription") || "",
  ).trim();

  if (!/^[a-z][a-z0-9_]{2,63}$/.test(moduleKey)) {
    redirect("/admin/modules/new?error=invalid-key");
  }
  if (displayName.length < 3 || displayName.length > 120) {
    redirect("/admin/modules/new?error=invalid-name");
  }
  if (category.length < 2 || category.length > 80) {
    redirect("/admin/modules/new?error=invalid-category");
  }

  let module: Awaited<ReturnType<typeof createLicenceModule>>;
  try {
    module = await createLicenceModule(
      { moduleKey, displayName, category, publicDescription },
      session.user.id,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "MODULE_KEY_EXISTS") {
      redirect("/admin/modules/new?error=duplicate-key");
    }
    throw error;
  }

  redirect(`/admin/modules/${module.moduleKey}`);
}

const errorMessages: Record<string, string> = {
  "invalid-key":
    "Module key must start with a letter and contain 3 to 64 lowercase letters, numbers, or underscores.",
  "invalid-name": "Display name must contain 3 to 120 characters.",
  "invalid-category": "Category must contain 2 to 80 characters.",
  "duplicate-key": "A module with that key already exists.",
};

export default async function NewModulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("ADMIN").catch(() => null);
  if (!session) redirect("/auth/login?callbackUrl=/admin/modules/new");
  const { error } = await searchParams;

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal – Admin"
        navigation={getNavigationForRole(session.user.role, "/admin")}
        userName={session.user.name}
        userRole={session.user.role}
      />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <nav className="govuk-breadcrumbs mb-6" aria-label="Breadcrumb">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/admin">Modules</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Create module</li>
            </ol>
          </nav>

          <h1>Create module</h1>
          <p className="text-govuk-dark-grey max-w-2xl">
            The module starts disabled, in draft, and not accepting applications.
            Configure and review its form, evidence, workflow, fees, and content
            before publishing and enabling it.
          </p>

          {error && errorMessages[error] && (
            <div className="govuk-warning-text" role="alert">
              <strong>There is a problem:</strong> {errorMessages[error]}
            </div>
          )}

          <form action={createModuleAction} className="max-w-2xl mt-6">
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="displayName">
                Display name
              </label>
              <p className="govuk-hint">For example, Market operator permit.</p>
              <input
                className="govuk-input"
                id="displayName"
                name="displayName"
                minLength={3}
                maxLength={120}
                required
              />
            </div>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="moduleKey">
                Module key
              </label>
              <p className="govuk-hint">
                Stable identifier using lowercase letters, numbers, and
                underscores. It cannot be changed after creation.
              </p>
              <input
                className="govuk-input font-mono"
                id="moduleKey"
                name="moduleKey"
                pattern="[A-Za-z][A-Za-z0-9 _]{2,63}"
                minLength={3}
                maxLength={64}
                required
              />
            </div>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="category">
                Category
              </label>
              <p className="govuk-hint">
                Use an existing category name where possible.
              </p>
              <input
                className="govuk-input"
                id="category"
                name="category"
                minLength={2}
                maxLength={80}
                required
              />
            </div>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="publicDescription">
                Initial public description
              </label>
              <p className="govuk-hint">
                Optional. You can refine this in the module builder.
              </p>
              <textarea
                className="govuk-textarea"
                id="publicDescription"
                name="publicDescription"
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="govuk-button">
                Create draft module
              </button>
              <Link
                href="/admin"
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