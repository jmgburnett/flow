"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

// Mock events for MVP
const mockEvents = [
	{
		id: "1",
		title: "Team Standup",
		startTime: 9,
		duration: 0.5,
		day: 1, // Monday
		attendees: ["Doug Chen", "Sarah Johnson"],
		color: "bg-blue-500",
		prepNotes: "Review yesterday's progress and blockers",
	},
	{
		id: "2",
		title: "Product Review",
		startTime: 11.5,
		duration: 1,
		day: 1,
		attendees: ["Carey Nieuwhof", "EJ Swanson"],
		color: "bg-indigo-500",
		prepNotes: "Discuss Q2 roadmap and feature priorities",
	},
	{
		id: "3",
		title: "1:1 with Doug",
		startTime: 14,
		duration: 0.5,
		day: 1,
		attendees: ["Doug Chen"],
		color: "bg-purple-500",
		prepNotes: "Pricing strategy follow-up from last week's email",
	},
	{
		id: "4",
		title: "Engineering Sync",
		startTime: 10,
		duration: 1,
		day: 2,
		attendees: ["Tech Team"],
		color: "bg-blue-500",
		prepNotes: "",
	},
	{
		id: "5",
		title: "Customer Call - Willow Creek",
		startTime: 15,
		duration: 1,
		day: 2,
		attendees: ["Sarah Johnson", "Client"],
		color: "bg-green-500",
		prepNotes: "Large church interested in enterprise plan",
	},
	{
		id: "6",
		title: "Board Meeting Prep",
		startTime: 13,
		duration: 2,
		day: 3,
		attendees: ["Doug Chen", "Sarah Johnson"],
		color: "bg-red-500",
		prepNotes: "Finalize Q1 numbers and Q2 projections",
	},
];

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm

