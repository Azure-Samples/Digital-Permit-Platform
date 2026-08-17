import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { deletePolicyDraft } from "@/lib/policy/service";
import { assertUuid } from "@/lib/http/validation";

export async function DELETE(
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
    const policy = await deletePolicyDraft(policyId, session.user.id);
    return NextResponse.json(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "POLICY_NOT_FOUND"
        ? 404
        : new Set([
              "ACTIVE_POLICY_DELETE_FORBIDDEN",
              "POLICY_HISTORY_DELETE_FORBIDDEN",
              "POLICY_DELETE_CONFLICT",
            ]).has(message)
          ? 409
          : 500;
    const responseMessage =
      message === "POLICY_HISTORY_DELETE_FORBIDDEN"
        ? "A policy version that has been active is retained as council policy history and cannot be deleted."
        : message === "POLICY_DELETE_CONFLICT"
          ? "The policy changed while deletion was in progress. Refresh and try again."
        : status === 409
          ? "Activate another policy before deleting this version."
          : "Policy deletion failed.";
    return NextResponse.json(
      { error: responseMessage },
      { status },
    );
  }
}