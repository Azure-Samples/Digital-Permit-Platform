"use client";

import { Suspense, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GovHeader } from "@/components/ui/header";
import { GovFooter } from "@/components/ui/footer";
import {
  EXTERNAL_ID_PROVIDER_ID,
  WORKFORCE_PROVIDER_ID,
} from "@/lib/auth/claims";
import { safeRelativeCallbackUrl } from "@/lib/auth/redirect";

function LoginForm() {
  const searchParams = useSearchParams();
  const requestedCallback = searchParams.get("callbackUrl");
  const callbackUrl = safeRelativeCallbackUrl(requestedCallback, "/dashboard");
  const staffCallbackUrl = safeRelativeCallbackUrl(requestedCallback, "/staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[] | null>(null);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const applicantSignInEnabled = providers?.includes(EXTERNAL_ID_PROVIDER_ID);
  const workforceSignInEnabled = providers?.includes(WORKFORCE_PROVIDER_ID);
  const demoCredentialsEnabled = providers?.includes("credentials");

  useEffect(() => {
    let active = true;
    getProviders()
      .then((configuredProviders) => {
        if (active) setProviders(Object.keys(configuredProviders ?? {}));
      })
      .catch(() => {
        if (active) {
          setProviders([]);
          setError("Sign-in options could not be loaded. Try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function handleProviderSignIn(provider: string, destination: string) {
    setError("");
    setLoadingProvider(provider);
    void signIn(provider, { callbackUrl: destination });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      // Use window.location for full reload so session is picked up everywhere
      window.location.href = callbackUrl;
    }
  }

  return (
    <>
      <GovHeader serviceName="Licensing Portal" />

      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <nav className="govuk-breadcrumbs mb-4">
            <ol className="govuk-breadcrumbs__list">
              <li className="govuk-breadcrumbs__list-item">
                <Link href="/">Home</Link>
              </li>
              <li className="govuk-breadcrumbs__list-item">Sign in</li>
            </ol>
          </nav>

          <h1>Sign in to your account</h1>

          {searchParams.get("registered") === "true" && (
            <div className="govuk-inset-text" role="status">
              Your demo account has been created. You can now sign in.
            </div>
          )}

          {error && (
            <div className="govuk-warning-text" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

          {providers === null && <p>Loading sign-in options...</p>}

          {applicantSignInEnabled && (
            <div className="mb-6">
              <h2 className="text-govuk-l mb-2">Residents and businesses</h2>
              <p className="text-govuk-dark-grey mb-3">
                Sign in or create a citizen account using any email address. You
                do not need a council email address or staff account.
              </p>
              <button
                type="button"
                className="govuk-button block"
                disabled={loadingProvider !== null}
                onClick={() =>
                  handleProviderSignIn(EXTERNAL_ID_PROVIDER_ID, callbackUrl)
                }
              >
                {loadingProvider === EXTERNAL_ID_PROVIDER_ID
                  ? "Redirecting..."
                  : "Citizen sign in or create an account"}
              </button>
            </div>
          )}

          {workforceSignInEnabled && (
            <div className="mb-6">
              <h2 className="text-govuk-l mb-2">Council staff</h2>
              <button
                type="button"
                className="govuk-button govuk-button--secondary block"
                disabled={loadingProvider !== null}
                onClick={() =>
                  handleProviderSignIn(WORKFORCE_PROVIDER_ID, staffCallbackUrl)
                }
              >
                {loadingProvider === WORKFORCE_PROVIDER_ID
                  ? "Redirecting..."
                  : "Sign in with a council staff account"}
              </button>
            </div>
          )}

          {demoCredentialsEnabled && (
            <form onSubmit={handleSubmit} className="max-w-md mt-8">
              {(applicantSignInEnabled || workforceSignInEnabled) && (
                <h2 className="text-govuk-l">Demo sign-in</h2>
              )}
              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="email">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  className="govuk-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="password">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="govuk-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                className="govuk-button"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}

          {demoCredentialsEnabled && (
            <p className="mt-6">
              Testing the pilot without a seeded account?{" "}
              <Link href="/auth/register">Create an account</Link>
            </p>
          )}

          {providers?.length === 0 && !error && (
            <div className="govuk-warning-text" role="alert">
              <strong>Sign-in has not been configured.</strong>
            </div>
          )}

          {demoMode && demoCredentialsEnabled && (
            <div className="govuk-inset-text mt-8">
              <h3 className="text-govuk-m">Demo accounts</h3>
              <p className="text-sm text-govuk-dark-grey mb-2">
                These synthetic users share the password configured in
                DEMO_PASSWORD:
              </p>
              <ul className="text-sm space-y-1">
                <li>
                  <strong>Applicant:</strong> applicant@example.com
                </li>
                <li>
                  <strong>Reviewer:</strong> reviewer@example.com
                </li>
                <li>
                  <strong>Manager:</strong> manager@example.com
                </li>
                <li>
                  <strong>Admin:</strong> admin@example.com
                </li>
              </ul>
            </div>
          )}
        </div>
      </main>

      <GovFooter />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="govuk-main-wrapper govuk-container">Loading...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
