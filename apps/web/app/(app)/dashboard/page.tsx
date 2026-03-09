import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Mic, CheckSquare, Clock } from "lucide-react";

async function DashboardContent() {
	const session = await getSession();

	if (!session?.user) {
		redirect("/login");
	}

	const user = session.user;
	const displayName = user?.name || user?.email?.split("@")[0] || "Josh";

	// Placeholder data for MVP
	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const upcomingEvents = [
		{ title: "Team Standup", time: "9:00 AM", attendees: ["Doug", "Sarah"] },
		{ title: "Product Review", time: "11:30 AM", attendees: ["Carey", "EJ"] },
		{ title: "1:1 with Doug", time: "2:00 PM", attendees: ["Doug"] },
	];

	const priorityEmails = [
		{ from: "Doug Chen", subject: "Q1 Pricing Strategy", time: "8:45 AM", badge: "needs_me" },
		{ from: "Carey Nieuwhof", subject: "Podcast Interview Request", time: "Yesterday", badge: "draft_ready" },
		{ from: "Sarah Johnson", subject: "Team Offsite Planning", time: "2d ago", badge: "needs_me" },
	];

	const tasksToday = [
		{ title: "Review pricing proposal from Doug", priority: "high", source: "email" },
		{ title: "Respond to Carey about podcast", priority: "medium", source: "email" },
		{ title: "Call EJ about Exponential deal", priority: "high", source: "recording" },
	];

	const recentRecordings = [
		{ title: "End of day brain dump", date: "Yesterday", duration: "8:32", status: "ready" },
		{ title: "Meeting with Church.tech team", date: "2 days ago", duration: "45:12", status: "ready" },
	];

	return (
		<DashboardLayout user={user}>
			<div className="container mx-auto p-8 space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-bold">Good morning, {displayName}</h1>
					<p className="text-muted-foreground mt-1">{today}</p>
				</div>

				{/* Today Card */}
				<Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-0">
					<CardContent className="p-6">
						<div className="flex items-start justify-between">
							<div>
								<h2 className="text-2xl font-bold mb-2">Today's Overview</h2>
								<p className="text-blue-100">You have 3 meetings, 5 priority emails, and 3 tasks due today</p>
							</div>
							<div className="text-right">
								<div className="text-3xl font-bold">72°F</div>
								<div className="text-blue-100 text-sm">Partly Cloudy</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Two Column Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Agenda */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calendar className="h-5 w-5 text-blue-600" />
								Today's Agenda
							</CardTitle>
							<CardDescription>Your upcoming meetings</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{upcomingEvents.map((event, i) => (
								<div key={i} className="flex items-start gap-3 pb-4 last:pb-0 border-b last:border-0">
									<div className="flex-shrink-0 w-20">
										<div className="flex items-center gap-1 text-sm font-medium">
											<Clock className="h-3 w-3" />
											{event.time}
										</div>
									</div>
									<div className="flex-1">
										<p className="font-medium">{event.title}</p>
										<p className="text-sm text-muted-foreground">
											with {event.attendees.join(", ")}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					{/* Priority Inbox */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mail className="h-5 w-5 text-blue-600" />
								Priority Inbox
							</CardTitle>
							<CardDescription>Emails that need your attention</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{priorityEmails.map((email, i) => (
								<div key={i} className="flex items-start gap-3 pb-4 last:pb-0 border-b last:border-0">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<p className="font-medium">{email.from}</p>
											{email.badge === "needs_me" && (
												<Badge variant="destructive" className="text-xs">Needs You</Badge>
											)}
											{email.badge === "draft_ready" && (
												<Badge className="text-xs bg-yellow-500">Draft Ready</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground">{email.subject}</p>
										<p className="text-xs text-muted-foreground mt-1">{email.time}</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					{/* Tasks Due Today */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckSquare className="h-5 w-5 text-blue-600" />
								Tasks Due Today
							</CardTitle>
							<CardDescription>Action items requiring your focus</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{tasksToday.map((task, i) => (
								<div key={i} className="flex items-start gap-3 pb-4 last:pb-0 border-b last:border-0">
									<input type="checkbox" className="mt-1" />
									<div className="flex-1">
										<p className="font-medium">{task.title}</p>
										<div className="flex items-center gap-2 mt-1">
											{task.priority === "high" && (
												<Badge variant="destructive" className="text-xs">High</Badge>
											)}
											{task.priority === "medium" && (
												<Badge variant="secondary" className="text-xs">Medium</Badge>
											)}
											<span className="text-xs text-muted-foreground">from {task.source}</span>
										</div>
									</div>
								</div>
							))}
						</CardContent>
					</Card>

					{/* Recent Recordings */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mic className="h-5 w-5 text-blue-600" />
								Recent Recordings
							</CardTitle>
							<CardDescription>Your latest voice notes and transcripts</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{recentRecordings.map((recording, i) => (
								<div key={i} className="flex items-start gap-3 pb-4 last:pb-0 border-b last:border-0">
									<div className="flex-1">
										<p className="font-medium">{recording.title}</p>
										<div className="flex items-center gap-2 mt-1">
											<span className="text-xs text-muted-foreground">{recording.date}</span>
											<span className="text-xs text-muted-foreground">•</span>
											<span className="text-xs text-muted-foreground">{recording.duration}</span>
											<Badge variant="secondary" className="text-xs">{recording.status}</Badge>
										</div>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</DashboardLayout>
	);
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<DashboardContent />
		</Suspense>
	);
}
