"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import { GovHeader } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import { EXTERNAL_ID_PROVIDER_ID } from "@/lib/auth/claims";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<string[] | null>(null);
  const applicantSignInEnabled = providers?.includes(EXTERNAL_ID_PROVIDER_ID);
  const demoRegistrationEnabled = providers?.includes("credentials");

  useEffect(() => {
    let active = true;
    getProviders()
      .then((configuredProviders) => {
        if (active) setProviders(Object.keys(configuredProviders ?? {}));
      })
      .catch(() => {
        if (active) {
          setProviders([]);
          setError("Account options could not be loaded. Try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      router.push("/auth/login?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <GovHeader serviceName="Licensing Portal" />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <h1>Create an account</h1>
          <p className="text-govuk-dark-grey mb-6">
            Create a free account to apply for licences and track your
            applications.
          </p>

          {error && (
            <div className="govuk-warning-text" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {providers === null && <p>Loading account options...</p>}

          {applicantSignInEnabled && (
            <button
              type="button"
              className="govuk-button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void signIn(EXTERNAL_ID_PROVIDER_ID, {
                  callbackUrl: "/dashboard",
                });
              }}
            >
              {loading ? "Redirecting..." : "Continue to create an account"}
            </button>
          )}

          {demoRegistrationEnabled && (
            <form onSubmit={handleSubmit} className="max-w-md mt-8">
              {applicantSignInEnabled && (
                <h2 className="text-govuk-l">Create a demo account</h2>
              )}
              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="firstName">
                  First name
                </label>
                <input
                  type="text"
                  id="firstName"
                  className="govuk-input"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="lastName">
                  Last name
                </label>
                <input
                  type="text"
                  id="lastName"
                  className="govuk-input"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="email">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  className="govuk-input"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="password">
                  Password
                </label>
                <p className="govuk-hint">Must be at least 8 characters</p>
                <input
                  type="password"
                  id="password"
                  className="govuk-input"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                  minLength={8}
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="govuk-input"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="govuk-button"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          {providers?.length === 0 && !error && (
            <div className="govuk-warning-text" role="alert">
              <strong>Account creation has not been configured.</strong>
            </div>
          )}

          <p className="mt-6">
            Already have an account? <Link href="/auth/login">Sign in</Link>
          </p>
        </div>
      </main>

      <GovFooter />
    </>
  );
}
