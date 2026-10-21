import { z } from "zod";
import type { FormField } from "@/types/module";

export const FIELD_TYPES = [
	"text",
	"textarea",
	"date",
	"checkbox",
	"select",
	"radio",
	"postcode",
	"address",
	"number",
	"currency",
	"upload",
	"email",
	"phone",
	"repeatable",
] as const;

export const APPLICATION_TYPES = [
	"new",
	"renewal",
	"variation",
	"transfer",
] as const;
export const PAYMENT_MODES = [
	"NO_FEE",
	"EXTERNAL_REDIRECT",
	"MANUAL_REFERENCE",
	"RECEIPT_UPLOAD",
	"API_INTEGRATION",
] as const;
export const DOCUMENT_MIME_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/gif",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const shortText = z.string().max(250);
const text = z.string().max(10000);
const key = z.string().max(64);
const scalar = z.union([
	z.string().max(1000),
	z.number().finite(),
	z.boolean(),
	z.null(),
]);
const conditionSchema = z.object({
	field: key,
	operator: z.enum([
		"eq",
		"neq",
		"in",
		"not_in",
		"gt",
		"lt",
		"contains",
		"exists",
	]),
	value: z.union([scalar, z.array(scalar).max(100)]),
});
export type BuilderCondition = z.infer<typeof conditionSchema>;

function fieldSchema(depth = 0): z.ZodType<FormField> {
	return z.object({
		key,
		label: shortText,
		type: z.enum(FIELD_TYPES),
		hint: text.optional(),
		placeholder: shortText.optional(),
		required: z.boolean().optional(),
		validation: z
			.object({
				minLength: z.number().int().min(0).max(10000).optional(),
				maxLength: z.number().int().min(0).max(10000).optional(),
				min: z.number().finite().optional(),
				max: z.number().finite().optional(),
				pattern: z.string().max(200).optional(),
				patternMessage: shortText.optional(),
			})
			.optional(),
		options: z
			.array(z.object({ value: shortText, label: shortText }))
			.max(100)
			.optional(),
		conditionalOn: conditionSchema.optional(),
		repeatableSchema:
			depth < 2
				? z
						.array(z.lazy(() => fieldSchema(depth + 1)))
						.max(50)
						.optional()
				: z.never().optional(),
		maxRepeats: z.number().int().min(1).max(100).optional(),
		defaultValue: z.unknown().optional(),
	});
}

