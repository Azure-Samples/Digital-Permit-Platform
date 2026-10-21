"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import type { ConditionalRule, FieldType, FormField } from "@/types/module";
import {
	duplicateSection,
	FIELD_TYPES,
	moveItem,
	nextKey,
	type BuilderCondition,
	type DefinitionIssue,
	type ModuleDefinition,
} from "@/lib/modules/definition";

export const BuilderErrors = createContext<DefinitionIssue[]>([]);
export const controlId = (path: string) =>
	`builder-${path.replaceAll(".", "-")}`;
export const FIELD_LABELS: Record<FieldType, string> = {
	text: "Short text",
	textarea: "Long text",
	number: "Number",
	currency: "Amount (GBP)",
	email: "Email address",
	phone: "Phone number",
	date: "Date",
	postcode: "Postcode",
	address: "Address",
	checkbox: "Confirmation checkbox",
	select: "Dropdown",
	radio: "Radio choices",
	repeatable: "Repeatable group",
	upload: "File upload (legacy)",
};

export function Input({
	path,
	label,
	value,
	onChange,
	multiline,
	type = "text",
	readOnly,
	list,
	min,
	max,
	step,
	placeholder,
}: {
	path: string;
	label: string;
	value: string | number;
	onChange: (value: string) => void;
	multiline?: boolean;
	type?: string;
	readOnly?: boolean;
	list?: string;
	min?: number;
	max?: number;
	step?: string;
	placeholder?: string;
}) {
	const errors = useContext(BuilderErrors).filter(
		(issue) => issue.path === path,
	);
	const id = controlId(path);
	const common = {
		id,
		value,
		readOnly,
		onChange: (
			event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
		) => onChange(event.target.value),
		"aria-invalid": errors.length > 0,
		"aria-describedby": errors.length ? `${id}-error` : undefined,
	};
	return (
		<div
			className={`govuk-form-group min-w-0 mb-4 ${errors.length ? "govuk-form-group--error" : ""}`}
		>
			<label className="govuk-label text-sm" htmlFor={id}>
				{label}
			</label>
			{errors.length > 0 && (
				<p className="govuk-error-message text-sm" id={`${id}-error`}>
					{errors[0].message}
				</p>
			)}
			{multiline ? (
				<textarea
					{...common}
					className="govuk-textarea w-full"
					rows={3}
					maxLength={10000}
				/>
			) : (
				<input
					{...common}
					className={`govuk-input w-full min-w-0 ${readOnly ? "bg-govuk-light-grey" : ""}`}
					type={type}
					list={list}
					min={min}
					max={max}
					step={step}
					placeholder={placeholder}
				/>
			)}
		</div>
	);
}

export function Select({
	path,
	label,
	value,
	onChange,
	children,
}: {
	path: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
}) {
	const errors = useContext(BuilderErrors).filter(
		(issue) => issue.path === path,
	);
	return (
		<div className="govuk-form-group min-w-0 mb-4">
			<label className="govuk-label text-sm" htmlFor={controlId(path)}>
				{label}
			</label>
			{errors.length > 0 && (
				<p
					className="govuk-error-message text-sm"
					id={`${controlId(path)}-error`}
				>
					{errors[0].message}
				</p>
			)}
			<select
				id={controlId(path)}
				className="govuk-select w-full min-w-0 max-w-full"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-invalid={errors.length > 0}
				aria-describedby={
					errors.length ? `${controlId(path)}-error` : undefined
				}
			>
				{children}
			</select>
		</div>
	);
}

export function Toggle({
	label,
	checked,
	onChange,
	disabled = false,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<label className="flex items-start gap-3 text-sm font-bold py-2 cursor-pointer">
			<input
				type="checkbox"
				className="h-5 w-5 shrink-0 mt-0.5"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span>{label}</span>
		</label>
	);
}

