"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Mic, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "waiting" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskSource = "email" | "recording" | "manual" | "chat";

interface Task {
	id: string;
	title: string;
	description?: string;
	status: TaskStatus;
	priority: TaskPriority;
	source: TaskSource;
	sourceId?: string;
	dueDate?: string;
}

// Mock tasks for MVP
const mockTasks: Task[] = [
	{
		id: "1",
		title: "Review pricing proposal from Doug",
		description: "Doug sent over new enterprise tier pricing - need to review and approve by Thursday",
		status: "todo",
		priority: "high",
		source: "email",
		sourceId: "email-1",
		dueDate: "Today",
	},
	{
		id: "2",
		title: "Call EJ about Exponential partnership",
		description: "Follow up on integration opportunities",
		status: "todo",
		priority: "high",
		source: "recording",
		sourceId: "rec-1",
		dueDate: "Tomorrow",
	},
	{
		id: "3",
		title: "Send Sarah agenda thoughts for Q2 offsite",
		status: "todo",
		priority: "medium",
		source: "recording",
		sourceId: "rec-1",
		dueDate: "This week",
	},
	{
		id: "4",
		title: "Review new onboarding flow",
		description: "Promised team by end of week",
		status: "in_progress",
		priority: "medium",
		source: "recording",
		sourceId: "rec-1",
		dueDate: "Friday",
	},
	{
		id: "5",
		title: "Respond to Carey about podcast interview",
		status: "in_progress",
		priority: "medium",
		source: "email",
		sourceId: "email-2",
		dueDate: "This week",
	},
	{
		id: "6",
		title: "Review Q1 metrics before board meeting",
		status: "waiting",
		priority: "urgent",
		source: "recording",
		sourceId: "rec-2",
		dueDate: "Next week",
	},
	{
		id: "7",
		title: "Schedule demo with large church prospect",
		status: "waiting",
		priority: "high",
		source: "manual",
		dueDate: "Next week",
	},
	{
		id: "8",
		title: "Updated financial projections for board deck",
		status: "done",
		priority: "high",
		source: "email",
		dueDate: "Yesterday",
	},
];

const sourceIcons = {
	email: Mail,
	recording: Mic,
	manual: User,
	chat: MessageSquare,
};

const priorityColors = {
	low: "bg-gray-500",
	medium: "bg-blue-500",
	high: "bg-orange-500",
	urgent: "bg-red-500",
};

const statusLabels = {
	todo: "To Do",
	in_progress: "In Progress",
	waiting: "Waiting",
	done: "Done",
};

export default function TasksPage() {
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);

	const tasksByStatus = {
		todo: mockTasks.filter((t) => t.status === "todo"),
		in_progress: mockTasks.filter((t) => t.status === "in_progress"),
		waiting: mockTasks.filter((t) => t.status === "waiting"),
		done: mockTasks.filter((t) => t.status === "done"),
	};

	return (
		<DashboardLayout>
			<div className="flex h-full">
				{/* Kanban Board */}
				<div className="flex-1 p-6 overflow-auto">
					<div className="flex items-center justify-between mb-6">
						<h1 className="text-2xl font-bold">Tasks</h1>
						<Button className="gap-2">
							<Plus className="h-4 w-4" />
							Add Task
						</Button>
					</div>

					<div className="grid grid-cols-4 gap-4 min-w-[1000px]">
						{(Object.keys(statusLabels) as TaskStatus[]).map((status) => (
							<div key={status}>
								<div className="mb-4">
									<div className="flex items-center justify-between mb-2">
										<h2 className="font-semibold">{statusLabels[status]}</h2>
										<Badge variant="secondary" className="text-xs">
											{tasksByStatus[status].length}
										</Badge>
									</div>
								</div>

								<div className="space-y-3">
									{tasksByStatus[status].map((task) => {
										const SourceIcon = sourceIcons[task.source];
										return (
											<Card
												key={task.id}
												onClick={() => setSelectedTask(task)}
												className={cn(
													"cursor-pointer transition-all hover:shadow-md",
													selectedTask?.id === task.id && "ring-2 ring-blue-500",
												)}
											>
												<CardContent className="p-4">
													<div className="space-y-3">
														<div className="flex items-start gap-2">
															<input
																type="checkbox"
																checked={task.status === "done"}
																className="mt-1"
																onClick={(e) => e.stopPropagation()}
															/>
															<p className="text-sm font-medium flex-1">
																{task.title}
															</p>
														</div>

														<div className="flex items-center gap-2 flex-wrap">
															<div className={cn("w-2 h-2 rounded-full", priorityColors[task.priority])} />
															<Badge variant="outline" className="text-xs">
																{task.priority}
															</Badge>
															{task.dueDate && (
																<span className="text-xs text-muted-foreground">
																	{task.dueDate}
																</span>
															)}
														</div>

														<div className="flex items-center gap-2">
															<SourceIcon className="h-3 w-3 text-muted-foreground" />
															<span className="text-xs text-muted-foreground">
																from {task.source}
															</span>
														</div>
													</div>
												</CardContent>
											</Card>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Task Detail Sidebar */}
				{selectedTask && (
					<div className="w-[350px] border-l p-6 space-y-6">
						<div>
							<div className="flex items-start justify-between mb-4">
								<div className={cn("w-3 h-3 rounded-full mt-1", priorityColors[selectedTask.priority])} />
								<Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
									Close
								</Button>
							</div>
							<h2 className="text-xl font-bold mb-4">{selectedTask.title}</h2>

							{selectedTask.description && (
								<p className="text-sm text-muted-foreground mb-4">
									{selectedTask.description}
								</p>
							)}

							<div className="space-y-3">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Status</span>
									<Badge>{statusLabels[selectedTask.status]}</Badge>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Priority</span>
									<Badge variant="outline">{selectedTask.priority}</Badge>
								</div>
								{selectedTask.dueDate && (
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Due Date</span>
										<span>{selectedTask.dueDate}</span>
									</div>
								)}
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">Source</span>
									<div className="flex items-center gap-1">
										{(() => {
											const Icon = sourceIcons[selectedTask.source];
											return <Icon className="h-3 w-3" />;
										})()}
										<span>{selectedTask.source}</span>
									</div>
								</div>
							</div>
						</div>

						{selectedTask.sourceId && (
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Source Context</CardTitle>
								</CardHeader>
								<CardContent>
									<Button variant="outline" size="sm" className="w-full">
										View Original {selectedTask.source}
									</Button>
								</CardContent>
							</Card>
						)}

						<div className="space-y-2">
							<Button variant="outline" size="sm" className="w-full">
								Change Status
							</Button>
							<Button variant="outline" size="sm" className="w-full">
								Edit Task
							</Button>
							<Button variant="outline" size="sm" className="w-full text-red-500">
								Delete Task
							</Button>
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}
