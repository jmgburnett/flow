"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Archive, Clock, Forward, Reply } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data for MVP
const mockEmails = [
	{
		id: "1",
		from: "Doug Chen",
		fromEmail: "doug@onflourish.com",
		subject: "Q1 Pricing Strategy Discussion",
		preview: "Hey Josh, wanted to get your thoughts on the new pricing tiers we discussed...",
		body: "Hey Josh,\n\nWanted to get your thoughts on the new pricing tiers we discussed last week. I've put together a proposal that I think addresses the concerns about enterprise customers while maintaining our growth trajectory.\n\nKey changes:\n- New enterprise tier at $499/mo\n- Increased limits on standard tier\n- Better value prop for annual plans\n\nCan you review by EOD Thursday? Want to present this to the board on Friday.\n\nThanks,\nDoug",
		time: "8:45 AM",
		triage: "needs_me" as const,
		unread: true,
	},
	{
		id: "2",
		from: "Carey Nieuwhof",
		fromEmail: "carey@careynieuwhof.com",
		subject: "Podcast Interview Request",
		preview: "Would love to have you on the podcast to talk about Church.tech and the future of...",
		body: "Hi Josh,\n\nHope you're doing well! I've been following the growth of Church.tech and would love to have you on the podcast.\n\nWould you be interested in a 30-45 minute conversation about:\n- The future of church technology\n- How AI is changing ministry\n- Your journey from Gloo to Church.tech\n\nWe typically record on Tuesday or Wednesday afternoons. Let me know if you're interested and we can find a time that works.\n\nBest,\nCarey",
		time: "Yesterday",
		triage: "draft_ready" as const,
		unread: true,
	},
	{
		id: "3",
		from: "Sarah Johnson",
		fromEmail: "sarah@onflourish.com",
		subject: "Team Offsite Planning - Need Your Input",
		preview: "Planning the Q2 team offsite and need to finalize the agenda. Can you...",
		body: "Hey Josh,\n\nPlanning the Q2 team offsite for April 15-16. Got most of the logistics sorted but need your input on a few things:\n\n1. What topics do you want to cover in your opening session?\n2. Should we do a full-day workshop or split sessions?\n3. Any specific team building activities you want to include?\n\nAlso, Doug suggested we might want to bring in an external facilitator for the strategy session. Thoughts?\n\nNeed to lock this down by next week to finalize venue and catering.\n\nThanks!\nSarah",
		time: "2 days ago",
		triage: "needs_me" as const,
		unread: false,
	},
	{
		id: "4",
		from: "EJ Swanson",
		fromEmail: "ej@exponential.org",
		subject: "Re: Partnership Opportunity",
		preview: "Thanks for the intro to the team! Looking forward to exploring this further...",
		body: "Josh,\n\nThanks for the intro to the team! Had a great initial call with Doug and Sarah yesterday.\n\nWe're definitely interested in exploring a partnership around church planting tools. The integration with Church.tech could be really powerful for our network.\n\nWould love to get 30 minutes with you to discuss the strategic vision and make sure we're aligned before we dive too deep into the details.\n\nHow does your schedule look next week?\n\nBest,\nEJ",
		time: "3 days ago",
		triage: "handled" as const,
		unread: false,
	},
	{
		id: "5",
		from: "LinkedIn",
		fromEmail: "notifications@linkedin.com",
		subject: "You have 15 new profile views",
		preview: "See who's been checking out your profile this week...",
		body: "You have 15 new profile views this week.\n\nSee who's been viewing your profile and connect with them.",
		time: "1 week ago",
		triage: "ignore" as const,
		unread: false,
	},
];

const triageBadges = {
	needs_me: { label: "Needs Me", variant: "destructive" as const, color: "text-red-500" },
	draft_ready: { label: "Draft Ready", variant: "default" as const, color: "text-yellow-500" },
	handled: { label: "Handled", variant: "secondary" as const, color: "text-green-500" },
	ignore: { label: "Ignore", variant: "outline" as const, color: "text-gray-500" },
};

