"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
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
	Eye,
	EyeOff,
	Reply,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";

type TriageFilter = "all" | "needs_me" | "draft_ready" | "handled" | "ignore";

const TRIAGE_CONFIG = {
	needs_me: { label: "Needs You", color: "bg-red-500 text-white" },
	draft_ready: { label: "Draft", color: "bg-yellow-500 text-white" },
	handled: { label: "Handled", color: "bg-green-500 text-white" },
	ignore: { label: "Ignore", color: "bg-gray-400 text-white" },
} as const;

function fmtDate(ts: number) {
	const d = new Date(ts);
	const now = new Date();
	const diff = now.getTime() - ts;
	if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 24 * 60 * 60 * 1000)
		return `${Math.floor(diff / 3600000)}h ago`;
	if (diff < 7 * 24 * 60 * 60 * 1000)
		return `${Math.ceil(diff / 86400000)}d ago`;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxPage() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const searchParams = useSearchParams();

	const [filter, setFilter] = useState<TriageFilter>("all");
	const [selectedEmail, setSelectedEmail] = useState<any>(null);
	const [syncing, setSyncing] = useState(false);

	// Reply state
	const [replyText, setReplyText] = useState("");
	const [showReply, setShowReply] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendSuccess, setSendSuccess] = useState(false);
	const [generatingDraft, setGeneratingDraft] = useState(false);

	const connections =
		useQuery(api.google.getGoogleConnections, { userId: "josh" }) ?? [];

	const emails =
		useQuery(
			api.google.getEmails,
			filter === "all"
				? { userId: "josh" }
				: { userId: "josh", triageStatus: filter as any },
		) ?? [];

	const syncGmail = useAction(api.google.syncGmailInbox);
	const sendReply = useAction(api.google.sendReply);
	const generateDraft = useAction(api.google.generateDraftReply);
	const updateDraft = useMutation(api.google.updateDraftReply);
	const updateTriage = useMutation(api.google.updateTriageStatus);

	// Auto-select email from query param (when clicking from home page)
	useEffect(() => {
		const emailId = searchParams.get("email");
		if (emailId && emails.length > 0 && !selectedEmail) {
			const found = emails.find((e: any) => e._id === emailId);
			if (found) {
				openEmail(found);
			}
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
	}

	async function handleSync() {
		setSyncing(true);
		try {
			for (const conn of connections) {
				await syncGmail({ connectionId: conn._id as any });
			}
		} catch (e) {
			console.error("Sync error:", e);
		}
		setSyncing(false);
	}

	async function handleSend() {
		if (!selectedEmail || !replyText.trim()) return;
		setSending(true);
		try {
			await sendReply({
				emailId: selectedEmail._id as Id<"emails">,
				replyBody: replyText,
			});
			setSendSuccess(true);
			setShowReply(false);
			// Update local state
			setSelectedEmail({ ...selectedEmail, triageStatus: "handled" });
		} catch (e) {
			console.error("Send error:", e);
			alert("Failed to send reply. Check console for details.");
		}
		setSending(false);
	}

	async function handleGenerateDraft() {
		if (!selectedEmail) return;
		setGeneratingDraft(true);
		try {
			const result = await generateDraft({
				emailId: selectedEmail._id as Id<"emails">,
			});
			setReplyText(result.draft);
			setShowReply(true);
			setSelectedEmail({
				...selectedEmail,
				draftReply: result.draft,
				triageStatus: "draft_ready",
			});
		} catch (e) {
			console.error("Draft generation error:", e);
			alert("Failed to generate draft. Check console.");
		}
		setGeneratingDraft(false);
	}

	async function handleSaveDraft() {
		if (!selectedEmail || !replyText.trim()) return;
		await updateDraft({
			emailId: selectedEmail._id as Id<"emails">,
			draftReply: replyText,
		});
		setSelectedEmail({ ...selectedEmail, draftReply: replyText });
	}

	async function handleArchive() {
		if (!selectedEmail) return;
		await updateTriage({
			emailId: selectedEmail._id as Id<"emails">,
			triageStatus: "handled",
		});
		closeEmail();
	}

	async function handleIgnore() {
		if (!selectedEmail) return;
		await updateTriage({
			emailId: selectedEmail._id as Id<"emails">,
			triageStatus: "ignore",
		});
		closeEmail();
	}

	const filters: { key: TriageFilter; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "needs_me", label: "Needs You" },
		{ key: "draft_ready", label: "Drafts" },
		{ key: "handled", label: "Handled" },
		{ key: "ignore", label: "Ignored" },
	];

	// Email detail view
	if (selectedEmail) {
		const triage =
			TRIAGE_CONFIG[
				selectedEmail.triageStatus as keyof typeof TRIAGE_CONFIG
			];
		return (
			<DashboardLayout user={user}>
				<div className="max-w-2xl mx-auto w-full p-4 space-y-4">
					{/* Back button */}
					<button
						type="button"
						onClick={closeEmail}
						className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<ChevronLeft className="h-4 w-4" /> Back to Inbox
					</button>

					{/* Email header */}
					<div className="space-y-2">
						<div className="flex items-start justify-between gap-2 min-w-0">
							<h2 className="font-bold text-lg leading-tight flex-1 min-w-0">
								{selectedEmail.subject}
							</h2>
							{triage && (
								<Badge
									className={cn(
										"text-[10px] shrink-0",
										triage.color,
									)}
								>
									{triage.label}
								</Badge>
							)}
						</div>
						<div className="text-sm text-muted-foreground space-y-0.5">
							<p className="truncate">
								<strong>From:</strong> {selectedEmail.from}
							</p>
							<p className="truncate">
								<strong>To:</strong>{" "}
								{selectedEmail.to?.join(", ")}
							</p>
							<p>
								<strong>Account:</strong>{" "}
								{selectedEmail.accountEmail}
							</p>
							<p>{fmtDate(selectedEmail.receivedAt)}</p>
						</div>
					</div>

					{/* Email body */}
					<Card className="p-4">
						<pre className="text-sm whitespace-pre-wrap break-words font-sans">
							{selectedEmail.body}
						</pre>
					</Card>

					{/* Send success banner */}
					{sendSuccess && (
						<Card className="p-3 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
							<p className="text-sm text-green-700 dark:text-green-300 font-medium">
								✅ Reply sent successfully
							</p>
						</Card>
					)}

					{/* Action buttons */}
					<div className="flex gap-2 flex-wrap">
						{!showReply && !sendSuccess && (
							<>
								<Button
									size="sm"
									onClick={() => setShowReply(true)}
									className="gap-1.5"
								>
									<Reply className="h-4 w-4" />
									Reply
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={handleGenerateDraft}
									disabled={generatingDraft}
									className="gap-1.5"
								>
									{generatingDraft ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Sparkles className="h-4 w-4" />
									)}
									AI Draft
								</Button>
							</>
						)}
						<Button
							size="sm"
							variant="outline"
							onClick={handleArchive}
							className="gap-1.5"
						>
							<Archive className="h-4 w-4" />
							Archive
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleIgnore}
							className="gap-1.5 text-muted-foreground"
						>
							<EyeOff className="h-4 w-4" />
							Ignore
						</Button>
					</div>

					{/* Reply composer */}
					{showReply && !sendSuccess && (
						<Card className="p-4 space-y-3 border-blue-200 dark:border-blue-800">
							<div className="flex items-center gap-2">
								<Reply className="h-4 w-4 text-blue-500" />
								<span className="text-sm font-medium">
									Reply to{" "}
									{selectedEmail.from
										.split("<")[0]
										.trim()}
								</span>
							</div>
							<Textarea
								value={replyText}
								onChange={(e) => setReplyText(e.target.value)}
								placeholder="Write your reply..."
								rows={6}
								className="resize-none"
								autoFocus
							/>
							<div className="flex items-center gap-2 justify-between">
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={handleGenerateDraft}
										disabled={generatingDraft}
										className="gap-1.5"
									>
										{generatingDraft ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Sparkles className="h-4 w-4" />
										)}
										AI Draft
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={handleSaveDraft}
										disabled={!replyText.trim()}
									>
										Save Draft
									</Button>
								</div>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setShowReply(false)}
									>
										Cancel
									</Button>
									<Button
										size="sm"
										onClick={handleSend}
										disabled={!replyText.trim() || sending}
										className="gap-1.5"
									>
										{sending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Send className="h-4 w-4" />
										)}
										Send
									</Button>
								</div>
							</div>
						</Card>
					)}
				</div>
			</DashboardLayout>
		);
	}

	// Email list view
	return (
		<DashboardLayout user={user}>
			<div className="max-w-2xl mx-auto w-full p-4 space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-bold">Inbox</h1>
					<button
						type="button"
						onClick={handleSync}
						disabled={syncing}
						className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
					>
						{syncing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						Sync
					</button>
				</div>

				{/* Filter tabs */}
				<div
					className="flex gap-2 overflow-x-auto"
					style={{ scrollbarWidth: "none" }}
				>
					{filters.map((f) => (
						<button
							key={f.key}
							type="button"
							onClick={() => setFilter(f.key)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
								filter === f.key
									? "bg-blue-600 text-white"
									: "bg-muted text-foreground",
							)}
						>
							{f.label}
						</button>
					))}
				</div>

				{/* Email count */}
				<p className="text-xs text-muted-foreground">
					{emails.length} emails
				</p>

				{/* Email list */}
				<div className="space-y-2">
					{emails.length === 0 ? (
						<div className="text-center py-12">
							<p className="text-muted-foreground">
								No emails in this category
							</p>
						</div>
					) : (
						emails.map((email: any) => {
							const triage =
								TRIAGE_CONFIG[
									email.triageStatus as keyof typeof TRIAGE_CONFIG
								];
							const fromName =
								email.from?.split("<")[0]?.trim() ||
								email.from;
							return (
								<button
									key={email._id}
									type="button"
									onClick={() => openEmail(email)}
									className="w-full text-left"
								>
									<Card className="p-3 hover:bg-muted/50 transition-colors">
										<div className="min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<p className="font-medium text-sm truncate flex-1 min-w-0">
													{fromName}
												</p>
												<span className="text-[10px] text-muted-foreground shrink-0">
													{fmtDate(
														email.receivedAt,
													)}
												</span>
											</div>
											<div className="flex items-center gap-2 min-w-0">
												<p className="text-sm truncate flex-1 min-w-0">
													{email.subject}
												</p>
												{triage && (
													<Badge
														className={cn(
															"text-[10px] shrink-0",
															triage.color,
														)}
													>
														{triage.label}
													</Badge>
												)}
											</div>
											{email.draftReply && (
												<p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-0.5">
													📝 Draft reply saved
												</p>
											)}
											<p className="text-xs text-muted-foreground mt-0.5 truncate">
												{email.accountEmail}
											</p>
										</div>
									</Card>
								</button>
							);
						})
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
