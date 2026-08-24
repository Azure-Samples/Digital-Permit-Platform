import type { NextRequest } from "next/server";
import { serveCouncilLogo } from "@/lib/setup/logo-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  const { version } = await params;
  return serveCouncilLogo(request, version);
}