export default function CalendarPage() {
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [currentWeek, setCurrentWeek] = useState("March 10-14, 2026");
	const [isSyncing, setIsSyncing] = useState(false);

	// Get connections and events from Convex
	const connections = useQuery(api.google.getGoogleConnections, {
		userId: "josh",
	});

	// Get events for the next 7 days
	const now = Date.now();
	const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
	const realEventsData = useQuery(api.google.getCalendarEvents, {
		userId: "josh",
		startTime: now,
		endTime: sevenDaysLater,
	});

	const syncCalendar = useAction(api.google.syncCalendar);

	// Transform real events to match the UI format
	const realEvents = realEventsData?.map((event: any) => {
		const startDate = new Date(event.startTime);
		const endDate = new Date(event.endTime);
		const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
		const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
		const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0 = Monday
		const hour = startDate.getHours() + startDate.getMinutes() / 60;

		return {
			id: event._id,
			title: event.title,
			startTime: hour,
			duration,
			day: adjustedDay,
			attendees: event.attendees || [],
			color: "bg-blue-500",
			prepNotes: event.prepNotes || "",
		};
	}).filter((event: any) => event.day >= 0 && event.day < 5) || []; // Only show weekdays

	// Use real events if available, otherwise fall back to mock data
	const events = realEvents.length > 0 ? realEvents : mockEvents;

	const selectedEvent = selectedEventId
		? events.find((e: any) => e.id === selectedEventId) || null
		: null;

	const handleSync = async () => {
		if (!connections || connections.length === 0) return;

		setIsSyncing(true);
		try {
			await Promise.all(
				connections.map((conn: any) => syncCalendar({ connectionId: conn._id })),
			);
		} catch (error) {
			console.error("Sync failed:", error);
		} finally {
			setIsSyncing(false);
		}
	};

	// Show empty state if no connections
	if (connections !== undefined && connections.length === 0) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center h-full">
					<div className="text-center space-y-4">
						<p className="text-muted-foreground">
							No Google accounts connected yet
						</p>
						<Link href="/dashboard/settings">
							<Button>Connect Google Account</Button>
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="flex h-full">
				{/* Calendar View */}
				<div className="flex-1 flex flex-col p-6">
					<div className="flex items-center justify-between mb-6">
						<div>
							<h1 className="text-2xl font-bold">Calendar</h1>
							<p className="text-sm text-muted-foreground">{currentWeek}</p>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="icon">
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button variant="outline" size="sm">Today</Button>
							<Button variant="outline" size="icon">
								<ChevronRight className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleSync}
								disabled={isSyncing || !connections}
							>
								{isSyncing ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Syncing...
									</>
								) : (
									<>
										<RefreshCw className="mr-2 h-4 w-4" />
										Sync
									</>
								)}
							</Button>
							<Button className="ml-4 gap-2">
								<Plus className="h-4 w-4" />
								Add Event
							</Button>
						</div>
					</div>

					{/* Week View Grid */}
					<div className="flex-1 border rounded-lg overflow-auto">
						<div className="grid grid-cols-6 min-w-[800px]">
							{/* Time column */}
							<div className="border-r bg-muted/30">
								<div className="h-12 border-b" />
								{hours.map((hour) => (
									<div key={hour} className="h-20 border-b flex items-start justify-end pr-2 pt-1">
										<span className="text-xs text-muted-foreground">
											{hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
										</span>
									</div>
								))}
							</div>

							{/* Day columns */}
							{daysOfWeek.map((day, dayIndex) => (
								<div key={day} className="border-r last:border-r-0 relative">
									<div className="h-12 border-b flex items-center justify-center font-medium">
										{day}
									</div>
									<div className="relative">
										{hours.map((hour) => (
											<div key={hour} className="h-20 border-b" />
										))}
										{/* Events for this day */}
										{events
											.filter((event: any) => event.day === dayIndex)
											.map((event: any) => {
												const topPosition = (event.startTime - 8) * 80; // 80px per hour
												const height = event.duration * 80;
												return (
													<div
														key={event.id}
														onClick={() => setSelectedEventId(event.id)}
														className={cn(
															"absolute left-1 right-1 rounded p-2 cursor-pointer text-white text-xs overflow-hidden",
															event.color,
															selectedEvent?.id === event.id && "ring-2 ring-white ring-offset-2",
														)}
														style={{
															top: `${topPosition}px`,
															height: `${height}px`,
														}}
													>
														<p className="font-medium truncate">{event.title}</p>
														{event.attendees.length > 0 && (
															<p className="text-[10px] opacity-90 truncate">
																{event.attendees.join(", ")}
															</p>
														)}
													</div>
												);
											})}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Event Detail Sidebar */}
				{selectedEvent && (
					<div className="w-[350px] border-l p-6 space-y-6">
						<div>
							<div className="flex items-start justify-between mb-4">
								<div className={cn("w-3 h-3 rounded-full", selectedEvent.color)} />
								<Button variant="ghost" size="sm" onClick={() => setSelectedEventId(null)}>
									Close
								</Button>
							</div>
							<h2 className="text-xl font-bold mb-2">{selectedEvent.title}</h2>
							<div className="space-y-2 text-sm">
								<div className="flex items-center gap-2 text-muted-foreground">
									<span>🕐</span>
									<span>
										{daysOfWeek[selectedEvent.day]},{" "}
										{selectedEvent.startTime > 12
											? `${selectedEvent.startTime - 12}:00 PM`
											: `${selectedEvent.startTime}:00 AM`}{" "}
										- {selectedEvent.duration}h
									</span>
								</div>
								{selectedEvent.attendees.length > 0 && (
									<div className="flex items-start gap-2 text-muted-foreground">
										<Users className="h-4 w-4 mt-0.5" />
										<div>
											{selectedEvent.attendees.map((attendee: any, i: number) => (
												<div key={i}>{attendee}</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>

						{selectedEvent.prepNotes && (
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Prep Notes</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										{selectedEvent.prepNotes}
									</p>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Related Context</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="flex items-center justify-between text-xs">
									<span className="text-muted-foreground">Recent emails with attendees</span>
									<Badge variant="secondary">3</Badge>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="text-muted-foreground">Related tasks</span>
									<Badge variant="secondary">2</Badge>
								</div>
								<div className="flex items-center justify-between text-xs">
									<span className="text-muted-foreground">Previous meetings</span>
									<Badge variant="secondary">5</Badge>
								</div>
							</CardContent>
						</Card>

						<div className="flex flex-col gap-2">
							<Button variant="outline" size="sm">Edit Event</Button>
							<Button variant="outline" size="sm">Cancel Meeting</Button>
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}
