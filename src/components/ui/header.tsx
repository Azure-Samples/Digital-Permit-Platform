import Link from "next/link";
import {
  Car,
  Wine,
  PawPrint,
  Store,
  Dice5,
  ClipboardList,
  Accessibility,
  User,
  LogIn,
  LogOut,
} from "lucide-react";
import type { SystemRole } from "@prisma/client";
import { CouncilLogo, CouncilServiceName } from "./council-brand";

// ─── Category icons (used on homepage) ────────────────────────
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Taxis and private hire": <Car className="h-8 w-8 text-govuk-blue" />,
  "Alcohol and entertainment": <Wine className="h-8 w-8 text-govuk-blue" />,
  Animals: <PawPrint className="h-8 w-8 text-govuk-blue" />,
  "Street licences and permits": <Store className="h-8 w-8 text-govuk-blue" />,
  Gambling: <Dice5 className="h-8 w-8 text-govuk-blue" />,
  "Parking and mobility permits": <Accessibility className="h-8 w-8 text-govuk-blue" />,
  Other: <ClipboardList className="h-8 w-8 text-govuk-blue" />,
};

// ─── Role-aware navigation builder ───────────────────────────
export function getNavigationForRole(
  role?: SystemRole | string | null,
  activePath?: string
) {
  const nav: Array<{ label: string; href: string; active?: boolean }> = [];

  if (!role || role === "APPLICANT") {
    nav.push(
      { label: "Home", href: "/" },
      { label: "All licences", href: "/licences" },
      { label: "My applications", href: "/dashboard" },
      { label: "Get help", href: "/help" },
      { label: "Take a tour", href: "/?tour=1" },
    );
  }

  if (role === "REVIEWER") {
    nav.push(
      { label: "Dashboard", href: "/staff" },
      { label: "Work queue", href: "/staff/queue" },
      { label: "Policy Copilot", href: "/staff/policy" },
      { label: "Modules", href: "/staff/modules" },
    );
  }

  if (role === "MANAGER") {
    nav.push(
      { label: "Dashboard", href: "/staff" },
      { label: "Work queue", href: "/staff/queue" },
      { label: "Policy Copilot", href: "/staff/policy" },
      { label: "Licensing policy", href: "/staff/policy/manage" },
      { label: "Modules", href: "/staff/modules" },
      { label: "Reports", href: "/staff/reports" },
    );
  }

  if (role === "ADMIN") {
    nav.push(
      { label: "Dashboard", href: "/staff" },
      { label: "Work queue", href: "/staff/queue" },
      { label: "Policy Copilot", href: "/staff/policy" },
      { label: "Licensing policy", href: "/staff/policy/manage" },
      { label: "Modules", href: "/admin" },
      { label: "Setup", href: "/setup" },
      { label: "Templates", href: "/admin/licence-management" },
      { label: "Users", href: "/admin/users" },
      { label: "API access", href: "/admin/api-access" },
      { label: "Audit log", href: "/admin/audit" },
      { label: "Reports", href: "/staff/reports" },
    );
  }

  // Mark active – only exact match, no prefix overlap
  if (activePath) {
    // Sort by href length descending so longer (more specific) paths match first
    let matched = false;
    const sorted = [...nav].sort((a, b) => b.href.length - a.href.length);
    for (const item of sorted) {
      if (!matched && (activePath === item.href || (item.href !== "/" && activePath.startsWith(`${item.href}/`)))) {
        // Find the item in the original nav array and mark it
        const orig = nav.find((n) => n.href === item.href);
        if (orig) orig.active = true;
        matched = true;
      }
    }
    // If nothing matched and we're on a sub-path, don't highlight anything extra
    if (!matched) {
      const exact = nav.find((n) => n.href === activePath);
      if (exact) exact.active = true;
    }
  }

  return nav;
}

// ─── Role display label ──────────────────────────────────────
function roleLabel(role?: string | null) {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "MANAGER":
      return "Manager";
    case "REVIEWER":
      return "Reviewer";
    default:
      return null;
  }
}

interface HeaderProps {
  serviceName?: string;
  navigation?: Array<{ label: string; href: string; active?: boolean }>;
  userName?: string | null;
  userRole?: string | null;
}

export function GovHeader({
  serviceName = "Licensing Portal",
  navigation = [],
  userName,
  userRole,
}: HeaderProps) {
  const label = roleLabel(userRole);

  return (
    <header>
      {/* Council top bar */}
      <div style={{ backgroundColor: "var(--brand-primary)" }}>
        <div className="govuk-container flex items-center justify-between py-3">
          <Link href="/" className="no-underline flex items-center">
            <CouncilLogo />
          </Link>

          {/* Auth state */}
          <div className="text-white text-sm flex items-center gap-4">
            {userName ? (
              <>
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {userName}
                  {label && (
                    <span className="bg-white/15 text-white text-xs px-1.5 py-0.5 rounded ml-1 font-bold">
                      {label}
                    </span>
                  )}
                </span>
                <Link
                  href="/api/auth/signout"
                  className="text-white/80 hover:text-white no-underline flex items-center gap-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Link>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="text-white/80 hover:text-white no-underline flex items-center gap-1"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Service name bar with blue accent border */}
      <div
        className="border-b-4"
        style={{
          backgroundColor: "var(--brand-primary)",
          borderColor: "var(--brand-accent)",
        }}
      >
        <div className="govuk-container py-2">
          <Link
            href="/"
            className="text-white font-bold text-xl no-underline hover:underline"
          >
            <CouncilServiceName requestedName={serviceName} />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      {navigation.length > 0 && (
        <nav
          className="border-b border-white/20"
          style={{ backgroundColor: "var(--brand-primary)" }}
          aria-label="Service navigation"
        >
          <div className="govuk-container">
            <ul className="flex flex-wrap gap-0 list-none m-0 p-0">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-block px-4 py-3 text-sm no-underline transition-colors ${
                      item.active
                        ? "text-white bg-white/15 font-bold"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
  );
}