export const moduleDefinitionSchema = z.object({
	visibility: z.enum(["DRAFT", "PUBLIC", "STAFF_ONLY"]).default("DRAFT"),
	publicDescription: text.default(""),
	helpText: text.default(""),
	beforeYouStartText: text.default(""),
	applicationTypes: z.array(key).max(20).default(["new"]),
	paymentMode: z.enum(PAYMENT_MODES).default("NO_FEE"),
	acceptingApplications: z.boolean().default(false),
	submissionMailbox: z
		.union([z.literal(""), z.string().email().max(254)])
		.default(""),
	owningTeamId: z.union([z.literal(""), z.string().uuid()]).default(""),
	eligibilityRules: z.unknown().optional(),
	conditionalRules: z.unknown().optional(),
	notificationTemplates: z.unknown().optional(),
	retentionPolicy: z.unknown().optional(),
	decisionTemplates: z.unknown().optional(),
	verificationStatus: z
		.enum([
			"VERIFIED_PUBLIC_PAGE",
			"VERIFIED_FORM_PACK",
			"VERIFIED_POLICY",
			"NEEDS_COUNCIL_CONFIRMATION",
		])
		.optional(),
	formSchema: z
		.array(
			z.object({
				key,
				title: shortText,
				description: text.optional(),
				fields: z.array(fieldSchema()).max(100),
				conditionalOn: conditionSchema.optional(),
			}),
		)
		.max(40)
		.default([]),
	documentRequirements: z
		.array(
			z.object({
				key,
				label: shortText,
				description: text.optional(),
				required: z.boolean(),
				conditionalOn: conditionSchema.optional(),
				acceptedMimeTypes: z.array(z.string().max(150)).max(15).optional(),
				maxSizeMb: z.number().positive().max(50).optional(),
				verificationStatus: z.enum([
					"verified_public_page",
					"verified_form_pack",
					"verified_policy",
					"needs_council_confirmation",
				]),
			}),
		)
		.max(100)
		.default([]),
	workflowDefinition: z
		.array(
			z.object({
				key,
				label: shortText,
				order: z.number().int().min(0),
				type: z.enum([
					"validation",
					"review",
					"inspection",
					"consultation",
					"hearing",
					"training",
					"decision",
					"custom",
				]),
				slaBusinessDays: z.number().int().min(1).max(3650).optional(),
				reminderDays: z.number().int().min(0).max(3650).optional(),
				autoTransitions: z
					.array(z.object({ condition: shortText, toStage: key }))
					.max(20)
					.optional(),
				requiredActions: z.array(shortText).max(30).optional(),
				visibleToApplicant: z.boolean().optional(),
			}),
		)
		.max(40)
		.default([]),
	reviewChecklist: z
		.array(
			z.object({
				key,
				label: shortText,
				description: text.optional(),
				required: z.boolean(),
				category: shortText.optional(),
			}),
		)
		.max(100)
		.default([]),
	feeSchedule: z
		.record(
			z.union([
				z.number().finite().min(0).max(10000000),
				z.object({
					baseAmount: z.number().finite().min(0).max(10000000),
					bands: z
						.array(
							z.object({
								label: shortText,
								condition: conditionSchema,
								amount: z.number().finite().min(0).max(10000000),
							}),
						)
						.max(50)
						.optional(),
				}),
			]),
		)
		.default({}),
});

export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;
export function toModuleDefinition(
	source: Record<string, unknown>,
): ModuleDefinition {
	return moduleDefinitionSchema.parse({
		...source,
		publicDescription: source.publicDescription ?? "",
		helpText: source.helpText ?? "",
		beforeYouStartText: source.beforeYouStartText ?? "",
		submissionMailbox: source.submissionMailbox ?? "",
		owningTeamId: source.owningTeamId ?? "",
		feeSchedule: source.feeSchedule ?? {},
	});
}

export type BuilderArea =
	| "general"
	| "form"
	| "documents"
	| "workflow"
	| "checklist"
	| "fees";
export interface DefinitionIssue {
	area: BuilderArea;
	path: string;
	message: string;
}

export function normaliseModuleKey(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_")
		.replace(/[^a-z0-9_]/g, "")
		.slice(0, 64);
}

export const moduleIdentitySchema = z.object({
	moduleKey: z
		.string()
		.regex(
			/^[a-z][a-z0-9_]{2,63}$/,
			"Use 3 to 64 lowercase letters, numbers or underscores, starting with a letter.",
		)
		.refine(
			(value) => !["new", "constructor", "prototype"].includes(value),
			"This module key is reserved.",
		),
	displayName: z.string().trim().min(3).max(120),
	category: z.string().trim().min(2).max(80),
});

export function nextKey(prefix: string, keys: string[]) {
	const used = new Set(keys);
	let suffix = 1;
	while (used.has(`${prefix}_${suffix}`)) suffix += 1;
	return `${prefix}_${suffix}`;
}

export function moveItem<Item>(
	items: Item[],
	index: number,
	direction: -1 | 1,
): Item[] {
	const destination = index + direction;
	if (
		index < 0 ||
		index >= items.length ||
		destination < 0 ||
		destination >= items.length
	)
		return items;
	const result = [...items];
	[result[index], result[destination]] = [result[destination], result[index]];
	return result;
}

