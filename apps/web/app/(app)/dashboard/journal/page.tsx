"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";
import {
	BookOpen,
	RefreshCw,
	Loader2,
	Sparkles,
	Settings2,
	X,
	Check,
	Search,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ─── Types ───

interface ActionItem {
	owner: string;
	action: string;
}

interface Meeting {
	approximate_time: string;
	name: string;
	type: string;
	attendees: string[];
	summary: string;
	decisions: string[];
	action_items: ActionItem[];
	confidence: string;
}

interface CrackItem {
	text: string;
	urgency: string;
}

interface MasterActionList {
	josh_only: string[];
	delegated: string[];
	engineering: string[];
	scheduling: string[];
}

interface Journal {
	_id: string;
	date: string;
	title: string;
	status: string;
	generatedAt: number;
	// v2 fields
	epigraph?: string;
	mood?: string;
	wins?: string[];
	meetings?: Meeting[];
	falling_through_cracks?: CrackItem[];
	master_action_list?: MasterActionList;
	conversation_count?: number;
	action_item_count?: number;
	capture_minutes?: number;
	// legacy v1 fields
	summary?: string;
	sections?: Array<{
		type: string;
		title: string;
		content: string;
		timeRange?: { start: string; end: string };
	}>;
	keyDecisions?: string[];
	actionItems?: Array<{ text: string; priority: string }>;
	peopleMetioned?: string[];
	themes?: string[];
	wordCount?: number;
	captureMinutes?: number;
}

// ─── Helpers ───

function getTodayDate() {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function getLast30Days() {
	const days: string[] = [];
	for (let i = 0; i < 30; i++) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		days.push(`${y}-${m}-${day}`);
	}
	return days;
}

function formatDateFull(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function formatDateMedium(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

function formatDateShort(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	const today = getTodayDate();
	const yesterday = (() => {
		const yd = new Date();
		yd.setDate(yd.getDate() - 1);
		return `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
	})();
	if (dateStr === today) return "Today";
	if (dateStr === yesterday) return "Yesterday";
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayAbbrev(dateStr: string) {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d).toLocaleDateString("en-US", {
		weekday: "short",
	});
}

function formatDayNum(dateStr: string) {
	return dateStr.split("-")[2];
}

// ─── Field Notes CSS Theme ───

// Inline grain texture via SVG data URI
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`;

const THEME_VARS = {
	"field-notes": {
		bg: "#FAF8F5",
		cardBg: "#FFFDF9",
		borderColor: "#E8E2D9",
		textPrimary: "#1A1714",
		textSecondary: "#6B5E4E",
		accent: "#5C7A5C",
		gold: "#C9963A",
		red: "#B94040",
		navy: "#2C4A6E",
	},
	moleskine: {
		bg: "#F5F4F0",
		cardBg: "#FAFAF8",
		borderColor: "#E0DDD8",
		textPrimary: "#1A1A1A",
		textSecondary: "#666666",
		accent: "#333333",
		gold: "#888888",
		red: "#CC0000",
		navy: "#003366",
	},
	night: {
		bg: "#1A1814",
		cardBg: "#221F1A",
		borderColor: "#3A3530",
		textPrimary: "#F0E8D8",
		textSecondary: "#A09080",
		accent: "#C9963A",
		gold: "#C9963A",
		red: "#E05050",
		navy: "#5080C0",
	},
} as const;

type ThemeName = keyof typeof THEME_VARS;

// ─── Schedule Modal ───

function ScheduleModal({
	onClose,
	currentTime,
	currentEnabled,
	currentTheme,
}: {
	onClose: () => void;
	currentTime?: string;
	currentEnabled?: boolean;
	currentTheme?: string;
}) {
	const [time, setTime] = useState(currentTime ?? "21:00");
	const [enabled, setEnabled] = useState(currentEnabled ?? true);
	const [theme, setTheme] = useState<ThemeName>(
		(currentTheme as ThemeName) ?? "field-notes",
	);
	const [saved, setSaved] = useState(false);
	const scheduleJournal = useMutation(api.journal.scheduleJournalGeneration);
	const setPrefs = useMutation(api.journal.setUserPreferences);

	async function handleSave() {
		await scheduleJournal({
			userId: "josh",
			journalTime: time,
			journalTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			journalEnabled: enabled,
		});
		await setPrefs({ userId: "josh", journalTheme: theme });
		setSaved(true);
		setTimeout(onClose, 700);
	}

	const themes: Array<{ id: ThemeName; label: string; desc: string }> = [
		{ id: "field-notes", label: "Journal Entry", desc: "Warm cream, serif" },
		{ id: "moleskine", label: "Moleskine", desc: "Off-white, minimal" },
		{ id: "night", label: "Night", desc: "Dark with gold accents" },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
			<div className="glass-heavy rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
				<div className="flex items-start justify-between mb-5">
					<div>
						<h2 className="text-base font-semibold">Journal Settings</h2>
						<p className="text-xs text-muted-foreground mt-0.5">
							Schedule and appearance
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-muted-foreground hover:text-foreground transition-colors ml-4"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="space-y-5">
					{/* Schedule */}
					<div>
						<label
							htmlFor="journal-time"
							className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5"
						>
							Auto-generate time
						</label>
						<input
							id="journal-time"
							type="time"
							value={time}
							onChange={(e) => setTime(e.target.value)}
							className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
						/>
					</div>

					<div className="flex items-center justify-between">
						<span className="text-sm">Auto-generate daily</span>
						<button
							type="button"
							onClick={() => setEnabled(!enabled)}
							className={cn(
								"relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0",
								enabled ? "bg-primary" : "bg-muted",
							)}
						>
							<span
								className={cn(
									"inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5",
									enabled ? "translate-x-4.5" : "translate-x-0.5",
								)}
							/>
						</button>
					</div>

					{/* Theme picker */}
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
							Theme
						</p>
						<div className="grid grid-cols-3 gap-2">
							{themes.map((t) => (
								<button
									key={t.id}
									type="button"
									onClick={() => setTheme(t.id)}
									className={cn(
										"rounded-xl p-2.5 text-left border-2 transition-all",
										theme === t.id
											? "border-primary bg-primary/5"
											: "border-border hover:border-muted-foreground/30",
									)}
								>
									<div
										className="w-full h-6 rounded-md mb-1.5"
										style={{ background: THEME_VARS[t.id].bg }}
									/>
									<p className="text-[11px] font-medium leading-tight">
										{t.label}
									</p>
									<p className="text-[10px] text-muted-foreground leading-tight">
										{t.desc}
									</p>
								</button>
							))}
						</div>
					</div>

					<div className="pt-1 space-y-2">
						<Button onClick={handleSave} className="w-full" size="sm">
							{saved ? (
								<>
									<Check className="h-3.5 w-3.5 mr-1.5" /> Saved
								</>
							) : (
								"Save Settings"
							)}
						</Button>
						<button
							type="button"
							onClick={onClose}
							className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Journal Spine (shelf item) ───

function JournalSpine({
	journal,
	date,
	isSelected,
	onClick,
}: {
	journal?: Journal;
	date: string;
	isSelected: boolean;
	onClick: () => void;
}) {
	const isToday = date === getTodayDate();
	const hasJournal = journal?.status === "complete";
	const isGenerating = journal?.status === "generating";
	const actionCount = journal?.action_item_count ?? 0;

	// Status dot color
	const dotColor = isGenerating
		? "#F59E0B"
		: !hasJournal
			? "transparent"
			: actionCount === 0
				? "#22C55E"
				: actionCount <= 5
					? "#EAB308"
					: "#EF4444";

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full text-left px-3 py-2.5 rounded-xl transition-all group",
				isSelected ? "bg-primary/10" : "hover:bg-accent/50",
			)}
		>
			<div className="flex items-start gap-3">
				{/* Day column */}
				<div className="shrink-0 text-center w-8">
					<div
						className={cn(
							"text-[10px] font-medium uppercase tracking-wider",
							isSelected ? "text-primary" : "text-muted-foreground",
						)}
					>
						{formatDayAbbrev(date)}
					</div>
					<div
						className={cn(
							"text-lg font-bold leading-tight",
							isSelected
								? "text-primary"
								: isToday
									? "text-foreground"
									: "text-muted-foreground",
						)}
					>
						{formatDayNum(date)}
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0 pt-0.5">
					{hasJournal ? (
						<>
							<p
								className={cn(
									"text-xs font-semibold truncate leading-tight",
									isSelected ? "text-primary" : "text-foreground",
								)}
							>
								{journal?.title}
							</p>
							{journal?.epigraph && (
								<p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
									{journal.epigraph}
								</p>
							)}
						</>
					) : isGenerating ? (
						<p className="text-[10px] text-amber-500 flex items-center gap-1">
							<Loader2 className="h-2.5 w-2.5 animate-spin" /> Generating...
						</p>
					) : (
						<p className="text-[10px] text-muted-foreground/50">
							{isToday ? "No journal yet" : "—"}
						</p>
					)}
				</div>

				{/* Status dot */}
				<div className="shrink-0 pt-1.5">
					<div
						className={cn(
							"h-2 w-2 rounded-full",
							isGenerating && "animate-pulse",
						)}
						style={{ backgroundColor: dotColor }}
					/>
				</div>
			</div>
		</button>
	);
}

// ─── Journal Cover ───

function JournalCover({
	journal,
	theme,
	onOpen,
}: {
	journal: Journal;
	theme: ThemeName;
	onOpen: () => void;
}) {
	const t = THEME_VARS[theme];
	const [y, m, d] = journal.date.split("-").map(Number);
	const dateObj = new Date(y, m - 1, d);
	const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
	const dateStr = dateObj.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});

	const wins = journal.wins ?? [];
	const actionCount = journal.action_item_count ?? 0;
	const convCount = journal.conversation_count ?? 0;
	const captureMin = journal.capture_minutes ?? journal.captureMinutes ?? 0;

	return (
		<div
			className="relative flex flex-col items-center justify-center min-h-full px-8 py-12 overflow-hidden cursor-pointer select-none"
			style={{ background: t.bg }}
			onClick={onOpen}
		>
			{/* Grain overlay */}
			<div
				className="absolute inset-0 pointer-events-none opacity-60"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>

			{/* Vignette */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background: `radial-gradient(ellipse at center, transparent 50%, ${t.bg === "#1A1814" ? "rgba(0,0,0,0.5)" : "rgba(180,160,130,0.18)"} 100%)`,
				}}
			/>

			{/* Content */}
			<div className="relative z-10 text-center max-w-md w-full">
				{/* Day name */}
				<p
					className="text-sm uppercase tracking-[0.25em] mb-3 font-medium"
					style={{ color: t.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
				>
					{dayName}
				</p>

				{/* Big date */}
				<h1
					className="text-5xl sm:text-6xl font-black leading-none mb-2"
					style={{
						fontFamily: "'Playfair Display', Georgia, serif",
						color: t.textPrimary,
					}}
				>
					{dateStr.split(",")[0]}
				</h1>
				<p
					className="text-lg mb-8"
					style={{
						fontFamily: "'Playfair Display', Georgia, serif",
						color: t.textSecondary,
					}}
				>
					{dateStr.split(",").slice(1).join(",").trim()}
				</p>

				{/* Title */}
				<div
					className="w-16 h-px mx-auto mb-6"
					style={{ backgroundColor: t.borderColor }}
				/>
				<h2
					className="text-2xl font-bold leading-tight mb-4"
					style={{
						fontFamily: "'Playfair Display', Georgia, serif",
						color: t.textPrimary,
					}}
				>
					{journal.title}
				</h2>

				{/* Epigraph */}
				{journal.epigraph && (
					<p
						className="text-base italic leading-relaxed mb-8 px-4"
						style={{
							fontFamily: "'Lora', Georgia, serif",
							color: t.textSecondary,
						}}
					>
						&ldquo;{journal.epigraph}&rdquo;
					</p>
				)}

				{/* At-a-glance strip */}
				<div
					className="rounded-2xl px-6 py-4 grid grid-cols-3 gap-4 text-center mb-8"
					style={{
						background: t.cardBg,
						border: `1px solid ${t.borderColor}`,
					}}
				>
					<div>
						<div
							className="text-2xl font-bold"
							style={{
								fontFamily: "'Playfair Display', serif",
								color: t.textPrimary,
							}}
						>
							{convCount}
						</div>
						<div
							className="text-[10px] uppercase tracking-wider mt-0.5"
							style={{ color: t.textSecondary }}
						>
							Sessions
						</div>
					</div>
					<div>
						<div
							className="text-2xl font-bold"
							style={{
								fontFamily: "'Playfair Display', serif",
								color: t.textPrimary,
							}}
						>
							{actionCount}
						</div>
						<div
							className="text-[10px] uppercase tracking-wider mt-0.5"
							style={{ color: t.textSecondary }}
						>
							Actions
						</div>
					</div>
					<div>
						<div
							className="text-2xl font-bold"
							style={{
								fontFamily: "'Playfair Display', serif",
								color: t.textPrimary,
							}}
						>
							{captureMin}m
						</div>
						<div
							className="text-[10px] uppercase tracking-wider mt-0.5"
							style={{ color: t.textSecondary }}
						>
							Captured
						</div>
					</div>
				</div>

				{/* Top wins preview */}
				{wins.length > 0 && (
					<div className="text-left mb-8 px-2">
						<p
							className="text-xs uppercase tracking-wider mb-2"
							style={{ color: t.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
						>
							Top wins
						</p>
						{wins.slice(0, 2).map((win, i) => (
							<p
								key={i}
								className="text-sm leading-relaxed"
								style={{ color: t.textPrimary, fontFamily: "'Lora', serif" }}
							>
								<span style={{ color: t.gold }}>⚡</span> {win}
							</p>
						))}
					</div>
				)}

				{/* Open CTA */}
				<button
					type="button"
					className="px-8 py-3 rounded-full text-sm font-semibold tracking-wide transition-all hover:opacity-80 active:scale-95"
					style={{
						background: t.accent,
						color: "#FFFFFF",
						fontFamily: "'Plus Jakarta Sans', sans-serif",
					}}
				>
					Open Journal →
				</button>
			</div>
		</div>
	);
}

// ─── Section page: Wins ───

function WinsPage({
	wins,
	theme,
}: {
	wins: string[];
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];

	return (
		<div
			className="h-full overflow-y-auto px-8 py-10"
			style={{ background: t.bg }}
		>
			{/* Grain */}
			<div
				className="fixed inset-0 pointer-events-none opacity-40"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>
			<div className="relative z-10 max-w-lg mx-auto">
				<h2
					className="text-4xl mb-8 font-bold"
					style={{ fontFamily: "'Caveat', cursive", color: t.gold }}
				>
					⚡ Today&apos;s Wins
				</h2>
				<div className="space-y-0">
					{wins.map((win, i) => (
						<div key={i}>
							<p
								className="py-4 text-base leading-[1.8]"
								style={{
									fontFamily: "'Lora', Georgia, serif",
									color: t.textPrimary,
								}}
							>
								{win}
							</p>
							{i < wins.length - 1 && (
								<div
									className="h-px"
									style={{ backgroundColor: t.borderColor }}
								/>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Section page: Meeting ───

function MeetingPage({
	meeting,
	theme,
}: {
	meeting: Meeting;
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];

	return (
		<div
			className="h-full overflow-y-auto px-8 py-10"
			style={{ background: t.bg }}
		>
			<div
				className="fixed inset-0 pointer-events-none opacity-40"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>
			<div className="relative z-10 max-w-lg mx-auto">
				{/* Header */}
				<div className="flex items-start justify-between mb-1 gap-4">
					<h2
						className="text-2xl font-bold leading-tight"
						style={{
							fontFamily: "'Playfair Display', Georgia, serif",
							color: t.textPrimary,
						}}
					>
						{meeting.name}
					</h2>
					<span
						className="text-sm shrink-0 mt-1"
						style={{
							fontFamily: "'Plus Jakarta Sans', sans-serif",
							color: t.textSecondary,
						}}
					>
						{meeting.approximate_time}
					</span>
				</div>

				{/* Attendees */}
				{meeting.attendees.length > 0 && (
					<p
						className="text-sm small-caps mb-6 font-medium"
						style={{
							fontFamily: "'Plus Jakarta Sans', sans-serif",
							color: t.textSecondary,
							letterSpacing: "0.08em",
						}}
					>
						{meeting.attendees.join(" · ")}
					</p>
				)}

				<div
					className="w-12 h-px mb-6"
					style={{ backgroundColor: t.borderColor }}
				/>

				{/* Summary prose */}
				<div
					className="text-base leading-[1.85] mb-8 whitespace-pre-wrap"
					style={{
						fontFamily: "'Lora', Georgia, serif",
						color: t.textPrimary,
					}}
				>
					{meeting.summary}
				</div>

				{/* Decisions */}
				{meeting.decisions.length > 0 && (
					<div className="mb-6">
						<p
							className="text-xs uppercase tracking-wider mb-3 font-semibold"
							style={{
								color: t.textSecondary,
								fontFamily: "'Plus Jakarta Sans', sans-serif",
							}}
						>
							Decisions
						</p>
						<ul className="space-y-1.5">
							{meeting.decisions.map((d, i) => (
								<li
									key={i}
									className="text-sm flex items-start gap-2"
									style={{
										fontFamily: "'Lora', serif",
										color: t.textPrimary,
									}}
								>
									<span style={{ color: t.navy }}>▸</span> {d}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Action items */}
				{meeting.action_items.length > 0 && (
					<div
						className="rounded-xl px-5 py-4"
						style={{
							background: t.cardBg,
							border: `1px solid ${t.borderColor}`,
						}}
					>
						<p
							className="text-xs uppercase tracking-wider mb-3 font-semibold"
							style={{
								color: t.textSecondary,
								fontFamily: "'Plus Jakarta Sans', sans-serif",
							}}
						>
							Action Items
						</p>
						<ul className="space-y-2.5">
							{meeting.action_items.map((ai, i) => (
								<li key={i} className="flex items-start gap-2.5">
									<span
										className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 uppercase tracking-wide"
										style={{
											background: t.navy + "18",
											color: t.navy,
											fontFamily: "'Plus Jakarta Sans', sans-serif",
										}}
									>
										{ai.owner}
									</span>
									<span
										className="text-sm leading-snug"
										style={{
											fontFamily: "'Lora', serif",
											color: t.textPrimary,
										}}
									>
										{ai.action}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Section page: Falling Through Cracks ───

function CracksPage({
	cracks,
	theme,
}: {
	cracks: CrackItem[];
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];

	return (
		<div
			className="h-full overflow-y-auto px-8 py-10"
			style={{ background: t.bg }}
		>
			<div
				className="fixed inset-0 pointer-events-none opacity-40"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>
			<div className="relative z-10 max-w-lg mx-auto">
				<div className="border-l-4 pl-5 mb-8" style={{ borderColor: t.red }}>
					<h2
						className="text-4xl font-bold"
						style={{ fontFamily: "'Caveat', cursive", color: t.textPrimary }}
					>
						Things Falling Through the Cracks
					</h2>
				</div>

				<div className="space-y-5">
					{cracks.map((item, i) => {
						const parts = item.text.split("—");
						const firstPart = parts[0];
						const rest = parts.slice(1).join("—");

						return (
							<div
								key={i}
								className="flex items-start gap-3"
							>
								<div className="shrink-0 mt-1">
									{item.urgency === "high" ? (
										<div
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: t.red }}
										/>
									) : (
										<div
											className="h-2.5 w-2.5 rounded-full"
											style={{ backgroundColor: "#F59E0B" }}
										/>
									)}
								</div>
								<div>
									<p
										className={cn("text-sm leading-relaxed")}
										style={{
											fontFamily: "'Lora', Georgia, serif",
											color: t.textPrimary,
										}}
									>
										<span
											className="font-semibold"
											style={
												item.urgency === "high"
													? {
															textDecoration: "underline",
															textDecorationColor: t.red,
															textUnderlineOffset: "3px",
														}
													: {}
											}
										>
											{firstPart.trim()}
										</span>
										{rest && (
											<span style={{ color: t.textSecondary }}>
												{" "}—{rest}
											</span>
										)}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ─── Section page: Master Action List ───

function ActionsPage({
	list,
	theme,
}: {
	list: MasterActionList;
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];

	const buckets = [
		{
			key: "josh_only" as const,
			label: "Josh Only",
			color: t.red,
			items: list.josh_only,
		},
		{
			key: "delegated" as const,
			label: "Delegated",
			color: "#C9963A",
			items: list.delegated,
		},
		{
			key: "engineering" as const,
			label: "Engineering",
			color: t.navy,
			items: list.engineering,
		},
		{
			key: "scheduling" as const,
			label: "Scheduling",
			color: t.accent,
			items: list.scheduling,
		},
	].filter((b) => b.items.length > 0);

	return (
		<div
			className="h-full overflow-y-auto px-8 py-10"
			style={{ background: t.bg }}
		>
			<div
				className="fixed inset-0 pointer-events-none opacity-40"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>
			<div className="relative z-10 max-w-lg mx-auto">
				<h2
					className="text-4xl font-bold mb-8"
					style={{ fontFamily: "'Caveat', cursive", color: t.textPrimary }}
				>
					⚫ Master Action List
				</h2>

				<div className="space-y-7">
					{buckets.map((bucket) => (
						<div key={bucket.key}>
							<div
								className="flex items-center gap-2 mb-3 pb-2"
								style={{ borderBottom: `2px solid ${bucket.color}` }}
							>
								<h3
									className="text-sm font-bold uppercase tracking-wider"
									style={{
										color: bucket.color,
										fontFamily: "'Plus Jakarta Sans', sans-serif",
									}}
								>
									{bucket.label}
								</h3>
								<span
									className="text-xs font-medium ml-auto"
									style={{ color: t.textSecondary }}
								>
									{bucket.items.length}
								</span>
							</div>
							<ul className="space-y-2">
								{bucket.items.map((item, i) => (
									<li
										key={i}
										className="text-sm flex items-start gap-2 leading-relaxed"
										style={{
											fontFamily: "'Lora', serif",
											color: t.textPrimary,
										}}
									>
										<span
											className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
											style={{ backgroundColor: bucket.color + "80" }}
										/>
										{item}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Legacy v1 Journal Renderer ───

function LegacyJournalView({
	journal,
	theme,
}: {
	journal: Journal;
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];

	return (
		<div
			className="h-full overflow-y-auto px-8 py-10"
			style={{ background: t.bg }}
		>
			<div className="max-w-lg mx-auto space-y-6">
				<p
					className="text-sm italic"
					style={{ color: t.textSecondary, fontFamily: "'Lora', serif" }}
				>
					{journal.summary}
				</p>
				{(journal.sections ?? []).map((section) => (
					<div key={section.type}>
						<h3
							className="text-base font-semibold mb-2"
							style={{
								fontFamily: "'Playfair Display', serif",
								color: t.textPrimary,
							}}
						>
							{section.title}
						</h3>
						<p
							className="text-sm leading-relaxed whitespace-pre-wrap"
							style={{ fontFamily: "'Lora', serif", color: t.textPrimary }}
						>
							{section.content}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Book View (page-turn navigation) ───

type PageDef =
	| { type: "wins" }
	| { type: "meeting"; index: number }
	| { type: "cracks" }
	| { type: "actions" }
	| { type: "legacy" };

function buildPages(journal: Journal): PageDef[] {
	// v2 journal
	if (journal.wins ?? journal.meetings ?? journal.falling_through_cracks) {
		const pages: PageDef[] = [];
		if ((journal.wins ?? []).length > 0) pages.push({ type: "wins" });
		(journal.meetings ?? []).forEach((_, i) =>
			pages.push({ type: "meeting", index: i }),
		);
		if ((journal.falling_through_cracks ?? []).length > 0)
			pages.push({ type: "cracks" });
		if (
			journal.master_action_list &&
			Object.values(journal.master_action_list).some((arr) => arr.length > 0)
		) {
			pages.push({ type: "actions" });
		}
		return pages;
	}
	// v1 journal
	return [{ type: "legacy" }];
}

const TAB_CONFIG = [
	{
		type: "wins",
		label: "Wins",
		emoji: "⚡",
		color: "#C9963A",
	},
	{
		type: "meeting",
		label: "Meetings",
		emoji: "💬",
		color: "#2C4A6E",
	},
	{
		type: "cracks",
		label: "Cracks",
		emoji: "🔴",
		color: "#B94040",
	},
	{
		type: "actions",
		label: "Actions",
		emoji: "⚫",
		color: "#3A3A3A",
	},
];

function BookView({
	journal,
	theme,
	onBack,
	onRegenerate,
	isRegenerating,
}: {
	journal: Journal;
	theme: ThemeName;
	onBack: () => void;
	onRegenerate: () => void;
	isRegenerating: boolean;
}) {
	const t = THEME_VARS[theme];
	const pages = buildPages(journal);
	const [pageIndex, setPageIndex] = useState(0);
	const [transitioning, setTransitioning] = useState(false);
	const [direction, setDirection] = useState<"forward" | "back">("forward");
	const [displayIndex, setDisplayIndex] = useState(0);

	const navigateTo = useCallback(
		(newIndex: number) => {
			if (newIndex < 0 || newIndex >= pages.length || transitioning) return;
			setDirection(newIndex > pageIndex ? "forward" : "back");
			setTransitioning(true);
			setTimeout(() => {
				setPageIndex(newIndex);
				setDisplayIndex(newIndex);
				setTransitioning(false);
			}, 280);
		},
		[pageIndex, pages.length, transitioning],
	);

	// Swipe support
	const touchStartX = useRef<number>(0);
	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
	};
	const handleTouchEnd = (e: React.TouchEvent) => {
		const delta = touchStartX.current - e.changedTouches[0].clientX;
		if (delta > 60) navigateTo(pageIndex + 1);
		else if (delta < -60) navigateTo(pageIndex - 1);
	};

	const currentPage = pages[displayIndex];
	if (!currentPage) return null;

	// Section ribbon tabs — unique section types
	const sectionTypes = [...new Set(pages.map((p) => p.type))];

	function renderPage(page: PageDef) {
		switch (page.type) {
			case "wins":
				return (
					<WinsPage wins={journal.wins ?? []} theme={theme} />
				);
			case "meeting":
				return (
					<MeetingPage
						meeting={journal.meetings![page.index]}
						theme={theme}
					/>
				);
			case "cracks":
				return (
					<CracksPage
						cracks={journal.falling_through_cracks ?? []}
						theme={theme}
					/>
				);
			case "actions":
				return (
					<ActionsPage
						list={
							journal.master_action_list ?? {
								josh_only: [],
								delegated: [],
								engineering: [],
								scheduling: [],
							}
						}
						theme={theme}
					/>
				);
			case "legacy":
				return <LegacyJournalView journal={journal} theme={theme} />;
			default:
				return null;
		}
	}

	return (
		<div
			className="flex flex-col h-full"
			style={{ background: t.bg }}
		>
			{/* Book toolbar */}
			<div
				className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
				style={{
					background: t.cardBg,
					borderColor: t.borderColor,
				}}
			>
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all hover:opacity-70"
					style={{ color: t.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
				>
					<ChevronLeft className="h-3.5 w-3.5" />
					Cover
				</button>

				{/* Page indicator */}
				<div className="flex-1 flex items-center justify-center gap-1.5">
					{pages.map((p, i) => (
						<button
							key={i}
							type="button"
							onClick={() => navigateTo(i)}
							className="transition-all rounded-full"
							style={{
								width: i === pageIndex ? 20 : 6,
								height: 6,
								background:
									i === pageIndex
										? t.accent
										: t.borderColor,
							}}
						/>
					))}
				</div>

				<button
					type="button"
					onClick={onRegenerate}
					disabled={isRegenerating}
					className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all hover:opacity-70"
					style={{ color: t.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
				>
					{isRegenerating ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="h-3.5 w-3.5" />
					)}
					Regen
				</button>
			</div>

			{/* Page area with nav arrows + section tabs */}
			<div className="flex-1 relative overflow-hidden flex">
				{/* Left nav zone */}
				{pageIndex > 0 && (
					<button
						type="button"
						onClick={() => navigateTo(pageIndex - 1)}
						className="absolute left-0 top-0 h-full w-12 z-20 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity group"
					>
						<div
							className="rounded-full p-2 shadow-md"
							style={{ background: t.cardBg, border: `1px solid ${t.borderColor}` }}
						>
							<ChevronLeft
								className="h-4 w-4"
								style={{ color: t.textSecondary }}
							/>
						</div>
					</button>
				)}

				{/* Page content */}
				<div
					className="flex-1 overflow-hidden"
					style={{
						transition: "opacity 0.28s ease, transform 0.28s ease",
						opacity: transitioning ? 0 : 1,
						transform: transitioning
							? direction === "forward"
								? "perspective(1200px) rotateY(-8deg) translateX(-20px)"
								: "perspective(1200px) rotateY(8deg) translateX(20px)"
							: "perspective(1200px) rotateY(0deg) translateX(0px)",
					}}
					onTouchStart={handleTouchStart}
					onTouchEnd={handleTouchEnd}
				>
					{renderPage(currentPage)}
				</div>

				{/* Right nav zone */}
				{pageIndex < pages.length - 1 && (
					<button
						type="button"
						onClick={() => navigateTo(pageIndex + 1)}
						className="absolute right-0 top-0 h-full w-12 z-20 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity group"
					>
						<div
							className="rounded-full p-2 shadow-md"
							style={{ background: t.cardBg, border: `1px solid ${t.borderColor}` }}
						>
							<ChevronRight
								className="h-4 w-4"
								style={{ color: t.textSecondary }}
							/>
						</div>
					</button>
				)}

				{/* Section ribbon tabs (right edge) */}
				<div className="absolute right-14 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-30">
					{sectionTypes.map((sType) => {
						const tabDef = TAB_CONFIG.find((tc) => tc.type === sType);
						if (!tabDef) return null;
						const firstPageOfSection = pages.findIndex(
							(p) => p.type === sType,
						);
						const isActive = currentPage.type === sType;

						return (
							<button
								key={sType}
								type="button"
								onClick={() => navigateTo(firstPageOfSection)}
								title={tabDef.label}
								className="h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all"
								style={{
									background: isActive
										? tabDef.color
										: t.cardBg,
									border: `1px solid ${isActive ? tabDef.color : t.borderColor}`,
									boxShadow: isActive ? `0 2px 8px ${tabDef.color}40` : "none",
								}}
							>
								{tabDef.emoji}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ─── Search Results ───

function SearchResults({
	journals,
	query,
	onSelect,
	theme,
}: {
	journals: Journal[];
	query: string;
	onSelect: (date: string) => void;
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];
	const q = query.toLowerCase();

	const matches = journals.filter((j) => {
		if (j.status !== "complete") return false;
		const text = [
			j.title,
			j.epigraph,
			...(j.wins ?? []),
			...(j.meetings ?? []).map((m) => `${m.name} ${m.summary}`),
			...(j.falling_through_cracks ?? []).map((c) => c.text),
			...(j.master_action_list
				? Object.values(j.master_action_list).flat()
				: []),
			j.summary ?? "",
		]
			.join(" ")
			.toLowerCase();
		return text.includes(q);
	});

	if (matches.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
				<Search
					className="h-8 w-8 mb-3 opacity-30"
					style={{ color: t.textSecondary }}
				/>
				<p
					className="text-sm"
					style={{ color: t.textSecondary, fontFamily: "'Lora', serif" }}
				>
					No journals match &ldquo;{query}&rdquo;
				</p>
			</div>
		);
	}

	// Highlight helper
	function highlight(text: string, max = 120): string {
		const idx = text.toLowerCase().indexOf(q);
		if (idx === -1) return text.slice(0, max);
		const start = Math.max(0, idx - 30);
		const end = Math.min(text.length, idx + q.length + 60);
		return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
	}

	function getExcerpt(j: Journal): string {
		const sources = [
			j.epigraph,
			...(j.wins ?? []),
			...(j.meetings ?? []).map((m) => m.summary),
			j.summary,
		].filter(Boolean) as string[];
		for (const s of sources) {
			if (s.toLowerCase().includes(q)) return highlight(s);
		}
		return "";
	}

	return (
		<div
			className="h-full overflow-y-auto px-6 py-6"
			style={{ background: t.bg }}
		>
			<p
				className="text-xs uppercase tracking-wider mb-4"
				style={{ color: t.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
			>
				{matches.length} result{matches.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
			</p>
			<div className="space-y-3">
				{matches.map((j) => (
					<button
						key={j._id}
						type="button"
						onClick={() => onSelect(j.date)}
						className="w-full text-left rounded-xl p-4 transition-all hover:opacity-80"
						style={{
							background: t.cardBg,
							border: `1px solid ${t.borderColor}`,
						}}
					>
						<div className="flex items-start justify-between gap-2 mb-1">
							<p
								className="text-sm font-semibold"
								style={{
									fontFamily: "'Playfair Display', serif",
									color: t.textPrimary,
								}}
							>
								{j.title}
							</p>
							<p
								className="text-xs shrink-0"
								style={{ color: t.textSecondary }}
							>
								{formatDateShort(j.date)}
							</p>
						</div>
						{getExcerpt(j) && (
							<p
								className="text-xs leading-relaxed"
								style={{ fontFamily: "'Lora', serif", color: t.textSecondary }}
							>
								{getExcerpt(j)}
							</p>
						)}
					</button>
				))}
			</div>
		</div>
	);
}

// ─── Generating State ───

const GENERATING_STAGES = [
	"Analyzing conversations…",
	"Identifying key moments…",
	"Writing meeting summaries…",
	"Compiling action items…",
	"Finishing your journal…",
];

function GeneratingState({ theme }: { theme: ThemeName }) {
	const t = THEME_VARS[theme];
	const [stage, setStage] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setStage((s) => (s < GENERATING_STAGES.length - 1 ? s + 1 : s));
		}, 3000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div
			className="flex flex-col items-center justify-center h-full text-center gap-6 px-8 py-16"
			style={{ background: t.bg }}
		>
			<div
				className="p-5 rounded-2xl"
				style={{ background: t.cardBg, border: `1px solid ${t.borderColor}` }}
			>
				<BookOpen
					className="h-10 w-10"
					style={{ color: t.accent + "60" }}
				/>
			</div>
			<div>
				<p
					className="text-base font-semibold mb-2"
					style={{
						fontFamily: "'Playfair Display', serif",
						color: t.textPrimary,
					}}
				>
					Generating your journal entry…
				</p>
				<p
					className="text-sm transition-all duration-500"
					style={{ fontFamily: "'Lora', serif", color: t.textSecondary }}
				>
					{GENERATING_STAGES[stage]}
				</p>
			</div>
			<div className="flex gap-1.5">
				{GENERATING_STAGES.map((_, i) => (
					<div
						key={i}
						className="h-1.5 rounded-full transition-all duration-500"
						style={{
							width: i <= stage ? 20 : 6,
							background: i <= stage ? t.accent : t.borderColor,
						}}
					/>
				))}
			</div>
		</div>
	);
}

// ─── Empty Day ───

function EmptyDay({
	date,
	onGenerate,
	isGenerating,
	theme,
}: {
	date: string;
	onGenerate: () => void;
	isGenerating: boolean;
	theme: ThemeName;
}) {
	const t = THEME_VARS[theme];
	const isToday = date === getTodayDate();

	return (
		<div
			className="flex flex-col items-center justify-center h-full text-center gap-5 px-8 py-16"
			style={{ background: t.bg }}
		>
			<div
				className="fixed inset-0 pointer-events-none opacity-30"
				style={{ backgroundImage: GRAIN_BG, backgroundSize: "300px 300px" }}
			/>
			<div className="relative z-10">
				<div
					className="p-5 rounded-2xl mb-4 mx-auto w-fit"
					style={{ background: t.cardBg, border: `1px solid ${t.borderColor}` }}
				>
					<BookOpen
						className="h-10 w-10"
						style={{ color: t.accent + "50" }}
					/>
				</div>
				<p
					className="text-xl font-bold mb-2"
					style={{
						fontFamily: "'Playfair Display', serif",
						color: t.textPrimary,
					}}
				>
					{isToday ? "No journal yet for today" : "No journal for this day"}
				</p>
				<p
					className="text-sm mb-6 max-w-xs"
					style={{ fontFamily: "'Lora', serif", color: t.textSecondary }}
				>
					{isToday
						? "Start a capture session and then generate your daily journal entry."
						: "No journal was generated for this date."}
				</p>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onGenerate}
						disabled={isGenerating}
						className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
						style={{
							background: t.accent,
							color: "#FFFFFF",
							fontFamily: "'Plus Jakarta Sans', sans-serif",
						}}
					>
						{isGenerating ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Sparkles className="h-3.5 w-3.5" />
						)}
						{isGenerating ? "Generating…" : "Generate Journal"}
					</button>
					<Link href="/dashboard/journal/review">
						<button
							type="button"
							className="px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-70"
							style={{
								background: t.cardBg,
								border: `1px solid ${t.borderColor}`,
								color: t.textSecondary,
								fontFamily: "'Plus Jakarta Sans', sans-serif",
							}}
						>
							Review Sessions
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
}

// ─── Main Page ───

export default function JournalPage() {
	const today = getTodayDate();
	const [selectedDate, setSelectedDate] = useState(today);
	const [viewState, setViewState] = useState<"cover" | "book">("cover");
	const [isGenerating, setIsGenerating] = useState(false);
	const [showSchedule, setShowSchedule] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showSearch, setShowSearch] = useState(false);

	const days = getLast30Days();

	const journals = (useQuery(api.journal.getJournalList, {
		userId: "josh",
		limit: 30,
	}) ?? []) as Journal[];

	const selectedJournal = useQuery(api.journal.getJournal, {
		userId: "josh",
		date: selectedDate,
	}) as Journal | null | undefined;

	const prefs = useQuery(api.journal.getUserPreferences, { userId: "josh" });
	const theme: ThemeName = (prefs?.journalTheme as ThemeName) ?? "field-notes";

	const generateJournal = useAction(api.journal.generateJournal);

	async function handleGenerate(date: string) {
		setIsGenerating(true);
		try {
			await generateJournal({ userId: "josh", date });
		} catch (e) {
			console.error("Failed to generate journal:", e);
		} finally {
			setIsGenerating(false);
		}
	}

	function handleSelectDate(date: string) {
		setSelectedDate(date);
		setViewState("cover");
		setShowSearch(false);
		setSearchQuery("");
	}

	function handleSearchSelect(date: string) {
		setSelectedDate(date);
		setShowSearch(false);
		setSearchQuery("");
		setViewState("book");
	}

	const isLoading = selectedJournal === undefined;
	const hasJournal = selectedJournal?.status === "complete";
	const isGeneratingServer = selectedJournal?.status === "generating";
	const t = THEME_VARS[theme];

	return (
		<>
			<DashboardLayout>
				<div
					className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden"
					style={{ background: t.bg }}
				>
					{/* Left panel: Journal Shelf */}
					<div
						className="w-[220px] shrink-0 flex flex-col border-r"
						style={{
							background: t.cardBg,
							borderColor: t.borderColor,
						}}
					>
						{/* Header */}
						<div
							className="px-4 pt-4 pb-3 border-b shrink-0"
							style={{ borderColor: t.borderColor }}
						>
							<div className="flex items-center justify-between mb-3">
								<h1
									className="text-lg font-bold tracking-tight"
									style={{
										fontFamily: "'Playfair Display', serif",
										color: t.textPrimary,
									}}
								>
									Journal
								</h1>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => setShowSearch(!showSearch)}
										className="h-7 w-7 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
										style={{ color: showSearch ? t.accent : t.textSecondary }}
									>
										<Search className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onClick={() => setShowSchedule(true)}
										className="h-7 w-7 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
										style={{ color: t.textSecondary }}
									>
										<Settings2 className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>

							{/* Search input */}
							{showSearch && (
								<div className="relative mb-1">
									<Search
										className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
										style={{ color: t.textSecondary }}
									/>
									<input
										type="text"
										placeholder="Search journals…"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="w-full rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none"
										style={{
											background: t.bg,
											border: `1px solid ${t.borderColor}`,
											color: t.textPrimary,
											fontFamily: "'Plus Jakarta Sans', sans-serif",
										}}
										autoFocus
									/>
									{searchQuery && (
										<button
											type="button"
											onClick={() => setSearchQuery("")}
											className="absolute right-2 top-1/2 -translate-y-1/2"
											style={{ color: t.textSecondary }}
										>
											<X className="h-3 w-3" />
										</button>
									)}
								</div>
							)}
						</div>

						{/* Review CTA */}
						<div
							className="px-3 py-2 border-b shrink-0"
							style={{ borderColor: t.borderColor }}
						>
							<Link href="/dashboard/journal/review" className="block">
								<button
									type="button"
									className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
									style={{
										background: t.accent + "15",
										color: t.accent,
										fontFamily: "'Plus Jakarta Sans', sans-serif",
									}}
								>
									<ClipboardList className="h-3.5 w-3.5 shrink-0" />
									Review & Generate
								</button>
							</Link>
						</div>

						{/* Spine list */}
						<div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
							{days.map((date) => {
								const journal = journals.find((j) => j.date === date);
								return (
									<JournalSpine
										key={date}
										journal={journal as Journal | undefined}
										date={date}
										isSelected={date === selectedDate}
										onClick={() => handleSelectDate(date)}
									/>
								);
							})}
						</div>
					</div>

					{/* Main content */}
					<div className="flex-1 flex flex-col overflow-hidden">
						{/* Content */}
						<div className="flex-1 overflow-hidden relative">
							{/* Search overlay */}
							{showSearch && searchQuery.trim() ? (
								<SearchResults
									journals={journals}
									query={searchQuery}
									onSelect={handleSearchSelect}
									theme={theme}
								/>
							) : isLoading ? (
								<div
									className="flex items-center justify-center h-full"
									style={{ background: t.bg }}
								>
									<Loader2
										className="h-6 w-6 animate-spin"
										style={{ color: t.accent + "80" }}
									/>
								</div>
							) : isGeneratingServer || (isGenerating && !hasJournal) ? (
								<GeneratingState theme={theme} />
							) : hasJournal && selectedJournal ? (
								viewState === "cover" ? (
									<JournalCover
										journal={selectedJournal as Journal}
										theme={theme}
										onOpen={() => setViewState("book")}
									/>
								) : (
									<BookView
										journal={selectedJournal as Journal}
										theme={theme}
										onBack={() => setViewState("cover")}
										onRegenerate={() => handleGenerate(selectedDate)}
										isRegenerating={isGenerating}
									/>
								)
							) : (
								<EmptyDay
									date={selectedDate}
									onGenerate={() => handleGenerate(selectedDate)}
									isGenerating={isGenerating}
									theme={theme}
								/>
							)}
						</div>

						{/* Bottom bar: date label */}
						<div
							className="px-4 py-2 border-t shrink-0 flex items-center justify-between"
							style={{
								background: t.cardBg,
								borderColor: t.borderColor,
							}}
						>
							<p
								className="text-xs"
								style={{
									color: t.textSecondary,
									fontFamily: "'Plus Jakarta Sans', sans-serif",
								}}
							>
								{formatDateMedium(selectedDate)}
							</p>
							{hasJournal && selectedJournal && (
								<div className="flex items-center gap-3">
									{selectedJournal.mood && (
										<span
											className="text-xs px-2 py-0.5 rounded-full"
											style={{
												background: t.accent + "15",
												color: t.accent,
												fontFamily: "'Plus Jakarta Sans', sans-serif",
											}}
										>
											{selectedJournal.mood}
										</span>
									)}
									{viewState === "book" ? (
										<button
											type="button"
											onClick={() => setViewState("cover")}
											className="text-xs font-medium transition-all hover:opacity-70"
											style={{ color: t.textSecondary }}
										>
											← Cover
										</button>
									) : (
										<button
											type="button"
											onClick={() => setViewState("book")}
											className="text-xs font-medium transition-all hover:opacity-70"
											style={{ color: t.accent }}
										>
											Open →
										</button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</DashboardLayout>

			{showSchedule && (
				<ScheduleModal
					onClose={() => setShowSchedule(false)}
					currentTime={prefs?.journalTime}
					currentEnabled={prefs?.journalEnabled}
					currentTheme={prefs?.journalTheme}
				/>
			)}
		</>
	);
}
