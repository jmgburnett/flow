"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, Plus, RefreshCw, Trash2, Mail, MessageSquare, Hash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
	const user = { name: "Josh", email: "josh@onflourish.com" };
	const searchParams = useSearchParams();
	const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

	const googleConnections = useQuery(api.google.getGoogleConnections, { userId: "josh" });
	const slackConnections = useQuery(api.slack.getSlackConnections, { userId: "josh" });

	const syncGmail = useAction(api.google.syncGmailInbox);
	const syncCalendar = useAction(api.google.syncCalendar);
	const deleteGoogleConnection = useMutation(api.google.deleteGoogleConnection);

	const syncSlack = useAction(api.slack.syncSlackMessages);
	const deleteSlackConnection = useMutation(api.slack.deleteSlackConnection);

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
		} catch (e) { console.error(e); }
		setIsSyncing((p) => ({ ...p, [connectionId]: false }));
	}

	async function handleSlackSync(connectionId: Id<"slack_connections">) {
		setIsSyncing((p) => ({ ...p, [connectionId]: true }));
		try {
			await syncSlack({ connectionId });
		} catch (e) { console.error(e); }
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
								<p className="text-xs text-muted-foreground">Email & Calendar</p>
							</div>
						</div>
						<Button size="sm" variant="ghost" onClick={() => (window.location.href = "/api/auth/google")} className="rounded-xl gap-1.5 text-xs">
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
								<p className="text-sm text-muted-foreground mb-3">No accounts connected</p>
								<Button size="sm" onClick={() => (window.location.href = "/api/auth/google")} className="rounded-xl">
									Connect Google
								</Button>
							</div>
						) : (
							googleConnections.map((conn: any) => (
								<div key={conn._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-all group">
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium truncate">{conn.email}</p>
										<p className="text-[10px] text-muted-foreground">
											{conn.lastSyncAt ? `Synced ${new Date(conn.lastSyncAt).toLocaleString()}` : "Never synced"}
										</p>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="sm" variant="ghost" onClick={() => handleGoogleSync(conn._id)}
											disabled={isSyncing[conn._id]} className="h-7 w-7 p-0 rounded-lg">
											{isSyncing[conn._id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
										</Button>
										<Button size="sm" variant="ghost"
											onClick={() => confirm("Disconnect?") && deleteGoogleConnection({ connectionId: conn._id })}
											className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive">
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
						<Button size="sm" variant="ghost" onClick={() => (window.location.href = "/api/auth/slack")} className="rounded-xl gap-1.5 text-xs">
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
								<p className="text-sm text-muted-foreground mb-3">No Slack workspace connected</p>
								<Button size="sm" onClick={() => (window.location.href = "/api/auth/slack")} className="rounded-xl">
									Connect Slack
								</Button>
							</div>
						) : (
							slackConnections.map((conn: any) => (
								<div key={conn._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-all group">
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium truncate">{conn.teamName}</p>
										<p className="text-[10px] text-muted-foreground">
											@{conn.slackUserName} · {conn.lastSyncAt ? `Synced ${new Date(conn.lastSyncAt).toLocaleString()}` : "Never synced"}
										</p>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="sm" variant="ghost" onClick={() => handleSlackSync(conn._id)}
											disabled={isSyncing[conn._id]} className="h-7 w-7 p-0 rounded-lg">
											{isSyncing[conn._id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
										</Button>
										<Button size="sm" variant="ghost"
											onClick={() => confirm("Disconnect Slack?") && deleteSlackConnection({ connectionId: conn._id })}
											className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive">
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
