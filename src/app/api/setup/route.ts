import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { SetupInputError } from "@/lib/setup/errors";
import { validateSetupLogo } from "@/lib/setup/logo";
import {
  hasResetDefaultsConfirmation,
  hasPublicImpactConfirmation,
  parseSetupManifest,
} from "@/lib/setup/manifest";
import {
  applyCouncilProfile,
  getCouncilProfile,
  resetCouncilProfile,
} from "@/lib/setup/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MANIFEST_BYTES = 32 * 1024;

export async function GET() {
  const session = await getServerSession(authOptions);
  const profile = await getCouncilProfile();
  return NextResponse.json({
    profile,
    authenticated: Boolean(session?.user),
    canApply: session?.user.role === "ADMIN",
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in as an administrator to apply this setup." },
      { status: 401 },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can apply council setup." },
      { status: 403 },
    );
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    if (!hasPublicImpactConfirmation(form.get("publicImpactConfirmed"))) {
      return NextResponse.json(
        {
          error:
            "Confirm that you understand these changes will be visible to citizens and staff.",
        },
        { status: 400 },
      );
    }
    const manifestJson = form.get("manifest");
    if (typeof manifestJson !== "string" || manifestJson.length > MAX_MANIFEST_BYTES) {
      return NextResponse.json(
        { error: "The setup manifest is missing or too large." },
        { status: 400 },
      );
    }
    const manifest = parseSetupManifest(JSON.parse(manifestJson));
    const file = form.get("logo");
    const logo =
      file instanceof File && file.size > 0
        ? validateSetupLogo({
            data: new Uint8Array(await file.arrayBuffer()),
            fileName: file.name,
            mimeType: file.type,
          })
        : null;

    const profile = await applyCouncilProfile({
      manifest,
      logo,
      configuredById: session.user.id,
      publicImpactConfirmed: true,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({
      profile,
      message: "Platform settings have been published.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "The setup manifest is not valid JSON." }, { status: 400 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "The setup manifest is invalid.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 },
      );
    }
    if (error instanceof SetupInputError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Platform settings publication failed:", error);
    return NextResponse.json(
      { error: "Platform settings could not be published." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in as an administrator to reset platform settings." },
      { status: 401 },
    );
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can reset platform settings." },
      { status: 403 },
    );
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { confirmation?: unknown };
    if (!hasResetDefaultsConfirmation(body.confirmation)) {
      return NextResponse.json(
        { error: "Confirm that you want to restore the Contoso Council defaults." },
        { status: 400 },
      );
    }

    const profile = await resetCouncilProfile({
      resetById: session.user.id,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({
      profile,
      message: "Contoso Council defaults have been restored across the platform.",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "The reset request is not valid JSON." }, { status: 400 });
    }
    console.error("Platform settings reset failed:", error);
    return NextResponse.json(
      { error: "Platform settings could not be reset." },
      { status: 500 },
    );
  }
}