export function IconButton({
	label,
	onClick,
	disabled,
	children,
	danger,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-govuk-mid-grey hover:bg-govuk-light-grey focus:outline focus:outline-4 focus:outline-govuk-yellow disabled:opacity-40 disabled:cursor-not-allowed ${danger ? "text-govuk-red" : "text-govuk-blue"}`}
		>
			{children}
		</button>
	);
}

export function ItemActions({
	label,
	index,
	count,
	onMove,
	onRemove,
	onDuplicate,
}: {
	label: string;
	index: number;
	count: number;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
	onDuplicate?: () => void;
}) {
	return (
		<fieldset className="flex flex-wrap gap-1" aria-label={`${label} actions`}>
			<IconButton
				label={`Move ${label} up`}
				disabled={index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp size={16} />
			</IconButton>
			<IconButton
				label={`Move ${label} down`}
				disabled={index === count - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown size={16} />
			</IconButton>
			{onDuplicate && (
				<IconButton label={`Duplicate ${label}`} onClick={onDuplicate}>
					<Copy size={16} />
				</IconButton>
			)}
			<IconButton label={`Remove ${label}`} onClick={onRemove} danger>
				<Trash2 size={16} />
			</IconButton>
		</fieldset>
	);
}

export function ConditionEditor({
	value,
	onChange,
	fields,
	path,
}: {
	value?: ConditionalRule;
	onChange: (value: BuilderCondition | undefined) => void;
	fields: FormField[];
	path: string;
}) {
	const source = fields.find((field) => field.key === value?.field);
	const defaultValue = (field?: FormField) =>
		field?.type === "checkbox"
			? true
			: ["number", "currency"].includes(field?.type ?? "")
				? 0
				: (field?.options?.[0]?.value ?? "");
	const operators: [ConditionalRule["operator"], string][] = [
		["eq", "Equals"],
		["neq", "Does not equal"],
		["exists", "Has an answer"],
		["contains", "Contains"],
		["in", "Is one of"],
		["not_in", "Is not one of"],
		["gt", "Greater than"],
		["lt", "Less than"],
	];
	return (
		<fieldset
			id={controlId(path)}
			tabIndex={-1}
			className="min-w-0 border-l-4 border-govuk-mid-grey pl-4 mt-3"
		>
			<legend className="sr-only">Display condition</legend>
			<Toggle
				label="Only show when a condition is met"
				checked={!!value}
				onChange={(checked) =>
					onChange(
						checked
							? {
									field: fields[0]?.key ?? "",
									operator: "eq",
									value: defaultValue(fields[0]),
								}
							: undefined,
					)
				}
			/>
			{value && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 mt-2">
					<Select
						path={`${path}.field`}
						label="Question"
						value={value.field}
						onChange={(field) =>
							onChange({
								field,
								operator: "eq",
								value: defaultValue(fields.find((item) => item.key === field)),
							})
						}
					>
						<option value="">Select an earlier question</option>
						{value.field && !source && (
							<option value={value.field}>Unavailable: {value.field}</option>
						)}
						{fields
							.filter(
								(field) =>
									!["address", "repeatable", "upload"].includes(field.type),
							)
							.map((field, index) => (
								<option key={`${field.key}-${index}`} value={field.key}>
									{field.label || field.key}
								</option>
							))}
					</Select>
					<Select
						path={`${path}.operator`}
						label="Comparison"
						value={value.operator}
						onChange={(operator) =>
							onChange({
								...value,
								operator: operator as ConditionalRule["operator"],
								value: ["in", "not_in"].includes(operator)
									? []
									: ["gt", "lt"].includes(operator)
										? 0
										: operator === "exists"
											? true
											: defaultValue(source),
							})
						}
					>
						{operators.map(([operator, label]) => (
							<option key={operator} value={operator}>
								{label}
							</option>
						))}
					</Select>
					{value.operator !== "exists" &&
						(["in", "not_in"].includes(value.operator) ? (
							<Input
								path={`${path}.value`}
								label="Accepted values (one per line)"
								multiline
								value={Array.isArray(value.value) ? value.value.join("\n") : ""}
								onChange={(text) =>
									onChange({
										...value,
										value: text
											.split("\n")
											.filter(Boolean)
											.map((item) =>
												["number", "currency"].includes(source?.type ?? "")
													? Number(item)
													: source?.type === "checkbox"
														? item === "true"
														: item,
											),
									})
								}
							/>
						) : source?.options?.length &&
							["eq", "neq"].includes(value.operator) ? (
							<Select
								path={`${path}.value`}
								label="Answer"
								value={String(value.value ?? "")}
								onChange={(answer) => onChange({ ...value, value: answer })}
							>
								{source.options.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>
						) : source?.type === "checkbox" ? (
							<Select
								path={`${path}.value`}
								label="Answer"
								value={String(value.value)}
								onChange={(answer) =>
									onChange({ ...value, value: answer === "true" })
								}
							>
								<option value="true">Checked</option>
								<option value="false">Not checked</option>
							</Select>
						) : (
							<Input
								path={`${path}.value`}
								label="Value"
								type={
									["gt", "lt"].includes(value.operator) ||
									["number", "currency"].includes(source?.type ?? "")
										? "number"
										: "text"
								}
								value={String(value.value ?? "")}
								onChange={(answer) =>
									onChange({
										...value,
										value:
											["gt", "lt"].includes(value.operator) ||
											["number", "currency"].includes(source?.type ?? "")
												? Number(answer)
												: answer,
									})
								}
							/>
						))}
				</div>
			)}
		</fieldset>
	);
}

function QuestionEditor({
	field,
	path,
	available,
	onChange,
	confirm,
	depth = 0,
}: {
	field: FormField;
	path: string;
	available: FormField[];
	onChange: (field: FormField) => void;
	confirm: (title: string, action: () => void) => void;
	depth?: number;
}) {
	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-4">
				<Input
					path={`${path}.label`}
					label="Question label"
					value={field.label}
					onChange={(label) => onChange({ ...field, label })}
				/>
				<Select
					path={`${path}.type`}
					label="Answer type"
					value={field.type}
					onChange={(type) =>
						onChange({
							...field,
							type: type as FieldType,
							...(type === "select" || type === "radio"
								? {
										options: field.options?.length
											? field.options
											: [
													{ label: "Yes", value: "yes" },
													{ label: "No", value: "no" },
												],
									}
								: {}),
							...(type === "repeatable"
								? {
										repeatableSchema: field.repeatableSchema ?? [
											{
												key: "name",
												label: "Name",
												type: "text",
												required: true,
											},
										],
										maxRepeats: field.maxRepeats ?? 10,
									}
								: {}),
						})
					}
				>
					{FIELD_TYPES.map((type) => (
						<option
							key={type}
							value={type}
							disabled={
								type === "upload" || (type === "repeatable" && depth >= 2)
							}
						>
							{FIELD_LABELS[type]}
						</option>
					))}
				</Select>
			</div>
			<Toggle
				label="Answer required"
				checked={field.required ?? false}
				onChange={(required) => onChange({ ...field, required })}
			/>
			<Input
				path={`${path}.hint`}
				label="Help for this question"
				value={field.hint ?? ""}
				onChange={(hint) => onChange({ ...field, hint })}
			/>
			{["select", "radio"].includes(field.type) && (
				<fieldset className="border-t border-govuk-mid-grey pt-3 mt-2 min-w-0">
					<legend className="text-sm font-bold pr-2">Answer choices</legend>
					{(field.options ?? []).map((option, index) => (
						<div
							key={index}
							className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-start"
						>
							<Input
								path={`${path}.options.${index}.label`}
								label={`Choice ${index + 1}`}
								value={option.label}
								onChange={(label) =>
									onChange({
										...field,
										options: field.options?.map((item, optionIndex) =>
											optionIndex === index ? { ...item, label } : item,
										),
									})
								}
							/>
							<Input
								path={`${path}.options.${index}.value`}
								label="Stored value"
								value={option.value}
								onChange={(value) =>
									onChange({
										...field,
										options: field.options?.map((item, optionIndex) =>
											optionIndex === index ? { ...item, value } : item,
										),
									})
								}
							/>
							<div className="pt-7">
								<IconButton
									label={`Remove choice ${index + 1}`}
									onClick={() =>
										onChange({
											...field,
											options: field.options?.filter(
												(_, optionIndex) => optionIndex !== index,
											),
										})
									}
									danger
								>
									<Trash2 size={16} />
								</IconButton>
							</div>
						</div>
					))}
					<button
						type="button"
						className="govuk-button govuk-button--secondary inline-flex items-center gap-2 text-sm"
						onClick={() =>
							onChange({
								...field,
								options: [
									...(field.options ?? []),
									{
										label: "",
										value: nextKey(
											"option",
											(field.options ?? []).map((option) => option.value),
										),
									},
								],
							})
						}
					>
						<Plus size={16} />
						Add choice
					</button>
				</fieldset>
			)}
			<details className="mt-3 border-t border-govuk-mid-grey pt-3">
				<summary className="cursor-pointer text-sm font-bold text-govuk-blue">
					Identifier and validation
				</summary>
				<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
					<Input
						path={`${path}.key`}
						label="Question key"
						value={field.key}
						onChange={(key) => onChange({ ...field, key })}
					/>
					<Input
						path={`${path}.placeholder`}
						label="Placeholder"
						value={field.placeholder ?? ""}
						onChange={(placeholder) => onChange({ ...field, placeholder })}
					/>
					{(["number", "currency"].includes(field.type)
						? ["min", "max"]
						: ["text", "textarea", "email", "phone", "postcode"].includes(
									field.type,
								)
							? ["minLength", "maxLength"]
							: []
					).map((constraint) => (
						<Input
							key={constraint}
							path={`${path}.validation.${constraint}`}
							label={
								{
									min: "Minimum value",
									max: "Maximum value",
									minLength: "Minimum characters",
									maxLength: "Maximum characters",
								}[constraint] ?? constraint
							}
							type="number"
							value={
								field.validation?.[
									constraint as keyof NonNullable<FormField["validation"]>
								] ?? ""
							}
							min={constraint.endsWith("Length") ? 0 : undefined}
							onChange={(value) =>
								onChange({
									...field,
									validation: {
										...field.validation,
										[constraint]: value === "" ? undefined : Number(value),
									},
								})
							}
						/>
					))}
				</div>
			</details>
			<details
				className="mt-3 border-t border-govuk-mid-grey pt-3"
				open={field.conditionalOn ? true : undefined}
			>
				<summary className="cursor-pointer text-sm font-bold text-govuk-blue">
					Display condition{field.conditionalOn ? " (configured)" : ""}
				</summary>
				<ConditionEditor
					path={`${path}.conditionalOn`}
					fields={available}
					value={field.conditionalOn}
					onChange={(conditionalOn) => onChange({ ...field, conditionalOn })}
				/>
			</details>
			{field.type === "repeatable" && (
				<div className="mt-5 border-l-4 border-govuk-blue pl-3 sm:pl-5">
					<Input
						path={`${path}.maxRepeats`}
						label="Maximum entries"
						type="number"
						min={1}
						max={100}
						value={field.maxRepeats ?? 10}
						onChange={(value) =>
							onChange({
								...field,
								maxRepeats: value ? Number(value) : undefined,
							})
						}
					/>
					<QuestionList
						fields={field.repeatableSchema ?? []}
						path={`${path}.repeatableSchema`}
						available={available}
						allKeys={field.repeatableSchema?.map((item) => item.key) ?? []}
						onChange={(repeatableSchema) =>
							onChange({ ...field, repeatableSchema })
						}
						confirm={confirm}
						depth={depth + 1}
					/>
				</div>
			)}
		</>
	);
}

function QuestionList({
	fields,
	path,
	available,
	allKeys,
	onChange,
	confirm,
	depth = 0,
}: {
	fields: FormField[];
	path: string;
	available: FormField[];
	allKeys: string[];
	onChange: (fields: FormField[]) => void;
	confirm: (title: string, action: () => void) => void;
	depth?: number;
}) {
	return (
		<div className="space-y-4">
			{fields.map((field, index) => (
				<div
					key={index}
					className="border border-govuk-mid-grey rounded p-4 min-w-0 bg-white"
				>
					<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
						<span className="text-xs font-bold text-govuk-dark-grey">
							QUESTION {index + 1}
						</span>
						<ItemActions
							label={field.label || `question ${index + 1}`}
							index={index}
							count={fields.length}
							onMove={(direction) =>
								onChange(moveItem(fields, index, direction))
							}
							onRemove={() =>
								confirm(`Remove ${field.label || "this question"}?`, () =>
									onChange(
										fields.filter((_, fieldIndex) => fieldIndex !== index),
									),
								)
							}
							onDuplicate={() => {
								const copy = structuredClone(field);
								copy.key = nextKey("question", allKeys);
								copy.label = `${copy.label} (copy)`;
								onChange([
									...fields.slice(0, index + 1),
									copy,
									...fields.slice(index + 1),
								]);
							}}
						/>
					</div>
					<QuestionEditor
						field={field}
						path={`${path}.${index}`}
						available={[...available, ...fields.slice(0, index)]}
						onChange={(updated) =>
							onChange(
								fields.map((item, fieldIndex) =>
									fieldIndex === index ? updated : item,
								),
							)
						}
						confirm={confirm}
						depth={depth}
					/>
				</div>
			))}
			<button
				type="button"
				className="govuk-button govuk-button--secondary inline-flex items-center gap-2 text-sm"
				onClick={() =>
					onChange([
						...fields,
						{
							key: nextKey("question", allKeys),
							label: "",
							type: "text",
							required: false,
						},
					])
				}
			>
				<Plus size={16} />
				{depth ? "Add group question" : "Add question"}
			</button>
		</div>
	);
}

export function FormEditor({
	definition,
	onChange,
	confirm,
}: {
	definition: ModuleDefinition;
	onChange: (definition: ModuleDefinition) => void;
	confirm: (title: string, action: () => void) => void;
}) {
	const sections = definition.formSchema;
	const allKeys = sections.flatMap((section) =>
		section.fields.map((field) => field.key),
	);
	function updateSection(
		index: number,
		update: Partial<ModuleDefinition["formSchema"][number]>,
	) {
		onChange({
			...definition,
			formSchema: sections.map((section, sectionIndex) =>
				sectionIndex === index ? { ...section, ...update } : section,
			),
		});
	}
	return (
		<div>
			<div className="flex flex-wrap items-center justify-between gap-3 mb-5">
				<h2 className="text-2xl m-0">Application form</h2>
				<span className="text-sm text-govuk-dark-grey">
					{sections.length} sections · {allKeys.length} questions
				</span>
			</div>
			{!sections.length && (
				<p className="border-l-4 border-govuk-mid-grey pl-4 py-4">
					No form sections yet.
				</p>
			)}
			{sections.map((section, index) => (
				<section
					key={index}
					aria-label={`Section ${index + 1}: ${section.title}`}
					className="border-b-2 border-govuk-mid-grey pb-6 mb-6 min-w-0"
				>
					<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
						<h3 className="text-lg m-0">Section {index + 1}</h3>
						<ItemActions
							label={section.title || `section ${index + 1}`}
							index={index}
							count={sections.length}
							onMove={(direction) =>
								onChange({
									...definition,
									formSchema: moveItem(sections, index, direction),
								})
							}
							onRemove={() =>
								confirm(
									`Remove ${section.title || "this section"} and its ${section.fields.length} questions?`,
									() =>
										onChange({
											...definition,
											formSchema: sections.filter(
												(_, sectionIndex) => sectionIndex !== index,
											),
										}),
								)
							}
							onDuplicate={() => onChange(duplicateSection(definition, index))}
						/>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
						<Input
							path={`formSchema.${index}.title`}
							label="Section title"
							value={section.title}
							onChange={(title) => updateSection(index, { title })}
						/>
						<Input
							path={`formSchema.${index}.key`}
							label="Section key"
							value={section.key}
							onChange={(key) => updateSection(index, { key })}
						/>
					</div>
					<Input
						path={`formSchema.${index}.description`}
						label="Section guidance"
						value={section.description ?? ""}
						onChange={(description) => updateSection(index, { description })}
						multiline
					/>
					<details
						className="mb-5"
						open={section.conditionalOn ? true : undefined}
					>
						<summary className="text-sm font-bold text-govuk-blue cursor-pointer">
							Section condition{section.conditionalOn ? " (configured)" : ""}
						</summary>
						<ConditionEditor
							path={`formSchema.${index}.conditionalOn`}
							fields={sections.slice(0, index).flatMap((item) => item.fields)}
							value={section.conditionalOn}
							onChange={(conditionalOn) =>
								updateSection(index, { conditionalOn })
							}
						/>
					</details>
					<QuestionList
						fields={section.fields}
						path={`formSchema.${index}.fields`}
						available={sections.slice(0, index).flatMap((item) => item.fields)}
						allKeys={allKeys}
						onChange={(fields) => updateSection(index, { fields })}
						confirm={confirm}
					/>
				</section>
			))}
			<button
				type="button"
				className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
				onClick={() =>
					onChange({
						...definition,
						formSchema: [
							...sections,
							{
								key: nextKey(
									"section",
									sections.map((section) => section.key),
								),
								title: "",
								fields: [],
							},
						],
					})
				}
			>
				<Plus size={18} />
				Add section
			</button>
		</div>
	);
}
