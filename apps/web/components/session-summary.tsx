"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Brain,
  CheckCircle2,
  Users,
  Tag,
  AlertCircle,
  Circle,
  Loader2,
} from "lucide-react";

type TabKey = "summary" | "actions" | "people";

const URGENCY_CONFIG = {
  high: { dot: "bg-red-500", label: "High" },
  medium: { dot: "bg-yellow-400", label: "Med" },
  low: { dot: "bg-muted-foreground/40", label: "Low" },
};

export function SessionSummaryPanel({
  sessionId,
}: {
  sessionId: Id<"capture_sessions">;
}) {
  const [tab, setTab] = useState<TabKey>("summary");

  const summary = useQuery(api.capture.getSessionSummary, { sessionId });
  const segments = useQuery(api.capture.getTranscriptSegments, { sessionId });

  const finalCount = segments?.filter((s) => s.isFinal).length ?? 0;
  const nextUpdateAt = summary ? summary.segmentCount + 10 : 10;
  const remaining = Math.max(0, nextUpdateAt - finalCount);

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
        <div className="relative">
          <Brain className="h-8 w-8 text-muted-foreground/30" />
          {finalCount > 0 && (
            <div className="absolute -top-1 -right-1">
              <Loader2 className="h-3 w-3 text-[#08a39e] animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {finalCount === 0
              ? "AI summary will appear after the first 10 transcript segments"
              : `Summary generates after ${remaining} more segment${remaining !== 1 ? "s" : ""}`}
          </p>
          {finalCount > 0 && (
            <div className="mt-2 mx-auto w-32 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[#08a39e]/60 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (finalCount / 10) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "summary", label: "Summary" },
    { key: "actions", label: "Actions", count: summary.actionItems.length },
    { key: "people", label: "People", count: summary.peopleMentioned?.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-border/30">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] px-1",
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {summary.segmentCount} segments
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "summary" && (
          <div className="space-y-3">
            {/* Summary paragraph */}
            <p className="text-sm leading-relaxed text-foreground">
              {summary.summary}
            </p>

            {/* Topics */}
            {summary.topics.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <Tag className="h-3 w-3" />
                  Topics
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summary.topics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs bg-[#08a39e]/10 text-[#08a39e] font-medium"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "actions" && (
          <div className="space-y-2">
            {summary.actionItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No action items extracted yet
                </p>
              </div>
            ) : (
              summary.actionItems.map((item, i) => {
                const urgency =
                  URGENCY_CONFIG[item.urgency as keyof typeof URGENCY_CONFIG] ??
                  URGENCY_CONFIG.medium;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-2.5 glass-card rounded-xl"
                  >
                    <div className="mt-1.5">
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{item.description}</p>
                      {item.assignedTo && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          → {item.assignedTo}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <div
                        className={cn("w-1.5 h-1.5 rounded-full", urgency.dot)}
                        title={urgency.label}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "people" && (
          <div className="space-y-2">
            {!summary.peopleMentioned ||
            summary.peopleMentioned.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Users className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No people identified yet
                </p>
              </div>
            ) : (
              summary.peopleMentioned.map((person, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 glass-card rounded-xl"
                >
                  <div className="h-7 w-7 rounded-full bg-[#08a39e]/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-[#08a39e]">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{person.name}</p>
                    {person.context && (
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {person.context}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer: last updated */}
      <div className="px-3 py-1.5 border-t border-border/30 flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground">
          Updated{" "}
          {new Date(summary.updatedAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
          {remaining > 0 && ` · next update in ~${remaining} segments`}
        </span>
      </div>
    </div>
  );
}
