"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type TriageFilter = "all" | "needs_me" | "draft_ready" | "handled" | "ignore";

const TRIAGE_CONFIG = {
  needs_me: { label: "Needs You", color: "bg-red-500 text-white" },
  draft_ready: { label: "Draft", color: "bg-yellow-500 text-white" },
  handled: { label: "Handled", color: "bg-green-500 text-white" },
  ignore: { label: "Ignore", color: "bg-gray-400 text-white" },
} as const;

function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.ceil(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };
  const [filter, setFilter] = useState<TriageFilter>("all");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const connections = useQuery(api.google.getGoogleConnections, { userId: "josh" }) ?? [];
  const syncGmail = useAction(api.google.syncGmailInbox);

  const emails = useQuery(
    api.google.getEmails,
    filter === "all"
      ? { userId: "josh" }
      : { userId: "josh", triageStatus: filter as any },
  ) ?? [];

  async function handleSync() {
    setSyncing(true);
    try {
      for (const conn of connections) {
        await syncGmail({ connectionId: conn._id as any });
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
    setSyncing(false);
  }

  const filters: { key: TriageFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs_me", label: "Needs You" },
    { key: "draft_ready", label: "Drafts" },
    { key: "handled", label: "Handled" },
    { key: "ignore", label: "Ignored" },
  ];

  // Email detail view
  if (selectedEmail) {
    const triage = TRIAGE_CONFIG[selectedEmail.triageStatus as keyof typeof TRIAGE_CONFIG];
    return (
      <DashboardLayout user={user}>
        <div className="max-w-lg mx-auto w-full p-4 space-y-4">
          <button type="button" onClick={() => setSelectedEmail(null)} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h2 className="font-bold text-lg leading-tight flex-1 min-w-0">{selectedEmail.subject}</h2>
              {triage && <Badge className={cn("text-[10px] shrink-0", triage.color)}>{triage.label}</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="truncate"><strong>From:</strong> {selectedEmail.from}</p>
              <p className="truncate"><strong>To:</strong> {selectedEmail.to?.join(", ")}</p>
              <p><strong>Account:</strong> {selectedEmail.accountEmail}</p>
              <p>{fmtDate(selectedEmail.receivedAt)}</p>
            </div>
          </div>
          <Card className="p-4">
            <pre className="text-sm whitespace-pre-wrap break-words font-sans">{selectedEmail.body}</pre>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="max-w-lg mx-auto w-full p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Inbox</h1>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                filter === f.key ? "bg-blue-600 text-white" : "bg-muted text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Email count */}
        <p className="text-xs text-muted-foreground">{emails.length} emails</p>

        {/* Email list */}
        <div className="space-y-2">
          {emails.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No emails in this category</p>
            </div>
          ) : (
            emails.map((email: any) => {
              const triage = TRIAGE_CONFIG[email.triageStatus as keyof typeof TRIAGE_CONFIG];
              const fromName = email.from?.split("<")[0]?.trim() || email.from;
              return (
                <button
                  key={email._id}
                  type="button"
                  onClick={() => setSelectedEmail(email)}
                  className="w-full text-left"
                >
                  <Card className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm truncate flex-1 min-w-0">{fromName}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(email.receivedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm truncate flex-1 min-w-0">{email.subject}</p>
                        {triage && <Badge className={cn("text-[10px] shrink-0", triage.color)}>{triage.label}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{email.accountEmail}</p>
                    </div>
                  </Card>
                </button>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