export function duplicateSection(
	definition: ModuleDefinition,
	index: number,
): ModuleDefinition {
	const result = structuredClone(definition);
	const section = structuredClone(result.formSchema[index]);
	section.key = nextKey(
		"section",
		result.formSchema.map((item) => item.key),
	);
	section.title = `${section.title} (copy)`;
	const used = result.formSchema.flatMap((item) =>
		item.fields.map((field) => field.key),
	);
	const renamed = new Map<string, string>();
	section.fields.forEach((field) => {
		const newKey = nextKey("question", used);
		renamed.set(field.key, newKey);
		field.key = newKey;
		used.push(newKey);
	});
	const remap = (fields: FormField[]) =>
		fields.forEach((field) => {
			if (field.conditionalOn && renamed.has(field.conditionalOn.field))
				field.conditionalOn.field =
					renamed.get(field.conditionalOn.field) ?? field.conditionalOn.field;
			if (field.repeatableSchema) remap(field.repeatableSchema);
		});
	remap(section.fields);
	result.formSchema.splice(index + 1, 0, section);
	return result;
}

export function getModuleReadiness(
	definition: ModuleDefinition,
	uploadLimitMb = 10,
): DefinitionIssue[] {
	const issues: DefinitionIssue[] = [];
	const add = (area: BuilderArea, path: string, message: string) =>
		issues.push({ area, path, message });
	const validKey = (value: string) =>
		/^[a-z][a-z0-9_]{0,63}$/.test(value) &&
		!["constructor", "prototype", "__proto__"].includes(value);
	const uniqueKeys = (
		items: { key: string }[],
		area: BuilderArea,
		path: string,
	) => {
		const used = new Set<string>();
		items.forEach((item, index) => {
			if (!validKey(item.key))
				add(
					area,
					`${path}.${index}.key`,
					"Use a key starting with a letter, followed by lowercase letters, numbers or underscores.",
				);
			if (used.has(item.key))
				add(
					area,
					`${path}.${index}.key`,
					`The key "${item.key}" is used more than once.`,
				);
			used.add(item.key);
		});
	};
	const condition = (
		rule: FormField["conditionalOn"],
		available: Set<string>,
		area: BuilderArea,
		path: string,
	) => {
		if (!rule) return;
		if (!available.has(rule.field))
			add(
				area,
				path,
				`The condition must refer to an earlier question. "${rule.field}" is not available here.`,
			);
		if (["in", "not_in"].includes(rule.operator) && !Array.isArray(rule.value))
			add(area, path, "This condition needs a list of values.");
		if (["gt", "lt"].includes(rule.operator) && typeof rule.value !== "number")
			add(area, path, "This condition needs a numeric value.");
	};
	const checkFields = (
		fields: FormField[],
		path: string,
		available: Set<string>,
	) => {
		fields.forEach((field, index) => {
			const fieldPath = `${path}.${index}`;
			if (!validKey(field.key) || available.has(field.key))
				add(
					"form",
					`${fieldPath}.key`,
					`Question key "${field.key}" must be valid and unique.`,
				);
			if (!field.label.trim())
				add("form", `${fieldPath}.label`, "Enter a question label.");
			if (field.type === "upload")
				add(
					"form",
					`${fieldPath}.type`,
					"Move file uploads to Supporting documents so uploaded files are stored securely.",
				);
			condition(
				field.conditionalOn,
				available,
				"form",
				`${fieldPath}.conditionalOn`,
			);
			if (["select", "radio"].includes(field.type)) {
				if (!field.options?.length)
					add(
						"form",
						`${fieldPath}.options`,
						`Add choices for "${field.label || field.key}".`,
					);
				const values = new Set<string>();
				for (const option of field.options ?? []) {
					if (
						!option.label.trim() ||
						!option.value.trim() ||
						values.has(option.value)
					)
						add(
							"form",
							`${fieldPath}.options`,
							"Choices need a label and a unique, non-empty value.",
						);
					values.add(option.value);
				}
			}
			if (field.type === "repeatable") {
				if (!field.repeatableSchema?.length)
					add(
						"form",
						`${fieldPath}.repeatableSchema`,
						"Add at least one question to the repeatable group.",
					);
				checkFields(
					field.repeatableSchema ?? [],
					`${fieldPath}.repeatableSchema`,
					new Set(available),
				);
			}
			const validation = field.validation;
			if (
				validation?.min !== undefined &&
				validation.max !== undefined &&
				validation.min > validation.max
			)
				add(
					"form",
					`${fieldPath}.validation`,
					"Minimum must not exceed maximum.",
				);
			if (
				validation?.minLength !== undefined &&
				validation.maxLength !== undefined &&
				validation.minLength > validation.maxLength
			)
				add(
					"form",
					`${fieldPath}.validation`,
					"Minimum length must not exceed maximum length.",
				);
			if (validation?.pattern) {
				try {
					new RegExp(validation.pattern);
				} catch {
					add(
						"form",
						`${fieldPath}.validation.pattern`,
						"Enter a valid regular expression.",
					);
				}
			}
			available.add(field.key);
		});
	};

	if (!definition.publicDescription.trim())
		add("general", "publicDescription", "Add a public description.");
	if (!definition.applicationTypes.length)
		add("general", "applicationTypes", "Select at least one application type.");
	if (
		new Set(definition.applicationTypes).size !==
			definition.applicationTypes.length ||
		definition.applicationTypes.some((value) => !validKey(value))
	)
		add(
			"general",
			"applicationTypes",
			"Application types must have valid, unique keys.",
		);
	if (!definition.formSchema.length)
		add("form", "formSchema", "Add at least one form section.");
	uniqueKeys(definition.formSchema, "form", "formSchema");
	const available = new Set<string>();
	definition.formSchema.forEach((section, index) => {
		const path = `formSchema.${index}`;
		if (!section.title.trim())
			add("form", `${path}.title`, "Enter a section title.");
		if (!section.fields.length)
			add(
				"form",
				`${path}.fields`,
				"Add a question or remove the empty section.",
			);
		condition(
			section.conditionalOn,
			available,
			"form",
			`${path}.conditionalOn`,
		);
		checkFields(section.fields, `${path}.fields`, available);
	});
	uniqueKeys(
		definition.documentRequirements,
		"documents",
		"documentRequirements",
	);
	definition.documentRequirements.forEach((document, index) => {
		if (!document.label.trim())
			add(
				"documents",
				`documentRequirements.${index}.label`,
				"Enter a document label.",
			);
		if (
			document.acceptedMimeTypes &&
			(!document.acceptedMimeTypes.length ||
				document.acceptedMimeTypes.some(
					(mime) => !DOCUMENT_MIME_TYPES.includes(mime),
				))
		)
			add(
				"documents",
				`documentRequirements.${index}.acceptedMimeTypes`,
				"Select at least one supported file type.",
			);
		if ((document.maxSizeMb ?? 10) > uploadLimitMb)
			add(
				"documents",
				`documentRequirements.${index}.maxSizeMb`,
				`The platform upload limit is ${uploadLimitMb} MB.`,
			);
		condition(
			document.conditionalOn,
			available,
			"documents",
			`documentRequirements.${index}.conditionalOn`,
		);
	});
	uniqueKeys(definition.workflowDefinition, "workflow", "workflowDefinition");
	if (!definition.workflowDefinition.length)
		add("workflow", "workflowDefinition", "Add workflow stages.");
	if (definition.workflowDefinition.at(-1)?.type !== "decision")
		add(
			"workflow",
			"workflowDefinition",
			"End the workflow with a decision stage.",
		);
	definition.workflowDefinition.forEach((stage, index) => {
		if (!stage.label.trim())
			add(
				"workflow",
				`workflowDefinition.${index}.label`,
				"Enter a stage label.",
			);
		for (const transition of stage.autoTransitions ?? []) {
			if (
				!definition.workflowDefinition.some(
					(target) => target.key === transition.toStage,
				)
			)
				add(
					"workflow",
					`workflowDefinition.${index}.autoTransitions`,
					`Stage "${transition.toStage}" does not exist.`,
				);
		}
	});
	uniqueKeys(definition.reviewChecklist, "checklist", "reviewChecklist");
	definition.reviewChecklist.forEach((item, index) => {
		if (!item.label.trim())
			add(
				"checklist",
				`reviewChecklist.${index}.label`,
				"Enter a checklist label.",
			);
	});
	if (definition.paymentMode !== "NO_FEE") {
		for (const applicationType of definition.applicationTypes) {
			if (definition.feeSchedule[applicationType] === undefined)
				add(
					"fees",
					`feeSchedule.${applicationType}`,
					`Set a fee for ${applicationType} applications, including zero if applicable.`,
				);
		}
	}
	if (["API_INTEGRATION", "EXTERNAL_REDIRECT"].includes(definition.paymentMode))
		add(
			"fees",
			"paymentMode",
			"Online payment gateways are not implemented in this accelerator. Choose payment reference, receipt upload or no fee.",
		);
	if (
		definition.paymentMode === "RECEIPT_UPLOAD" &&
		!definition.documentRequirements.some(
			(document) =>
				["payment_receipt", "receipt"].includes(document.key) &&
				document.required &&
				!document.conditionalOn,
		)
	)
		add(
			"documents",
			"documentRequirements",
			"Receipt payments need an unconditional required document with key payment_receipt.",
		);
	for (const [applicationType, fee] of Object.entries(definition.feeSchedule)) {
		const amount = typeof fee === "number" ? fee : fee.baseAmount;
		if (
			definition.paymentMode === "NO_FEE" &&
			(amount > 0 ||
				(typeof fee !== "number" && fee.bands?.some((band) => band.amount > 0)))
		)
			add(
				"fees",
				`feeSchedule.${applicationType}`,
				"Choose a payment method or remove non-zero fees.",
			);
		if (typeof fee !== "number")
			fee.bands?.forEach((band, index) => {
				condition(
					band.condition,
					available,
					"fees",
					`feeSchedule.${applicationType}.bands.${index}`,
				);
			});
	}
	return issues;
}

