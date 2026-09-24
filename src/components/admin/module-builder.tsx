"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { z } from "zod";
import {
	ArrowRight,
	CheckCircle2,
	ClipboardCheck,
	Download,
	Eye,
	FileText,
	GitBranch,
	History,
	ListChecks,
	Plus,
	PoundSterling,
	Redo2,
	Save,
	Settings2,
	Undo2,
	Upload,
} from "lucide-react";
import type { DocumentRequirement, WorkflowStage } from "@/types/module";
import {
	APPLICATION_TYPES,
	createModuleDefinition,
	getModuleReadiness,
	moduleDefinitionSchema,
	moduleIdentitySchema,
	moveItem,
	nextKey,
	normaliseModuleKey,
	PAYMENT_MODES,
	type BuilderArea,
	type DefinitionIssue,
	type ModuleDefinition,
} from "@/lib/modules/definition";
import {
	BuilderErrors,
	ConditionEditor,
	controlId,
	FormEditor,
	IconButton,
	Input,
	ItemActions,
	Select,
	Toggle,
} from "./module-builder-fields";
import { ModulePreview } from "./module-preview";

const TABS = [
	{ key: "general", label: "Details", icon: Settings2 },
	{ key: "form", label: "Form", icon: ListChecks },
	{ key: "documents", label: "Documents", icon: FileText },
	{ key: "workflow", label: "Workflow", icon: GitBranch },
	{ key: "checklist", label: "Checklist", icon: ClipboardCheck },
	{ key: "fees", label: "Fees", icon: PoundSterling },
	{ key: "preview", label: "Preview", icon: Eye },
	{ key: "review", label: "Review & publish", icon: CheckCircle2 },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Draft = {
	moduleKey: string;
	displayName: string;
	category: string;
	definition: ModuleDefinition;
};
type VersionSummary = {
	id: string;
	version: number;
	visibility: string;
	isActive: boolean;
	createdAt: string;
};
type LiveVersion = {
	id: string;
	version: number;
	visibility: string;
	acceptingApplications: boolean;
};

export interface ModuleBuilderProps {
	userId: string;
	options: {
		categories: string[];
		teams: { id: string; name: string }[];
		modules: {
			id: string;
			moduleKey: string;
			displayName: string;
			category: string;
		}[];
		uploadLimitMb?: number;
	};
	initial?: Draft & {
		moduleId: string;
		enabled: boolean;
		versionId: string;
		versionNumber: number;
		liveVersion: LiveVersion | null;
		history: VersionSummary[];
	};
	initialTab?: string;
	notice?: string;
}

const draftSchema = z.object({
	moduleKey: z.string().max(64),
	displayName: z.string().max(120),
	category: z.string().max(80),
	definition: moduleDefinitionSchema,
});
const packageSchema = z.object({
	schemaVersion: z.literal(1),
	module: draftSchema.omit({ definition: true }),
	definition: moduleDefinitionSchema,
});
const recoverySchema = z.object({
	schemaVersion: z.literal(1),
	baseVersionId: z.string().nullable(),
	savedAt: z.string(),
	draft: draftSchema,
});
const FILE_TYPES = [
	{ label: "PDF", mime: "application/pdf" },
	{ label: "JPEG", mime: "image/jpeg" },
	{ label: "PNG", mime: "image/png" },
	{
		label: "Word (DOCX)",
		mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	},
];
const PAYMENT_LABELS: Record<string, string> = {
	NO_FEE: "No fee",
	MANUAL_REFERENCE: "Payment reference",
	RECEIPT_UPLOAD: "Receipt upload",
	EXTERNAL_REDIRECT: "External payment gateway",
	API_INTEGRATION: "Payment API (integration required)",
};

function areaFor(path: string): BuilderArea {
	if (path.startsWith("formSchema")) return "form";
	if (path.startsWith("documentRequirements")) return "documents";
	if (path.startsWith("workflowDefinition")) return "workflow";
	if (path.startsWith("reviewChecklist")) return "checklist";
	if (path.startsWith("feeSchedule") || path === "paymentMode") return "fees";
	return "general";
}

function mappedIssues(
	issues: { path: string | (string | number)[]; message: string }[],
): DefinitionIssue[] {
	return issues.map((issue) => {
		const path = (
			Array.isArray(issue.path) ? issue.path.join(".") : issue.path
		).replace(/^definition\./, "");
		return { path, message: issue.message, area: areaFor(path) };
	});
}

async function requestJson(url: string, init?: RequestInit) {
	const response = await fetch(url, {
		...init,
		signal: AbortSignal.timeout(30000),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		const message =
			typeof data.error === "string" ? data.error : data.error?.message;
		throw Object.assign(
			new Error(
				message || "The request failed. Your changes are still in the builder.",
			),
			{ issues: data.issues ?? [], status: response.status },
		);
	}
	return data;
}

export function ModuleBuilder({
	userId,
	options,
	initial,
	initialTab,
	notice: initialNotice,
}: ModuleBuilderProps) {
	const router = useRouter();
	const [history, setHistory] = useState<{
		past: Draft[];
		present: Draft;
		future: Draft[];
	}>(() => ({
		past: [],
		future: [],
		present: {
			moduleKey: initial?.moduleKey ?? "",
			displayName: initial?.displayName ?? "",
			category: initial?.category ?? "",
			definition: initial?.definition ?? createModuleDefinition(),
		},
	}));
	const draft = history.present;
	const definition = draft.definition;
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		JSON.stringify(draft),
	);
	const recoveryBaseline = useRef(savedSnapshot);
	const [baseVersionId, setBaseVersionId] = useState(
		initial?.versionId ?? null,
	);
	const [versionNumber, setVersionNumber] = useState(
		initial?.versionNumber ?? 0,
	);
	const [liveVersion, setLiveVersion] = useState(initial?.liveVersion ?? null);
	const [versions, setVersions] = useState(initial?.history ?? []);
	const [enabled, setEnabled] = useState(initial?.enabled ?? false);
	const [tab, setTab] = useState<Tab>(
		TABS.some((item) => item.key === initialTab)
			? (initialTab as Tab)
			: "general",
	);
	const [busy, setBusy] = useState<"draft" | "publish" | "load" | null>(null);
	const [notice, setNotice] = useState(initialNotice ?? "");
	const [error, setError] = useState("");
	const [errors, setErrors] = useState<DefinitionIssue[]>([]);
	const [starter, setStarter] = useState("standard");
	const [keyEdited, setKeyEdited] = useState(false);
	const [customType, setCustomType] = useState("");
	const [publication, setPublication] = useState({
		visibility:
			initial?.liveVersion?.visibility === "STAFF_ONLY"
				? "STAFF_ONLY"
				: "PUBLIC",
		enabled: initial?.liveVersion ? initial.enabled : true,
		acceptingApplications: initial?.liveVersion?.acceptingApplications ?? true,
	});
	const [confirmed, setConfirmed] = useState(false);
	const [dialog, setDialog] = useState<{
		title: string;
		action: () => void;
	} | null>(null);
	const [recovery, setRecovery] = useState<z.infer<
		typeof recoverySchema
	> | null>(null);
	const [storageReady, setStorageReady] = useState(false);
	const [recoveryStatus, setRecoveryStatus] = useState("");
	const [focusPath, setFocusPath] = useState<string | null>(null);
	const errorRef = useRef<HTMLDivElement>(null);
	const importRef = useRef<HTMLInputElement>(null);
	const allowLeave = useRef(false);
	const dirty = JSON.stringify(draft) !== savedSnapshot;
	const storageKey = `dpp-module-builder:v1:${userId}:${initial?.moduleId ?? "new"}`;
	const parsed = moduleDefinitionSchema.safeParse(definition);
	const readiness = parsed.success
		? getModuleReadiness(parsed.data, options.uploadLimitMb ?? 10)
		: mappedIssues(parsed.error.issues);
	const identityCheck = moduleIdentitySchema.safeParse(draft);
	if (!initial && !identityCheck.success)
		readiness.unshift(...mappedIssues(identityCheck.error.issues));
	if (
		!initial &&
		options.modules.some((module) => module.moduleKey === draft.moduleKey)
	)
		readiness.unshift({
			area: "general",
			path: "moduleKey",
			message: "This module key already exists. Choose a different key.",
		});
	const fields = definition.formSchema.flatMap((section) => section.fields);

	function change(next: Draft) {
		setHistory((current) => ({
			past: [...current.past, current.present].slice(-30),
			present: next,
			future: [],
		}));
		setConfirmed(false);
		setNotice("");
		setErrors([]);
		setError("");
	}
	function updateDefinition(next: ModuleDefinition) {
		change({ ...draft, definition: next });
	}
	function mutate(update: (copy: ModuleDefinition) => void) {
		const copy = structuredClone(definition);
		update(copy);
		updateDefinition(copy);
	}
	function confirm(title: string, action: () => void) {
		setDialog({ title, action });
	}
	function showError(message: string, issues: DefinitionIssue[] = []) {
		setError(message);
		setErrors(issues);
	}
	function focusIssue(issue: DefinitionIssue) {
		setTab(issue.area);
		setFocusPath(issue.path);
	}

	useEffect(() => {
		if (error) errorRef.current?.focus();
	}, [error]);
	useEffect(() => {
		if (!focusPath) return;
		let path = focusPath;
		let target = document.getElementById(controlId(path));
		while (!target && path.includes(".")) {
			path = path.slice(0, path.lastIndexOf("."));
			target = document.getElementById(controlId(path));
		}
		if (target) {
			let parent = target.parentElement;
			while (parent) {
				if (parent instanceof HTMLDetailsElement) parent.open = true;
				parent = parent.parentElement;
			}
			target.focus();
			target.scrollIntoView({ block: "center", behavior: "smooth" });
		} else document.getElementById(`builder-panel-${tab}`)?.focus();
		setFocusPath(null);
	}, [tab, focusPath]);
	useEffect(() => {
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				const candidate = recoverySchema.safeParse(JSON.parse(stored));
				if (
					candidate.success &&
					JSON.stringify(candidate.data.draft) !== recoveryBaseline.current
				)
					setRecovery(candidate.data);
			}
		} catch {
			setRecoveryStatus(
				"Browser recovery is unavailable. Save your draft to keep changes.",
			);
		}
		setStorageReady(true);
	}, [storageKey]);
	useEffect(() => {
		if (!storageReady || recovery) return;
		const timer = setTimeout(() => {
			try {
				if (dirty) {
					localStorage.setItem(
						storageKey,
						JSON.stringify({
							schemaVersion: 1,
							baseVersionId,
							savedAt: new Date().toISOString(),
							draft,
						}),
					);
					setRecoveryStatus("Recovery copy saved in this browser");
				} else {
					localStorage.removeItem(storageKey);
					setRecoveryStatus("");
				}
			} catch {
				setRecoveryStatus(
					"Browser recovery is unavailable. Save your draft to keep changes.",
				);
			}
		}, 500);
		return () => clearTimeout(timer);
	}, [draft, dirty, baseVersionId, storageReady, recovery, storageKey]);
	useEffect(() => {
		if (!dirty) return;
		const unload = (event: BeforeUnloadEvent) => {
			if (!allowLeave.current) {
				event.preventDefault();
				event.returnValue = "";
			}
		};
		const navigate = (event: MouseEvent) => {
			const link =
				event.target instanceof Element
					? event.target.closest<HTMLAnchorElement>("a[href]")
					: null;
			if (
				!link ||
				link.hasAttribute("download") ||
				link.target === "_blank" ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.altKey ||
				event.button !== 0 ||
				allowLeave.current ||
				link.href === window.location.href ||
				link.getAttribute("href")?.startsWith("#")
			)
				return;
			event.preventDefault();
			event.stopPropagation();
			setDialog({
				title: "Leave with unsaved changes?",
				action: () => {
					allowLeave.current = true;
					window.location.assign(link.href);
				},
			});
		};
		window.addEventListener("beforeunload", unload);
		document.addEventListener("click", navigate, true);
		return () => {
			window.removeEventListener("beforeunload", unload);
			document.removeEventListener("click", navigate, true);
		};
	}, [dirty]);

	async function loadStarter() {
		setBusy("load");
		try {
			const copiedModule = options.modules.find(
				(module) => module.id === starter,
			);
			const next = copiedModule
				? moduleDefinitionSchema.parse(
						(await requestJson(`/api/admin/modules/${copiedModule.id}/version`))
							.definition,
					)
				: createModuleDefinition(
						starter as "blank" | "standard" | "inspection",
					);
			const displayName =
				draft.displayName ||
				(copiedModule ? `${copiedModule.displayName} (copy)` : "");
			const configuration = copiedModule
				? next
				: {
						...definition,
						formSchema: next.formSchema,
						workflowDefinition: next.workflowDefinition,
					};
			change({
				...draft,
				displayName,
				moduleKey: draft.moduleKey || normaliseModuleKey(displayName),
				category: draft.category || copiedModule?.category || "",
				definition: {
					...configuration,
					visibility: "DRAFT",
					acceptingApplications: false,
				},
			});
			setTab("form");
			setNotice("Starting configuration loaded. Not published.");
		} catch (caught) {
			showError(
				caught instanceof Error
					? caught.message
					: "The starting configuration could not be loaded.",
			);
		} finally {
			setBusy(null);
		}
	}

	function exportDraft() {
		const { definition: config, ...module } = draft;
		const url = URL.createObjectURL(
			new Blob(
				[
					JSON.stringify(
						{ schemaVersion: 1, module, definition: config },
						null,
						2,
					),
				],
				{ type: "application/json" },
			),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${draft.moduleKey || "module"}-draft.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function importDraft(file?: File) {
		if (!file) return;
		try {
			if (file.size > 1024 * 1024)
				throw new Error("Choose a module JSON file smaller than 1 MB.");
			const imported = packageSchema.parse(JSON.parse(await file.text()));
			confirm(
				"Replace the current configuration with this imported draft?",
				() => {
					change({
						...(initial ? draft : { ...draft, ...imported.module }),
						definition: {
							...imported.definition,
							visibility: "DRAFT",
							acceptingApplications: false,
						},
					});
					setNotice("Configuration imported into the editor. Not published.");
				},
			);
		} catch (caught) {
			showError(
				caught instanceof z.ZodError
					? "This file is not a valid version 1 module package. The current configuration has not changed."
					: caught instanceof SyntaxError
						? "The file does not contain valid JSON. The current configuration has not changed."
						: caught instanceof Error
							? caught.message
							: "The file could not be imported.",
			);
		} finally {
			if (importRef.current) importRef.current.value = "";
		}
	}

	async function save(intent: "draft" | "publish") {
		const identity = moduleIdentitySchema.safeParse(draft);
		const config = moduleDefinitionSchema.safeParse(definition);
		const issues = [
			...(!identity.success ? mappedIssues(identity.error.issues) : []),
			...(!config.success ? mappedIssues(config.error.issues) : []),
		];
		if (intent === "publish") issues.push(...readiness);
		if (issues.length) {
			showError("Review these settings before continuing.", issues);
			return;
		}
		if (intent === "publish" && (!initial || !confirmed)) {
			showError("Save a draft and confirm the publication first.");
			return;
		}
		setBusy(intent);
		setError("");
		setErrors([]);
		setNotice("");
		try {
			if (!initial) {
				const result = await requestJson("/api/admin/modules", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(draft),
				});
				setSavedSnapshot(JSON.stringify(draft));
				try {
					localStorage.removeItem(storageKey);
				} catch {
					setRecoveryStatus("Browser recovery is unavailable.");
				}
				allowLeave.current = true;
				router.replace(`/admin/modules/${result.moduleKey}?saved=1&tab=${tab}`);
				return;
			}
			const nextDefinition =
				intent === "publish"
					? {
							...definition,
							visibility: publication.visibility,
							acceptingApplications: publication.acceptingApplications,
						}
					: definition;
			const result = await requestJson(
				`/api/admin/modules/${initial.moduleId}/version`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						definition: nextDefinition,
						intent,
						baseVersionId,
						enableModule: publication.enabled,
						publishConfirmed: confirmed,
					}),
				},
			);
			const savedDefinition = moduleDefinitionSchema.parse(result.definition);
			const savedDraft = { ...draft, definition: savedDefinition };
			setHistory((current) => ({
				...current,
				present: savedDraft,
				future: [],
			}));
			setSavedSnapshot(JSON.stringify(savedDraft));
			setBaseVersionId(result.versionId);
			setVersionNumber(result.version);
			setConfirmed(false);
			setVersions((current) =>
				[
					{
						id: result.versionId,
						version: result.version,
						visibility: savedDefinition.visibility,
						isActive: intent === "publish",
						createdAt: new Date().toISOString(),
					},
					...current.map((version) =>
						intent === "publish" ? { ...version, isActive: false } : version,
					),
				].slice(0, 20),
			);
			if (intent === "publish") {
				setLiveVersion({
					id: result.versionId,
					version: result.version,
					visibility: savedDefinition.visibility,
					acceptingApplications: savedDefinition.acceptingApplications,
				});
				setEnabled(publication.enabled);
				setNotice(
					`Version ${result.version} published. ${publication.enabled ? (publication.acceptingApplications ? "Applications are open." : "Applications remain closed.") : "The module remains disabled."}`,
				);
			} else
				setNotice(
					`Draft version ${result.version} saved.${liveVersion ? ` Published version ${liveVersion.version} is unchanged.` : " Not published."}`,
				);
		} catch (caught) {
			const failure = caught as Error & {
				issues?: { path: string; message: string }[];
			};
			showError(
				failure.name === "TimeoutError"
					? "The request timed out. Your changes are retained. Reload the latest version before retrying in case the save completed."
					: failure.message || "Could not save. Your changes are retained.",
				mappedIssues(failure.issues ?? []),
			);
		} finally {
			setBusy(null);
		}
	}

	async function restoreVersion(version: VersionSummary) {
		setBusy("load");
		try {
			const result = await requestJson(
				`/api/admin/modules/${initial?.moduleId}/version?versionId=${version.id}`,
			);
			updateDefinition(moduleDefinitionSchema.parse(result.definition));
			setNotice(
				`Version ${version.version} loaded into the editor. Save and review before publishing.`,
			);
		} catch (caught) {
			showError(
				caught instanceof Error
					? caught.message
					: "Could not load this version.",
			);
		} finally {
			setBusy(null);
		}
	}

	return (
		<BuilderErrors.Provider value={errors}>
			<div className="min-w-0">
				<div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-5">
					<div className="w-full min-w-0 md:flex-1">
						<p className="text-sm font-bold text-govuk-dark-grey mb-1">
							MODULE BUILDER
						</p>
						<h1 className="mt-0 mb-2 break-words">
							{initial ? draft.displayName : "Create module"}
						</h1>
						<p className="text-sm text-govuk-dark-grey mb-0">
							{initial
								? `${draft.moduleKey} / Version ${versionNumber}`
								: "New module / Unpublished draft"}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
						<button
							type="button"
							className="govuk-button govuk-button--secondary inline-flex items-center gap-2 mb-0"
							disabled={!!busy}
							onClick={() => save("draft")}
						>
							<Save size={17} />
							{busy === "draft" ? "Saving..." : "Save draft"}
						</button>
						<button
							type="button"
							className="govuk-button inline-flex items-center gap-2 mb-0"
							disabled={!!busy}
							onClick={() => {
								setTab("review");
								setErrors(readiness);
							}}
						>
							<CheckCircle2 size={17} />
							Review & publish
						</button>
					</div>
				</div>

				<div className="border-y border-govuk-mid-grey bg-govuk-light-grey px-3 py-3 mb-5 flex flex-wrap justify-between items-center gap-3">
					<div
						className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
						aria-live="polite"
					>
						<span
							className={`font-bold ${dirty ? "text-govuk-red" : "text-govuk-dark-grey"}`}
						>
							{dirty ? "Unsaved changes" : initial ? "Saved" : "Not saved"}
						</span>
						<span>
							{liveVersion
								? `${enabled ? "Published" : "Disabled"}: v${liveVersion.version}`
								: "Not published"}
						</span>
						{recoveryStatus && (
							<span className="text-xs text-govuk-dark-grey">
								{recoveryStatus}
							</span>
						)}
					</div>
					<div className="flex flex-wrap gap-1">
						<IconButton
							label="Undo change"
							disabled={!history.past.length || !!busy}
							onClick={() => {
								setHistory((current) => ({
									past: current.past.slice(0, -1),
									present: current.past.at(-1) ?? current.present,
									future: [current.present, ...current.future],
								}));
								setConfirmed(false);
							}}
						>
							<Undo2 size={17} />
						</IconButton>
						<IconButton
							label="Redo change"
							disabled={!history.future.length || !!busy}
							onClick={() => {
								setHistory((current) => ({
									past: [...current.past, current.present],
									present: current.future[0] ?? current.present,
									future: current.future.slice(1),
								}));
								setConfirmed(false);
							}}
						>
							<Redo2 size={17} />
						</IconButton>
						<IconButton label="Export module JSON" onClick={exportDraft}>
							<Download size={17} />
						</IconButton>
						<IconButton
							label="Import module JSON"
							disabled={!!busy}
							onClick={() => importRef.current?.click()}
						>
							<Upload size={17} />
						</IconButton>
						<input
							ref={importRef}
							type="file"
							accept="application/json,.json"
							className="sr-only"
							aria-label="Import module JSON file"
							tabIndex={-1}
							onChange={(event) => importDraft(event.target.files?.[0])}
						/>
					</div>
				</div>

				{recovery && (
					<div
						role="status"
						className="border-l-4 border-govuk-blue bg-govuk-light-grey p-4 mb-5"
					>
						<p className="font-bold">Unsaved changes found in this browser</p>
						<p className="text-sm">
							Recovery copy:{" "}
							{new Date(recovery.savedAt).toLocaleString("en-GB")}
							{recovery.baseVersionId !== baseVersionId
								? ". A newer server version exists; export recovered work before reloading."
								: ""}
						</p>
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								className="govuk-button mb-0"
								onClick={() => {
									change(recovery.draft);
									setBaseVersionId(recovery.baseVersionId);
									setRecovery(null);
								}}
							>
								Restore changes
							</button>
							<button
								type="button"
								className="govuk-button govuk-button--secondary mb-0"
								onClick={() => {
									try {
										localStorage.removeItem(storageKey);
									} catch {
										setRecoveryStatus("Browser recovery is unavailable.");
									}
									setRecovery(null);
								}}
							>
								Discard recovery copy
							</button>
						</div>
					</div>
				)}
				{notice && (
					<div
						role="status"
						className="border-l-4 border-govuk-green bg-govuk-light-grey p-4 mb-5"
					>
						<p className="m-0 font-bold">{notice}</p>
						{liveVersion?.visibility === "PUBLIC" && enabled && initial && (
							<Link
								href={`/licences/${initial.moduleKey}`}
								target="_blank"
								className="text-sm"
							>
								View published module
							</Link>
						)}
					</div>
				)}
				{error && (
					<div
						ref={errorRef}
						tabIndex={-1}
						role="alert"
						className="border-4 border-govuk-red p-4 mb-5 focus:outline-none"
					>
						<h2 className="text-xl mt-0">There is a problem</h2>
						<p>{error}</p>
						<ul className="space-y-2">
							{errors.map((issue, index) => (
								<li key={`${issue.path}-${index}`}>
									<button
										type="button"
										className="text-left text-govuk-red underline font-bold text-sm"
										onClick={() => focusIssue(issue)}
									>
										{issue.message}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-6 items-start">
					<div className="lg:sticky lg:top-4">
						<div
							role="tablist"
							aria-label="Module configuration"
							className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-1"
						>
							{TABS.map((item, index) => {
								const count = readiness.filter(
									(issue) => issue.area === item.key,
								).length;
								return (
									<button
										key={item.key}
										type="button"
										role="tab"
										id={`builder-tab-${item.key}`}
										aria-selected={tab === item.key}
										aria-controls={`builder-panel-${item.key}`}
										tabIndex={tab === item.key ? 0 : -1}
										className={`text-left flex items-center gap-2 px-3 py-3 border-l-4 text-sm font-bold min-w-0 ${tab === item.key ? "border-govuk-blue bg-govuk-light-grey text-govuk-blue" : "border-transparent hover:bg-govuk-light-grey"}`}
										onClick={() => setTab(item.key)}
										onKeyDown={(event) => {
											const nextIndex =
												event.key === "Home"
													? 0
													: event.key === "End"
														? TABS.length - 1
														: ["ArrowDown", "ArrowRight"].includes(event.key)
															? (index + 1) % TABS.length
															: ["ArrowUp", "ArrowLeft"].includes(event.key)
																? (index + TABS.length - 1) % TABS.length
																: -1;
											if (nextIndex >= 0) {
												event.preventDefault();
												setTab(TABS[nextIndex].key);
												document
													.getElementById(`builder-tab-${TABS[nextIndex].key}`)
													?.focus();
											}
										}}
									>
										<item.icon size={17} className="shrink-0" />
										<span className="min-w-0 flex-1">{item.label}</span>
										{count > 0 && (
											<span className="text-xs text-govuk-red">
												{count}
												<span className="sr-only"> issues</span>
											</span>
										)}
									</button>
								);
							})}
						</div>
						<div className="hidden lg:block border-t border-govuk-mid-grey mt-5 pt-4 text-xs text-govuk-dark-grey space-y-2">
							<p>{definition.formSchema.length} form sections</p>
							<p>{fields.length} questions</p>
							<p>
								{definition.documentRequirements.length} evidence requirements
							</p>
							<p>{definition.workflowDefinition.length} workflow stages</p>
						</div>
					</div>

					<div
						role="tabpanel"
						id={`builder-panel-${tab}`}
						aria-labelledby={`builder-tab-${tab}`}
						tabIndex={-1}
						className="min-w-0 focus:outline-none"
					>
						<fieldset disabled={!!busy} className="min-w-0">
							<legend className="sr-only">
								{TABS.find((item) => item.key === tab)?.label} settings
							</legend>
							{tab === "general" && (
								<>
									{!initial && (
										<section className="border-b-2 border-govuk-mid-grey pb-5 mb-6">
											<h2 className="text-2xl mt-0">Starting point</h2>
											<div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
												<Select
													path="starter"
													label="Start from"
													value={starter}
													onChange={setStarter}
												>
													<optgroup label="Starter configurations">
														<option value="blank">Blank module</option>
														<option value="standard">
															Standard application
														</option>
														<option value="inspection">
															Application with inspection
														</option>
													</optgroup>
													<optgroup label="Copy an existing module">
														{options.modules.map((module) => (
															<option key={module.id} value={module.id}>
																{module.displayName}
															</option>
														))}
													</optgroup>
												</Select>
												<button
													type="button"
													className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
													onClick={() =>
														definition.formSchema.length
															? confirm(
																	"Replace this form with the selected starting configuration?",
																	() => {
																		void loadStarter();
																	},
																)
															: loadStarter()
													}
												>
													<Plus size={17} />
													Use starting point
												</button>
											</div>
										</section>
									)}
									<h2 className="text-2xl mt-0">Module details</h2>
									<Input
										path="displayName"
										label="Display name"
										value={draft.displayName}
										readOnly={!!initial}
										onChange={(displayName) =>
											change({
												...draft,
												displayName,
												moduleKey: keyEdited
													? draft.moduleKey
													: normaliseModuleKey(displayName),
											})
										}
									/>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
										<Input
											path="moduleKey"
											label="Module key (permanent)"
											value={draft.moduleKey}
											readOnly={!!initial}
											onChange={(moduleKey) => {
												setKeyEdited(true);
												change({ ...draft, moduleKey });
											}}
										/>
										<Input
											path="category"
											label="Category"
											value={draft.category}
											readOnly={!!initial}
											list="module-categories"
											onChange={(category) => change({ ...draft, category })}
										/>
										<datalist id="module-categories">
											{options.categories.map((category) => (
												<option key={category} value={category} />
											))}
										</datalist>
									</div>
									<Input
										path="publicDescription"
										label="Public description"
										value={definition.publicDescription}
										onChange={(publicDescription) =>
											updateDefinition({ ...definition, publicDescription })
										}
										multiline
									/>
									<Input
										path="beforeYouStartText"
										label="Before you start"
										value={definition.beforeYouStartText}
										onChange={(beforeYouStartText) =>
											updateDefinition({ ...definition, beforeYouStartText })
										}
										multiline
									/>
									<Input
										path="helpText"
										label="Applicant help and contact guidance"
										value={definition.helpText}
										onChange={(helpText) =>
											updateDefinition({ ...definition, helpText })
										}
										multiline
									/>
									<fieldset
										id={controlId("applicationTypes")}
										tabIndex={-1}
										className="border-t border-govuk-mid-grey pt-4 mb-5"
									>
										<legend className="font-bold text-base pr-2">
											Application types
										</legend>
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3">
											{[
												...new Set([
													...APPLICATION_TYPES,
													"notice",
													"registration",
													...definition.applicationTypes,
												]),
											].map((type) => (
												<Toggle
													key={type}
													label={type.replaceAll("_", " ")}
													checked={definition.applicationTypes.includes(type)}
													onChange={(checked) =>
														updateDefinition({
															...definition,
															applicationTypes: checked
																? [...definition.applicationTypes, type]
																: definition.applicationTypes.filter(
																		(value) => value !== type,
																	),
														})
													}
												/>
											))}
										</div>
										<details className="mt-3">
											<summary className="text-sm text-govuk-blue font-bold cursor-pointer">
												Custom application type
											</summary>
											<div className="flex flex-wrap gap-3 items-end mt-3">
												<Input
													path="customType"
													label="Application type key"
													value={customType}
													onChange={setCustomType}
												/>
												<button
													type="button"
													className="govuk-button govuk-button--secondary"
													disabled={
														!normaliseModuleKey(customType) ||
														definition.applicationTypes.includes(
															normaliseModuleKey(customType),
														)
													}
													onClick={() => {
														updateDefinition({
															...definition,
															applicationTypes: [
																...definition.applicationTypes,
																normaliseModuleKey(customType),
															],
														});
														setCustomType("");
													}}
												>
													Add type
												</button>
											</div>
										</details>
									</fieldset>
									<h3 className="text-lg border-t border-govuk-mid-grey pt-4">
										Team and routing
									</h3>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
										<Select
											path="owningTeamId"
											label="Owning team"
											value={definition.owningTeamId}
											onChange={(owningTeamId) =>
												updateDefinition({ ...definition, owningTeamId })
											}
										>
											<option value="">Unassigned</option>
											{options.teams.map((team) => (
												<option key={team.id} value={team.id}>
													{team.name}
												</option>
											))}
										</Select>
										<Input
											path="submissionMailbox"
											label="Submission mailbox"
											type="email"
											value={definition.submissionMailbox}
											onChange={(submissionMailbox) =>
												updateDefinition({ ...definition, submissionMailbox })
											}
										/>
									</div>
								</>
							)}

							{tab === "form" && (
								<FormEditor
									definition={definition}
									onChange={updateDefinition}
									confirm={confirm}
								/>
							)}

							{tab === "documents" && (
								<>
									<h2 className="text-2xl mt-0">Supporting documents</h2>
									<p className="text-sm text-govuk-dark-grey">
										Platform upload limit: {options.uploadLimitMb ?? 10} MB per
										file.
									</p>
									{!definition.documentRequirements.length && (
										<p>No evidence requirements configured.</p>
									)}
									{definition.documentRequirements.map((document, index) => (
										<section
											key={index}
											className="border-b border-govuk-mid-grey pb-5 mb-5"
										>
											<div className="flex flex-wrap justify-between items-center gap-3 mb-4">
												<h3 className="text-lg m-0">Document {index + 1}</h3>
												<ItemActions
													label={document.label || `document ${index + 1}`}
													index={index}
													count={definition.documentRequirements.length}
													onMove={(direction) =>
														updateDefinition({
															...definition,
															documentRequirements: moveItem(
																definition.documentRequirements,
																index,
																direction,
															),
														})
													}
													onRemove={() =>
														confirm(
															`Remove ${document.label || "this evidence requirement"}?`,
															() =>
																mutate((copy) => {
																	copy.documentRequirements.splice(index, 1);
																}),
														)
													}
												/>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
												<Input
													path={`documentRequirements.${index}.label`}
													label="Document name"
													value={document.label}
													onChange={(label) =>
														mutate((copy) => {
															copy.documentRequirements[index].label = label;
														})
													}
												/>
												<Input
													path={`documentRequirements.${index}.key`}
													label="Document key"
													value={document.key}
													onChange={(key) =>
														mutate((copy) => {
															copy.documentRequirements[index].key = key;
														})
													}
												/>
											</div>
											<Input
												path={`documentRequirements.${index}.description`}
												label="Evidence guidance"
												value={document.description ?? ""}
												onChange={(description) =>
													mutate((copy) => {
														copy.documentRequirements[index].description =
															description;
													})
												}
												multiline
											/>
											<Toggle
												label="Evidence required"
												checked={document.required}
												onChange={(required) =>
													mutate((copy) => {
														copy.documentRequirements[index].required =
															required;
													})
												}
											/>
											<fieldset className="mt-3 mb-4">
												<legend className="text-sm font-bold">
													Accepted file types
												</legend>
												<div className="flex flex-wrap gap-x-5">
													{FILE_TYPES.map((type) => (
														<Toggle
															key={type.mime}
															label={type.label}
															checked={(
																document.acceptedMimeTypes ??
																FILE_TYPES.map((item) => item.mime)
															).includes(type.mime)}
															onChange={(checked) =>
																mutate((copy) => {
																	const current =
																		document.acceptedMimeTypes ??
																		FILE_TYPES.map((item) => item.mime);
																	copy.documentRequirements[
																		index
																	].acceptedMimeTypes = checked
																		? [...current, type.mime]
																		: current.filter(
																				(mime) => mime !== type.mime,
																			);
																})
															}
														/>
													))}
												</div>
											</fieldset>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
												<Input
													path={`documentRequirements.${index}.maxSizeMb`}
													label="Maximum file size (MB)"
													type="number"
													min={1}
													max={options.uploadLimitMb ?? 10}
													value={document.maxSizeMb ?? 10}
													onChange={(value) =>
														mutate((copy) => {
															copy.documentRequirements[index].maxSizeMb = value
																? Number(value)
																: undefined;
														})
													}
												/>
												<Select
													path={`documentRequirements.${index}.verificationStatus`}
													label="Requirement verified against"
													value={document.verificationStatus}
													onChange={(value) =>
														mutate((copy) => {
															copy.documentRequirements[
																index
															].verificationStatus =
																value as DocumentRequirement["verificationStatus"];
														})
													}
												>
													<option value="needs_council_confirmation">
														Needs council confirmation
													</option>
													<option value="verified_public_page">
														Public guidance
													</option>
													<option value="verified_form_pack">
														Application pack
													</option>
													<option value="verified_policy">
														Council policy
													</option>
												</Select>
											</div>
											<ConditionEditor
												path={`documentRequirements.${index}.conditionalOn`}
												value={document.conditionalOn}
												fields={fields}
												onChange={(conditionalOn) =>
													mutate((copy) => {
														copy.documentRequirements[index].conditionalOn =
															conditionalOn;
													})
												}
											/>
										</section>
									))}
									<button
										type="button"
										className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
										onClick={() =>
											mutate((copy) => {
												copy.documentRequirements.push({
													key: nextKey(
														"document",
														copy.documentRequirements.map((item) => item.key),
													),
													label: "",
													required: true,
													maxSizeMb: Math.min(10, options.uploadLimitMb ?? 10),
													acceptedMimeTypes: FILE_TYPES.map(
														(item) => item.mime,
													),
													verificationStatus: "needs_council_confirmation",
												});
											})
										}
									>
										<Plus size={17} />
										Add document requirement
									</button>
								</>
							)}

							{tab === "workflow" && (
								<>
									<h2 className="text-2xl mt-0">Workflow and service levels</h2>
									{!definition.workflowDefinition.length && (
										<p>No workflow stages configured.</p>
									)}
									<ol className="space-y-5">
										{definition.workflowDefinition.map((stage, index) => (
											<li
												key={index}
												className="border-b border-govuk-mid-grey pb-5"
											>
												<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
													<h3 className="text-lg m-0">Stage {index + 1}</h3>
													<ItemActions
														label={stage.label || `stage ${index + 1}`}
														index={index}
														count={definition.workflowDefinition.length}
														onMove={(direction) =>
															updateDefinition({
																...definition,
																workflowDefinition: moveItem(
																	definition.workflowDefinition,
																	index,
																	direction,
																).map((item, order) => ({
																	...item,
																	order: order + 1,
																})),
															})
														}
														onRemove={() =>
															confirm(
																`Remove ${stage.label || "this stage"}?`,
																() =>
																	mutate((copy) => {
																		copy.workflowDefinition.splice(index, 1);
																	}),
															)
														}
													/>
												</div>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
													<Input
														path={`workflowDefinition.${index}.label`}
														label="Stage name"
														value={stage.label}
														onChange={(label) =>
															mutate((copy) => {
																copy.workflowDefinition[index].label = label;
															})
														}
													/>
													<Input
														path={`workflowDefinition.${index}.key`}
														label="Stage key"
														value={stage.key}
														onChange={(key) =>
															mutate((copy) => {
																copy.workflowDefinition[index].key = key;
															})
														}
													/>
													<Select
														path={`workflowDefinition.${index}.type`}
														label="Stage type"
														value={stage.type}
														onChange={(type) =>
															mutate((copy) => {
																copy.workflowDefinition[index].type =
																	type as WorkflowStage["type"];
															})
														}
													>
														{[
															"validation",
															"review",
															"inspection",
															"consultation",
															"hearing",
															"training",
															"decision",
															"custom",
														].map((type) => (
															<option key={type} value={type}>
																{type}
															</option>
														))}
													</Select>
													<Input
														path={`workflowDefinition.${index}.slaBusinessDays`}
														label="Target (working days)"
														type="number"
														min={1}
														max={3650}
														value={stage.slaBusinessDays ?? ""}
														onChange={(value) =>
															mutate((copy) => {
																copy.workflowDefinition[index].slaBusinessDays =
																	value ? Number(value) : undefined;
															})
														}
													/>
													<Input
														path={`workflowDefinition.${index}.reminderDays`}
														label="Reminder after (working days)"
														type="number"
														min={0}
														value={stage.reminderDays ?? ""}
														onChange={(value) =>
															mutate((copy) => {
																copy.workflowDefinition[index].reminderDays =
																	value ? Number(value) : undefined;
															})
														}
													/>
												</div>
												<Toggle
													label="Visible to applicant"
													checked={stage.visibleToApplicant ?? false}
													onChange={(visibleToApplicant) =>
														mutate((copy) => {
															copy.workflowDefinition[
																index
															].visibleToApplicant = visibleToApplicant;
														})
													}
												/>
											</li>
										))}
									</ol>
									<button
										type="button"
										className="govuk-button govuk-button--secondary inline-flex items-center gap-2 mt-5"
										onClick={() =>
											mutate((copy) => {
												copy.workflowDefinition.push({
													key: nextKey(
														"stage",
														copy.workflowDefinition.map((item) => item.key),
													),
													label: "",
													order: copy.workflowDefinition.length + 1,
													type: "review",
													slaBusinessDays: 5,
													visibleToApplicant: true,
												});
											})
										}
									>
										<Plus size={17} />
										Add stage
									</button>
								</>
							)}

							{tab === "checklist" && (
								<>
									<h2 className="text-2xl mt-0">Officer review checklist</h2>
									{!definition.reviewChecklist.length && (
										<p>No checklist items configured.</p>
									)}
									{definition.reviewChecklist.map((item, index) => (
										<section
											key={index}
											className="border-b border-govuk-mid-grey pb-5 mb-5"
										>
											<div className="flex flex-wrap justify-between items-center gap-3 mb-4">
												<h3 className="text-lg m-0">Check {index + 1}</h3>
												<ItemActions
													label={item.label || `check ${index + 1}`}
													index={index}
													count={definition.reviewChecklist.length}
													onMove={(direction) =>
														updateDefinition({
															...definition,
															reviewChecklist: moveItem(
																definition.reviewChecklist,
																index,
																direction,
															),
														})
													}
													onRemove={() =>
														confirm(
															`Remove ${item.label || "this check"}?`,
															() =>
																mutate((copy) => {
																	copy.reviewChecklist.splice(index, 1);
																}),
														)
													}
												/>
											</div>
											<Input
												path={`reviewChecklist.${index}.label`}
												label="Check to complete"
												value={item.label}
												onChange={(label) =>
													mutate((copy) => {
														copy.reviewChecklist[index].label = label;
													})
												}
											/>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
												<Input
													path={`reviewChecklist.${index}.key`}
													label="Checklist key"
													value={item.key}
													onChange={(key) =>
														mutate((copy) => {
															copy.reviewChecklist[index].key = key;
														})
													}
												/>
												<Input
													path={`reviewChecklist.${index}.category`}
													label="Group"
													value={item.category ?? ""}
													onChange={(category) =>
														mutate((copy) => {
															copy.reviewChecklist[index].category = category;
														})
													}
												/>
											</div>
											<Input
												path={`reviewChecklist.${index}.description`}
												label="Officer guidance"
												value={item.description ?? ""}
												onChange={(description) =>
													mutate((copy) => {
														copy.reviewChecklist[index].description =
															description;
													})
												}
												multiline
											/>
											<Toggle
												label="Check required"
												checked={item.required}
												onChange={(required) =>
													mutate((copy) => {
														copy.reviewChecklist[index].required = required;
													})
												}
											/>
										</section>
									))}
									<button
										type="button"
										className="govuk-button govuk-button--secondary inline-flex items-center gap-2"
										onClick={() =>
											mutate((copy) => {
												copy.reviewChecklist.push({
													key: nextKey(
														"check",
														copy.reviewChecklist.map((item) => item.key),
													),
													label: "",
													required: true,
												});
											})
										}
									>
										<Plus size={17} />
										Add checklist item
									</button>
								</>
							)}

							{tab === "fees" && (
								<>
									<h2 className="text-2xl mt-0">Fees and payment</h2>
									<Select
										path="paymentMode"
										label="Payment method"
										value={definition.paymentMode}
										onChange={(paymentMode) =>
											mutate((copy) => {
												copy.paymentMode =
													paymentMode as ModuleDefinition["paymentMode"];
												if (
													paymentMode === "RECEIPT_UPLOAD" &&
													!copy.documentRequirements.some((document) =>
														["receipt", "payment_receipt"].includes(
															document.key,
														),
													)
												)
													copy.documentRequirements.push({
														key: "payment_receipt",
														label: "Payment receipt",
														required: true,
														maxSizeMb: Math.min(
															options.uploadLimitMb ?? 10,
															10,
														),
														acceptedMimeTypes: [
															"application/pdf",
															"image/jpeg",
															"image/png",
														],
														verificationStatus: "needs_council_confirmation",
													});
											})
										}
									>
										{PAYMENT_MODES.map((mode) => (
											<option
												key={mode}
												value={mode}
												disabled={[
													"API_INTEGRATION",
													"EXTERNAL_REDIRECT",
												].includes(mode)}
											>
												{PAYMENT_LABELS[mode]}
											</option>
										))}
									</Select>
									{["API_INTEGRATION", "EXTERNAL_REDIRECT"].includes(
										definition.paymentMode,
									) && (
										<p className="border-l-4 border-govuk-yellow p-3 text-sm">
											Online payment gateways are not implemented. Select
											payment reference, receipt upload or no fee before
											publishing.
										</p>
									)}
									{definition.applicationTypes.map((type) => {
										const fee = definition.feeSchedule[type];
										const amount =
											typeof fee === "number" ? fee : fee?.baseAmount;
										return (
											<div
												key={type}
												className="border-b border-govuk-mid-grey pb-2 mb-4 max-w-lg"
											>
												<Input
													path={`feeSchedule.${type}`}
													label={`${type.replaceAll("_", " ")} fee (GBP)`}
													type="number"
													min={0}
													step="0.01"
													value={amount ?? ""}
													onChange={(value) =>
														mutate((copy) => {
															if (value === "") delete copy.feeSchedule[type];
															else
																copy.feeSchedule[type] =
																	typeof fee === "object"
																		? { ...fee, baseAmount: Number(value) }
																		: Number(value);
														})
													}
												/>
												{typeof fee === "object" && !!fee.bands?.length && (
													<p className="text-xs text-govuk-dark-grey">
														{fee.bands.length} existing fee bands retained in
														the configuration. The current payment service uses
														the base fee.
													</p>
												)}
											</div>
										);
									})}
									{!definition.applicationTypes.length && (
										<button
											type="button"
											className="text-govuk-blue underline"
											onClick={() => setTab("general")}
										>
											Select application types
										</button>
									)}
								</>
							)}

							{tab === "preview" && (
								<ModulePreview
									definition={definition}
									displayName={draft.displayName}
								/>
							)}

							{tab === "review" && (
								<>
									<h2 className="text-2xl mt-0">Review and publish</h2>
									<div
										className={`border-l-4 p-4 mb-5 bg-govuk-light-grey ${readiness.length ? "border-govuk-red" : "border-govuk-green"}`}
									>
										<p className="font-bold mb-2">
											{readiness.length
												? `${readiness.length} settings need attention`
												: "Configuration checks passed"}
										</p>
										{readiness.length > 0 && (
											<ul className="space-y-2">
												{readiness.map((issue, index) => (
													<li key={`${issue.path}-${index}`}>
														<button
															type="button"
															className="text-sm text-left underline text-govuk-red"
															onClick={() => {
																setErrors(readiness);
																focusIssue(issue);
															}}
														>
															{issue.message}
														</button>
													</li>
												))}
											</ul>
										)}
									</div>
									<dl className="grid grid-cols-1 sm:grid-cols-2 border-y border-govuk-mid-grey py-4 gap-4 mb-6">
										{[
											["Module", draft.displayName || "Not named"],
											["Category", draft.category || "Not selected"],
											[
												"Application types",
												definition.applicationTypes.join(", ") || "None",
											],
											[
												"Form",
												`${definition.formSchema.length} sections, ${fields.length} questions`,
											],
											[
												"Evidence",
												`${definition.documentRequirements.filter((document) => document.required).length} required documents`,
											],
											["Payment", PAYMENT_LABELS[definition.paymentMode]],
											[
												"Workflow",
												definition.workflowDefinition
													.map((stage) => stage.label || "Unnamed")
													.join(" > "),
											],
											[
												"Owning team",
												options.teams.find(
													(team) => team.id === definition.owningTeamId,
												)?.name ?? "Unassigned",
											],
										].map(([label, value]) => (
											<div key={label} className="min-w-0">
												<dt className="text-xs text-govuk-dark-grey">
													{label}
												</dt>
												<dd className="font-bold text-sm break-words">
													{value}
												</dd>
											</div>
										))}
									</dl>
									{definition.documentRequirements.some(
										(document) =>
											document.verificationStatus ===
											"needs_council_confirmation",
									) && (
										<p className="border-l-4 border-govuk-yellow p-3 text-sm">
											Some evidence requirements still need council
											confirmation.
										</p>
									)}
									{!initial ? (
										<button
											type="button"
											className="govuk-button inline-flex items-center gap-2"
											onClick={() => save("draft")}
										>
											<Save size={17} />
											Create draft module
										</button>
									) : (
										<>
											<Select
												path="publication.visibility"
												label="Publication audience"
												value={publication.visibility}
												onChange={(visibility) => {
													setPublication({ ...publication, visibility });
													setConfirmed(false);
												}}
											>
												<option value="PUBLIC">Public catalogue</option>
												<option value="STAFF_ONLY">Staff only</option>
											</Select>
											<Toggle
												label="Enable module"
												checked={publication.enabled}
												onChange={(value) => {
													setPublication({ ...publication, enabled: value });
													setConfirmed(false);
												}}
											/>
											<Toggle
												label="Accept new applications"
												checked={publication.acceptingApplications}
												onChange={(acceptingApplications) => {
													setPublication({
														...publication,
														acceptingApplications,
													});
													setConfirmed(false);
												}}
											/>
											<p className="text-sm mt-3">
												{publication.enabled &&
												publication.visibility === "PUBLIC"
													? publication.acceptingApplications
														? "Publication will make this module available to applicants immediately."
														: "The module will appear in the catalogue with applications closed."
													: "This module will not be available in the public catalogue."}{" "}
												Existing applications keep their original configuration.
											</p>
											<div className="border-t border-govuk-mid-grey pt-4 mt-4">
												<Toggle
													label="I have reviewed the form, requirements, fees and publication settings."
													checked={confirmed}
													onChange={setConfirmed}
													disabled={readiness.length > 0}
												/>
											</div>
											<button
												type="button"
												className="govuk-button inline-flex items-center gap-2 mt-4"
												disabled={!confirmed || readiness.length > 0 || !!busy}
												onClick={() => save("publish")}
											>
												<CheckCircle2 size={18} />
												{busy === "publish"
													? "Publishing..."
													: "Publish version"}
											</button>
										</>
									)}
									{versions.length > 0 && (
										<section className="border-t-2 border-govuk-mid-grey mt-7 pt-5">
											<h3 className="text-lg flex items-center gap-2">
												<History size={18} />
												Version history
											</h3>
											<ul className="divide-y divide-govuk-mid-grey">
												{versions.map((version) => (
													<li
														key={version.id}
														className="flex flex-wrap justify-between items-center gap-3 py-3 text-sm"
													>
														<div>
															<strong>v{version.version}</strong>{" "}
															<span>
																{version.visibility === "DRAFT"
																	? "Draft"
																	: version.isActive
																		? "Published"
																		: "Previous publication"}
															</span>
															<span className="block text-xs text-govuk-dark-grey">
																{new Date(version.createdAt).toLocaleString(
																	"en-GB",
																)}
															</span>
														</div>
														<button
															type="button"
															className="text-govuk-blue underline text-sm"
															disabled={version.id === baseVersionId}
															onClick={() =>
																confirm(
																	`Load version ${version.version} into the editor? Current unsaved changes will be replaced.`,
																	() => {
																		void restoreVersion(version);
																	},
																)
															}
														>
															Use as draft
														</button>
													</li>
												))}
											</ul>
										</section>
									)}
									<details className="mt-6 border-t border-govuk-mid-grey pt-4">
										<summary className="text-sm text-govuk-blue font-bold cursor-pointer">
											Full configuration
										</summary>
										<pre className="text-xs overflow-auto max-h-96 bg-govuk-light-grey p-4 mt-3">
											{JSON.stringify(definition, null, 2)}
										</pre>
									</details>
								</>
							)}
						</fieldset>

						<div className="flex flex-wrap justify-between items-center gap-3 border-t border-govuk-mid-grey pt-5 mt-6">
							<Link href="/admin" className="text-sm">
								Back to module registry
							</Link>
							{tab !== "review" && (
								<button
									type="button"
									className="govuk-button govuk-button--secondary inline-flex items-center gap-2 mb-0"
									onClick={() =>
										setTab(
											TABS[TABS.findIndex((item) => item.key === tab) + 1].key,
										)
									}
								>
									Continue
									<ArrowRight size={17} />
								</button>
							)}
						</div>
					</div>
				</div>

				<AlertDialog.Root
					open={!!dialog}
					onOpenChange={(open) => {
						if (!open) setDialog(null);
					}}
				>
					<AlertDialog.Portal>
						<AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
						<AlertDialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-4 border-govuk-blue rounded p-6 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-auto">
							<AlertDialog.Title className="text-xl font-bold mb-3">
								{dialog?.title}
							</AlertDialog.Title>
							<AlertDialog.Description className="text-sm mb-5">
								The published module and existing applications will not change
								until a new version is published.
							</AlertDialog.Description>
							<div className="flex flex-wrap gap-3">
								<AlertDialog.Cancel className="govuk-button govuk-button--secondary mb-0">
									Cancel
								</AlertDialog.Cancel>
								<AlertDialog.Action
									className="govuk-button mb-0"
									onClick={() => dialog?.action()}
								>
									Confirm
								</AlertDialog.Action>
							</div>
						</AlertDialog.Content>
					</AlertDialog.Portal>
				</AlertDialog.Root>
			</div>
		</BuilderErrors.Provider>
	);
}
