import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertUuid } from "@/lib/http/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role === "APPLICANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { policyId } = await params;
  const invalid = assertUuid(policyId, "policyId");
  if (invalid) return invalid;

  const policy = await prisma.licensingPolicy.findUnique({
    where: { id: policyId },
    select: {
      isActive: true,
      sourceFilename: true,
      sourceMimeType: true,
      sourceFileData: true,
    },
  });
  if (!policy?.sourceFileData || !policy.sourceFilename) {
    return NextResponse.json({ error: "Source document not found." }, { status: 404 });
  }
  if (
    !policy.isActive &&
    !new Set(["MANAGER", "ADMIN"]).has(session.user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const inline =
    policy.sourceMimeType === "application/pdf" &&
    new URL(request.url).searchParams.get("view") === "inline";

  return new NextResponse(policy.sourceFileData, {
    headers: {
      "Content-Type": policy.sourceMimeType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(policy.sourceFilename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      ...(inline
        ? {
            "Content-Security-Policy":
              "default-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-downloads",
          }
        : {}),
    },
  });
}