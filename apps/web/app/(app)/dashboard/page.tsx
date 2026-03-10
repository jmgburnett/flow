"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	const calendarEvents =
		useQuery(api.google.getCalendarEvents, {
			userId: "josh",
			startTime: Date.now(),
			endTime: Date.now() + 24 * 60 * 60 * 1000,
		}) ?? [];
	const smsConvos =
		useQuery(api.sms.listConversations, { userId: "josh" }) ?? [];

	const needsMe = emails.filter((e: any) => e.triageStatus === "needs_me");
	const unreadTexts = smsConvos.reduce(
		(sum: number, c: any) => sum + (c.unreadCount || 0),
		0,
	);

	const nextEvent = calendarEvents[0];

	function fmtTime(ts: number) {
		return new Date(ts).toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	}

	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good morning";
		if (hour < 18) return "Good afternoon";
		return "Good evening";
	};

	return (
		<DashboardLayout user={user}>
			<div className="space-y-5 p-4 md:p-6 max-w-2xl mx-auto w-full">
				{/* Greeting */}
				<div className="pt-2">
					<h1 className="text-xl font-semibold text-foreground">
						{getGreeting()}, {user.name}
					</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						Here's what needs your attention today.
					</p>
				</div>

				{/* Quick stats row */}
				<div className="grid grid-cols-3 gap-3">
					<Link href="/dashboard/inbox">
						<Card className="hover:shadow-md transition-shadow cursor-pointer">
							<CardContent className="p-3 text-center">
								<div className="text-2xl font-bold text-foreground">
									{needsMe.length}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Needs You
								</div>
							</CardContent>
						</Card>
					</Link>
					<Link href="/dashboard/calendar">
						<Card className="hover:shadow-md transition-shadow cursor-pointer">
							<CardContent className="p-3 text-center">
								<div className="text-2xl font-bold text-foreground">
									{calendarEvents.length}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Events Today
								</div>
							</CardContent>
						</Card>
					</Link>
					<Link href="/dashboard/messages">
						<Card className="hover:shadow-md transition-shadow cursor-pointer">
							<CardContent className="p-3 text-center">
								<div className="text-2xl font-bold text-foreground">
									{unreadTexts}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Unread Texts
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>

				{/* Next Event */}
				{nextEvent && (
					<Card className="overflow-hidden">
						<CardContent className="p-4">
							<div className="flex items-center gap-2 mb-2">
								<Clock className="h-4 w-4 text-primary shrink-0" />
								<span className="text-xs font-medium text-primary uppercase tracking-wide">
									Next up
								</span>
							</div>
							<h3 className="text-base font-semibold text-foreground mb-1 truncate">
								{nextEvent.title}
							</h3>
							<p className="text-sm text-muted-foreground truncate">
								{fmtTime(nextEvent.startTime)}
								{nextEvent.attendees?.length
									? ` · ${nextEvent.attendees.slice(0, 3).join(", ")}`
									: ""}
							</p>
						</CardContent>
					</Card>
				)}

				{/* Priority Inbox */}
				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-sm font-semibold">
								<Mail className="h-4 w-4 text-muted-foreground shrink-0" />
								Priority Inbox
							</CardTitle>
							<Link
								href="/dashboard/inbox"
								className="flex items-center gap-0.5 text-xs text-primary hover:underline"
							>
								View all
								<ChevronRight className="h-3 w-3" />
							</Link>
						</div>
					</CardHeader>
					<CardContent className="space-y-1">
						{needsMe.length === 0 ? (
							<p className="text-sm text-muted-foreground py-2">
								All caught up! 🎉
							</p>
						) : (
							needsMe.slice(0, 4).map((email: any) => (
								<button
									key={email._id}
									type="button"
									onClick={() =>
										router.push(
											`/dashboard/inbox?email=${email._id}`,
										)
									}
									className="flex items-start gap-3 p-2.5 -mx-2 rounded-lg w-full text-left hover:bg-accent transition-colors"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-0.5">
											<p className="font-medium text-sm truncate flex-1">
												{email.from.split("<")[0].trim()}
											</p>
											<Badge
												variant="destructive"
												className="text-[10px] shrink-0"
											>
												Needs You
											</Badge>
										</div>
										<p className="text-sm text-muted-foreground truncate">
											{email.subject}
										</p>
									</div>
								</button>
							))
						)}
					</CardContent>
				</Card>

				{/* Today Calendar */}
				{calendarEvents.length > 0 && (
					<Card>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2 text-sm font-semibold">
									<Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
									Today
								</CardTitle>
								<Link
									href="/dashboard/calendar"
									className="flex items-center gap-0.5 text-xs text-primary hover:underline"
								>
									Full calendar
									<ChevronRight className="h-3 w-3" />
								</Link>
							</div>
						</CardHeader>
						<CardContent className="space-y-1">
							{calendarEvents.slice(0, 5).map((event: any) => (
								<div
									key={event._id}
									className="flex items-start gap-3 p-2.5 -mx-2 rounded-lg hover:bg-accent transition-colors"
								>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">
											{event.title}
										</p>
										<p className="text-xs text-muted-foreground">
											{fmtTime(event.startTime)} –{" "}
											{fmtTime(event.endTime)}
											{event.location
												? ` · ${event.location}`
												: ""}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				)}

				{/* Recent Texts */}
				{smsConvos.length > 0 && (
					<Card>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2 text-sm font-semibold">
									<MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
									Recent Messages
								</CardTitle>
								<Link
									href="/dashboard/messages"
									className="flex items-center gap-0.5 text-xs text-primary hover:underline"
								>
									View all
									<ChevronRight className="h-3 w-3" />
								</Link>
							</div>
						</CardHeader>
						<CardContent className="space-y-1">
							{smsConvos.slice(0, 3).map((convo: any) => (
								<div
									key={convo._id}
									className="flex items-start gap-3 p-2.5 -mx-2 rounded-lg hover:bg-accent transition-colors"
								>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">
											{convo.contactName || convo.phoneNumber}
										</p>
										<p className="text-sm text-muted-foreground truncate">
											{convo.lastMessage}
										</p>
									</div>
									{convo.unreadCount > 0 && (
										<Badge variant="secondary" className="text-xs shrink-0">
											{convo.unreadCount}
										</Badge>
									)}
								</div>
							))}
						</CardContent>
					</Card>
				)}
			</div>
		</DashboardLayout>
	);
}

export default function DashboardPage() {
	return <DashboardContent />;
}
