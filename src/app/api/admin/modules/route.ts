import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { readJsonObject } from "@/lib/api/request";
import { isTrustedMutationOrigin } from "@/lib/http/origin";
import {
	moduleDefinitionSchema,
	moduleIdentitySchema,
} from "@/lib/modules/definition";
import {
	createLicenceModule,
	ModuleBuilderError,
} from "@/lib/modules/registry";

const createSchema = moduleIdentitySchema.extend({
	definition: moduleDefinitionSchema,
});

export async function POST(request: NextRequest) {
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
		const body = await readJsonObject(request, 1024 * 1024);
		if (!body.ok) return body.response;
		const input = createSchema.parse(body.data);
		const module = await createLicenceModule(input, session.user.id);
		return NextResponse.json(
			{
				moduleId: module.id,
				moduleKey: module.moduleKey,
				versionId: module.versions[0].id,
				version: 1,
			},
			{ status: 201 },
		);
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
			"Module creation failed:",
			error instanceof Error ? error.message : "unknown",
		);
		return NextResponse.json(
			{
				error:
					"The module could not be created. Your changes are still in the builder. Try again.",
			},
			{ status: 500 },
		);
	}
}
