"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ChatInterface() {
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [sending, setSending] = useState(false);
	const [messages, setMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string; time: string }>
	>([
		{
			role: "assistant",
			content: "Hi Josh! I'm Flobot, your AI Chief of Staff. I can help with your team, OKRs, meeting actions, and more. What do you need?",
			time: fmt(new Date()),
		},
	]);
	const endRef = useRef<HTMLDivElement>(null);

	// Team context for chat
	const teamMembers = useQuery(api.team.listTeamMembers, { userId: "josh" });
	const okrDashboard = useQuery(api.okrs.getOKRDashboard, { userId: "josh" });
	const actionCounts = useQuery(api.meetingActions.getActionCounts, { userId: "josh" });
	const skillCoverage = useQuery(api.team.getSkillCoverage, { userId: "josh" });

	function fmt(d: Date) {
		return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	}

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// Build team context summary for the chat
	function buildTeamContext(): string {
		const parts: string[] = [];
		if (teamMembers && teamMembers.length > 0) {
			const memberList = teamMembers.map((m) => {
				let info = m.name;
				if (m.role) info += ` (${m.role})`;
				if (m.department) info += ` — ${m.department}`;
				if (m.skills?.length) info += ` [${m.skills.length} skills]`;
				return info;
			}).join("; ");
			parts.push(`Team (${teamMembers.length} members): ${memberList}`);
		}
		if (okrDashboard) {
			parts.push(`OKRs: ${okrDashboard.activeCount} active, ${okrDashboard.overallProgress}% overall progress. RAG: ${okrDashboard.ragBreakdown.green} green, ${okrDashboard.ragBreakdown.amber} amber, ${okrDashboard.ragBreakdown.red} red`);
			if (okrDashboard.objectives.length > 0) {
				const objList = okrDashboard.objectives.map((o: any) => `"${o.title}" (${o.progress}%, ${o.ragStatus})`).join("; ");
				parts.push(`Active objectives: ${objList}`);
			}
		}
		if (actionCounts) {
			parts.push(`Meeting actions: ${actionCounts.pending} pending review, ${actionCounts.confirmed} confirmed, ${actionCounts.total} total`);
		}
		if (skillCoverage) {
			parts.push(`Skills: ${skillCoverage.coveragePercent}% coverage (${skillCoverage.coveredSkills}/${skillCoverage.totalSkills} skills covered across ${skillCoverage.teamSize} members)`);
		}
		return parts.length > 0 ? `\n\nTeam Context:\n${parts.join("\n")}` : "";
	}

	const handleSend = async () => {
		if (!message.trim() || sending) return;
		const userMsg = message.trim();
		setMessages((p) => [...p, { role: "user", content: userMsg, time: fmt(new Date()) }]);
		setMessage("");
		setSending(true);

		// Build contextual response
		const teamContext = buildTeamContext();
		const lowerMsg = userMsg.toLowerCase();

		let response: string;

		// Simple keyword-based responses with team context
		if (lowerMsg.includes("team") && (lowerMsg.includes("who") || lowerMsg.includes("member") || lowerMsg.includes("list"))) {
			if (teamMembers && teamMembers.length > 0) {
				const list = teamMembers.map((m) => `• ${m.name}${m.role ? ` — ${m.role}` : ""}${m.department ? ` (${m.department})` : ""}`).join("\n");
				response = `Here's your team:\n\n${list}\n\nTotal: ${teamMembers.length} members`;
			} else {
				response = "No team members found yet. Mark contacts as 'coworker' or 'team member' in People to build your team.";
			}
		} else if (lowerMsg.includes("okr") || lowerMsg.includes("objective") || lowerMsg.includes("key result")) {
			if (okrDashboard && okrDashboard.objectives.length > 0) {
				const list = okrDashboard.objectives.map((o: any) => `• ${o.title} — ${o.progress}% (${o.ragStatus})`).join("\n");
				response = `Active OKRs (${okrDashboard.overallProgress}% overall):\n\n${list}`;
			} else {
				response = "No active OKRs yet. Head to Team → OKRs to create your first objective.";
			}
		} else if (lowerMsg.includes("skill") && (lowerMsg.includes("gap") || lowerMsg.includes("coverage"))) {
			if (skillCoverage) {
				response = `Skill coverage: ${skillCoverage.coveragePercent}% — ${skillCoverage.coveredSkills} of ${skillCoverage.totalSkills} skills covered across ${skillCoverage.teamSize} team members.`;
			} else {
				response = "Skill data is loading...";
			}
		} else if (lowerMsg.includes("action") || lowerMsg.includes("meeting")) {
			if (actionCounts) {
				response = `Meeting actions: ${actionCounts.pending} pending review, ${actionCounts.confirmed} confirmed, ${actionCounts.converted} converted to tasks. ${actionCounts.total} total.`;
			} else {
				response = "Meeting action data is loading...";
			}
		} else {
			response = `I understand your question. Here's what I know about your team:${teamContext || "\n\nNo team data loaded yet."}\n\nFor a fully powered AI response, connect the Anthropic API key in settings.`;
		}

		setTimeout(() => {
			setMessages((p) => [...p, { role: "assistant", content: response, time: fmt(new Date()) }]);
			setSending(false);
		}, 300);
	};

	if (!isOpen) {
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="fixed bottom-24 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-2xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all active:scale-95 z-50"
			>
				<MessageSquare className="h-5 w-5" />
			</button>
		);
	}

	return (
		<div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[560px] glass-heavy md:rounded-2xl md:shadow-xl flex flex-col z-50">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
				<div className="flex items-center gap-2.5">
					<Avatar className="h-7 w-7">
						<AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">F</AvatarFallback>
					</Avatar>
					<div>
						<p className="text-sm font-semibold tracking-tight">Flobot</p>
						<p className="text-[10px] text-muted-foreground">AI Chief of Staff</p>
					</div>
				</div>
				<button type="button" onClick={() => setIsOpen(false)} className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground">
					<X className="h-4 w-4" />
				</button>
			</div>

			{/* Messages */}
			<div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
				{messages.map((msg, i) => (
					<div key={i}>
						{msg.role === "user" ? (
							<div className="flex flex-col items-end">
								<span className="text-[10px] text-muted-foreground mb-1">{msg.time}</span>
								<div className="max-w-[80%] rounded-2xl rounded-tr-lg px-4 py-2.5 bg-primary text-primary-foreground">
									<p className="text-sm leading-relaxed">{msg.content}</p>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-start">
								<div className="flex items-center gap-1.5 mb-1">
									<Avatar className="h-4 w-4">
										<AvatarFallback className="text-[8px] bg-primary/10 text-primary">F</AvatarFallback>
									</Avatar>
									<span className="text-[10px] text-muted-foreground">{msg.time}</span>
								</div>
								<div className="max-w-[85%] pl-5">
									<p className="text-sm leading-relaxed text-foreground">{msg.content}</p>
								</div>
							</div>
						)}
					</div>
				))}
				<div ref={endRef} />
			</div>

			{/* Input */}
			<div className="px-3 pb-3 pt-1 border-t border-border/30">
				<form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
					className="flex items-center gap-1 glass rounded-xl px-2 py-1">
					<button type="button" className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
						<Plus className="h-4 w-4" />
					</button>
					<input
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Message..."
						className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5"
					/>
					<button type="submit" disabled={!message.trim() || sending}
						className={cn("p-1.5 rounded-lg transition-all", message.trim() && !sending ? "bg-primary text-primary-foreground" : "text-muted-foreground/40")}>
						{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
					</button>
				</form>
			</div>
		</div>
	);
}
