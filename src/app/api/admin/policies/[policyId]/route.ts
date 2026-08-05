import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import { deletePolicyDraft } from "@/lib/policy/service";

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

  try {
    const { policyId } = await params;
    const policy = await deletePolicyDraft(policyId, session.user.id);
    return NextResponse.json(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "POLICY_NOT_FOUND" ? 404 : message === "ACTIVE_POLICY_DELETE_FORBIDDEN" ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "Activate another policy before deleting this version." : "Policy deletion failed." },
      { status },
    );
  }
}