export default function InboxPage() {
	const [selectedEmail, setSelectedEmail] = useState(mockEmails[0]);
	const [filter, setFilter] = useState<"all" | "needs_me" | "draft_ready" | "handled">("all");

	const filteredEmails = filter === "all"
		? mockEmails
		: mockEmails.filter((email) => email.triage === filter);

	return (
		<DashboardLayout>
			<div className="flex h-full">
				{/* Email List */}
				<div className="w-[400px] border-r flex flex-col">
					<div className="p-4 border-b">
						<h1 className="text-xl font-bold mb-4">Inbox</h1>
						<Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
							<TabsList className="grid w-full grid-cols-4">
								<TabsTrigger value="all" className="text-xs">All</TabsTrigger>
								<TabsTrigger value="needs_me" className="text-xs">Needs Me</TabsTrigger>
								<TabsTrigger value="draft_ready" className="text-xs">Drafts</TabsTrigger>
								<TabsTrigger value="handled" className="text-xs">Handled</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
					<div className="flex-1 overflow-auto">
						{filteredEmails.map((email) => {
							const badge = triageBadges[email.triage];
							return (
								<div
									key={email.id}
									onClick={() => setSelectedEmail(email)}
									className={cn(
										"p-4 border-b cursor-pointer transition-colors hover:bg-accent",
										selectedEmail?.id === email.id && "bg-accent",
										email.unread && "font-medium",
									)}
								>
									<div className="flex items-start gap-3">
										<Avatar className="h-10 w-10 flex-shrink-0">
											<AvatarFallback>{email.from[0]}</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<p className={cn("text-sm truncate", email.unread && "font-semibold")}>
													{email.from}
												</p>
												<span className={cn("text-lg", badge.color)}>●</span>
											</div>
											<p className={cn("text-sm truncate mb-1", email.unread && "font-semibold")}>
												{email.subject}
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{email.preview}
											</p>
											<div className="flex items-center gap-2 mt-2">
												<Badge variant={badge.variant} className="text-xs">
													{badge.label}
												</Badge>
												<span className="text-xs text-muted-foreground">{email.time}</span>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Email Detail */}
				<div className="flex-1 flex flex-col">
					{selectedEmail ? (
						<>
							<div className="p-6 border-b">
								<div className="flex items-start justify-between mb-4">
									<div>
										<h2 className="text-2xl font-bold mb-2">{selectedEmail.subject}</h2>
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarFallback>{selectedEmail.from[0]}</AvatarFallback>
											</Avatar>
											<div>
												<p className="text-sm font-medium">{selectedEmail.from}</p>
												<p className="text-xs text-muted-foreground">{selectedEmail.fromEmail}</p>
											</div>
											<Badge variant={triageBadges[selectedEmail.triage].variant}>
												{triageBadges[selectedEmail.triage].label}
											</Badge>
										</div>
									</div>
									<p className="text-sm text-muted-foreground">{selectedEmail.time}</p>
								</div>
								<div className="flex gap-2">
									<Button size="sm" className="gap-2">
										<Reply className="h-4 w-4" />
										Reply
									</Button>
									<Button size="sm" variant="outline" className="gap-2">
										<Forward className="h-4 w-4" />
										Forward to Flo
									</Button>
									<Button size="sm" variant="outline" className="gap-2">
										<Archive className="h-4 w-4" />
										Archive
									</Button>
									<Button size="sm" variant="outline" className="gap-2">
										<Clock className="h-4 w-4" />
										Snooze
									</Button>
								</div>
							</div>
							<div className="flex-1 p-6 overflow-auto">
								<div className="prose max-w-none">
									<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
										{selectedEmail.body}
									</pre>
								</div>

								{/* Draft reply section for draft_ready emails */}
								{selectedEmail.triage === "draft_ready" && (
									<Card className="mt-6 p-4 bg-yellow-50 border-yellow-200">
										<p className="text-sm font-medium mb-2">AI-Generated Draft Reply:</p>
										<div className="bg-white p-4 rounded border">
											<p className="text-sm">
												Hi Carey,
												<br /><br />
												Thanks so much for the invitation — I'd be honored to join you on the podcast!
												<br /><br />
												Those topics are right in my wheelhouse, especially around how AI is transforming ministry operations. I think we could have a great conversation about where church technology is headed in the next 3-5 years.
												<br /><br />
												Tuesday or Wednesday afternoons work well for me. I'm generally available after 2pm ET. What works best for you?
												<br /><br />
												Looking forward to it!
												<br />
												Josh
											</p>
										</div>
										<div className="flex gap-2 mt-3">
											<Button size="sm">Send Draft</Button>
											<Button size="sm" variant="outline">Edit</Button>
										</div>
									</Card>
								)}
							</div>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-muted-foreground">
							Select an email to view
						</div>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
