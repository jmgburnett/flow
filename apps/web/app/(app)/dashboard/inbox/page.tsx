"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Loader2,
	RefreshCw,
	ChevronLeft,
	Send,
	Sparkles,
	Archive,
	EyeOff,
	Reply,
	MailOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSearchParams, useRouter } from "next/navigation";

type TriageFilter = "all" | "needs_me" | "draft_ready" | "handled" | "ignore";

const TRIAGE_CONFIG = {
	needs_me: { label: "Needs You", color: "bg-red-500/90 text-white" },
	draft_ready: { label: "Draft", color: "bg-amber-500/90 text-white" },
	handled: { label: "Done", color: "bg-emerald-500/90 text-white" },
	ignore: { label: "Skipped", color: "bg-muted text-muted-foreground" },
} as const;

function fmtDate(ts: number) {
	const diff = Date.now() - ts;
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
	if (diff < 604800000) return `${Math.ceil(diff / 86400000)}d`;
	return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxPage() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const searchParams = useSearchParams();

	const [filter, setFilter] = useState<TriageFilter>("all");
	const [selectedEmail, setSelectedEmail] = useState<any>(null);
	const [syncing, setSyncing] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [showReply, setShowReply] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendSuccess, setSendSuccess] = useState(false);
	const [generatingDraft, setGeneratingDraft] = useState(false);

	const router = useRouter();
	const connections = useQuery(api.google.getGoogleConnections, { userId: "josh" }) ?? [];
	const emails = useQuery(
		api.google.getEmails,
		filter === "all" ? { userId: "josh" } : { userId: "josh", triageStatus: filter as any },
	) ?? [];

	const syncGmail = useAction(api.google.syncGmailInbox);
	const sendReply = useAction(api.google.sendReply);
	const generateDraft = useAction(api.google.generateDraftReply);
	const updateDraft = useMutation(api.google.updateDraftReply);
	const updateTriage = useMutation(api.google.updateTriageStatus);

	useEffect(() => {
		const emailId = searchParams.get("email");
		if (emailId && emails.length > 0 && !selectedEmail) {
			const found = emails.find((e: any) => e._id === emailId);
			if (found) openEmail(found);
		}
	}, [searchParams, emails, selectedEmail]);

	function openEmail(email: any) {
		setSelectedEmail(email);
		setReplyText(email.draftReply || "");
		setShowReply(!!email.draftReply);
		setSendSuccess(false);
	}

	function closeEmail() {
		setSelectedEmail(null);
		setReplyText("");
		setShowReply(false);
		setSendSuccess(false);
		// Clear the ?email= param so the useEffect doesn't reopen it
		if (searchParams.get("email")) {
			router.replace("/dashboard/inbox", { scroll: false });
		}
	}

	async function handleSync() {
		setSyncing(true);
		try {
			for (const conn of connections) await syncGmail({ connectionId: conn._id as any });
		} catch (e) { console.error(e); }
		setSyncing(false);
	}

	async function handleSend() {
		if (!selectedEmail || !replyText.trim()) return;
		setSending(true);
		try {
			await sendReply({ emailId: selectedEmail._id as Id<"emails">, replyBody: replyText });
			setSendSuccess(true);
			setShowReply(false);
			setSelectedEmail({ ...selectedEmail, triageStatus: "handled" });
		} catch (e) { console.error(e); }
		setSending(false);
	}

	async function handleGenerateDraft() {
		if (!selectedEmail) return;
		setGeneratingDraft(true);
		try {
			const result = await generateDraft({ emailId: selectedEmail._id as Id<"emails"> });
			setReplyText(result.draft);
			setShowReply(true);
			setSelectedEmail({ ...selectedEmail, draftReply: result.draft, triageStatus: "draft_ready" });
		} catch (e) { console.error(e); }
		setGeneratingDraft(false);
	}

	async function handleSaveDraft() {
		if (!selectedEmail || !replyText.trim()) return;
		await updateDraft({ emailId: selectedEmail._id as Id<"emails">, draftReply: replyText });
	}

	async function handleArchive() {
		if (!selectedEmail) return;
		await updateTriage({ emailId: selectedEmail._id as Id<"emails">, triageStatus: "handled" });
		closeEmail();
	}

	async function handleIgnore() {
		if (!selectedEmail) return;
		await updateTriage({ emailId: selectedEmail._id as Id<"emails">, triageStatus: "ignore" });
		closeEmail();
	}

	const filters: { key: TriageFilter; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "needs_me", label: "Needs You" },
		{ key: "draft_ready", label: "Drafts" },
		{ key: "handled", label: "Done" },
	];

	// ─── Email Detail ───
	if (selectedEmail) {
		const triage = TRIAGE_CONFIG[selectedEmail.triageStatus as keyof typeof TRIAGE_CONFIG];
		return (
			<DashboardLayout user={user}>
				<div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-4 pb-40">
					<button type="button" onClick={closeEmail} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
						<ChevronLeft className="h-4 w-4" /> Inbox
					</button>

					{/* Header */}
					<div className="space-y-2">
						<div className="flex items-start justify-between gap-2">
							<h2 className="font-semibold text-lg leading-tight tracking-tight flex-1">{selectedEmail.subject}</h2>
							{triage && <Badge className={cn("text-[10px] shrink-0 rounded-full", triage.color)}>{triage.label}</Badge>}
						</div>
						<div className="text-sm text-muted-foreground space-y-0.5">
							<p className="truncate"><span className="text-foreground font-medium">{selectedEmail.from.split("<")[0].trim()}</span></p>
							<p className="text-xs">to {selectedEmail.to?.join(", ")} · {selectedEmail.accountEmail} · {fmtDate(selectedEmail.receivedAt)}</p>
						</div>
					</div>

					{/* Body */}
					<div className="glass-card rounded-2xl p-5">
						<pre className="text-sm whitespace-pre-wrap break-words font-sans leading-relaxed text-foreground/90">{selectedEmail.body}</pre>
					</div>

					{sendSuccess && (
						<div className="glass-card rounded-2xl p-4 border-emerald-200 dark:border-emerald-800">
							<p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✓ Reply sent</p>
						</div>
					)}

					{/* Reply composer */}
					{showReply && !sendSuccess && (
						<div className="glass-card rounded-2xl p-4 space-y-3">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Reply className="h-4 w-4 text-primary" />
								<span>Reply to {selectedEmail.from.split("<")[0].trim()}</span>
							</div>
							<Textarea
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								placeholder="Write your reply..."
								rows={5}
								className="resize-none bg-transparent border-0 focus-visible:ring-0 p-0 text-sm"
								autoFocus
							/>
						</div>
					)}
				</div>

				{/* ─── Floating Action Bar ─── */}
				<div className="fixed bottom-0 left-0 right-0 md:left-[220px] z-40">
					<div className="max-w-2xl mx-auto px-4 pb-4 md:pb-6">
						<div className="glass-heavy rounded-2xl shadow-lg px-3 py-2.5 flex items-center gap-2">
							{!showReply && !sendSuccess ? (
								<>
									<Button size="sm" onClick={() => setShowReply(true)} className="rounded-xl gap-1.5 flex-1 md:flex-none">
										<Reply className="h-4 w-4" /> Reply
									</Button>
									<Button size="sm" variant="secondary" onClick={handleGenerateDraft} disabled={generatingDraft} className="rounded-xl gap-1.5 flex-1 md:flex-none">
										{generatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI Draft
									</Button>
									<div className="flex-1 hidden md:block" />
									<Button size="sm" variant="ghost" onClick={handleArchive} className="rounded-xl gap-1.5 text-muted-foreground">
										<Archive className="h-4 w-4" /> Archive
									</Button>
									<Button size="sm" variant="ghost" onClick={handleIgnore} className="rounded-xl text-muted-foreground">
										<EyeOff className="h-4 w-4" />
									</Button>
								</>
							) : showReply && !sendSuccess ? (
								<>
									<Button size="sm" variant="secondary" onClick={handleGenerateDraft} disabled={generatingDraft} className="rounded-xl gap-1.5">
										{generatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI
									</Button>
									<Button size="sm" variant="ghost" onClick={handleSaveDraft} disabled={!replyText.trim()} className="rounded-xl text-muted-foreground">
										Save
									</Button>
									<div className="flex-1" />
									<Button size="sm" variant="ghost" onClick={() => setShowReply(false)} className="rounded-xl text-muted-foreground">
										Cancel
									</Button>
									<Button size="sm" onClick={handleSend} disabled={!replyText.trim() || sending} className="rounded-xl gap-1.5">
										{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
									</Button>
								</>
							) : (
								<>
									<div className="flex-1 text-sm text-muted-foreground px-2">Email sent ✓</div>
									<Button size="sm" variant="ghost" onClick={closeEmail} className="rounded-xl">
										Back to Inbox
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// ─── Email List ───
	return (
		<DashboardLayout user={user}>
			<div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
					<button type="button" onClick={handleSync} disabled={syncing}
						className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
						{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
						Sync
					</button>
				</div>

				{/* Filters */}
				<div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
					{filters.map((f) => (
						<button key={f.key} type="button" onClick={() => setFilter(f.key)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
								filter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "glass text-foreground hover:bg-accent",
							)}>
							{f.label}
						</button>
					))}
				</div>

				<p className="text-xs text-muted-foreground">{emails.length} emails</p>

				{/* List */}
				<div className="space-y-2">
					{emails.length === 0 ? (
						<div className="text-center py-16">
							<MailOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
							<p className="text-sm text-muted-foreground">No emails here</p>
						</div>
					) : (
						emails.map((email: any) => {
							const triage = TRIAGE_CONFIG[email.triageStatus as keyof typeof TRIAGE_CONFIG];
							const fromName = email.from?.split("<")[0]?.trim() || email.from;
							return (
								<button key={email._id} type="button" onClick={() => openEmail(email)} className="w-full text-left group">
									<div className="glass-card rounded-2xl p-4 hover:shadow-md active:scale-[0.99] transition-all">
										<div className="min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<p className="font-medium text-sm truncate flex-1">{fromName}</p>
												<span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(email.receivedAt)}</span>
											</div>
											<div className="flex items-center gap-2">
												<p className="text-sm text-muted-foreground truncate flex-1">{email.subject}</p>
												{triage && <Badge className={cn("text-[10px] shrink-0 rounded-full", triage.color)}>{triage.label}</Badge>}
											</div>
											{email.draftReply && (
												<p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
													<Sparkles className="h-3 w-3" /> Draft ready
												</p>
											)}
										</div>
									</div>
								</button>
							);
						})
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
