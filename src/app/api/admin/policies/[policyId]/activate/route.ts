import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { activatePolicyVersion } from "@/lib/policy/service";
import { assertUuid } from "@/lib/http/validation";

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

  const { policyId } = await params;
  const invalid = assertUuid(policyId, "policyId");
  if (invalid) return invalid;

  try {
    const policy = await activatePolicyVersion(policyId, session.user.id);
    return NextResponse.json(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "POLICY_NOT_FOUND"
        ? 404
        : message === "POLICY_GROUNDING_TOO_LARGE"
          ? 422
          : message === "POLICY_ACTIVATION_CONFLICT"
            ? 409
            : 500;
    const responseMessage =
      status === 422
        ? "This policy is too large for the current full-context grounding mode. Reduce it or configure a retrieval-based policy index."
        : status === 409
          ? "Another policy activation completed at the same time. Refresh and try again."
          : "Policy activation failed.";
    return NextResponse.json({ error: responseMessage }, { status });
  }
}