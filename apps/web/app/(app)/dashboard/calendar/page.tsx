"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	RefreshCw,
	Calendar,
	MapPin,
	Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function getWeekDates(baseDate: Date): Date[] {
	const start = new Date(baseDate);
	const day = start.getDay();
	// Start from Monday
	const diff = day === 0 ? -6 : 1 - day;
	start.setDate(start.getDate() + diff);
	start.setHours(0, 0, 0, 0);

	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(start);
		d.setDate(d.getDate() + i);
		return d;
	});
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function fmtTime(ts: number) {
	return new Date(ts).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});
}

function fmtDuration(start: number, end: number) {
	const mins = Math.round((end - start) / 60000);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.floor(mins / 60);
	const remainMins = mins % 60;
	return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

export default function CalendarPage() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const today = new Date();
	const [baseDate, setBaseDate] = useState(today);
	const [selectedDate, setSelectedDate] = useState(today);
	const [isSyncing, setIsSyncing] = useState(false);
	const [selectedEvent, setSelectedEvent] = useState<any>(null);

	const weekDates = getWeekDates(baseDate);
	const weekStart = weekDates[0].getTime();
	const weekEnd = weekDates[6].getTime() + 24 * 60 * 60 * 1000;

	const connections =
		useQuery(api.google.getGoogleConnections, { userId: "josh" }) ?? [];

	const events =
		useQuery(api.google.getCalendarEvents, {
			userId: "josh",
			startTime: weekStart,
			endTime: weekEnd,
		}) ?? [];

	const syncCalendar = useAction(api.google.syncCalendar);

	// Events for selected day
	const dayEvents = events
		.filter((e: any) => isSameDay(new Date(e.startTime), selectedDate))
		.sort((a: any, b: any) => a.startTime - b.startTime);

	// Events count per day for dots
	function eventsOnDay(date: Date) {
		return events.filter((e: any) => isSameDay(new Date(e.startTime), date))
			.length;
	}

	async function handleSync() {
		if (connections.length === 0) return;
		setIsSyncing(true);
		try {
			for (const conn of connections) {
				await syncCalendar({ connectionId: conn._id as any });
			}
		} catch (e) {
			console.error("Sync error:", e);
		}
		setIsSyncing(false);
	}

	function prevWeek() {
		const d = new Date(baseDate);
		d.setDate(d.getDate() - 7);
		setBaseDate(d);
		setSelectedDate(d);
	}

	function nextWeek() {
		const d = new Date(baseDate);
		d.setDate(d.getDate() + 7);
		setBaseDate(d);
		setSelectedDate(d);
	}

	function goToday() {
		setBaseDate(today);
		setSelectedDate(today);
	}

	const monthLabel = selectedDate.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	// Empty state
	if (connections.length === 0) {
		return (
			<DashboardLayout user={user}>
				<div className="flex items-center justify-center h-[60vh]">
					<div className="text-center space-y-3">
						<Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
						<p className="text-muted-foreground">
							No Google accounts connected
						</p>
						<Link href="/dashboard/settings">
							<Button size="sm">Connect Google</Button>
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout user={user}>
			<div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold">{monthLabel}</h1>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleSync}
							disabled={isSyncing}
							className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							{isSyncing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							Sync
						</button>
					</div>
				</div>

				{/* Week strip */}
				<Card>
					<CardContent className="p-2">
						<div className="flex items-center justify-between px-1 mb-2">
							<button
								type="button"
								onClick={prevWeek}
								className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={goToday}
								className="text-xs font-medium text-primary hover:underline"
							>
								Today
							</button>
							<button
								type="button"
								onClick={nextWeek}
								className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
						<div className="grid grid-cols-7 gap-1">
							{weekDates.map((date) => {
								const isToday = isSameDay(date, today);
								const isSelected = isSameDay(date, selectedDate);
								const count = eventsOnDay(date);
								return (
									<button
										key={date.toISOString()}
										type="button"
										onClick={() => setSelectedDate(date)}
										className={cn(
											"flex flex-col items-center py-2 rounded-xl transition-all",
											isSelected
												? "bg-primary text-primary-foreground"
												: isToday
													? "bg-accent"
													: "hover:bg-accent",
										)}
									>
										<span
											className={cn(
												"text-[10px] font-medium mb-0.5",
												isSelected
													? "text-primary-foreground/70"
													: "text-muted-foreground",
											)}
										>
											{DAY_NAMES[date.getDay()]}
										</span>
										<span
											className={cn(
												"text-sm font-semibold",
												isSelected
													? "text-primary-foreground"
													: "text-foreground",
											)}
										>
											{date.getDate()}
										</span>
										{count > 0 && (
											<div className="flex gap-0.5 mt-1">
												{Array.from({
													length: Math.min(count, 3),
												}).map((_, j) => (
													<div
														key={j}
														className={cn(
															"w-1 h-1 rounded-full",
															isSelected
																? "bg-primary-foreground/60"
																: "bg-primary",
														)}
													/>
												))}
											</div>
										)}
									</button>
								);
							})}
						</div>
					</CardContent>
				</Card>

				{/* Day label */}
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-semibold text-foreground">
						{FULL_DAY_NAMES[selectedDate.getDay()]},{" "}
						{selectedDate.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						})}
					</h2>
					<span className="text-xs text-muted-foreground">
						{dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
					</span>
				</div>

				{/* Events list */}
				<div className="space-y-2">
					{dayEvents.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
							<p className="text-sm">No events this day</p>
						</div>
					) : (
						dayEvents.map((event: any) => (
							<Card
								key={event._id}
								className={cn(
									"cursor-pointer hover:shadow-md active:scale-[0.99] transition-all",
									selectedEvent?._id === event._id &&
										"ring-1 ring-primary",
								)}
								onClick={() =>
									setSelectedEvent(
										selectedEvent?._id === event._id
											? null
											: event,
									)
								}
							>
								<CardContent className="p-4">
									<div className="flex items-start gap-3">
										{/* Time column */}
										<div className="text-right shrink-0 w-16 pt-0.5">
											<p className="text-sm font-medium text-foreground">
												{fmtTime(event.startTime)}
											</p>
											<p className="text-[10px] text-muted-foreground">
												{fmtDuration(
													event.startTime,
													event.endTime,
												)}
											</p>
										</div>

										{/* Divider */}
										<div className="w-0.5 self-stretch bg-primary rounded-full shrink-0" />

										{/* Content */}
										<div className="flex-1 min-w-0">
											<h3 className="font-semibold text-sm text-foreground truncate">
												{event.title}
											</h3>
											{event.location && (
												<p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
													<MapPin className="h-3 w-3" />
													{event.location}
												</p>
											)}
											{event.attendees &&
												event.attendees.length > 0 && (
													<p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
														<Users className="h-3 w-3" />
														{event.attendees
															.slice(0, 3)
															.join(", ")}
														{event.attendees.length >
															3 &&
															` +${event.attendees.length - 3}`}
													</p>
												)}
											<p className="text-[10px] text-muted-foreground mt-1">
												{event.accountEmail}
											</p>

											{/* Expanded detail */}
											{selectedEvent?._id ===
												event._id &&
												event.description && (
													<div className="mt-3 pt-3 border-t border-border">
														<p className="text-xs text-muted-foreground whitespace-pre-wrap">
															{event.description}
														</p>
													</div>
												)}
										</div>
									</div>
								</CardContent>
							</Card>
						))
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
