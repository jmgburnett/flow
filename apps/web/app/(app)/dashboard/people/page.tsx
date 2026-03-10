"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Users,
	Plus,
	Search,
	X,
	AlertCircle,
	Check,
	XCircle,
	GitMerge,
	Mail,
	Phone,
	Building2,
	Briefcase,
	UserPlus,
	Trash2,
	ChevronLeft,
	Calendar,
	MessageSquare,
	Send,
	Inbox,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ContactType = "contact" | "coworker" | "team_member";
type FilterType = "all" | ContactType;

const TYPE_CONFIG = {
	contact: { label: "Contact", color: "bg-primary", icon: "👤" },
	coworker: { label: "Coworker", color: "bg-green-600", icon: "🏢" },
	team_member: { label: "Team", color: "bg-purple-600", icon: "⭐" },
} as const;

const SOURCE_ICONS: Record<string, string> = {
	email: "📧",
	calendar: "📅",
	sms: "💬",
	slack: "💼",
	recording: "🎙️",
	chat: "💭",
	manual: "✏️",
};

function timeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days === 1) return "Yesterday";
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}

function formatDate(ts: number): string {
	return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PeoplePage() {
	const user = { name: "Josh", email: "josh@onflourish.com", image: undefined as string | undefined };
	const userId = "josh";

	const [filter, setFilter] = useState<FilterType>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [showReviewQueue, setShowReviewQueue] = useState(false);
	const [selectedContact, setSelectedContact] = useState<any>(null);

	// Edit/create dialog
	const [editing, setEditing] = useState<any>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [formName, setFormName] = useState("");
	const [formEmails, setFormEmails] = useState("");
	const [formPhones, setFormPhones] = useState("");
	const [formType, setFormType] = useState<ContactType>("contact");
	const [formCompany, setFormCompany] = useState("");
	const [formRole, setFormRole] = useState("");
	const [formNotes, setFormNotes] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const contacts = useQuery(api.people.list, {
		userId,
		type: filter === "all" ? undefined : filter,
	});

	const pendingContacts = useQuery(api.people.listPending, { userId });
	const pendingCount = useQuery(api.people.pendingCount, { userId });

	// Load all profiles — these ARE the primary people data
	const profiles = useQuery(api.profileBuilder.listProfiles, { userId });

	const createContact = useMutation(api.people.create);
	const updateContact = useMutation(api.people.update);
	const removeContact = useMutation(api.people.remove);
	const approvePending = useMutation(api.people.approvePending);
	const mergePending = useMutation(api.people.mergePending);
	const dismissPending = useMutation(api.people.dismissPending);

	// Build a lookup map: email → contact (for linking)
	const contactMap = new Map<string, any>();
	if (contacts) {
		for (const c of contacts) {
			for (const email of (c.emails || [])) {
				contactMap.set(email.toLowerCase(), c);
			}
		}
	}

	// Merge profiles + contacts into unified people list
	// Profiles are primary, contacts add type/role/company/notes
	const mergedPeople = (() => {
		if (!profiles) return undefined;
		const seen = new Set<string>();
		const people: any[] = [];

		// First: all profiles (primary source)
		for (const profile of profiles) {
			seen.add(profile.email.toLowerCase());
			const linkedContact = contactMap.get(profile.email.toLowerCase());
			people.push({
				_id: linkedContact?._id || profile._id,
				isProfile: true,
				profile,
				// Use contact data if available, otherwise derive from profile
				name: linkedContact?.name || profile.name,
				emails: linkedContact?.emails || [profile.email],
				phones: linkedContact?.phones || [],
				type: linkedContact?.type || inferTypeFromEmail(profile.email),
				company: linkedContact?.company,
				role: linkedContact?.role,
				notes: linkedContact?.notes,
				sources: profile.sources,
				lastInteraction: profile.lastInteractionDate || linkedContact?.lastInteraction,
				interactionCount: (profile.emailsSent || 0) + (profile.emailsReceived || 0) + (profile.sharedMeetings || 0),
			});
		}

		// Then: contacts without profiles
		if (contacts) {
			for (const contact of contacts) {
				const hasProfile = contact.emails?.some((e: string) => seen.has(e.toLowerCase()));
				if (!hasProfile) {
					people.push({
						...contact,
						isProfile: false,
						profile: null,
					});
				}
			}
		}

		return people;
	})();

	function inferTypeFromEmail(email: string): ContactType {
		if (email.endsWith("@gloo.us") || email.endsWith("@gloo.tech")) return "coworker";
		if (email.endsWith("@church.tech") || email.endsWith("@onflourish.com")) return "team_member";
		return "contact";
	}

	// Filter + search
	const filteredContacts = mergedPeople?.filter((c: any) => {
		// Type filter
		if (filter !== "all" && c.type !== filter) return false;
		// Search
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			c.name?.toLowerCase().includes(q) ||
			c.emails?.some((e: string) => e.toLowerCase().includes(q)) ||
			c.phones?.some((p: string) => p.includes(q)) ||
			c.company?.toLowerCase().includes(q) ||
			c.role?.toLowerCase().includes(q) ||
			c.profile?.relationshipSummary?.toLowerCase().includes(q) ||
			c.profile?.topics?.some((t: string) => t.toLowerCase().includes(q))
		);
	})?.sort((a: any, b: any) => (b.interactionCount || 0) - (a.interactionCount || 0));

	// Helper to get profile from merged person
	function getProfile(person: any) {
		return person.profile || null;
	}

	function openCreate() {
		setFormName(""); setFormEmails(""); setFormPhones(""); setFormType("contact");
		setFormCompany(""); setFormRole(""); setFormNotes("");
		setIsCreating(true); setEditing(null); setShowDeleteConfirm(false);
	}

	function openEdit(contact: any) {
		setFormName(contact.name);
		setFormEmails(contact.emails?.join(", ") ?? "");
		setFormPhones(contact.phones?.join(", ") ?? "");
		setFormType(contact.type);
		setFormCompany(contact.company ?? "");
		setFormRole(contact.role ?? "");
		setFormNotes(contact.notes ?? "");
		setEditing(contact); setIsCreating(false); setShowDeleteConfirm(false);
	}

	function closeDialog() { setEditing(null); setIsCreating(false); setShowDeleteConfirm(false); }

	async function handleSave() {
		const emails = formEmails.split(",").map((e) => e.trim()).filter(Boolean);
		const phones = formPhones.split(",").map((p) => p.trim()).filter(Boolean);
		if (isCreating) {
			await createContact({ userId, name: formName || "Unknown", emails, phones, type: formType, company: formCompany || undefined, role: formRole || undefined, notes: formNotes || undefined, sources: ["manual"] });
		} else if (editing) {
			await updateContact({ id: editing._id, name: formName || "Unknown", emails, phones, type: formType, company: formCompany || undefined, role: formRole || undefined, notes: formNotes || undefined });
		}
		closeDialog();
	}

	async function handleDelete() {
		if (editing) { await removeContact({ id: editing._id }); closeDialog(); }
	}

	async function handleApprove(pendingId: Id<"pending_contacts">, type?: ContactType) { await approvePending({ pendingId, type }); }
	async function handleMerge(pendingId: Id<"pending_contacts">, contactId: Id<"contacts">) { await mergePending({ pendingId, contactId }); }
	async function handleDismiss(pendingId: Id<"pending_contacts">) { await dismissPending({ pendingId }); }

	const filters: { key: FilterType; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "team_member", label: "Team" },
		{ key: "coworker", label: "Coworkers" },
		{ key: "contact", label: "Contacts" },
	];

	const isDialogOpen = isCreating || editing !== null;

	// ─── Person Detail View ───
	if (selectedContact) {
		const contact = selectedContact;
		const config = TYPE_CONFIG[contact.type as ContactType];
		const profile = getProfile(contact);

		return (
			<DashboardLayout user={user}>
				<div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-4">
					<button type="button" onClick={() => setSelectedContact(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
						<ChevronLeft className="h-4 w-4" /> People
					</button>

					{/* Header card */}
					<div className="glass-card rounded-2xl p-5 space-y-3">
						<div className="flex items-start gap-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl shrink-0">
								{config?.icon ?? "👤"}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<h2 className="font-display font-semibold text-xl tracking-tight">{contact.name}</h2>
									<Badge variant="secondary" className={cn("text-[10px] text-white shrink-0", config?.color)}>{config?.label}</Badge>
								</div>
								{(contact.role || contact.company) && (
									<p className="text-sm text-muted-foreground">
										{contact.role}{contact.role && contact.company && " · "}{contact.company}
									</p>
								)}
								<div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
									{contact.emails?.map((e: string) => (
										<span key={e} className="flex items-center gap-1"><Mail className="h-3 w-3" />{e}</span>
									))}
									{contact.phones?.map((p: string) => (
										<span key={p} className="flex items-center gap-1"><Phone className="h-3 w-3" />{p}</span>
									))}
								</div>
							</div>
							<Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={() => openEdit(contact)}>Edit</Button>
						</div>

						{/* Quick stats */}
						<div className="flex gap-3 pt-2 border-t border-border/50">
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Send className="h-3 w-3" />
								<span>{profile?.emailsSent ?? 0} sent</span>
							</div>
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Inbox className="h-3 w-3" />
								<span>{profile?.emailsReceived ?? 0} received</span>
							</div>
							{(profile?.sharedMeetings ?? 0) > 0 && (
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Calendar className="h-3 w-3" />
									<span>{profile.sharedMeetings} meetings</span>
								</div>
							)}
							{contact.lastInteraction && (
								<span className="text-xs text-muted-foreground ml-auto">
									Last: {timeAgo(contact.lastInteraction)}
								</span>
							)}
						</div>

						{/* Sources */}
						<div className="flex items-center gap-2">
							<span className="text-[10px] text-muted-foreground">Sources:</span>
							{(profile?.sources ?? contact.sources ?? []).map((s: string) => (
								<span key={s} className="text-xs" title={s}>{SOURCE_ICONS[s] ?? s} {s}</span>
							))}
						</div>
					</div>

					{/* AI Profile */}
					{profile ? (
						<>
							{/* Relationship */}
							<div className="glass-card rounded-2xl p-5 space-y-3">
								<div className="flex items-center gap-2">
									<Sparkles className="h-4 w-4 text-primary" />
									<h3 className="font-display font-semibold text-sm">AI Profile</h3>
									<Badge variant="secondary" className="text-[10px] ml-auto">{profile.sentiment}</Badge>
								</div>
								<p className="text-sm text-foreground/90 leading-relaxed">{profile.relationshipSummary}</p>
								{profile.keyContext && (
									<div className="bg-muted/30 rounded-xl p-3">
										<p className="text-xs text-muted-foreground font-medium mb-1">Key Context</p>
										<p className="text-sm text-foreground/80 leading-relaxed">{profile.keyContext}</p>
									</div>
								)}
							</div>

							{/* Topics */}
							{profile.topics?.length > 0 && (
								<div className="glass-card rounded-2xl p-5 space-y-3">
									<div className="flex items-center gap-2">
										<TrendingUp className="h-4 w-4 text-primary" />
										<h3 className="font-display font-semibold text-sm">Topics</h3>
									</div>
									<div className="flex flex-wrap gap-2">
										{profile.topics.map((topic: string) => (
											<Badge key={topic} variant="secondary" className="text-xs rounded-full">{topic}</Badge>
										))}
									</div>
								</div>
							)}

							{/* Communication style */}
							{profile.communicationStyle && (
								<div className="glass-card rounded-2xl p-5 space-y-3">
									<div className="flex items-center gap-2">
										<MessageSquare className="h-4 w-4 text-primary" />
										<h3 className="font-display font-semibold text-sm">Communication Style</h3>
									</div>
									<p className="text-sm text-foreground/80 leading-relaxed">{profile.communicationStyle}</p>
								</div>
							)}

							{/* Meeting topics */}
							{profile.meetingTopics?.length > 0 && (
								<div className="glass-card rounded-2xl p-5 space-y-3">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-primary" />
										<h3 className="font-display font-semibold text-sm">Recent Meetings</h3>
									</div>
									<div className="space-y-1.5">
										{profile.meetingTopics.slice(0, 5).map((topic: string, i: number) => (
											<p key={i} className="text-sm text-foreground/80 flex items-start gap-2">
												<span className="text-muted-foreground shrink-0">•</span>
												{topic}
											</p>
										))}
									</div>
								</div>
							)}

							{/* Recent interactions */}
							{profile.recentInteractions?.length > 0 && (
								<div className="glass-card rounded-2xl p-5 space-y-3">
									<h3 className="font-display font-semibold text-sm">Recent Interactions</h3>
									<div className="space-y-2">
										{profile.recentInteractions.map((interaction: any, i: number) => (
											<div key={i} className="flex items-start gap-3 text-sm">
												<span className="text-xs shrink-0 mt-0.5">
													{interaction.type === "email_sent" ? "📤" :
													 interaction.type === "email_received" ? "📥" :
													 interaction.type === "calendar" ? "📅" :
													 interaction.type === "sms_received" ? "💬" :
													 interaction.type === "slack_received" ? "💼" : "📌"}
												</span>
												<div className="flex-1 min-w-0">
													<p className="text-foreground/80 truncate">{interaction.summary}</p>
													<p className="text-[10px] text-muted-foreground">{formatDate(interaction.date)}</p>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					) : (
						<div className="glass-card rounded-2xl p-5 text-center">
							<Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
							<p className="text-sm text-muted-foreground">No AI profile yet</p>
							<p className="text-xs text-muted-foreground mt-1">Profiles are built automatically from email, calendar, and messages</p>
						</div>
					)}

					{/* Notes */}
					{contact.notes && (
						<div className="glass-card rounded-2xl p-5 space-y-2">
							<h3 className="font-display font-semibold text-sm">Notes</h3>
							<p className="text-sm text-foreground/80 whitespace-pre-wrap">{contact.notes}</p>
						</div>
					)}
				</div>
			</DashboardLayout>
		);
	}

	// ─── People List ───
	return (
		<DashboardLayout user={user}>
			<div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Users className="h-6 w-6 text-primary" />
						<h1 className="text-xl font-display font-bold">People</h1>
					</div>
					<div className="flex gap-2">
						{(pendingCount ?? 0) > 0 && (
							<Button size="sm" variant="outline" onClick={() => setShowReviewQueue(!showReviewQueue)} className="gap-1.5 relative rounded-xl">
								<AlertCircle className="h-4 w-4 text-yellow-500" />
								Review
								<Badge variant="destructive" className="text-[10px] h-5 min-w-[20px] flex items-center justify-center">{pendingCount}</Badge>
							</Button>
						)}
						<Button size="sm" onClick={openCreate} className="gap-1 rounded-xl">
							<Plus className="h-4 w-4" /> Add
						</Button>
					</div>
				</div>

				{/* Review Queue */}
				{showReviewQueue && pendingContacts && pendingContacts.length > 0 && (
					<Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
						<CardContent className="p-4 space-y-3">
							<div className="flex items-center gap-2 mb-1">
								<AlertCircle className="h-4 w-4 text-yellow-500" />
								<h3 className="font-semibold text-sm">New people detected — verify before adding</h3>
							</div>
							{pendingContacts.map((pending: any) => (
								<div key={pending._id} className="bg-background rounded-lg p-3 space-y-2 border">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm">{pending.name}</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
												{pending.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{pending.email}</span>}
												{pending.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{pending.phone}</span>}
											</div>
											<span className="text-[10px] text-muted-foreground">{SOURCE_ICONS[pending.source]} {pending.sourceDetail || pending.source}</span>
											{pending.matchedContactId && (
												<div className="mt-1.5 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
													<GitMerge className="h-3 w-3" /> Possible match: {pending.matchReason}
													{pending.matchConfidence && <span className="text-[10px] text-muted-foreground">({Math.round(pending.matchConfidence * 100)}%)</span>}
												</div>
											)}
										</div>
									</div>
									<div className="flex gap-2 flex-wrap">
										{pending.matchedContactId ? (
											<>
												<Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleMerge(pending._id, pending.matchedContactId)}><GitMerge className="h-3 w-3" />Merge</Button>
												<Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleApprove(pending._id, pending.suggestedType)}><UserPlus className="h-3 w-3" />New Person</Button>
											</>
										) : (
											<>
												<Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleApprove(pending._id, "contact")}><Check className="h-3 w-3" />Contact</Button>
												<Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleApprove(pending._id, "coworker")}><Check className="h-3 w-3" />Coworker</Button>
												<Button size="sm" variant="outline" className="gap-1 text-xs h-7 rounded-lg" onClick={() => handleApprove(pending._id, "team_member")}><Check className="h-3 w-3" />Team</Button>
											</>
										)}
										<Button size="sm" variant="ghost" className="gap-1 text-xs h-7 text-muted-foreground" onClick={() => handleDismiss(pending._id)}><XCircle className="h-3 w-3" />Skip</Button>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				)}

				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input placeholder="Search people, topics, companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 rounded-xl" />
					{searchQuery && (
						<button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Filter pills */}
				<div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
					{filters.map((f) => (
						<button key={f.key} type="button" onClick={() => setFilter(f.key)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
								filter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "glass text-foreground hover:bg-accent",
							)}>
							{f.label}
						</button>
					))}
					<span className="text-xs text-muted-foreground self-center ml-auto">{filteredContacts?.length ?? 0} people</span>
				</div>

				{/* Contacts list */}
				<div className="space-y-2">
					{!filteredContacts ? (
						Array.from({ length: 3 }).map((_, i) => (
							<div key={`skeleton-${i}`} className="glass-card rounded-2xl p-4 animate-pulse">
								<div className="flex gap-3">
									<div className="h-10 w-10 rounded-full bg-muted" />
									<div className="flex-1">
										<div className="h-4 bg-muted rounded w-1/3 mb-2" />
										<div className="h-3 bg-muted rounded w-2/3" />
									</div>
								</div>
							</div>
						))
					) : filteredContacts.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
							<p className="font-medium">No people yet</p>
							<p className="text-sm mt-1">People will be auto-added from emails, calendar, and messages</p>
						</div>
					) : (
						filteredContacts.map((contact: any) => {
							const config = TYPE_CONFIG[contact.type as ContactType];
							const profile = getProfile(contact);
							return (
								<button key={contact._id} type="button" onClick={() => setSelectedContact(contact)} className="w-full text-left">
									<div className="glass-card rounded-2xl p-4 hover:shadow-md active:scale-[0.99] transition-all">
										<div className="flex items-start gap-3">
											<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg shrink-0">
												{config?.icon ?? "👤"}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-0.5">
													<h3 className="font-semibold text-sm truncate">{contact.name}</h3>
													<Badge variant="secondary" className={cn("text-[10px] text-white shrink-0", config?.color)}>{config?.label}</Badge>
												</div>
												{/* Show AI summary if available, otherwise role/company */}
												{profile?.relationshipSummary ? (
													<p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{profile.relationshipSummary}</p>
												) : (contact.role || contact.company) ? (
													<p className="text-xs text-muted-foreground truncate">
														{contact.role}{contact.role && contact.company && " · "}{contact.company}
													</p>
												) : null}

												{/* Topics pills */}
												{profile?.topics?.length > 0 && (
													<div className="flex gap-1 mt-1.5 overflow-hidden">
														{profile.topics.slice(0, 3).map((t: string) => (
															<span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground truncate max-w-[100px]">{t}</span>
														))}
														{profile.topics.length > 3 && <span className="text-[10px] text-muted-foreground">+{profile.topics.length - 3}</span>}
													</div>
												)}

												{/* Stats row */}
												<div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
													{(profile?.emailsSent ?? 0) > 0 && (
														<span className="flex items-center gap-0.5"><Send className="h-2.5 w-2.5" />{profile.emailsSent}</span>
													)}
													{(profile?.emailsReceived ?? 0) > 0 && (
														<span className="flex items-center gap-0.5"><Inbox className="h-2.5 w-2.5" />{profile.emailsReceived}</span>
													)}
													{(profile?.sharedMeetings ?? 0) > 0 && (
														<span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{profile.sharedMeetings}</span>
													)}
													{(profile?.sources ?? contact.sources)?.map((s: string) => (
														<span key={s} title={s}>{SOURCE_ICONS[s]}</span>
													))}
													{contact.lastInteraction && (
														<span className="ml-auto">{timeAgo(contact.lastInteraction)}</span>
													)}
												</div>
											</div>
										</div>
									</div>
								</button>
							);
						})
					)}
				</div>
			</div>

			{/* Create / Edit Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
				<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							{isCreating ? "Add Person" : "Edit Person"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div>
							<label className="text-sm font-medium mb-1.5 block">Name</label>
							<Input placeholder="Full name" value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-sm font-medium mb-1.5 block">Type</label>
								<Select value={formType} onValueChange={(v) => setFormType(v as ContactType)}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="contact">👤 Contact</SelectItem>
										<SelectItem value="coworker">🏢 Coworker</SelectItem>
										<SelectItem value="team_member">⭐ Team Member</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="text-sm font-medium mb-1.5 block">Company</label>
								<Input placeholder="Company" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
							</div>
						</div>
						<div>
							<label className="text-sm font-medium mb-1.5 block">Role / Title</label>
							<Input placeholder="e.g. VP of Product" value={formRole} onChange={(e) => setFormRole(e.target.value)} />
						</div>
						<div>
							<label className="text-sm font-medium mb-1.5 block">Emails <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
							<Input placeholder="email@example.com" value={formEmails} onChange={(e) => setFormEmails(e.target.value)} />
						</div>
						<div>
							<label className="text-sm font-medium mb-1.5 block">Phones <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
							<Input placeholder="+1 (555) 123-4567" value={formPhones} onChange={(e) => setFormPhones(e.target.value)} />
						</div>
						<div>
							<label className="text-sm font-medium mb-1.5 block">Notes</label>
							<Textarea placeholder="Anything to remember..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} className="resize-none" />
						</div>
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2">
						{editing && !showDeleteConfirm && (
							<Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 mr-auto" onClick={() => setShowDeleteConfirm(true)}>
								<Trash2 className="h-4 w-4 mr-1" />Delete
							</Button>
						)}
						{showDeleteConfirm && (
							<div className="flex items-center gap-2 mr-auto">
								<span className="text-sm text-red-500">Remove this person?</span>
								<Button variant="destructive" size="sm" onClick={handleDelete}>Yes</Button>
								<Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>No</Button>
							</div>
						)}
						<div className="flex gap-2">
							<Button variant="outline" onClick={closeDialog}>Cancel</Button>
							<Button onClick={handleSave}>{isCreating ? "Add" : "Save"}</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
