"use client";

import { useEffect, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Loader2,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Edit3,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Helpers ───

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Generation stage labels ───

const STAGES = [
  { label: "Analyzing conversations…", pct: 10 },
  { label: "Identifying key moments…", pct: 30 },
  { label: "Writing meeting summaries…", pct: 55 },
  { label: "Compiling action items…", pct: 80 },
  { label: "Finishing your Field Notes…", pct: 95 },
  { label: "Done!", pct: 100 },
];

// ─── Session Card ───

interface CaptureSession {
  _id: Id<"capture_sessions">;
  title?: string;
  startedAt: number;
  stoppedAt?: number;
  totalDurationMs: number;
  includeInJournal?: boolean;
  status: string;
}

function SessionCard({
  session,
  onToggle,
  onRename,
}: {
  session: CaptureSession;
  onToggle: () => void;
  onRename: (title: string) => void;
}) {
  const included = session.includeInJournal !== false;
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(session.title ?? "");

  function handleSaveTitle() {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all overflow-hidden",
        included
          ? "border-border bg-card"
          : "border-border/40 bg-muted/30 opacity-60",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Include toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all",
            included
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
          title={included ? "Exclude from journal" : "Include in journal"}
        >
          {included ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Time & duration */}
        <div className="shrink-0">
          <p className="text-xs font-semibold text-foreground">
            {formatTime(session.startedAt)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatDuration(session.totalDurationMs)}
          </p>
        </div>

        {/* Title / edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="flex-1 text-xs rounded-lg border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="Label this session…"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="text-primary hover:opacity-70 transition-opacity"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-muted-foreground hover:opacity-70 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-foreground/70 truncate">
                {session.title ?? "Unlabeled session"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(session.title ?? "");
                  setEditing(true);
                }}
                className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <Edit3 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Included badge */}
        <div
          className={cn(
            "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full",
            included
              ? "bg-primary/10 text-primary"
              : "bg-muted/50 text-muted-foreground",
          )}
        >
          {included ? "Included" : "Excluded"}
        </div>
      </div>
    </div>
  );
}

// ─── Main Review Page ───

export default function ReviewPage() {
  const today = getTodayDate();
  const [date, setDate] = useState(today);
  const [stageIndex, setStageIndex] = useState(-1); // -1 = not generating
  const [isGenerating, setIsGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const sessions = (useQuery(api.journal.getCaptureSessions, {
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }) ?? []) as CaptureSession[];

  const journal = useQuery(api.journal.getJournal, {
    date,
  });

  const toggleSession = useMutation(api.journal.toggleSessionJournal);
  const renameSession = useMutation(api.journal.updateSessionTitle);
  const generateJournal = useAction(api.journal.generateJournal);

  const includedCount = sessions.filter(
    (s) => s.includeInJournal !== false,
  ).length;

  const totalMinutes = sessions
    .filter((s) => s.includeInJournal !== false)
    .reduce((sum, s) => sum + Math.round(s.totalDurationMs / 60000), 0);

  async function handleGenerate() {
    setIsGenerating(true);
    setStageIndex(0);
    setDone(false);

    // Animate through stages while waiting
    const stageInterval = setInterval(() => {
      setStageIndex((i) => {
        if (i >= STAGES.length - 2) {
          clearInterval(stageInterval);
          return i;
        }
        return i + 1;
      });
    }, 3500);

    try {
      await generateJournal({ date });
      clearInterval(stageInterval);
      setStageIndex(STAGES.length - 1);
      setDone(true);
    } catch (e) {
      console.error("Failed to generate journal:", e);
      clearInterval(stageInterval);
    } finally {
      setIsGenerating(false);
    }
  }

  const hasExistingJournal = journal?.status === "complete";
  const isServerGenerating = journal?.status === "generating";

  const currentStage = stageIndex >= 0 ? STAGES[stageIndex] : null;
  const progressPct = currentStage?.pct ?? 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/30 flex items-center gap-3 shrink-0">
          <Link href="/dashboard/journal">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Journal
            </button>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="text-sm font-semibold">Review & Generate</h1>

          {/* Date picker */}
          <div className="ml-auto">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDone(false);
                setStageIndex(-1);
              }}
              className="text-xs border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Summary strip */}
            <div className="glass-card rounded-2xl p-4 flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {sessions.length}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Sessions
                </div>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {includedCount}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Included
                </div>
              </div>
              <div className="h-8 w-px bg-border/50" />
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {totalMinutes}m
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  To process
                </div>
              </div>
            </div>

            {/* Session list */}
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base font-medium mb-1">
                  No capture sessions for this date
                </p>
                <p className="text-sm text-muted-foreground">
                  Start a recording in the Capture tab to create sessions.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Capture Sessions
                </h2>
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <SessionCard
                      key={session._id}
                      session={session}
                      onToggle={() =>
                        toggleSession({
                          sessionId: session._id,
                          include: session.includeInJournal === false,
                        })
                      }
                      onRename={(title) =>
                        renameSession({ sessionId: session._id, title })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Existing journal notice */}
            {hasExistingJournal && !done && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  A journal already exists for this date. Generating again will
                  overwrite it.
                </p>
              </div>
            )}

            {/* Generation progress */}
            {(isGenerating || isServerGenerating || done) && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {done ? "Journal ready!" : "Generating your Field Notes…"}
                  </p>
                  {done && (
                    <Link href="/dashboard/journal">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:opacity-80 transition-opacity"
                      >
                        View Journal →
                      </button>
                    </Link>
                  )}
                </div>

                {/* Progress bar */}
                <div className="rounded-full h-2 bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      background: done
                        ? "var(--primary)"
                        : "linear-gradient(90deg, var(--primary), #C9963A)",
                    }}
                  />
                </div>

                {currentStage && (
                  <p className="text-xs text-muted-foreground">
                    {currentStage.label}
                  </p>
                )}

                {/* Stage dots */}
                <div className="flex gap-1.5">
                  {STAGES.map((stage, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i <= stageIndex ? "bg-primary" : "bg-muted",
                        i <= stageIndex ? "w-4" : "w-1.5",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Generate CTA */}
            {!done && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  isGenerating || isServerGenerating || includedCount === 0
                }
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background:
                    isGenerating || isServerGenerating
                      ? undefined
                      : "var(--primary)",
                  color: "white",
                }}
              >
                {isGenerating || isServerGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Field Notes
                    {totalMinutes > 0 && (
                      <span className="opacity-70 font-normal">
                        · {totalMinutes}m of audio
                      </span>
                    )}
                  </>
                )}
              </button>
            )}

            {done && (
              <Link href="/dashboard/journal" className="block">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-semibold bg-primary text-white transition-all hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                  Open Your Journal
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
