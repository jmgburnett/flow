"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useCapture } from "@/components/providers/capture-provider";
import { LiveTranscriptPanel } from "@/components/live-transcript";
import { SessionSummaryPanel } from "@/components/session-summary";
import { LiveFeed } from "@/components/live-feed";
import { cn } from "@/lib/utils";
import {
  Circle,
  Pause,
  Play,
  Square,
  Mic,
  FileText,
  ChevronRight,
  Clock,
  Radio,
  Brain,
  ListTodo,
  BookOpen,
} from "lucide-react";
import { useMutation } from "convex/react";

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0)
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1)
    return `Yesterday, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Past Session Detail ───
function PastSessionDetail({
  sessionId,
}: {
  sessionId: Id<"capture_sessions">;
}) {
  const [panel, setPanel] = useState<"transcript" | "summary" | "tasks">(
    "transcript",
  );

  const panelTabs = [
    { key: "transcript" as const, label: "Transcript", icon: FileText },
    { key: "summary" as const, label: "Summary", icon: Brain },
    { key: "tasks" as const, label: "Tasks", icon: ListTodo },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Panel selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30">
        {panelTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPanel(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                panel === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {panel === "transcript" && (
          <LiveTranscriptPanel sessionId={sessionId} />
        )}
        {panel === "summary" && <SessionSummaryPanel sessionId={sessionId} />}
        {panel === "tasks" && <LiveFeed sessionId={sessionId} />}
      </div>
    </div>
  );
}

// ─── Past Sessions List ───
function PastSessionsList({
  selectedId,
  onSelect,
}: {
  selectedId: Id<"capture_sessions"> | null;
  onSelect: (id: Id<"capture_sessions">) => void;
}) {
  const sessions = useQuery(api.capture.listSessions, {
    limit: 20,
  });
  const toggleJournal = useMutation(api.journal.toggleSessionJournal);

  const stopped = sessions?.filter((s) => s.status === "stopped") ?? [];

  if (stopped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8 px-4">
        <Mic className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">
          No recordings yet. Start a capture session to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {stopped.map((session) => {
        const included = session.includeInJournal !== false;
        return (
          <div
            key={session._id}
            className={cn(
              "border-b border-border/30",
              selectedId === session._id &&
                "bg-primary/5 border-l-2 border-l-primary",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(session._id)}
              className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {session.title ?? "Capture Session"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(session.startedAt)}
                    </span>
                    {session.totalDurationMs > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDuration(session.totalDurationMs)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
              </div>
            </button>
            {/* Journal toggle */}
            <div className="px-4 pb-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleJournal({ sessionId: session._id, include: !included });
                }}
                className={cn(
                  "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
                  included
                    ? "text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"
                    : "text-muted-foreground bg-muted/50 hover:bg-muted",
                )}
              >
                <BookOpen className="h-2.5 w-2.5" />
                {included ? "In journal" : "Excluded"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Active Session View (split panel) ───
function ActiveSessionView({
  sessionId,
}: {
  sessionId: Id<"capture_sessions">;
}) {
  const { isRecording, isPaused, elapsed, error, pause, resume, stop } =
    useCapture();
  const [activePanel, setActivePanel] = useState<"intelligence" | "tasks">(
    "intelligence",
  );

  return (
    <div className="flex flex-col h-full">
      {/* Recording controls bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 glass-card rounded-none">
        {/* Live dot */}
        <div className="relative flex items-center justify-center">
          {!isPaused && (
            <div className="absolute w-3 h-3 rounded-full bg-red-500/40 animate-ping" />
          )}
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full",
              isPaused ? "bg-yellow-500" : "bg-red-500",
            )}
          />
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            {isPaused ? "Paused" : "Recording"}
          </span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </div>

        <div className="flex-1" />

        {/* Panel toggle */}
        <div className="flex items-center gap-0.5 rounded-xl bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setActivePanel("intelligence")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              activePanel === "intelligence"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Brain className="h-3 w-3" />
            Intelligence
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("tasks")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              activePanel === "tasks"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground",
            )}
          >
            <ListTodo className="h-3 w-3" />
            Tasks
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {isPaused ? (
            <button
              type="button"
              onClick={resume}
              className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground"
              title="Resume"
            >
              <Play className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground"
              title="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-red-500"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-500 bg-red-500/5 border-b border-red-500/10">
          {error}
        </div>
      )}

      {/* Split panels */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top: Live Transcript */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-border/30">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
            <Radio className="h-3.5 w-3.5 text-[#08a39e]" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Live Transcript
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <LiveTranscriptPanel sessionId={sessionId} />
          </div>
        </div>

        {/* Bottom: Intelligence or Tasks */}
        <div className="h-[40%] min-h-0 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
            {activePanel === "intelligence" ? (
              <>
                <Brain className="h-3.5 w-3.5 text-[#08a39e]" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  AI Intelligence
                </span>
              </>
            ) : (
              <>
                <ListTodo className="h-3.5 w-3.5 text-[#08a39e]" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Live Tasks
                </span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {activePanel === "intelligence" ? (
              <SessionSummaryPanel sessionId={sessionId} />
            ) : (
              <LiveFeed sessionId={sessionId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function RecordingsPage() {
  const { isRecording, isPaused, sessionId, start, error } = useCapture();
  const [selectedPastSession, setSelectedPastSession] =
    useState<Id<"capture_sessions"> | null>(null);

  const isActive = isRecording || isPaused;

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
        {/* Left sidebar: controls + session list */}
        <div className="w-[280px] shrink-0 flex flex-col border-r border-border/30">
          {/* Header */}
          <div className="px-4 py-4 border-b border-border/30">
            <h1 className="text-lg font-semibold tracking-tight mb-3">
              Recordings
            </h1>

            {!isActive ? (
              <button
                type="button"
                onClick={start}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-500 transition-all active:scale-[0.97] text-sm font-medium"
              >
                <Circle className="h-3.5 w-3.5 fill-red-500" />
                Start Capture
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-2xl">
                <div className="relative flex items-center justify-center">
                  {!isPaused && (
                    <div className="absolute w-3 h-3 rounded-full bg-red-500/40 animate-ping" />
                  )}
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      isPaused ? "bg-yellow-500" : "bg-red-500",
                    )}
                  />
                </div>
                <span className="text-xs font-medium text-foreground flex-1">
                  {isPaused ? "Paused" : "Recording live"}
                </span>
              </div>
            )}

            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </div>

          {/* Past sessions label */}
          <div className="px-4 py-2 border-b border-border/20">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Past Sessions
            </span>
          </div>

          {/* Past sessions list */}
          <div className="flex-1 overflow-hidden">
            <PastSessionsList
              selectedId={selectedPastSession}
              onSelect={(id) => {
                if (!isActive) setSelectedPastSession(id);
              }}
            />
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
          {isActive && sessionId ? (
            <ActiveSessionView sessionId={sessionId} />
          ) : selectedPastSession ? (
            <PastSessionDetail sessionId={selectedPastSession} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8">
              <div className="p-4 rounded-2xl bg-primary/5">
                <Mic className="h-10 w-10 text-primary/40" />
              </div>
              <div>
                <p className="text-base font-medium text-foreground mb-1">
                  Real-time transcription
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Start a capture session to see live streaming transcription
                  with AI-generated summaries and action items.
                </p>
              </div>
              <button
                type="button"
                onClick={start}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-500 transition-all active:scale-[0.97] text-sm font-medium"
              >
                <Circle className="h-3.5 w-3.5 fill-red-500" />
                Start Capture
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
