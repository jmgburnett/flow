import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Mic, CheckSquare, Clock } from "lucide-react";

async function DashboardContent() {
	// const session = await getSession();

	if (false) {
		redirect("/login");
	}

	const user = { name: "Josh", email: "josh@onflourish.com" };
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
			<div className="space-y-4 p-4 md:p-6">
				{/* Quick Stats Row */}
				<div className="grid grid-cols-3 gap-3">
					<Card className="bg-blue-600 text-white border-0">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold">5</div>
							<div className="text-xs text-blue-100">Unread Emails</div>
						</CardContent>
					</Card>
					<Card className="bg-indigo-600 text-white border-0">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold">3</div>
							<div className="text-xs text-indigo-100">Events Today</div>
						</CardContent>
					</Card>
					<Card className="bg-purple-600 text-white border-0">
						<CardContent className="p-4 text-center">
							<div className="text-2xl font-bold">2</div>
							<div className="text-xs text-purple-100">Unread Texts</div>
						</CardContent>
					</Card>
				</div>

				{/* Next Event Card - only show if within 2 hours */}
				<Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-0">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-2">
							<Clock className="h-4 w-4" />
							<span className="text-xs font-medium text-blue-100">NEXT UP</span>
						</div>
						<h3 className="text-lg font-bold mb-1">{upcomingEvents[0].title}</h3>
						<p className="text-sm text-blue-100">
							{upcomingEvents[0].time} • with {upcomingEvents[0].attendees.join(", ")}
						</p>
					</CardContent>
				</Card>

				{/* Priority Inbox Preview */}
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-base">
								<Mail className="h-4 w-4 text-blue-600" />
								Priority Inbox
							</CardTitle>
							<Badge variant="destructive" className="text-xs">5</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						{priorityEmails.slice(0, 3).map((email, i) => (
							<div key={i} className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<p className="font-medium text-sm truncate">{email.from}</p>
										{email.badge === "needs_me" && (
											<Badge variant="destructive" className="text-[10px] shrink-0">Needs You</Badge>
										)}
										{email.badge === "draft_ready" && (
											<Badge className="text-[10px] bg-yellow-500 shrink-0">Draft</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground truncate">{email.subject}</p>
									<p className="text-xs text-muted-foreground mt-1">{email.time}</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				{/* Recent Texts Preview */}
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2 text-base">
								<Mail className="h-4 w-4 text-blue-600" />
								Recent Messages
							</CardTitle>
							<Badge variant="secondary" className="text-xs">2</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-start gap-3 pb-3 border-b">
							<div className="flex-1 min-w-0">
								<p className="font-medium text-sm">Sarah Burnett</p>
								<p className="text-sm text-muted-foreground truncate">Hey, can you pick up milk on the way home?</p>
								<p className="text-xs text-muted-foreground mt-1">1h ago</p>
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="flex-1 min-w-0">
								<p className="font-medium text-sm">Savannah</p>
								<p className="text-sm text-muted-foreground truncate">Dad, what time is dinner?</p>
								<p className="text-xs text-muted-foreground mt-1">2d ago</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Tasks Due Today */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<CheckSquare className="h-4 w-4 text-blue-600" />
							Tasks Due Today
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{tasksToday.map((task, i) => (
							<div key={i} className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0">
								<input type="checkbox" className="mt-1 h-5 w-5" />
								<div className="flex-1 min-w-0">
									<p className="font-medium text-sm">{task.title}</p>
									<div className="flex items-center gap-2 mt-1">
										{task.priority === "high" && (
											<Badge variant="destructive" className="text-[10px]">High</Badge>
										)}
										{task.priority === "medium" && (
											<Badge variant="secondary" className="text-[10px]">Medium</Badge>
										)}
									</div>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
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
