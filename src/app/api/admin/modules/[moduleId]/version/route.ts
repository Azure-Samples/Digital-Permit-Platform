import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readJsonObject } from "@/lib/api/request";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
	moduleDefinitionSchema,
	toModuleDefinition,
} from "@/lib/modules/definition";
import {
	createModuleVersion,
	ModuleBuilderError,
} from "@/lib/modules/registry";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
	definition: moduleDefinitionSchema,
	intent: z.enum(["draft", "publish"]),
	baseVersionId: z.string().uuid(),
	enableModule: z.boolean().optional(),
	publishConfirmed: z.boolean().optional(),
});

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ moduleId: string }> },
) {
	const session = await getServerSession(authOptions);
	if (session?.user.role !== "ADMIN")
		return NextResponse.json(
			{ error: "Administrator access required." },
			{ status: 403 },
		);
	const { moduleId } = await params;
	if (!z.string().uuid().safeParse(moduleId).success)
		return NextResponse.json(
			{ error: "Invalid module identifier." },
			{ status: 400 },
		);
	const versionId = request.nextUrl.searchParams.get("versionId");
	const version = await prisma.moduleVersion.findFirst({
		where: { moduleId, ...(versionId ? { id: versionId } : {}) },
		orderBy: { version: "desc" },
	});
	if (!version)
		return NextResponse.json(
			{ error: "Module version not found." },
			{ status: 404 },
		);
	return NextResponse.json(
		{
			definition: toModuleDefinition(version),
			versionId: version.id,
			version: version.version,
		},
		{ headers: { "Cache-Control": "private, no-store" } },
	);
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ moduleId: string }> },
) {
	try {
		const session = await getServerSession(authOptions);
		if (session?.user.role !== "ADMIN")
			return NextResponse.json(
				{ error: "Administrator access required." },
				{ status: 403 },
			);
		if (!isTrustedMutationOrigin(request))
			return NextResponse.json(
				{ error: "Invalid request origin." },
				{ status: 403 },
			);
		const { moduleId } = await params;
		if (!z.string().uuid().safeParse(moduleId).success)
			return NextResponse.json(
				{ error: "Invalid module identifier." },
				{ status: 400 },
			);
		const body = await readJsonObject(request, 1024 * 1024);
		if (!body.ok) return body.response;
		const input = saveSchema.parse(body.data);
		if (input.intent === "publish" && input.publishConfirmed !== true)
			return NextResponse.json(
				{ error: "Confirm the publication before continuing." },
				{ status: 422 },
			);
		const version = await createModuleVersion(
			moduleId,
			input.definition,
			session.user.id,
			input,
		);
		return NextResponse.json({
			success: true,
			versionId: version.id,
			version: version.version,
			definition: toModuleDefinition(version),
		});
	} catch (error) {
		if (error instanceof ModuleBuilderError)
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status },
			);
		if (error instanceof z.ZodError)
			return NextResponse.json(
				{
					error: "Some settings are invalid. Review the highlighted fields.",
					issues: error.issues.map((issue) => ({
						path: issue.path.join("."),
						message: issue.message,
					})),
				},
				{ status: 422 },
			);
		console.error(
			"Module version save failed:",
			error instanceof Error ? error.message : "unknown",
		);
		return NextResponse.json(
			{
				error:
					"The module could not be saved. Your changes are still in the builder. Try again.",
			},
			{ status: 500 },
		);
	}
}
