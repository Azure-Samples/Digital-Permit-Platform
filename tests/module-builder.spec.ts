import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.MODULE_BUILDER_URL ?? "http://localhost:3107";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
	throw new Error(
		"Module builder browser tests must use an isolated local instance.",
	);

test.use({
	baseURL,
	viewport: { width: 1440, height: 1000 },
	trace: "retain-on-failure",
});
test.setTimeout(90000);

async function signIn(page: Page, role = "admin") {
	await page.goto(
		`${baseURL}/auth/login?callbackUrl=${role === "admin" ? "/admin/modules/new" : "/dashboard"}`,
	);
	await page
		.getByLabel("Email address", { exact: true })
		.fill(`${role}@example.com`);
	await page
		.getByLabel("Password", { exact: true })
		.fill(process.env.MODULE_BUILDER_PASSWORD ?? "password123");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
}

test("administrator reaches the create route and validation preserves their work", async ({
	page,
}, testInfo) => {
	await signIn(page);
	await page.goto(`${baseURL}/admin/modules/new`);
	await expect(
		page.getByRole("heading", { name: "Create module", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(
		page.getByRole("alert").filter({ hasText: "There is a problem" }),
	).toContainText("Review these settings");
	await page
		.getByLabel("Display name", { exact: true })
		.fill("Community market permit");
	await expect(page.getByLabel("Module key (permanent)")).toHaveValue(
		"community_market_permit",
	);
	await page.getByLabel("Category", { exact: true }).fill("Community permits");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("Apply to operate a community market.");
	await page
		.getByRole("button", { name: "Use starting point", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Application form", exact: true }),
	).toBeVisible();
	await expect(page.getByLabel("Question label", { exact: true })).toHaveCount(
		5,
	);
	await page.getByRole("tab", { name: "Details", exact: true }).click();
	await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
		"Community market permit",
	);
	await page.screenshot({
		path: testInfo.outputPath("create-module-desktop.png"),
		fullPage: true,
	});
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	expect(overflow).toBe(false);
});

async function tab(page: Page, name: string) {
	await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
}

async function createStarter(page: Page, suffix: string) {
	const moduleKey = `browser_${suffix}_${Date.now()}`;
	await page.goto(`${baseURL}/admin/modules/new`);
	await page
		.getByLabel("Display name", { exact: true })
		.fill(`Community permit ${suffix}`);
	await page.getByLabel("Module key (permanent)").fill(moduleKey);
	await page
		.getByLabel("Category", { exact: true })
		.fill("Browser test permits");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("Apply for a community permit.");
	await page
		.getByRole("button", { name: "Use starting point", exact: true })
		.click();
	return moduleKey;
}

test("complete create, preview, publish and applicant journey preserves historical versions", async ({
	page,
	browser,
}, testInfo) => {
	await signIn(page);
	const moduleKey = await createStarter(page, "journey");
	const applicantSection = page.getByRole("region", {
		name: "Section 1: Applicant details",
		exact: true,
	});
	await applicantSection
		.getByRole("button", { name: "Add question", exact: true })
		.click();
	await applicantSection
		.getByLabel("Question label", { exact: true })
		.last()
		.fill("Do you need an inspection?");
	await applicantSection
		.getByLabel("Answer type", { exact: true })
		.last()
		.selectOption("radio");
	await applicantSection
		.getByText("Identifier and validation", { exact: true })
		.last()
		.click();
	await applicantSection
		.getByLabel("Question key", { exact: true })
		.last()
		.fill("needs_inspection");
	const detailSection = page.getByRole("region", {
		name: "Section 2: Application details",
		exact: true,
	});
	await detailSection.getByText("Section condition", { exact: true }).click();
	await detailSection
		.getByRole("checkbox", {
			name: "Only show when a condition is met",
			exact: true,
		})
		.check();
	await detailSection
		.getByLabel("Question", { exact: true })
		.selectOption("needs_inspection");
	await detailSection.getByLabel("Answer", { exact: true }).selectOption("yes");

	await tab(page, "Documents");
	await page.getByRole("button", { name: "Add document requirement" }).click();
	await page.getByLabel("Document name", { exact: true }).fill("Site plan");
	await page.getByLabel("Maximum file size (MB)", { exact: true }).fill("1");
	await page.getByLabel("Evidence required", { exact: true }).uncheck();
	await page
		.getByLabel("Requirement verified against", { exact: true })
		.selectOption("verified_policy");
	await tab(page, "Checklist");
	await page.getByRole("button", { name: "Add checklist item" }).click();
	await page
		.getByLabel("Check to complete", { exact: true })
		.fill("Confirm applicant details");
	await tab(page, "Workflow");
	await page
		.getByLabel("Target (working days)", { exact: true })
		.first()
		.fill("7");
	await tab(page, "Details");
	await page.getByLabel("renewal", { exact: true }).check();
	await page
		.getByLabel("Owning team", { exact: true })
		.selectOption({ index: 1 });
	await tab(page, "Fees");
	await page
		.getByLabel("Payment method", { exact: true })
		.selectOption("MANUAL_REFERENCE");
	await page.getByLabel("new fee (GBP)", { exact: true }).fill("25");
	await page.getByLabel("renewal fee (GBP)", { exact: true }).fill("15");

	await tab(page, "Preview");
	await page
		.getByRole("button", { name: "Start preview", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Save and continue", exact: true })
		.click();
	await expect(
		page.getByText("Full name is required.", { exact: false }),
	).toBeVisible();
	await page.getByLabel("Full name", { exact: false }).fill("Preview Person");
	await page
		.getByLabel("Email address", { exact: false })
		.fill("preview@example.test");
	await page.getByLabel("No", { exact: true }).check();
	await page
		.getByRole("button", { name: "Save and continue", exact: true })
		.click();
	await expect(
		page.getByText("Declaration", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByLabel("Describe your application", { exact: false }),
	).toHaveCount(0);
	await page
		.getByLabel("I confirm that the information I have provided is accurate.", {
			exact: true,
		})
		.check();
	await page
		.getByRole("button", { name: "Continue to documents", exact: true })
		.click();
	await page
		.getByRole("button", { name: "Continue to payment", exact: true })
		.click();
	await page
		.getByLabel("Payment reference (preview)", { exact: true })
		.fill("PREVIEW-ONLY");
	await page
		.getByRole("button", { name: "Review answers", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Check your answers", exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Finish preview", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Preview complete", exact: true }),
	).toBeVisible();

	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await page.waitForURL(`**/admin/modules/${moduleKey}?**`);
	await expect(
		page.getByText("Draft module created.", { exact: false }),
	).toBeVisible();
	const unpublished = await page.request.get(`/licences/${moduleKey}`);
	expect(unpublished.status()).toBe(404);
	await tab(page, "Review & publish");
	await expect(
		page.getByText("Configuration checks passed", { exact: true }),
	).toBeVisible();
	await page
		.getByLabel(
			"I have reviewed the form, requirements, fees and publication settings.",
			{ exact: true },
		)
		.check();
	await page
		.getByRole("button", { name: "Publish version", exact: true })
		.click();
	await expect(
		page.getByText("Version 2 published.", { exact: false }),
	).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath("published-module-desktop.png"),
		fullPage: true,
	});

	const applicantContext = await browser.newContext({ baseURL });
	const applicant = await applicantContext.newPage();
	await signIn(applicant, "applicant");
	await applicant.goto(`/licences/${moduleKey}`);
	await applicant
		.getByLabel("Application type", { exact: true })
		.selectOption("renewal");
	await applicant
		.getByRole("button", { name: "Start application", exact: true })
		.click();
	await applicant.waitForURL(`**/apply/${moduleKey}/*`);
	const applicationUrl = applicant.url();
	const applicationId = applicationUrl.split("/").at(-1);
	const invalidSubmission = await applicant.request.post(
		`/api/applications/${applicationId}/submit`,
		{
			headers: { Origin: baseURL },
			data: { declarationAccepted: true, paymentReference: "TEST" },
		},
	);
	expect(invalidSubmission.status()).toBe(422);
	await applicant
		.getByLabel("Full name", { exact: false })
		.fill("Resident Applicant");
	await applicant
		.getByLabel("Email address", { exact: false })
		.fill("resident@example.test");
	await applicant.getByLabel("No", { exact: true }).check();
	await applicant
		.getByRole("button", { name: "Save and continue", exact: true })
		.click();
	await expect(
		applicant.getByRole("heading", { name: "Declaration", exact: true }),
	).toBeVisible();
	await applicant.reload();
	await expect(applicant.getByLabel("Full name", { exact: false })).toHaveValue(
		"Resident Applicant",
	);

	await tab(page, "Details");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("Unpublished revised description.");
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(
		page.getByText("Draft version 3 saved.", { exact: false }),
	).toBeVisible();
	const liveBefore = await applicant.request.get(`/licences/${moduleKey}`);
	expect(await liveBefore.text()).toContain("Apply for a community permit.");
	expect(await liveBefore.text()).not.toContain(
		"Unpublished revised description.",
	);
	await tab(page, "Form");
	await page
		.getByLabel("Question label", { exact: true })
		.first()
		.fill("New applicant name");
	await tab(page, "Review & publish");
	await page
		.getByLabel(
			"I have reviewed the form, requirements, fees and publication settings.",
			{ exact: true },
		)
		.check();
	await page
		.getByRole("button", { name: "Publish version", exact: true })
		.click();
	await expect(
		page.getByText("Version 4 published.", { exact: false }),
	).toBeVisible();
	await applicant.goto(applicationUrl);
	await expect(applicant.getByLabel("Full name", { exact: false })).toHaveValue(
		"Resident Applicant",
	);
	await expect(
		applicant.getByLabel("New applicant name", { exact: false }),
	).toHaveCount(0);

	await applicant
		.getByRole("button", { name: "Save and continue", exact: true })
		.click();
	await applicant
		.getByLabel("I confirm that the information I have provided is accurate.", {
			exact: true,
		})
		.check();
	await applicant
		.getByRole("button", { name: "Continue to documents", exact: true })
		.click();
	await expect(
		applicant.getByRole("heading", { name: "Upload documents", exact: true }),
	).toBeVisible();
	const unsupportedFile = await applicant.request.post(
		"/api/documents/upload",
		{
			headers: { Origin: baseURL },
			multipart: {
				applicationId: applicationId ?? "",
				requirementKey: "document_1",
				file: {
					name: "test.txt",
					mimeType: "text/plain",
					buffer: Buffer.from("unsupported"),
				},
			},
		},
	);
	expect(unsupportedFile.status()).toBe(400);
	const oversizedFile = await applicant.request.post("/api/documents/upload", {
		headers: { Origin: baseURL },
		multipart: {
			applicationId: applicationId ?? "",
			requirementKey: "document_1",
			file: {
				name: "large.pdf",
				mimeType: "application/pdf",
				buffer: Buffer.alloc(2 * 1024 * 1024),
			},
		},
	});
	expect(oversizedFile.status()).toBe(413);
	await applicant
		.getByRole("button", { name: "Continue", exact: true })
		.click();
	await expect(
		applicant.getByRole("heading", { name: "Fee: £15.00", exact: true }),
	).toBeVisible();
	await expect(
		applicant.getByRole("button", { name: "Continue", exact: true }),
	).toBeDisabled();
	await applicant
		.getByLabel("Payment reference number", { exact: true })
		.fill("TEST-RENEWAL-15");
	await applicant
		.getByRole("button", { name: "Continue", exact: true })
		.click();
	await applicant
		.getByLabel(
			"I confirm that I have read and agree to the above declaration.",
			{ exact: true },
		)
		.check();
	await applicant
		.getByRole("button", { name: "Continue to review", exact: true })
		.click();
	await applicant
		.getByRole("button", { name: "Submit application", exact: true })
		.click();
	await expect(
		applicant.getByRole("heading", {
			name: "Application submitted",
			exact: true,
		}),
	).toBeVisible();
	await tab(page, "Review & publish");
	await page.getByLabel("Accept new applications", { exact: true }).uncheck();
	await page
		.getByLabel(
			"I have reviewed the form, requirements, fees and publication settings.",
			{ exact: true },
		)
		.check();
	await page
		.getByRole("button", { name: "Publish version", exact: true })
		.click();
	await expect(
		page.getByText("Applications remain closed.", { exact: false }),
	).toBeVisible();
	const closed = await applicant.request.get(
		`/apply/${moduleKey}/new?applicationType=new`,
	);
	expect(closed.status()).toBe(404);
	await page
		.getByRole("link", { name: "Back to module registry", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Module registry", exact: true }),
	).toBeVisible();
	const moduleRow = page.getByRole("row").filter({ hasText: moduleKey });
	await moduleRow.getByRole("button", { name: "Disable", exact: true }).click();
	await expect(
		moduleRow.getByRole("button", { name: "Enable", exact: true }),
	).toBeVisible();
	expect((await applicant.request.get(`/licences/${moduleKey}`)).status()).toBe(
		404,
	);
	await moduleRow.getByRole("button", { name: "Enable", exact: true }).click();
	await expect(
		moduleRow.getByRole("button", { name: "Disable", exact: true }),
	).toBeVisible();
	await applicantContext.close();
});

test("draft recovery, failed save, undo, and mobile layout keep work usable", async ({
	page,
}, testInfo) => {
	await signIn(page);
	await createStarter(page, "recovery");
	await tab(page, "Details");
	await expect(
		page.getByText("Recovery copy saved in this browser", { exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByText("Unsaved changes found in this browser", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Restore changes", exact: true })
		.click();
	await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
		"Community permit recovery",
	);
	await page.route("**/api/admin/modules", (route) =>
		route.fulfill({
			status: 500,
			contentType: "application/json",
			body: JSON.stringify({ error: "Simulated save failure" }),
		}),
	);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Simulated save failure" }),
	).toBeVisible();
	await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
		"Community permit recovery",
	);
	await page.unroute("**/api/admin/modules");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("Changed description");
	await page.getByRole("button", { name: "Undo change", exact: true }).click();
	await expect(
		page.getByLabel("Public description", { exact: true }),
	).toHaveValue("Apply for a community permit.");
	await page.setViewportSize({ width: 390, height: 844 });
	const title = await page.getByRole("heading", { level: 1 }).boundingBox();
	const saveButton = await page
		.getByRole("button", { name: "Save draft", exact: true })
		.boundingBox();
	expect(title?.width).toBeGreaterThan(300);
	expect(title?.height).toBeLessThan(100);
	expect(saveButton?.y).toBeGreaterThan((title?.y ?? 0) + (title?.height ?? 0));
	for (const name of [
		"Details",
		"Form",
		"Documents",
		"Workflow",
		"Checklist",
		"Fees",
		"Preview",
		"Review & publish",
	]) {
		await tab(page, name);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	}
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({
		path: testInfo.outputPath("module-builder-mobile.png"),
		fullPage: true,
	});
	await page.setViewportSize({ width: 320, height: 740 });
	await tab(page, "Form");
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	expect(
		(await page.getByRole("heading", { level: 1 }).boundingBox())?.width,
	).toBeGreaterThan(250);
});

test("non-administrators cannot create modules and invalid requests fail closed", async ({
	page,
	browser,
}) => {
	const unauthenticated = await page.request.post("/api/admin/modules", {
		data: {},
	});
	expect(unauthenticated.status()).toBe(403);
	await signIn(page);
	const crossOrigin = await page.request.post("/api/admin/modules", {
		headers: { Origin: "https://untrusted.example" },
		data: {},
	});
	expect(crossOrigin.status()).toBe(403);
	const malformed = await page.request.post("/api/admin/modules", {
		headers: { Origin: baseURL, "Content-Type": "application/json" },
		data: "{",
	});
	expect(malformed.status()).toBe(400);
	const invalid = await page.request.post("/api/admin/modules", {
		headers: { Origin: baseURL },
		data: {
			moduleKey: "new",
			displayName: "Test",
			category: "Tests",
			definition: {},
		},
	});
	expect(invalid.status()).toBe(422);
	const context = await browser.newContext({ baseURL });
	const applicant = await context.newPage();
	await signIn(applicant, "applicant");
	const forbidden = await applicant.request.post("/api/admin/modules", {
		headers: { Origin: baseURL },
		data: {},
	});
	expect(forbidden.status()).toBe(403);
	await context.close();
});

test("import, export, copy, concurrent edits and version restoration remain drafts", async ({
	page,
	context,
}, testInfo) => {
	await signIn(page);
	const moduleKey = await createStarter(page, "versions");
	await page
		.getByRole("button", { name: "Duplicate Applicant details", exact: true })
		.click();
	await expect(page.getByLabel("Question label", { exact: true })).toHaveCount(
		8,
	);
	await page.getByRole("button", { name: "Undo change", exact: true }).click();
	await expect(page.getByLabel("Question label", { exact: true })).toHaveCount(
		5,
	);

	const downloadPromise = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "Export module JSON", exact: true })
		.click();
	const download = await downloadPromise;
	const packagePath = testInfo.outputPath("module-package.json");
	await download.saveAs(packagePath);
	await tab(page, "Details");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("Temporary edit");
	await page
		.getByLabel("Import module JSON file", { exact: true })
		.setInputFiles(packagePath);
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(
		page.getByLabel("Public description", { exact: true }),
	).toHaveValue("Temporary edit");
	await page
		.getByLabel("Import module JSON file", { exact: true })
		.setInputFiles(packagePath);
	await page.getByRole("button", { name: "Confirm", exact: true }).click();
	await expect(
		page.getByLabel("Public description", { exact: true }),
	).toHaveValue("Apply for a community permit.");
	await page
		.getByLabel("Import module JSON file", { exact: true })
		.setInputFiles({
			name: "invalid.json",
			mimeType: "application/json",
			buffer: Buffer.from("{"),
		});
	await expect(
		page.getByRole("alert").filter({ hasText: "valid JSON" }),
	).toBeVisible();
	await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
		"Community permit versions",
	);
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await page.waitForURL(`**/admin/modules/${moduleKey}?**`);

	const secondEditor = await context.newPage();
	await secondEditor.goto(`/admin/modules/${moduleKey}`);
	await expect(
		secondEditor.getByLabel("Public description", { exact: true }),
	).toHaveValue("Apply for a community permit.");
	await tab(page, "Details");
	await page
		.getByLabel("Public description", { exact: true })
		.fill("First editor saved this revision.");
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(
		page.getByText("Draft version 2 saved.", { exact: false }),
	).toBeVisible();
	await secondEditor
		.getByLabel("Public description", { exact: true })
		.fill("Second editor unsaved work.");
	await secondEditor
		.getByRole("button", { name: "Save draft", exact: true })
		.click();
	await expect(
		secondEditor.getByRole("alert").filter({ hasText: "newer version" }),
	).toBeVisible();
	await expect(
		secondEditor.getByLabel("Public description", { exact: true }),
	).toHaveValue("Second editor unsaved work.");
	await secondEditor.close();

	await tab(page, "Review & publish");
	await page
		.getByRole("button", { name: "Use as draft", exact: true })
		.last()
		.click();
	await page.getByRole("button", { name: "Confirm", exact: true }).click();
	await expect(
		page.getByText("Version 1 loaded into the editor.", { exact: false }),
	).toBeVisible();
	await tab(page, "Details");
	await expect(
		page.getByLabel("Public description", { exact: true }),
	).toHaveValue("Apply for a community permit.");
	await page.getByRole("button", { name: "Save draft", exact: true }).click();
	await expect(
		page.getByText("Draft version 3 saved.", { exact: false }),
	).toBeVisible();
	const unpublished = await page.request.get(`/licences/${moduleKey}`);
	expect(unpublished.status()).toBe(404);
	await page.getByRole("tab", { name: /^Details/ }).focus();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("tab", { name: /^Form/ })).toBeFocused();
	await expect(
		page.getByRole("heading", { name: "Application form", exact: true }),
	).toBeVisible();
});
