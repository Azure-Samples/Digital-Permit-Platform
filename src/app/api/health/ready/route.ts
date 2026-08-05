import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "disconnected" },
      { status: 503 }
    );
  }
}