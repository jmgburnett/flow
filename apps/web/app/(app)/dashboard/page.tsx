"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { HomeChat } from "@/components/home-chat";
import { LiveCaptureBar, TranscriptViewer } from "@/components/live-capture";
import { LiveFeed } from "@/components/live-feed";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Mail,
  MessageCircle,
  Clock,
  ChevronRight,
  Mic,
  Zap,
  FileText,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCapture } from "@/components/providers/capture-provider";
import Link from "next/link";

function QuickGlance() {
  const emails = useQuery(api.google.getEmails, { userId: "josh" }) ?? [];
  const calendarEvents =
    useQuery(api.google.getCalendarEvents, {
      userId: "josh",
      startTime: Date.now(),
      endTime: Date.now() + 24 * 60 * 60 * 1000,
    }) ?? [];
  const smsConvos =
    useQuery(api.sms.listConversations, { userId: "josh" }) ?? [];

  const needsMe = emails.filter((e: any) => e.triageStatus === "needs_me");
  const unreadTexts = smsConvos.reduce(
    (sum: number, c: any) => sum + (c.unreadCount || 0),
    0,
  );
  const nextEvent = calendarEvents[0];

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-3">
      <TodaysJournalCard />
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Needs You",
            value: needsMe.length,
            href: "/dashboard/inbox",
            color: "text-red-500",
          },
          {
            label: "Today",
            value: calendarEvents.length,
            href: "/dashboard/calendar",
            color: "text-primary",
          },
          {
            label: "Unread",
            value: unreadTexts,
            href: "/dashboard/messages",
            color: "text-purple-500",
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className="glass-card rounded-xl p-3 text-center hover:shadow-md active:scale-[0.98] transition-all">
              <div className={`text-lg font-bold tracking-tight ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {stat.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {nextEvent && (
        <Link href="/dashboard/calendar">
          <div className="glass-card rounded-xl p-3 hover:shadow-md active:scale-[0.98] transition-all">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                Next up
              </span>
            </div>
            <p className="text-sm font-medium truncate">{nextEvent.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {fmtTime(nextEvent.startTime)}
              {nextEvent.attendees?.length
                ? ` · ${nextEvent.attendees.length} attendees`
                : ""}
            </p>
          </div>
        </Link>
      )}

      {needsMe.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold tracking-tight">
                Priority
              </span>
            </div>
            <Link
              href="/dashboard/inbox"
              className="text-[10px] text-primary flex items-center gap-0.5"
            >
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-1.5 pb-1.5">
            {needsMe.slice(0, 3).map((email: any) => (
              <div
                key={email._id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {email.from.split("<")[0].trim()}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {email.subject}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodaysJournalCard() {
  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const journal = useQuery(api.journal.getJournal, {
    userId: "josh",
    date: today,
  });

  const isGenerating = journal?.status === "generating";
  const isComplete = journal?.status === "complete";

  return (
    <Link href="/dashboard/journal">
      <div className="glass-card rounded-xl p-3 hover:shadow-md active:scale-[0.98] transition-all">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">
            Today's Journal
          </span>
        </div>
        {isGenerating ? (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs text-muted-foreground">Generating...</p>
          </div>
        ) : isComplete && journal ? (
          <>
            <p className="text-sm font-medium truncate">{journal.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {journal.wordCount.toLocaleString()} words ·{" "}
              {journal.captureMinutes}m captured
            </p>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Ready to generate</p>
          </div>
        )}
      </div>
    </Link>
  );
}

type RightPanelTab = "feed" | "transcript" | "glance";

function RightSidebar() {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("feed");
  const { isRecording, sessionId } = useCapture();
  const activeSession = useQuery(api.capture.getActiveSession, {
    userId: "josh",
  });
  // Use context sessionId if recording, otherwise check DB for recent session
  const effectiveSessionId = sessionId ?? activeSession?._id;

  return (
    <div className="flex flex-col h-full">
      {/* Capture controls — always visible */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live Capture
          </span>
        </div>
        <LiveCaptureBar />
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 px-4 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("feed")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
            activeTab === "feed"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Zap className="h-3 w-3" />
          Live Feed
        </button>
        {isRecording && (
          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              activeTab === "transcript"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <FileText className="h-3 w-3" />
            Transcript
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("glance")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
            activeTab === "glance"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          At a Glance
        </button>
      </div>

      <div className="border-t border-border/30" />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "feed" && <LiveFeed sessionId={effectiveSessionId} />}
        {activeTab === "transcript" && effectiveSessionId && (
          <div className="p-4 overflow-y-auto h-full">
            <TranscriptViewer sessionId={effectiveSessionId} />
          </div>
        )}
        {activeTab === "glance" && (
          <div className="p-4 overflow-y-auto h-full">
            <QuickGlance />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const user = { name: "Josh", email: "josh@onflourish.com" };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <DashboardLayout user={user}>
      <div className="flex h-full">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 md:px-6 pt-4 pb-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {greeting}, Josh
            </h1>
          </div>
          <HomeChat />
        </div>

        {/* Right sidebar — capture + live feed + glance (desktop only) */}
        <div className="hidden lg:flex lg:flex-col w-[320px] shrink-0 border-l border-border/30">
          <RightSidebar />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
