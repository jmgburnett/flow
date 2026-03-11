"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Zap,
	ChevronLeft,
	Check,
	X,
	ArrowRightCircle,
	User,
	Clock,
	FileText,
	Plus,
	MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type StatusFilter = "all" | "pending_review" | "confirmed" | "converted_to_task" | "dismissed";

const STATUS_CONFIG = {
	pending_review: { label: "Pending", color: "bg-amber-500/90 text-white" },
	confirmed: { label: "Confirmed", color: "bg-emerald-500/90 text-white" },
	converted_to_task: { label: "Task", color: "bg-primary/90 text-white" },
	dismissed: { label: "Dismissed", color: "bg-muted text-muted-foreground" },
} as const;

function timeAgo(ts: number): string {
	const seconds = Math.floor((Date.now() - ts) / 1000);
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export default function MeetingActionsPage() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const userId = "josh";

	const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review");
	const [showExtract, setShowExtract] = useState(false);
	const [transcriptText, setTranscriptText] = useState("");
	const [extracting, setExtracting] = useState(false);

	const actions = useQuery(api.meetingActions.listMeetingActions, {
		userId,
		status: statusFilter === "all" ? undefined : statusFilter as any,
	});
	const counts = useQuery(api.meetingActions.getActionCounts, { userId });

	const confirmAction = useMutation(api.meetingActions.confirmAction);
	const dismissAction = useMutation(api.meetingActions.dismissAction);
	const convertToTask = useMutation(api.meetingActions.convertToTask);
	const createAction = useMutation(api.meetingActions.createMeetingAction);

	async function handleConfirm(id: Id<"meeting_actions">) {
		await confirmAction({ id });
	}

	async function handleDismiss(id: Id<"meeting_actions">) {
		await dismissAction({ id });
	}

	async function handleConvert(id: Id<"meeting_actions">) {
		await convertToTask({ id, userId });
	}

	async function handleManualCreate() {
		if (!transcriptText.trim()) return;
		// For manual entry, create single action items (one per line)
		const lines = transcriptText.split("\n").filter((l) => l.trim());
		for (const line of lines) {
			await createAction({
				userId,
				action: line.trim(),
			});
		}
		setTranscriptText("");
		setShowExtract(false);
	}

	const filters: { key: StatusFilter; label: string; count?: number }[] = [
		{ key: "pending_review", label: "Pending", count: counts?.pending },
		{ key: "confirmed", label: "Confirmed", count: counts?.confirmed },
		{ key: "converted_to_task", label: "Tasks", count: counts?.converted },
		{ key: "dismissed", label: "Dismissed" },
		{ key: "all", label: "All", count: counts?.total },
	];

	return (
		<DashboardLayout user={user}>
			<div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Link href="/dashboard/team" className="text-muted-foreground hover:text-foreground transition-colors">
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<Zap className="h-6 w-6 text-primary" />
						<h1 className="text-xl font-display font-bold">Meeting Actions</h1>
					</div>
					<Button size="sm" onClick={() => setShowExtract(true)} className="gap-1 rounded-xl">
						<Plus className="h-4 w-4" /> Add
					</Button>
				</div>

				{/* Filter pills */}
				<div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
					{filters.map((f) => (
						<button
							key={f.key}
							type="button"
							onClick={() => setStatusFilter(f.key)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
								statusFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "glass text-foreground hover:bg-accent",
							)}
						>
							{f.label}
							{f.count !== undefined && f.count > 0 && (
								<span className={cn(
									"h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold",
									statusFilter === f.key ? "bg-primary-foreground/20" : "bg-muted",
								)}>
									{f.count}
								</span>
							)}
						</button>
					))}
				</div>

				{/* Actions list */}
				<div className="space-y-2">
					{!actions ? (
						<div className="glass-card rounded-2xl p-4 animate-pulse h-20" />
					) : actions.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
							<p className="font-medium">No actions here</p>
							<p className="text-sm mt-1">
								{statusFilter === "pending_review"
									? "Extract action items from meeting transcripts"
									: "No actions with this status"}
							</p>
						</div>
					) : (
						actions.map((action: any) => {
							const config = STATUS_CONFIG[action.status as keyof typeof STATUS_CONFIG];
							const isPending = action.status === "pending_review";

							return (
								<div key={action._id} className="glass-card rounded-2xl p-4 space-y-3">
									<div className="flex items-start gap-3">
										<Zap className={cn("h-4 w-4 mt-0.5 shrink-0", isPending ? "text-amber-500" : "text-muted-foreground")} />
										<div className="flex-1 min-w-0">
											<div className="flex items-start gap-2 mb-1">
												<p className="text-sm font-medium flex-1">{action.action}</p>
												{config && (
													<Badge className={cn("text-[10px] shrink-0 rounded-full", config.color)}>{config.label}</Badge>
												)}
											</div>

											{/* Suggested assignee */}
											{action.assigneeName && (
												<div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
													<User className="h-3 w-3" />
													<span>{action.assigneeName}</span>
													{action.suggestedReason && (
														<span className="text-[10px] italic">— {action.suggestedReason}</span>
													)}
												</div>
											)}

											{/* Source text */}
											{action.sourceText && (
												<div className="mt-2 bg-muted/30 rounded-lg p-2">
													<p className="text-[10px] text-muted-foreground italic line-clamp-2">"{action.sourceText}"</p>
												</div>
											)}

											{/* Due date */}
											<div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
												{action.dueDate && (
													<span className="flex items-center gap-1">
														<Clock className="h-3 w-3" />
														Due: {new Date(action.dueDate).toLocaleDateString()}
													</span>
												)}
												<span>{timeAgo(action.createdAt)}</span>
											</div>
										</div>
									</div>

									{/* Action buttons for pending */}
									{isPending && (
										<div className="flex gap-2 pt-1 border-t border-border/50">
											<Button
												size="sm"
												variant="outline"
												className="text-xs h-7 rounded-lg gap-1 flex-1"
												onClick={() => handleConfirm(action._id)}
											>
												<Check className="h-3 w-3" /> Confirm
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="text-xs h-7 rounded-lg gap-1 flex-1"
												onClick={() => handleConvert(action._id)}
											>
												<ArrowRightCircle className="h-3 w-3" /> → Task
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="text-xs h-7 rounded-lg gap-1 text-muted-foreground"
												onClick={() => handleDismiss(action._id)}
											>
												<X className="h-3 w-3" /> Skip
											</Button>
										</div>
									)}

									{/* Convert confirmed to task */}
									{action.status === "confirmed" && (
										<div className="pt-1 border-t border-border/50">
											<Button
												size="sm"
												variant="outline"
												className="text-xs h-7 rounded-lg gap-1"
												onClick={() => handleConvert(action._id)}
											>
												<ArrowRightCircle className="h-3 w-3" /> Convert to Task
											</Button>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* Add Actions Dialog */}
			<Dialog open={showExtract} onOpenChange={(open) => { if (!open) { setTranscriptText(""); setShowExtract(false); } }}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<MessageSquare className="h-5 w-5 text-primary" /> Add Action Items
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<p className="text-sm text-muted-foreground">
							Enter action items, one per line. These will be added to your review queue.
						</p>
						<Textarea
							value={transcriptText}
							onChange={(e) => setTranscriptText(e.target.value)}
							placeholder={"Follow up with Sarah on Q2 budget\nSchedule 1:1 with the engineering lead\nReview the product roadmap draft"}
							rows={8}
							className="resize-none"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => { setTranscriptText(""); setShowExtract(false); }}>Cancel</Button>
						<Button onClick={handleManualCreate} disabled={!transcriptText.trim()}>
							Add Actions
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