export function createModuleDefinition(
	template: "blank" | "standard" | "inspection" = "blank",
): ModuleDefinition {
	return moduleDefinitionSchema.parse({
		formSchema:
			template === "blank"
				? []
				: [
						{
							key: "applicant",
							title: "Applicant details",
							fields: [
								{
									key: "full_name",
									label: "Full name",
									type: "text",
									required: true,
								},
								{
									key: "contact_email",
									label: "Email address",
									type: "email",
									required: true,
								},
								{ key: "contact_phone", label: "Phone number", type: "phone" },
							],
						},
						{
							key: "details",
							title: "Application details",
							fields: [
								{
									key: "description",
									label: "Describe your application",
									type: "textarea",
									required: true,
								},
							],
						},
						{
							key: "declaration",
							title: "Declaration",
							fields: [
								{
									key: "declaration",
									label:
										"I confirm that the information I have provided is accurate.",
									type: "checkbox",
									required: true,
								},
							],
						},
					],
		workflowDefinition: [
			{
				key: "validation",
				label: "Application validation",
				type: "validation",
				order: 1,
				slaBusinessDays: 5,
				visibleToApplicant: true,
			},
			...(template === "inspection"
				? [
						{
							key: "inspection",
							label: "Inspection",
							type: "inspection",
							order: 2,
							slaBusinessDays: 10,
							visibleToApplicant: true,
						},
					]
				: []),
			{
				key: "decision",
				label: "Decision",
				type: "decision",
				order: template === "inspection" ? 3 : 2,
				slaBusinessDays: 5,
				visibleToApplicant: true,
			},
		],
	});
}
