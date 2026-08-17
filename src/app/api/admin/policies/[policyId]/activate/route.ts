import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { activatePolicyVersion } from "@/lib/policy/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ policyId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!new Set(["MANAGER", "ADMIN"]).has(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const { policyId } = await params;
    const policy = await activatePolicyVersion(policyId, session.user.id);
    return NextResponse.json(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "POLICY_NOT_FOUND"
        ? 404
        : message === "POLICY_ACTIVATION_CONFLICT"
            ? 409
            : 500;
    const responseMessage =
      status === 409
          ? "Another policy activation completed at the same time. Refresh and try again."
          : "Policy activation failed.";
    return NextResponse.json({ error: responseMessage }, { status });
  }
}