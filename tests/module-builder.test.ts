import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAnswers } from "../src/lib/api/validate";
import {
	createModuleDefinition,
	duplicateSection,
	getModuleReadiness,
	moduleDefinitionSchema,
	moduleIdentitySchema,
	moveItem,
	nextKey,
	normaliseModuleKey,
} from "../src/lib/modules/definition";

function readyDefinition() {
	return {
		...createModuleDefinition("standard"),
		publicDescription: "Apply for a local permit.",
	};
}

describe("module builder definitions", () => {
	it("creates a closed, unpublished draft and allows incomplete work to be saved", () => {
		const definition = createModuleDefinition();
		assert.equal(definition.visibility, "DRAFT");
		assert.equal(definition.acceptingApplications, false);
		assert.equal(moduleDefinitionSchema.safeParse(definition).success, true);
		assert.ok(
			getModuleReadiness(definition).some((issue) => issue.area === "form"),
		);
	});

	it("provides valid standard and inspection starters without inventing licence requirements", () => {
		for (const template of ["standard", "inspection"] as const) {
			const definition = {
				...createModuleDefinition(template),
				publicDescription: "Permit application.",
			};
			assert.deepEqual(getModuleReadiness(definition), []);
			assert.deepEqual(definition.documentRequirements, []);
		}
	});

	it("normalises keys, reserves the new route and avoids collisions after deletion", () => {
		assert.equal(
			normaliseModuleKey(" Market-Operator Permit! "),
			"market_operator_permit",
		);
		assert.equal(
			moduleIdentitySchema.safeParse({
				moduleKey: "new",
				displayName: "Permit",
				category: "Permits",
			}).success,
			false,
		);
		assert.equal(nextKey("field", ["field_1", "field_3"]), "field_2");
	});

	it("blocks duplicate question keys across sections and missing choice options", () => {
		const definition = readyDefinition();
		definition.formSchema[1].fields.push({
			key: "full_name",
			label: "Route",
			type: "select",
		});
		const issues = getModuleReadiness(definition);
		assert.ok(issues.some((issue) => issue.message.includes("unique")));
		assert.ok(issues.some((issue) => issue.message.includes("choices")));
	});

	it("rejects forward, missing and self-referencing conditions", () => {
		for (const field of ["full_name", "description", "missing"]) {
			const definition = readyDefinition();
			definition.formSchema[0].fields[0].conditionalOn = {
				field,
				operator: "eq",
				value: "yes",
			};
			assert.ok(
				getModuleReadiness(definition).some((issue) =>
					issue.path.endsWith("conditionalOn"),
				),
			);
		}
	});

	it("accepts conditions referring to earlier questions and requires typed comparison values", () => {
		const definition = readyDefinition();
		definition.formSchema[1].conditionalOn = {
			field: "full_name",
			operator: "exists",
			value: true,
		};
		assert.deepEqual(getModuleReadiness(definition), []);
		definition.formSchema[1].conditionalOn = {
			field: "full_name",
			operator: "gt",
			value: "10",
		};
		assert.ok(
			getModuleReadiness(definition).some((issue) =>
				issue.message.includes("numeric"),
			),
		);
	});

	it("requires a decision stage and rejects broken transition targets", () => {
		const definition = readyDefinition();
		definition.workflowDefinition.pop();
		definition.workflowDefinition[0].autoTransitions = [
			{ condition: "complete", toStage: "missing" },
		];
		assert.equal(
			getModuleReadiness(definition).filter(
				(issue) => issue.area === "workflow",
			).length,
			2,
		);
	});

	it("requires fees for each selected application type and rejects negative amounts", () => {
		const definition = readyDefinition();
		definition.paymentMode = "MANUAL_REFERENCE";
		definition.applicationTypes = ["new", "renewal"];
		definition.feeSchedule = { new: 50 };
		assert.ok(
			getModuleReadiness(definition).some(
				(issue) => issue.path === "feeSchedule.renewal",
			),
		);
		assert.equal(
			moduleDefinitionSchema.safeParse({
				...definition,
				feeSchedule: { new: -1 },
			}).success,
			false,
		);
		definition.feeSchedule.renewal = 0;
		assert.deepEqual(getModuleReadiness(definition), []);
		definition.paymentMode = "NO_FEE";
		assert.ok(
			getModuleReadiness(definition).some((issue) => issue.area === "fees"),
		);
	});

	it("bounds configuration size, nested groups and validation ranges", () => {
		assert.equal(
			moduleDefinitionSchema.safeParse({
				formSchema: Array(41).fill({ key: "test", title: "Test", fields: [] }),
			}).success,
			false,
		);
		const definition = readyDefinition();
		definition.formSchema[0].fields[0].validation = {
			minLength: 10,
			maxLength: 2,
			pattern: "[",
		};
		assert.equal(
			getModuleReadiness(definition).filter((issue) =>
				issue.path.includes("validation"),
			).length,
			2,
		);
	});

	it("duplicates sections without duplicate keys or broken internal conditions", () => {
		const definition = readyDefinition();
		definition.formSchema[0].fields[1].conditionalOn = {
			field: "full_name",
			operator: "exists",
			value: true,
		};
		const copy = duplicateSection(definition, 0);
		assert.equal(copy.formSchema.length, 4);
		assert.equal(definition.formSchema.length, 3);
		assert.deepEqual(getModuleReadiness(copy), []);
		assert.equal(
			copy.formSchema[1].fields[1].conditionalOn?.field,
			copy.formSchema[1].fields[0].key,
		);
	});

	it("moves items without mutating history or wrapping at the ends", () => {
		const items = ["first", "second", "third"];
		assert.deepEqual(moveItem(items, 1, -1), ["second", "first", "third"]);
		assert.deepEqual(moveItem(items, 0, -1), items);
		assert.deepEqual(moveItem(items, 2, 1), items);
		assert.deepEqual(items, ["first", "second", "third"]);
	});

	it("validates builder question types as applicants will answer them", () => {
		const sections = [
			{
				key: "details",
				title: "Details",
				fields: [
					{
						key: "count",
						label: "Count",
						type: "number" as const,
						required: true,
						validation: { min: 0, max: 10 },
					},
					{
						key: "confirm",
						label: "Confirmation",
						type: "checkbox" as const,
						required: true,
					},
					{
						key: "address",
						label: "Address",
						type: "address" as const,
						required: true,
					},
					{
						key: "people",
						label: "People",
						type: "repeatable" as const,
						required: true,
						repeatableSchema: [
							{
								key: "name",
								label: "Name",
								type: "text" as const,
								required: true,
							},
						],
					},
				],
			},
		];
		const answers = {
			details: {
				count: 0,
				confirm: true,
				address: {
					line1: "1 Test Road",
					town: "Test town",
					postcode: "AB1 2CD",
				},
				people: [{ name: "Test Person" }],
			},
		};
		assert.equal(validateAnswers(sections, answers).ok, true);
		assert.equal(
			validateAnswers(sections, {
				details: { ...answers.details, confirm: false, people: [{}] },
			}).errors.length,
			2,
		);
		assert.equal(
			validateAnswers(sections, { details: { ...answers.details, count: 11 } })
				.ok,
			false,
		);
	});

	it("blocks unsupported gateways and requires evidence for receipt payments", () => {
		const definition = readyDefinition();
		definition.feeSchedule = { new: 20 };
		definition.paymentMode = "EXTERNAL_REDIRECT";
		assert.ok(
			getModuleReadiness(definition).some(
				(issue) => issue.path === "paymentMode",
			),
		);
		definition.paymentMode = "RECEIPT_UPLOAD";
		assert.ok(
			getModuleReadiness(definition).some(
				(issue) => issue.path === "documentRequirements",
			),
		);
		definition.documentRequirements = [
			{
				key: "payment_receipt",
				label: "Receipt",
				required: true,
				verificationStatus: "verified_policy",
				acceptedMimeTypes: ["application/pdf"],
				maxSizeMb: 5,
			},
		];
		assert.deepEqual(getModuleReadiness(definition), []);
		assert.ok(
			getModuleReadiness(definition, 2).some((issue) =>
				issue.path.endsWith("maxSizeMb"),
			),
		);
		definition.documentRequirements[0].acceptedMimeTypes = [];
		assert.ok(
			getModuleReadiness(definition).some((issue) =>
				issue.path.endsWith("acceptedMimeTypes"),
			),
		);
	});
});
