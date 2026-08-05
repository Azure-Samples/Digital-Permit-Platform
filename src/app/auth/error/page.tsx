"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GovFooter } from "@/components/ui/footer";
import { GovHeader } from "@/components/ui/header";

const errorMessages: Record<string, string> = {
  AccessDenied: "Your account is not assigned access to this service.",
  Configuration: "Sign-in is not configured correctly.",
  OAuthAccountNotLinked:
    "This email address is already associated with another sign-in method.",
  OAuthCallback: "The identity provider could not complete sign-in.",
  OAuthProfile: "The identity provider did not return the required account details.",
};

function AuthenticationError() {
  const error = useSearchParams().get("error") ?? "Default";
  const message =
    errorMessages[error] ?? "We could not sign you in. No changes were made.";

  return (
    <>
      <GovHeader serviceName="Licensing Portal" />
      <main className="govuk-main-wrapper" id="main-content">
        <div className="govuk-container max-w-govuk-two-thirds">
          <h1>There is a problem signing you in</h1>
          <div className="govuk-warning-text" role="alert">
            <strong>{message}</strong>
          </div>
          <p>
            <Link href="/auth/login">Return to sign in</Link>
          </p>
        </div>
      </main>
      <GovFooter />
    </>
  );
}

export default function AuthenticationErrorPage() {
  return (
    <Suspense fallback={<div className="govuk-main-wrapper govuk-container">Loading...</div>}>
      <AuthenticationError />
    </Suspense>
  );
}