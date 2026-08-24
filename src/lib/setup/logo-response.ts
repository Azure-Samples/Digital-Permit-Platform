import { type NextRequest, NextResponse } from "next/server";
import { contentDispositionHeader } from "@/lib/http/content-disposition";
import { getCouncilLogo } from "./profile";

export async function serveCouncilLogo(
  request: NextRequest,
  expectedVersion?: string,
) {
  const logo = await getCouncilLogo();
  if (!logo?.logoData || !logo.logoMimeType || !logo.logoHash) {
    return NextResponse.json(
      { error: "No council logo has been configured." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (expectedVersion && expectedVersion !== logo.logoHash) {
    return NextResponse.json(
      { error: "This council logo version is no longer active." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const etag = `"${logo.logoHash}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(Buffer.from(logo.logoData), {
    headers: {
      "Content-Type": logo.logoMimeType,
      "Content-Disposition": contentDispositionHeader(
        "inline",
        logo.logoFileName || "council-logo",
      ),
      "Cache-Control": expectedVersion
        ? "public, max-age=31536000, immutable"
        : "no-store",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}