"use client";

import Link from "next/link";
import { useCouncilProfile } from "./council-profile-provider";

export function GovFooter() {
  const profile = useCouncilProfile();

  return (
    <footer className="bg-govuk-dark-grey mt-auto" role="contentinfo">
      <div className="govuk-container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-white text-govuk-m mb-3">Contact us</h3>
            <ul className="list-none p-0 space-y-1">
              <li>
                <Link
                  href={`mailto:${profile.supportEmail}`}
                  className="text-govuk-mid-grey hover:text-white no-underline"
                >
                  {profile.supportEmail}
                </Link>
              </li>
              <li className="text-govuk-mid-grey">{profile.supportPhone}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-white text-govuk-m mb-3">Useful links</h3>
            <ul className="list-none p-0 space-y-1">
              <li>
                <Link
                  href="/accessibility"
                  className="text-govuk-mid-grey hover:text-white no-underline"
                >
                  Accessibility statement
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-govuk-mid-grey hover:text-white no-underline"
                >
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-govuk-mid-grey hover:text-white no-underline"
                >
                  Terms and conditions
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-white text-govuk-m mb-3">About</h3>
            <p className="text-govuk-mid-grey text-sm">
              {profile.serviceName} is a reference implementation for digital licence and
              permit applications.
            </p>
            <p className="mt-3 text-govuk-mid-grey text-xs">
              Built as an open-source solution accelerator for Microsoft Azure.
            </p>
          </div>
        </div>
        <div className="border-t border-govuk-mid-grey pt-4">
          <p className="text-govuk-mid-grey text-xs">
            © {profile.organisationName} {new Date().getFullYear()}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
