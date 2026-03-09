"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
	const searchParams = useSearchParams();
	const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

	const connections = useQuery(api.google.getGoogleConnections, {
		userId: "josh",
	});

	const syncGmail = useAction(api.google.syncGmailInbox);
	const syncCalendar = useAction(api.google.syncCalendar);
	const deleteConnection = useMutation(api.google.deleteGoogleConnection);

	useEffect(() => {
		const success = searchParams.get("success");
		const error = searchParams.get("error");
		const email = searchParams.get("email");

		if (success === "connected" && email) {
			// Show success message (you could add a toast notification here)
			console.log(`Successfully connected ${email}`);
		} else if (error) {
			console.error(`OAuth error: ${error}`);
		}
	}, [searchParams]);

	const handleConnectGoogle = () => {
		// Redirect to Google OAuth flow
		window.location.href = "/api/auth/google";
	};

	const handleSync = async (connectionId: Id<"google_connections">) => {
		setIsSyncing((prev) => ({ ...prev, [connectionId]: true }));

		try {
			await Promise.all([
				syncGmail({ connectionId }),
				syncCalendar({ connectionId }),
			]);
			console.log("Sync completed");
		} catch (error) {
			console.error("Sync failed:", error);
		} finally {
			setIsSyncing((prev) => ({ ...prev, [connectionId]: false }));
		}
	};

	const handleDisconnect = async (connectionId: Id<"google_connections">) => {
		if (confirm("Are you sure you want to disconnect this account?")) {
			await deleteConnection({ connectionId });
		}
	};

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Settings</h1>
					<p className="text-muted-foreground mt-2">
						Manage your connected accounts and preferences
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Connected Accounts</CardTitle>
						<CardDescription>
							Connect your Google accounts to sync emails and calendar events
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{connections === undefined ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : connections.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-muted-foreground mb-4">
									No accounts connected yet
								</p>
								<Button onClick={handleConnectGoogle}>
									<Plus className="mr-2 h-4 w-4" />
									Connect Google Account
								</Button>
							</div>
						) : (
							<>
								<div className="space-y-3">
									{connections.map((connection: any) => (
										<div
											key={connection._id}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="space-y-1">
												<p className="font-medium">{connection.email}</p>
												<div className="flex items-center gap-4 text-sm text-muted-foreground">
													<span>
														Connected:{" "}
														{new Date(connection.connectedAt).toLocaleDateString()}
													</span>
													{connection.lastSyncAt && (
														<span>
															Last sync:{" "}
															{new Date(connection.lastSyncAt).toLocaleString()}
														</span>
													)}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleSync(connection._id)}
													disabled={isSyncing[connection._id]}
												>
													{isSyncing[connection._id] ? (
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Syncing...
														</>
													) : (
														<>
															<RefreshCw className="mr-2 h-4 w-4" />
															Sync Now
														</>
													)}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleDisconnect(connection._id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
								<Button onClick={handleConnectGoogle} variant="outline">
									<Plus className="mr-2 h-4 w-4" />
									Connect Another Account
								</Button>
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
