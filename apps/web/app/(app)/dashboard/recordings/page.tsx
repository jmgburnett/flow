"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Mic, Play, Download, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock recordings for MVP
const mockRecordings = [
	{
		id: "1",
		title: "End of day brain dump",
		duration: "8:32",
		date: "Yesterday, 6:45 PM",
		status: "ready" as const,
		transcript: `[00:00] Okay, so today was productive. Had a really good conversation with Doug about the pricing strategy. I think we're aligned on the new enterprise tier at $499 a month.

[01:15] Need to remember to call EJ back about the Exponential partnership. He seemed really excited about integrating with Church.tech. Could be a great channel for us.

[02:30] Sarah's working on the Q2 offsite planning. I should send her my thoughts on the agenda tonight. Want to make sure we do a proper strategy session, not just team building stuff.

[03:45] Made some progress on the pitch deck for the board meeting. Still need to tighten up the financial projections slide. Doug said he'd have the updated numbers by Thursday.

[04:30] Random thought - we should probably look into building a mobile app for Church.tech. Keep hearing that feedback from customers. Add that to the product roadmap discussion.

[05:15] Tomorrow I need to respond to Carey about that podcast interview. Should definitely do it - good exposure for Church.tech.

[06:00] Oh, and I promised the team I'd review the new onboarding flow by EOW. Put that on my task list.

[07:30] That's it for today. Feeling good about the week ahead.`,
		actionItems: [
			"Call EJ about Exponential partnership",
			"Send Sarah agenda thoughts for Q2 offsite",
			"Review updated financial projections from Doug by Thursday",
			"Add mobile app to product roadmap discussion",
			"Respond to Carey about podcast interview",
			"Review new onboarding flow by end of week",
		],
		summary: "Productive day covering pricing strategy alignment with Doug, Exponential partnership follow-up with EJ, Q2 offsite planning with Sarah, board meeting prep, and product roadmap considerations including mobile app development.",
	},
	{
		id: "2",
		title: "Meeting with Church.tech team",
		duration: "45:12",
		date: "2 days ago, 2:00 PM",
		status: "ready" as const,
		transcript: "[Recording transcript would be here...]",
		actionItems: [
			"Follow up with design team on UI refresh",
			"Schedule demo with large church prospect",
			"Review Q1 metrics before board meeting",
		],
		summary: "Team meeting covering product updates, customer feedback, and Q1 performance review.",
	},
	{
		id: "3",
		title: "Quick voice note",
		duration: "2:15",
		date: "3 days ago, 9:15 AM",
		status: "ready" as const,
		transcript: "[Recording transcript would be here...]",
		actionItems: [],
		summary: "Quick note about customer feedback on pricing.",
	},
];

export default function RecordingsPage() {
	const [selectedRecording, setSelectedRecording] = useState<typeof mockRecordings[0] | null>(null);

	return (
		<DashboardLayout>
			<div className="flex h-full">
				{/* Recordings List */}
				<div className="w-[400px] border-r flex flex-col">
					<div className="p-6 border-b space-y-4">
						<h1 className="text-2xl font-bold">Recordings</h1>
						<div className="flex gap-2">
							<Button className="flex-1 gap-2">
								<Upload className="h-4 w-4" />
								Upload
							</Button>
							<Button variant="outline" className="flex-1 gap-2">
								<Mic className="h-4 w-4" />
								Record
							</Button>
						</div>
						<div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
							Drag and drop audio files here
						</div>
					</div>
					<div className="flex-1 overflow-auto">
						{mockRecordings.map((recording) => (
							<div
								key={recording.id}
								onClick={() => setSelectedRecording(recording)}
								className={cn(
									"p-4 border-b cursor-pointer transition-colors hover:bg-accent",
									selectedRecording?.id === recording.id && "bg-accent",
								)}
							>
								<div className="flex items-start justify-between mb-2">
									<p className="font-medium">{recording.title}</p>
									<Badge variant="secondary" className="text-xs">
										{recording.status}
									</Badge>
								</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{recording.duration}</span>
									<span>•</span>
									<span>{recording.date}</span>
								</div>
								{recording.actionItems.length > 0 && (
									<div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
										<CheckSquare className="h-3 w-3" />
										<span>{recording.actionItems.length} action items</span>
									</div>
								)}
							</div>
						))}
					</div>
				</div>

				{/* Recording Detail */}
				<div className="flex-1 flex flex-col">
					{selectedRecording ? (
						<>
							<div className="p-6 border-b">
								<div className="flex items-start justify-between mb-4">
									<div>
										<h2 className="text-2xl font-bold mb-2">{selectedRecording.title}</h2>
										<div className="flex items-center gap-3 text-sm text-muted-foreground">
											<span>{selectedRecording.date}</span>
											<span>•</span>
											<span>{selectedRecording.duration}</span>
										</div>
									</div>
									<div className="flex gap-2">
										<Button size="sm" variant="outline" className="gap-2">
											<Download className="h-4 w-4" />
											Download
										</Button>
									</div>
								</div>
								<div className="flex gap-2">
									<Button size="sm" className="gap-2">
										<Play className="h-4 w-4" />
										Play
									</Button>
								</div>
							</div>

							<div className="flex-1 overflow-auto p-6 space-y-6">
								{/* Summary */}
								{selectedRecording.summary && (
									<Card>
										<CardHeader>
											<CardTitle>Summary</CardTitle>
										</CardHeader>
										<CardContent>
											<p className="text-sm text-muted-foreground">
												{selectedRecording.summary}
											</p>
										</CardContent>
									</Card>
								)}

								{/* Action Items */}
								{selectedRecording.actionItems.length > 0 && (
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<CheckSquare className="h-5 w-5 text-blue-600" />
												Action Items
											</CardTitle>
											<CardDescription>
												Extracted from recording
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3">
											{selectedRecording.actionItems.map((item, i) => (
												<div key={i} className="flex items-start gap-3">
													<input type="checkbox" className="mt-1" />
													<p className="text-sm flex-1">{item}</p>
													<Button size="sm" variant="ghost">
														Create Task
													</Button>
												</div>
											))}
										</CardContent>
									</Card>
								)}

								{/* Transcript */}
								<Card>
									<CardHeader>
										<CardTitle>Transcript</CardTitle>
										<CardDescription>
											Speaker-labeled with timestamps
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="prose max-w-none">
											<pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
												{selectedRecording.transcript}
											</pre>
										</div>
									</CardContent>
								</Card>
							</div>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-muted-foreground">
							Select a recording to view details
						</div>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
