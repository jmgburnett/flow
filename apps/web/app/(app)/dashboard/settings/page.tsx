"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Mail,
  MessageSquare,
  Hash,
  Sparkles,
  PenLine,
  BookOpen,
  Check,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SettingsPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };
  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [emailCount, setEmailCount] = useState("200");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const googleConnections = useQuery(api.google.getGoogleConnections, {
    userId: "josh",
  });
  const slackConnections = useQuery(api.slack.getSlackConnections, {
    userId: "josh",
  });

  const syncGmail = useAction(api.google.syncGmailInbox);
  const syncCalendar = useAction(api.google.syncCalendar);
  const deleteGoogleConnection = useMutation(api.google.deleteGoogleConnection);

  const syncSlack = useAction(api.slack.syncSlackMessages);
  const deleteSlackConnection = useMutation(api.slack.deleteSlackConnection);

  const userPreferences = useQuery(api.journal.getUserPreferences, {
    userId: "josh",
  });
  const scheduleJournalGeneration = useMutation(
    api.journal.scheduleJournalGeneration,
  );
  const [journalTime, setJournalTime] = useState("21:00");
  const [journalEnabled, setJournalEnabled] = useState(true);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);

  // Sync prefs from DB on load
  const [prefsSynced, setPrefsSynced] = useState(false);
  if (userPreferences !== undefined && !prefsSynced) {
    if (userPreferences?.journalTime)
      setJournalTime(userPreferences.journalTime);
    if (userPreferences?.journalEnabled !== undefined)
      setJournalEnabled(userPreferences.journalEnabled ?? true);
    setPrefsSynced(true);
  }

  const styleProfile = useQuery(api.styleAnalysis.getStyleProfile, {
    userId: "josh",
  });
  const analysisStatus = useQuery(api.styleAnalysis.getAnalysisStatus, {
    userId: "josh",
  });
  const analyzeStyle = useAction(api.styleAnalysis.analyzeEmailStyle);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success) console.log("Connected:", success);
    if (error) console.error("OAuth error:", error);
  }, [searchParams]);

  async function handleGoogleSync(connectionId: Id<"google_connections">) {
    setIsSyncing((p) => ({ ...p, [connectionId]: true }));
    try {
      await Promise.all([
        syncGmail({ connectionId }),
        syncCalendar({ connectionId }),
      ]);
    } catch (e) {
      console.error(e);
    }
    setIsSyncing((p) => ({ ...p, [connectionId]: false }));
  }

  async function handleSlackSync(connectionId: Id<"slack_connections">) {
    setIsSyncing((p) => ({ ...p, [connectionId]: true }));
    try {
      await syncSlack({ connectionId });
    } catch (e) {
      console.error(e);
    }
    setIsSyncing((p) => ({ ...p, [connectionId]: false }));
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage connected accounts and preferences
          </p>
        </div>

        {/* Google Accounts */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Google</h2>
                <p className="text-xs text-muted-foreground">
                  Email & Calendar
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (window.location.href = "/api/auth/google")}
              className="rounded-xl gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="px-3 pb-3">
            {googleConnections === undefined ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : googleConnections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  No accounts connected
                </p>
                <Button
                  size="sm"
                  onClick={() => (window.location.href = "/api/auth/google")}
                  className="rounded-xl"
                >
                  Connect Google
                </Button>
              </div>
            ) : (
              googleConnections.map((conn: any) => (
                <div
                  key={conn._id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{conn.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {conn.lastSyncAt
                        ? `Synced ${new Date(conn.lastSyncAt).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleGoogleSync(conn._id)}
                      disabled={isSyncing[conn._id]}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      {isSyncing[conn._id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        confirm("Disconnect?") &&
                        deleteGoogleConnection({ connectionId: conn._id })
                      }
                      className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slack */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Hash className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Slack</h2>
                <p className="text-xs text-muted-foreground">DMs & Mentions</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (window.location.href = "/api/auth/slack")}
              className="rounded-xl gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="px-3 pb-3">
            {slackConnections === undefined ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : slackConnections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  No Slack workspace connected
                </p>
                <Button
                  size="sm"
                  onClick={() => (window.location.href = "/api/auth/slack")}
                  className="rounded-xl"
                >
                  Connect Slack
                </Button>
              </div>
            ) : (
              slackConnections.map((conn: any) => (
                <div
                  key={conn._id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {conn.teamName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      @{conn.slackUserName} ·{" "}
                      {conn.lastSyncAt
                        ? `Synced ${new Date(conn.lastSyncAt).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSlackSync(conn._id)}
                      disabled={isSyncing[conn._id]}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      {isSyncing[conn._id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        confirm("Disconnect Slack?") &&
                        deleteSlackConnection({ connectionId: conn._id })
                      }
                      className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Writing Style */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <PenLine className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Writing Style</h2>
                <p className="text-xs text-muted-foreground">
                  AI learns your email voice
                </p>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {styleProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Style profile active</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Learned from {styleProfile.emailsAnalyzed} emails across{" "}
                  {(styleProfile as any).accountsAnalyzed?.length ?? 0} accounts
                </p>
                {(() => {
                  try {
                    const p = JSON.parse(styleProfile.profile);
                    return (
                      <div className="space-y-2 text-xs">
                        {p.tone && (
                          <div className="glass rounded-xl p-3">
                            <span className="font-medium text-foreground">
                              Tone:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {p.tone}
                            </span>
                          </div>
                        )}
                        {p.defaultSignoff && (
                          <div className="glass rounded-xl p-3">
                            <span className="font-medium text-foreground">
                              Sign-off:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              "{p.defaultSignoff}"
                            </span>
                          </div>
                        )}
                        {p.keyPhrases && (
                          <div className="glass rounded-xl p-3">
                            <span className="font-medium text-foreground">
                              Key phrases:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {p.keyPhrases.slice(0, 4).join(" · ")}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={async () => {
                    setIsAnalyzing(true);
                    try {
                      await analyzeStyle({
                        userId: "josh",
                        emailCount: parseInt(emailCount),
                      });
                    } catch (e) {
                      console.error(e);
                    }
                    setIsAnalyzing(false);
                  }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Re-analyze
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {analysisStatus &&
                analysisStatus.status !== "complete" &&
                analysisStatus.status !== "error" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        {analysisStatus.message}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${analysisStatus.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Scan your sent emails so AI drafts match your writing
                      style.
                    </p>
                    {analysisStatus?.status === "error" && (
                      <p className="text-xs text-destructive">
                        {analysisStatus.message}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Select value={emailCount} onValueChange={setEmailCount}>
                        <SelectTrigger className="w-[140px] h-9 rounded-xl text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50 emails</SelectItem>
                          <SelectItem value="100">100 emails</SelectItem>
                          <SelectItem value="200">200 emails</SelectItem>
                          <SelectItem value="300">300 emails</SelectItem>
                          <SelectItem value="500">500 emails</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="rounded-xl gap-1.5"
                        onClick={async () => {
                          setIsAnalyzing(true);
                          try {
                            await analyzeStyle({
                              userId: "josh",
                              emailCount: parseInt(emailCount),
                            });
                          } catch (e) {
                            console.error(e);
                          }
                          setIsAnalyzing(false);
                        }}
                        disabled={isAnalyzing || !googleConnections?.length}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Learn My Style
                      </Button>
                    </div>
                    {!googleConnections?.length && (
                      <p className="text-[10px] text-muted-foreground">
                        Connect a Google account first
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Journal Schedule */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Daily Journal</h2>
                <p className="text-xs text-muted-foreground">
                  Auto-generate from captures
                </p>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-generate journal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically generate your daily journal at a scheduled time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJournalEnabled((v) => !v)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  journalEnabled ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    journalEnabled ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </div>

            {journalEnabled && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Daily generation time
                </label>
                <input
                  type="time"
                  value={journalTime}
                  onChange={(e) => setJournalTime(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground">
                  Journal will be generated daily at this time using your
                  captured audio from the day.
                </p>
              </div>
            )}

            <Button
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={async () => {
                setIsSavingJournal(true);
                try {
                  await scheduleJournalGeneration({
                    userId: "josh",
                    journalTime,
                    journalTimezone:
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                    journalEnabled,
                  });
                  setJournalSaved(true);
                  setTimeout(() => setJournalSaved(false), 2000);
                } catch (e) {
                  console.error(e);
                }
                setIsSavingJournal(false);
              }}
              disabled={isSavingJournal}
            >
              {isSavingJournal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : journalSaved ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <BookOpen className="h-3.5 w-3.5" />
              )}
              {journalSaved ? "Saved!" : "Save Schedule"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
