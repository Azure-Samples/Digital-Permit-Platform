import { type NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { isDemoCredentialsEnabled } from "@/lib/auth/config";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
  checkRateLimit,
  requestClientAddress,
} from "@/lib/http/rate-limit";

const REGISTER_LIMIT = { windowMs: 60_000, max: 5 };
const BCRYPT_ROUNDS = 14;
const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}'\- ]{0,63}$/u;

function passwordFailsPolicy(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const complexity =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (complexity < 3) {
    return "Password must include at least three of: lowercase, uppercase, digit, symbol.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isDemoCredentialsEnabled()) {
    return NextResponse.json(
      { error: "Local account registration is disabled" },
      { status: 403 },
    );
  }

  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const clientAddress = requestClientAddress(req);
  const limit = checkRateLimit(`register:${clientAddress}`, REGISTER_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
          "X-RateLimit-Reset": String(limit.resetEpochSeconds),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request body." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 },
    );
  }

  const { email, password, firstName, lastName } = body as Record<
    string,
    unknown
  >;

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof firstName !== "string" ||
    typeof lastName !== "string"
  ) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 },
    );
  }
  if (!NAME_PATTERN.test(firstName.trim()) || !NAME_PATTERN.test(lastName.trim())) {
    return NextResponse.json(
      { error: "Names may only contain letters, hyphens and spaces." },
      { status: 400 },
    );
  }
  const passwordError = passwordFailsPolicy(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      // Avoid confirming address enrolment status while still burning
      // roughly the same bcrypt time so timing does not leak enumeration.
      await hash(password, BCRYPT_ROUNDS);
      return NextResponse.json(
        {
          success: true,
          message:
            "If the details are new, an account has been created. Please sign in.",
        },
        { status: 202 },
      );
    }

    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: "APPLICANT",
      },
    });

    await prisma.applicantProfile.create({
      data: { userId: user.id },
    });

    await writeAuditLog({
      userId: user.id,
      action: "user.register",
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, role: "APPLICANT" },
      ipAddress: clientAddress,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "If the details are new, an account has been created. Please sign in.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Registration error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 },
    );
  }
}
