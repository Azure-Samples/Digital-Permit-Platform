import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { prisma } from "../src/lib/db";
import { createApplication } from "../src/lib/modules/applications";
import {
	createModuleDefinition,
	type ModuleDefinition,
} from "../src/lib/modules/definition";
import {
	createLicenceModule,
	createModuleVersion,
	getModuleForBuilder,
	getPublicModuleCatalogue,
	ModuleBuilderError,
	toggleModule,
} from "../src/lib/modules/registry";

describe("module builder database lifecycle", {
	skip: process.env.MODULE_BUILDER_INTEGRATION !== "1",
}, () => {
	let actorId: string;
	const moduleIds: string[] = [];

	before(async () => {
		const url = new URL(process.env.DATABASE_URL ?? "");
		assert.ok(
			["localhost", "127.0.0.1"].includes(url.hostname) &&
				url.pathname.startsWith("/dpp_module_builder_"),
			"Use a dedicated local dpp_module_builder_ database.",
		);
		const actor = await prisma.user.create({
			data: {
				email: `builder-${randomUUID()}@example.test`,
				firstName: "Builder",
				lastName: "Test",
				role: "ADMIN",
			},
		});
		actorId = actor.id;
	});

	after(async () => {
		if (actorId) {
			await prisma.auditLog.deleteMany({ where: { userId: actorId } });
			await prisma.application.deleteMany({ where: { applicantId: actorId } });
			await prisma.licenceModule.deleteMany({
				where: { id: { in: moduleIds } },
			});
			await prisma.user.delete({ where: { id: actorId } });
		}
		await prisma.$disconnect();
	});

	function definition(): ModuleDefinition {
		return {
			...createModuleDefinition("standard"),
			publicDescription: "A test permit.",
			visibility: "PUBLIC",
			acceptingApplications: true,
		};
	}

	async function create(config = definition()) {
		const module = await createLicenceModule(
			{
				moduleKey: `builder_${randomUUID().replaceAll("-", "")}`,
				displayName: "Builder test permit",
				category: "Test permits",
				definition: config,
			},
			actorId,
		);
		moduleIds.push(module.id);
		return module;
	}

	it("creates an editable draft without exposing it to applicants", async () => {
		const module = await create();
		assert.equal(module.enabled, false);
		assert.equal(module.versions[0].isActive, false);
		assert.equal(module.versions[0].acceptingApplications, false);
		assert.equal(module.versions[0].visibility, "DRAFT");
		assert.ok(await getModuleForBuilder(module.moduleKey));
		assert.ok(
			!(await getPublicModuleCatalogue()).some(
				(entry) => entry.id === module.id,
			),
		);
		await assert.rejects(
			toggleModule(module.id, true, actorId),
			(error: unknown) =>
				error instanceof ModuleBuilderError && error.status === 422,
		);
	});

	it("handles duplicate module keys without creating partial records", async () => {
		const module = await create();
		await assert.rejects(
			createLicenceModule(
				{
					moduleKey: module.moduleKey,
					displayName: "Duplicate permit",
					category: "Tests",
				},
				actorId,
			),
			(error: unknown) =>
				error instanceof ModuleBuilderError && error.status === 409,
		);
		assert.equal(
			await prisma.licenceModule.count({
				where: { moduleKey: module.moduleKey },
			}),
			1,
		);
		assert.equal(
			await prisma.auditLog.count({
				where: { entityId: module.id, action: "module.create" },
			}),
			1,
		);
	});

	it("keeps live and historical applications intact across draft saves and publication", async () => {
		const module = await create();
		const published = await createModuleVersion(
			module.id,
			definition(),
			actorId,
			{
				intent: "publish",
				baseVersionId: module.versions[0].id,
				enableModule: true,
			},
		);
		const application = await prisma.application.create({
			data: {
				referenceNumber: `BUILDER-${randomUUID()}`,
				moduleId: module.id,
				moduleVersionId: published.id,
				applicantId: actorId,
			},
		});
		const edited = {
			...definition(),
			publicDescription: "Changed but not yet published.",
		};
		edited.workflowDefinition[0].order = 50;
		const draft = await createModuleVersion(module.id, edited, actorId, {
			intent: "draft",
			baseVersionId: published.id,
		});
		assert.equal(draft.isActive, false);
		assert.equal(
			(
				await prisma.moduleVersion.findUniqueOrThrow({
					where: { id: published.id },
				})
			).isActive,
			true,
		);
		assert.equal(
			(await getPublicModuleCatalogue()).find((entry) => entry.id === module.id)
				?.publicDescription,
			"A test permit.",
		);
		const next = await createModuleVersion(module.id, edited, actorId, {
			intent: "publish",
			baseVersionId: draft.id,
			enableModule: true,
		});
		assert.equal(
			(await getPublicModuleCatalogue()).find((entry) => entry.id === module.id)
				?.versionId,
			next.id,
		);
		assert.equal(
			(
				await prisma.application.findUniqueOrThrow({
					where: { id: application.id },
				})
			).moduleVersionId,
			published.id,
		);
		assert.equal(
			(
				await prisma.moduleVersion.findUniqueOrThrow({
					where: { id: published.id },
				})
			).publicDescription,
			"A test permit.",
		);
		assert.equal((next.workflowDefinition as { order: number }[])[0].order, 1);
		assert.equal(
			await prisma.moduleVersion.count({
				where: { moduleId: module.id, isActive: true },
			}),
			1,
		);
	});

	it("rejects incomplete publication before changing the live version", async () => {
		const module = await create();
		const published = await createModuleVersion(
			module.id,
			definition(),
			actorId,
			{ intent: "publish", baseVersionId: module.versions[0].id },
		);
		await assert.rejects(
			createModuleVersion(
				module.id,
				{ ...definition(), formSchema: [] },
				actorId,
				{ intent: "publish", baseVersionId: published.id },
			),
			(error: unknown) =>
				error instanceof ModuleBuilderError && error.status === 422,
		);
		assert.equal(
			await prisma.moduleVersion.count({ where: { moduleId: module.id } }),
			2,
		);
		assert.equal(
			(
				await prisma.moduleVersion.findUniqueOrThrow({
					where: { id: published.id },
				})
			).isActive,
			true,
		);
	});

	it("serializes concurrent saves and rejects the stale writer", async () => {
		const module = await create();
		const options = {
			intent: "draft" as const,
			baseVersionId: module.versions[0].id,
		};
		const results = await Promise.allSettled([
			createModuleVersion(module.id, definition(), actorId, options),
			createModuleVersion(module.id, definition(), actorId, options),
		]);
		assert.equal(
			results.filter((result) => result.status === "fulfilled").length,
			1,
		);
		const rejected = results.find((result) => result.status === "rejected");
		assert.ok(
			rejected?.status === "rejected" &&
				rejected.reason instanceof ModuleBuilderError &&
				rejected.reason.status === 409,
		);
		assert.equal(
			await prisma.moduleVersion.count({ where: { moduleId: module.id } }),
			2,
		);
	});

	it("rolls back activation and enablement if the replacement cannot be stored", async () => {
		const module = await create();
		const published = await createModuleVersion(
			module.id,
			definition(),
			actorId,
			{
				intent: "publish",
				baseVersionId: module.versions[0].id,
				enableModule: true,
			},
		);
		await assert.rejects(
			createModuleVersion(
				module.id,
				{ ...definition(), owningTeamId: randomUUID() },
				actorId,
				{ intent: "publish", baseVersionId: published.id, enableModule: false },
			),
		);
		assert.equal(
			(
				await prisma.moduleVersion.findUniqueOrThrow({
					where: { id: published.id },
				})
			).isActive,
			true,
		);
		assert.equal(
			(
				await prisma.licenceModule.findUniqueOrThrow({
					where: { id: module.id },
				})
			).enabled,
			true,
		);
		assert.equal(
			await prisma.moduleVersion.count({ where: { moduleId: module.id } }),
			2,
		);
	});

	it("preserves existing eligibility, retention and decision settings when omitted by an editor", async () => {
		const config = {
			...definition(),
			retentionPolicy: { retentionMonths: 84 },
			decisionTemplates: { approve: "Approved" },
			eligibilityRules: [{ field: "age", operator: "gte", value: 18 }],
		};
		const module = await create(config);
		const saved = await createModuleVersion(module.id, definition(), actorId, {
			intent: "draft",
			baseVersionId: module.versions[0].id,
		});
		assert.deepEqual(saved.retentionPolicy, config.retentionPolicy);
		assert.deepEqual(saved.decisionTemplates, config.decisionTemplates);
		assert.deepEqual(saved.eligibilityRules, config.eligibilityRules);
	});

	it("blocks applications to drafts, disabled or closed modules and unsupported types", async () => {
		const module = await create();
		const input = {
			moduleId: module.id,
			moduleVersionId: module.versions[0].id,
			applicationType: "new",
			applicantId: actorId,
		};
		await assert.rejects(createApplication(input));
		const closed = await createModuleVersion(
			module.id,
			{ ...definition(), acceptingApplications: false },
			actorId,
			{
				intent: "publish",
				baseVersionId: input.moduleVersionId,
				enableModule: true,
			},
		);
		await assert.rejects(
			createApplication({ ...input, moduleVersionId: closed.id }),
		);
		const opened = await createModuleVersion(module.id, definition(), actorId, {
			intent: "publish",
			baseVersionId: closed.id,
			enableModule: true,
		});
		await assert.rejects(
			createApplication({
				...input,
				moduleVersionId: opened.id,
				applicationType: "unsupported",
			}),
		);
		const application = await createApplication({
			...input,
			moduleVersionId: opened.id,
		});
		assert.equal(application.moduleVersionId, opened.id);
		await prisma.auditLog.deleteMany({
			where: { applicationId: application.id },
		});
		await prisma.application.delete({ where: { id: application.id } });
		await prisma.licenceModule.update({
			where: { id: module.id },
			data: { enabled: false },
		});
		await assert.rejects(
			createApplication({ ...input, moduleVersionId: opened.id }),
		);
	});

	it("allocates unique references for concurrent applications in modules sharing initials", async () => {
		const modules = [];
		for (const name of ["community_market_alpha", "community_market_another"]) {
			const module = await createLicenceModule(
				{
					moduleKey: `${name}_${Date.now()}`,
					displayName: "Reference test permit",
					category: "Tests",
					definition: definition(),
				},
				actorId,
			);
			moduleIds.push(module.id);
			const published = await createModuleVersion(
				module.id,
				definition(),
				actorId,
				{
					intent: "publish",
					baseVersionId: module.versions[0].id,
					enableModule: true,
				},
			);
			modules.push({
				moduleId: module.id,
				moduleVersionId: published.id,
				applicantId: actorId,
				applicationType: "new",
			});
		}
		const applications = await Promise.all([
			createApplication(modules[0]),
			createApplication(modules[1]),
			createApplication(modules[0]),
		]);
		assert.equal(
			new Set(applications.map((application) => application.referenceNumber))
				.size,
			3,
		);
		assert.equal(
			await prisma.auditLog.count({
				where: {
					applicationId: {
						in: applications.map((application) => application.id),
					},
					action: "application.create",
				},
			}),
			3,
		);
	});
});
