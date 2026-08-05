import { type NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isDemoCredentialsEnabled } from "@/lib/auth/config";

export async function POST(req: NextRequest) {
  if (!isDemoCredentialsEnabled()) {
    return NextResponse.json(
      { error: "Local account registration is disabled" },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: "APPLICANT",
      },
    });

    // Create applicant profile
    await prisma.applicantProfile.create({
      data: { userId: user.id },
    });

    await writeAuditLog({
      userId: user.id,
      action: "user.register",
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, role: "APPLICANT" },
    });

    return NextResponse.json(
      { success: true, userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
