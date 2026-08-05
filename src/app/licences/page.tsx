import Link from "next/link";
import { GovHeader, getNavigationForRole } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { getPublicModuleCatalogue } from "@/lib/modules/registry";
import { getSessionOrNull } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function LicenceCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const modules = await getPublicModuleCatalogue();

  // Group by category
  const grouped = modules.reduce<
    Record<string, typeof modules>
  >((acc, mod) => {
    const cat = mod.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mod);
    return acc;
  }, {});

  // Filter by category if specified
  const categoryFilter = resolvedSearchParams.category
    ?.replace(/-/g, " ")
    .toLowerCase();

  const filteredGroups = categoryFilter
    ? Object.entries(grouped).filter(
        ([cat]) => cat.toLowerCase() === categoryFilter
      )
    : Object.entries(grouped);

  // Search filter
  const searchFilter = resolvedSearchParams.search?.toLowerCase();
  const searchedGroups = searchFilter
    ? filteredGroups
        .map(([cat, mods]) => [
          cat,
          mods.filter(
            (m) =>
              m.displayName.toLowerCase().includes(searchFilter) ||
              m.publicDescription?.toLowerCase().includes(searchFilter)
          ),
        ] as [string, typeof modules])
        .filter(([, mods]) => mods.length > 0)
    : filteredGroups;

  const session = await getSessionOrNull();
  const user = session?.user;

  return (
    <>
      <GovHeader
        serviceName="Licensing Portal"
        navigation={getNavigationForRole(user?.role, "/licences")}
        userName={user?.name}
        userRole={user?.role}
      />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">
                All licences and permits
              </li>
            </ol>
          </nav>

          <h1>Licences and permits</h1>
          <p className="text-govuk-dark-grey mb-6 max-w-2xl">
            Browse our available licences and permits. Select a licence type to
            see requirements, fees, and start your application.
          </p>

          {/* Search */}
          <div className="mb-8">
            <form method="GET" action="/licences" className="flex gap-3">
              <input
                type="search"
                name="search"
                placeholder="Search licences..."
                defaultValue={resolvedSearchParams.search}
                className="govuk-input max-w-md"
              />
              <button type="submit" className="govuk-button">
                Search
              </button>
              {(resolvedSearchParams.search || resolvedSearchParams.category) && (
                <Link href="/licences" className="govuk-button govuk-button--secondary no-underline">
                  Clear filters
                </Link>
              )}
            </form>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {Object.keys(grouped).map((cat) => {
              const isActive = categoryFilter === cat.toLowerCase();
              const slug = cat.toLowerCase().replace(/\s+/g, "-");
              return (
                <Link
                  key={cat}
                  href={isActive ? "/licences" : `/licences?category=${slug}`}
                  className={`px-3 py-1 text-sm no-underline border ${
                    isActive
                      ? "bg-govuk-blue text-white border-govuk-blue"
                      : "bg-white text-govuk-blue border-govuk-mid-grey hover:border-govuk-blue"
                  }`}
                >
                  {cat}
                  <span className="ml-1 text-xs opacity-70">
                    ({grouped[cat].length})
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Module listing */}
          {searchedGroups.length === 0 ? (
            <div className="govuk-inset-text">
              <p>No licences found matching your search criteria.</p>
            </div>
          ) : (
            searchedGroups.map(([category, mods]) => (
              <section key={category} className="mb-10">
                <h2 className="border-b-2 border-govuk-blue pb-2 mb-4">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mods.map((mod) => (
                    <Link
                      key={mod.moduleKey}
                      href={`/licences/${mod.moduleKey}`}
                      className="module-card no-underline hover:border-govuk-blue transition-colors"
                    >
                      <h3 className="module-card__title">{mod.displayName}</h3>
                      <p className="module-card__description line-clamp-3">
                        {mod.publicDescription || "View details and apply."}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-govuk-blue text-sm">
                          View details →
                        </span>
                        {!mod.acceptingApplications && (
                          <span className="govuk-tag govuk-tag--grey text-xs">
                            Not accepting applications
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}
