"use client";

import { useState } from "react";
import { CheckCircle2, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { DynamicForm } from "@/components/forms/dynamic-form";
import { evaluateCondition } from "@/lib/conditions";
import type { ModuleDefinition } from "@/lib/modules/definition";
import { IconButton, Input, Select } from "./module-builder-fields";

type PreviewStep =
	| "overview"
	| "form"
	| "documents"
	| "payment"
	| "review"
	| "complete";
type Answers = Record<string, Record<string, unknown>>;
const money = (amount: number) =>
	new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
		amount,
	);

export function ModulePreview({
	definition,
	displayName,
}: {
	definition: ModuleDefinition;
	displayName: string;
}) {
	const [mobile, setMobile] = useState(false);
	const [state, setState] = useState({
		step: "overview" as PreviewStep,
		sectionKey: "",
		answers: {} as Answers,
	});
	const [applicationType, setApplicationType] = useState(
		definition.applicationTypes[0] ?? "new",
	);
	const [documents, setDocuments] = useState<Record<string, string>>({});
	const [paymentReference, setPaymentReference] = useState("");
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);
	const flat = Object.assign({}, ...Object.values(state.answers)) as Record<
		string,
		unknown
	>;
	const visibleSections = (answers: Answers) => {
		const values = Object.assign({}, ...Object.values(answers)) as Record<
			string,
			unknown
		>;
		return definition.formSchema.filter(
			(section) =>
				!section.conditionalOn ||
				evaluateCondition(section.conditionalOn, values),
		);
	};
	const sections = visibleSections(state.answers);
	const sectionIndex = Math.max(
		0,
		sections.findIndex((section) => section.key === state.sectionKey),
	);
	const requiredDocuments = definition.documentRequirements.filter(
		(document) =>
			!document.conditionalOn ||
			evaluateCondition(document.conditionalOn, flat),
	);
	const configuredFee = definition.feeSchedule[applicationType];
	const amount =
		definition.paymentMode === "NO_FEE"
			? 0
			: typeof configuredFee === "number"
				? configuredFee
				: (configuredFee?.baseAmount ?? 0);

	function reset() {
		setState({ step: "overview", sectionKey: "", answers: {} });
		setDocuments({});
		setPaymentReference("");
		setError("");
		setSaved(false);
	}

	function advanceSection(direction: -1 | 1) {
		setSaved(false);
		setState((current) => {
			const visible = visibleSections(current.answers);
			const index = Math.max(
				0,
				visible.findIndex((section) => section.key === current.sectionKey),
			);
			const next = visible[index + direction];
			return {
				...current,
				step: next ? "form" : direction > 0 ? "documents" : "overview",
				sectionKey: next?.key ?? current.sectionKey,
			};
		});
	}

	return (
		<section aria-label="Applicant preview">
			<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
				<h2 className="text-2xl m-0">Applicant preview</h2>
				<div className="flex gap-2">
					<IconButton
						label="Desktop preview"
						onClick={() => setMobile(false)}
						disabled={!mobile}
					>
						<Monitor size={18} />
					</IconButton>
					<IconButton
						label="Mobile preview"
						onClick={() => setMobile(true)}
						disabled={mobile}
					>
						<Smartphone size={18} />
					</IconButton>
					<IconButton label="Restart preview" onClick={reset}>
						<RotateCcw size={18} />
					</IconButton>
				</div>
			</div>
			<p className="text-sm border-l-4 border-govuk-blue pl-3 py-2 mb-5">
				Preview only. No application, payment or document will be submitted.
			</p>
			<div
				className={`border border-govuk-mid-grey bg-white mx-auto w-full min-w-0 ${mobile ? "max-w-[390px]" : ""}`}
			>
				<div className="bg-govuk-light-grey border-b border-govuk-mid-grey px-4 py-3 text-sm font-bold break-words">
					{displayName || "Untitled module"}
				</div>
				<div className="p-4 sm:p-5 min-w-0">
					{error && (
						<p className="govuk-error-message" role="alert">
							{error}
						</p>
					)}
					{state.step === "overview" && (
						<>
							<h3 className="text-xl">{displayName || "Untitled module"}</h3>
							<p className="whitespace-pre-line break-words">
								{definition.publicDescription || "No description yet."}
							</p>
							{definition.beforeYouStartText && (
								<>
									<h4 className="text-lg font-bold mt-5">Before you start</h4>
									<p className="whitespace-pre-line break-words">
										{definition.beforeYouStartText}
									</p>
								</>
							)}
							{definition.helpText && (
								<p className="whitespace-pre-line break-words text-sm">
									{definition.helpText}
								</p>
							)}
							<Select
								path="preview.applicationType"
								label="Application type"
								value={applicationType}
								onChange={setApplicationType}
							>
								{definition.applicationTypes.map((type) => (
									<option key={type} value={type}>
										{type.replaceAll("_", " ")}
									</option>
								))}
							</Select>
							<p className="font-bold">Application fee: {money(amount)}</p>
							<button
								type="button"
								className="govuk-button"
								disabled={!sections.length}
								onClick={() =>
									setState({
										...state,
										step: "form",
										sectionKey: sections[0]?.key ?? "",
									})
								}
							>
								Start preview
							</button>
							{!sections.length && (
								<p role="status" className="text-sm">
									No visible form sections.
								</p>
							)}
						</>
					)}
					{state.step === "form" && (
						<>
							<p className="text-sm text-govuk-dark-grey">
								Section {sectionIndex + 1} of {sections.length}
							</p>
							{saved && (
								<p role="status" className="text-sm text-govuk-green">
									Preview answers saved.
								</p>
							)}
							<DynamicForm
								sections={sections}
								currentSectionIndex={sectionIndex}
								answers={state.answers}
								onSave={(sectionKey, answers) => {
									setState((current) => ({
										...current,
										answers: { ...current.answers, [sectionKey]: answers },
									}));
									setSaved(true);
									return true;
								}}
								onNext={() => advanceSection(1)}
								onPrevious={() => advanceSection(-1)}
								isFirstSection={sectionIndex === 0}
								isLastSection={sectionIndex === sections.length - 1}
							/>
						</>
					)}
					{state.step === "documents" && (
						<>
							<h3 className="text-xl">Supporting documents</h3>
							{!requiredDocuments.length && <p>No documents required.</p>}
							{requiredDocuments.map((document, index) => (
								<div key={document.key} className="govuk-form-group">
									<label
										htmlFor={`preview-document-${index}`}
										className="govuk-label"
									>
										{document.label}
										{document.required ? " (required)" : " (optional)"}
									</label>
									{document.description && (
										<p className="govuk-hint">{document.description}</p>
									)}
									<p className="text-xs text-govuk-dark-grey">
										Maximum {document.maxSizeMb ?? 10} MB
									</p>
									<input
										type="file"
										id={`preview-document-${index}`}
										className="block w-full min-w-0 text-sm"
										accept={document.acceptedMimeTypes?.join(",")}
										onChange={(event) => {
											const file = event.target.files?.[0];
											if (!file) return;
											if (
												file.size > (document.maxSizeMb ?? 10) * 1024 * 1024 ||
												(document.acceptedMimeTypes?.length &&
													!document.acceptedMimeTypes.includes(file.type))
											) {
												setError(
													`Choose an accepted file up to ${document.maxSizeMb ?? 10} MB for ${document.label}.`,
												);
												setDocuments((current) => {
													const next = { ...current };
													delete next[document.key];
													return next;
												});
												event.target.value = "";
											} else {
												setDocuments((current) => ({
													...current,
													[document.key]: file.name,
												}));
												setError("");
											}
										}}
									/>
									{documents[document.key] && (
										<p className="text-sm break-all">
											Selected: {documents[document.key]}
										</p>
									)}
								</div>
							))}
							<div className="flex flex-wrap gap-3">
								<button
									type="button"
									className="govuk-button govuk-button--secondary"
									onClick={() =>
										setState({
											...state,
											step: "form",
											sectionKey: sections.at(-1)?.key ?? "",
										})
									}
								>
									Previous
								</button>
								<button
									type="button"
									className="govuk-button"
									onClick={() => {
										if (
											requiredDocuments.some(
												(document) =>
													document.required && !documents[document.key],
											)
										)
											setError(
												"Select all required documents before continuing.",
											);
										else {
											setError("");
											setState({ ...state, step: "payment" });
										}
									}}
								>
									Continue to payment
								</button>
							</div>
						</>
					)}
					{state.step === "payment" && (
						<>
							<h3 className="text-xl">Payment</h3>
							<p className="font-bold">Fee: {money(amount)}</p>
							{definition.paymentMode === "NO_FEE" ? (
								<p>No payment is required.</p>
							) : (
								<Input
									path="preview.paymentReference"
									label="Payment reference (preview)"
									value={paymentReference}
									onChange={setPaymentReference}
								/>
							)}
							<div className="flex flex-wrap gap-3">
								<button
									type="button"
									className="govuk-button govuk-button--secondary"
									onClick={() => setState({ ...state, step: "documents" })}
								>
									Previous
								</button>
								<button
									type="button"
									className="govuk-button"
									onClick={() => {
										if (
											definition.paymentMode !== "NO_FEE" &&
											!paymentReference.trim()
										)
											setError("Enter a preview payment reference.");
										else {
											setError("");
											setState({ ...state, step: "review" });
										}
									}}
								>
									Review answers
								</button>
							</div>
						</>
					)}
					{state.step === "review" && (
						<>
							<h3 className="text-xl">Check your answers</h3>
							{sections.map((section) => (
								<section key={section.key} className="mb-5">
									<h4 className="font-bold text-base">{section.title}</h4>
									<dl>
										{section.fields
											.filter(
												(field) =>
													!field.conditionalOn ||
													evaluateCondition(field.conditionalOn, flat),
											)
											.map((field) => {
												const value = state.answers[section.key]?.[field.key];
												return (
													<div
														key={field.key}
														className="border-b border-govuk-mid-grey py-2"
													>
														<dt className="text-sm font-bold">{field.label}</dt>
														<dd className="text-sm whitespace-pre-line break-words">
															{typeof value === "boolean"
																? value
																	? "Yes"
																	: "No"
																: value === undefined || value === ""
																	? "Not provided"
																	: typeof value === "object"
																		? JSON.stringify(value, null, 2)
																		: String(value)}
														</dd>
													</div>
												);
											})}
									</dl>
								</section>
							))}
							<p>Fee: {money(amount)}</p>
							<div className="flex flex-wrap gap-3">
								<button
									type="button"
									className="govuk-button govuk-button--secondary"
									onClick={() =>
										setState({
											...state,
											step: "form",
											sectionKey: sections[0]?.key ?? "",
										})
									}
								>
									Change answers
								</button>
								<button
									type="button"
									className="govuk-button"
									onClick={() => setState({ ...state, step: "complete" })}
								>
									Finish preview
								</button>
							</div>
						</>
					)}
					{state.step === "complete" && (
						<div role="status">
							<CheckCircle2 className="text-govuk-green mb-3" size={32} />
							<h3 className="text-xl">Preview complete</h3>
							<p>No application has been created.</p>
							<button
								type="button"
								className="govuk-button govuk-button--secondary"
								onClick={reset}
							>
								Start again
							</button>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
