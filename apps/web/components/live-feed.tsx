"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Users,
  GitBranch,
  MessageCircle,
  HelpCircle,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const CATEGORY_CONFIG = {
  task: {
    icon: Zap,
    label: "Task",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  commitment: {
    icon: Clock,
    label: "Commitment",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  decision: {
    icon: GitBranch,
    label: "Decision",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  follow_up: {
    icon: MessageCircle,
    label: "Follow-up",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  question: {
    icon: HelpCircle,
    label: "Question",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
};

const URGENCY_CONFIG = {
  high: { label: "High", color: "text-red-500", dot: "bg-red-500" },
  medium: { label: "Med", color: "text-yellow-500", dot: "bg-yellow-500" },
  low: {
    label: "Low",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

type FilterType = "all" | "mine" | "team" | "decisions" | "pending";

function LiveTaskCard({
  task,
}: {
  task: {
    _id: Id<"live_tasks">;
    description: string;
    owner: "josh" | "team";
    ownerName?: string;
    assignedTo?: string;
    deadline?: string;
    urgency: "low" | "medium" | "high";
    category: "task" | "commitment" | "decision" | "follow_up" | "question";
    sourceText: string;
    timestamp: number;
    status: "pending" | "approved" | "dismissed" | "converted";
  };
}) {
  const [showSource, setShowSource] = useState(false);
  const approveLiveTask = useMutation(api.capture.approveLiveTask);
  const dismissLiveTask = useMutation(api.capture.dismissLiveTask);
  const convertLiveTask = useMutation(api.capture.convertLiveTask);

  const cat = CATEGORY_CONFIG[task.category];
  const urg = URGENCY_CONFIG[task.urgency];
  const CatIcon = cat.icon;

  const isActionable = task.status === "pending";
  const time = new Date(task.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "glass-card rounded-xl p-3 transition-all",
        task.status === "dismissed" && "opacity-40",
        task.status === "converted" && "opacity-60",
      )}
    >
      {/* Header: category + time + urgency */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
            cat.bg,
            cat.color,
          )}
        >
          <CatIcon className="h-3 w-3" />
          {cat.label}
        </div>
        {task.owner === "team" && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-500">
            <Users className="h-3 w-3" />
            {task.ownerName || "Team"}
          </div>
        )}
        <div className="flex-1" />
        <div
          className={cn("w-1.5 h-1.5 rounded-full", urg.dot)}
          title={urg.label}
        />
        <span className="text-[10px] text-muted-foreground">{time}</span>
      </div>

      {/* Description */}
      <p className="text-sm font-medium leading-snug mb-1">
        {task.description}
      </p>

      {/* Metadata */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        {task.assignedTo && <span>→ {task.assignedTo}</span>}
        {task.deadline && <span>📅 {task.deadline}</span>}
      </div>

      {/* Source quote toggle */}
      <button
        type="button"
        onClick={() => setShowSource(!showSource)}
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        {showSource ? "Hide quote" : "Show quote"}
      </button>
      {showSource && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 mb-2">
          "{task.sourceText}"
        </p>
      )}

      {/* Actions */}
      {isActionable && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => approveLiveTask({ taskId: task._id })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => convertLiveTask({ liveTaskId: task._id })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <ArrowRight className="h-3 w-3" />
            Create Task
          </button>
          <button
            type="button"
            onClick={() => dismissLiveTask({ taskId: task._id })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            <XCircle className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Status badges for non-pending */}
      {task.status === "approved" && (
        <span className="text-[10px] font-medium text-green-600">
          ✓ Approved
        </span>
      )}
      {task.status === "converted" && (
        <span className="text-[10px] font-medium text-primary">
          → Task created
        </span>
      )}
      {task.status === "dismissed" && (
        <span className="text-[10px] font-medium text-muted-foreground">
          ✕ Dismissed
        </span>
      )}
    </div>
  );
}

export function LiveFeed({
  sessionId,
}: {
  sessionId?: Id<"capture_sessions">;
}) {
  const [filter, setFilter] = useState<FilterType>("all");

  const tasks = useQuery(api.capture.getLiveTasks, {
    userId: "josh",
    sessionId,
    filter,
  });

  const counts = useQuery(api.capture.getLiveTaskCounts, {
    userId: "josh",
    sessionId,
  });

  const filters: Array<{ key: FilterType; label: string; count?: number }> = [
    { key: "all", label: "All", count: counts?.total },
    { key: "mine", label: "Mine", count: counts?.mine },
    { key: "team", label: "Team", count: counts?.team },
    { key: "decisions", label: "Decisions", count: counts?.decisions },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
              filter === f.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span
                className={cn(
                  "min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] px-1",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {!tasks || tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Filter className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "No items captured yet. Start recording and tasks will appear here in real-time."
                : `No ${filter === "mine" ? "personal" : filter} items found.`}
            </p>
          </div>
        ) : (
          tasks.map((task: any) => <LiveTaskCard key={task._id} task={task} />)
        )}
      </div>
    </div>
  );
}
