// ─────────────────────────────────────────────────────────────
// NextAuth type extensions
// ─────────────────────────────────────────────────────────────
import { SystemRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: SystemRole;
      teamId?: string | null;
    };
  }

  interface User {
    id: string;
    role: SystemRole;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: SystemRole;
    teamId?: string | null;
  }
}
