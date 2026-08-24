"use client";

import Image from "next/image";
import { useCouncilProfile } from "./council-profile-provider";

export function CouncilLogo() {
  const profile = useCouncilProfile();
  if (profile.configured && !profile.hasLogo) {
    const initials = profile.organisationName
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    return (
      <span className="flex items-center gap-3 text-white">
        <span className="grid h-11 w-11 place-items-center border-2 border-white text-sm font-bold">
          {initials || "CC"}
        </span>
        <span className="hidden text-sm font-bold sm:inline">
          {profile.organisationName}
        </span>
      </span>
    );
  }

  const logoSource = profile.hasLogo
    ? `/api/setup/logo/${profile.logoVersion ?? "active"}`
    : "/contoso_logo.svg";

  const scale = Math.min(200, Math.max(50, profile.logoScale || 100)) / 100;
  const logoHeight = Math.round(44 * scale);

  return (
    <span className="flex items-center gap-3">
      <span
        className={
          profile.hasLogo && profile.logoBackdrop === "white"
            ? "flex items-center rounded-sm bg-white px-2 py-1"
            : "flex items-center"
        }
      >
        <Image
          src={logoSource}
          alt={`${profile.organisationName} logo`}
          width={280}
          height={48}
          unoptimized={profile.hasLogo}
          className={profile.hasLogo ? "w-auto" : "h-10 w-auto md:h-12"}
          style={profile.hasLogo ? { height: `${logoHeight}px` } : undefined}
        />
      </span>
      {profile.hasLogo && profile.showOrganisationName && (
        <span className="hidden text-sm font-bold text-white sm:inline">
          {profile.organisationName}
        </span>
      )}
    </span>
  );
}

export function CouncilServiceName({ requestedName }: { requestedName: string }) {
  const profile = useCouncilProfile();
  return requestedName.replace(/^Licensing Portal/, profile.serviceName);
}