"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MessageCircle, Clock, ChevronRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

function DashboardContent() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const router = useRouter();

	const emails = useQuery(api.google.getEmails, { userId: "josh" }) ?? [];
	const calendarEvents = useQuery(api.google.getCalendarEvents, {
		userId: "josh",
		startTime: Date.now(),
		endTime: Date.now() + 24 * 60 * 60 * 1000,
	}) ?? [];
	const smsConvos = useQuery(api.sms.listConversations, { userId: "josh" }) ?? [];

	const needsMe = emails.filter((e: any) => e.triageStatus === "needs_me");
	const unreadTexts = smsConvos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
	const nextEvent = calendarEvents[0];

	function fmtTime(ts: number) {
		return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	}

	const hour = new Date().getHours();
	const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

	return (
		<DashboardLayout user={user}>
			<div className="space-y-5 p-4 md:p-6 max-w-2xl mx-auto w-full">
				<div className="pt-1">
					<h1 className="text-2xl font-semibold tracking-tight">{greeting}, Josh</h1>
					<p className="text-sm text-muted-foreground mt-0.5">Here's what needs your attention.</p>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-3">
					{[
						{ label: "Needs You", value: needsMe.length, href: "/dashboard/inbox", color: "text-red-500" },
						{ label: "Events", value: calendarEvents.length, href: "/dashboard/calendar", color: "text-primary" },
						{ label: "Unread", value: unreadTexts, href: "/dashboard/messages", color: "text-purple-500" },
					].map((stat) => (
						<Link key={stat.label} href={stat.href}>
							<div className="glass-card rounded-2xl p-4 text-center hover:shadow-md active:scale-[0.98] transition-all">
								<div className={`text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
							</div>
						</Link>
					))}
				</div>

				{/* Next Event */}
				{nextEvent && (
					<div className="glass-card rounded-2xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Clock className="h-3.5 w-3.5 text-primary" />
							<span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Next up</span>
						</div>
						<h3 className="text-base font-semibold tracking-tight truncate">{nextEvent.title}</h3>
						<p className="text-sm text-muted-foreground truncate mt-0.5">
							{fmtTime(nextEvent.startTime)}
							{nextEvent.attendees?.length ? ` · ${nextEvent.attendees.slice(0, 3).join(", ")}` : ""}
						</p>
					</div>
				)}

				{/* Priority Inbox */}
				<div className="glass-card rounded-2xl overflow-hidden">
					<div className="flex items-center justify-between px-4 pt-4 pb-2">
						<div className="flex items-center gap-2">
							<Mail className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-semibold tracking-tight">Priority Inbox</span>
						</div>
						<Link href="/dashboard/inbox" className="flex items-center gap-0.5 text-xs text-primary">
							All <ChevronRight className="h-3 w-3" />
						</Link>
					</div>
					<div className="px-2 pb-2">
						{needsMe.length === 0 ? (
							<p className="text-sm text-muted-foreground px-2 py-3">All caught up 🎉</p>
						) : (
							needsMe.slice(0, 4).map((email: any) => (
								<button key={email._id} type="button"
									onClick={() => router.push(`/dashboard/inbox?email=${email._id}`)}
									className="flex items-start gap-3 p-2.5 rounded-xl w-full text-left hover:bg-accent/50 active:scale-[0.99] transition-all">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-0.5">
											<p className="font-medium text-sm truncate flex-1">{email.from.split("<")[0].trim()}</p>
											<Badge className="text-[10px] shrink-0 rounded-full bg-red-500/90 text-white">Action</Badge>
										</div>
										<p className="text-sm text-muted-foreground truncate">{email.subject}</p>
									</div>
								</button>
							))
						)}
					</div>
				</div>

				{/* Calendar */}
				{calendarEvents.length > 0 && (
					<div className="glass-card rounded-2xl overflow-hidden">
						<div className="flex items-center justify-between px-4 pt-4 pb-2">
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-semibold tracking-tight">Today</span>
							</div>
							<Link href="/dashboard/calendar" className="flex items-center gap-0.5 text-xs text-primary">
								Full calendar <ChevronRight className="h-3 w-3" />
							</Link>
						</div>
						<div className="px-2 pb-2">
							{calendarEvents.slice(0, 5).map((event: any) => (
								<div key={event._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all">
									<div className="w-1 h-8 bg-primary/30 rounded-full shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">{event.title}</p>
										<p className="text-xs text-muted-foreground">
											{fmtTime(event.startTime)} – {fmtTime(event.endTime)}
											{event.location ? ` · ${event.location}` : ""}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Messages */}
				{smsConvos.length > 0 && (
					<div className="glass-card rounded-2xl overflow-hidden">
						<div className="flex items-center justify-between px-4 pt-4 pb-2">
							<div className="flex items-center gap-2">
								<MessageCircle className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-semibold tracking-tight">Messages</span>
							</div>
							<Link href="/dashboard/messages" className="flex items-center gap-0.5 text-xs text-primary">
								All <ChevronRight className="h-3 w-3" />
							</Link>
						</div>
						<div className="px-2 pb-2">
							{smsConvos.slice(0, 3).map((convo: any) => (
								<div key={convo._id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all">
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">{convo.contactName || convo.phoneNumber}</p>
										<p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
									</div>
									{convo.unreadCount > 0 && (
										<div className="h-5 min-w-[20px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
											{convo.unreadCount}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}

export default function DashboardPage() {
	return <DashboardContent />;
}
