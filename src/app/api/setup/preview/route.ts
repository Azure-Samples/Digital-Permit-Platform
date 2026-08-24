import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
  buildSetupDeploymentPreview,
  parseSetupManifest,
} from "@/lib/setup/manifest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const manifest = parseSetupManifest(await request.json());
    return NextResponse.json({
      manifest,
      preview: buildSetupDeploymentPreview(manifest),
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
    return NextResponse.json(
      { error: "The deployment preview could not be generated." },
      { status: 500 },
    );
  }
}