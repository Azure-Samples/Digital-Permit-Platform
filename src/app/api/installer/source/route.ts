import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { contentDispositionHeader } from "@/lib/http/content-disposition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sourcePath = process.env.INSTALLER_SOURCE_PATH;
  if (process.env.SETUP_INSTALLER_MODE !== "true" || !sourcePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const source = await readFile(sourcePath);
    if (source.byteLength === 0 || source.byteLength > 5 * 1024 * 1024) {
      throw new Error("Installer source bundle has an invalid size.");
    }
    return new NextResponse(source, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDispositionHeader(
          "attachment",
          path.basename(sourcePath),
        ),
        "Content-Length": String(source.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Installer source bundle could not be served:", error);
    return new NextResponse("Installer source is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}