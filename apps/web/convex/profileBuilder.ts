import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ─── Queries ───

// Get all profiles for a user
export const listProfiles = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const profiles = await ctx.db
			.query("contact_profiles")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		return profiles.sort((a, b) => b.emailsSent - a.emailsSent);
	},
});

// Get profile by email
export const getProfileByEmail = query({
	args: { userId: v.string(), email: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("contact_profiles")
			.withIndex("by_user_and_email", (q) =>
				q.eq("userId", args.userId).eq("email", args.email.toLowerCase()),
			)
			.first();
	},
});

// Internal: get profile by email (for use in actions)
export const getProfileByEmailInternal = internalQuery({
	args: { userId: v.string(), email: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("contact_profiles")
			.withIndex("by_user_and_email", (q) =>
				q.eq("userId", args.userId).eq("email", args.email.toLowerCase()),
			)
			.first();
	},
});

// Get profile for a contact
export const getProfileForContact = query({
	args: { contactId: v.id("contacts") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("contact_profiles")
			.withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
			.first();
	},
});

// Get build progress
export const getBuildProgress = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const builds = await ctx.db
			.query("profile_builds")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.first();
		return builds;
	},
});

// Profile count
export const profileCount = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const profiles = await ctx.db
			.query("contact_profiles")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		return profiles.length;
	},
});

// ─── Internal mutations ───

export const upsertProfile = internalMutation({
	args: {
		userId: v.string(),
		contactId: v.optional(v.id("contacts")),
		email: v.string(),
		name: v.string(),
		relationshipSummary: v.string(),
		topics: v.array(v.string()),
		communicationStyle: v.string(),
		sentiment: v.string(),
		keyContext: v.string(),
		recentInteractions: v.array(v.object({
			date: v.number(),
			type: v.string(),
			summary: v.string(),
		})),
		emailsSent: v.number(),
		emailsReceived: v.number(),
		lastInteractionDate: v.optional(v.number()),
		sources: v.array(v.string()),
		rawEmailSamples: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query("contact_profiles")
			.withIndex("by_user_and_email", (q) =>
				q.eq("userId", args.userId).eq("email", args.email),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				...args,
				updatedAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("contact_profiles", {
			...args,
			builtAt: now,
			updatedAt: now,
		});
	},
});

export const createBuildProgress = internalMutation({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		// Clear old builds
		const old = await ctx.db
			.query("profile_builds")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		for (const b of old) {
			await ctx.db.delete(b._id);
		}

		const now = Date.now();
		return await ctx.db.insert("profile_builds", {
			userId: args.userId,
			status: "pending",
			progress: 0,
			message: "Starting profile build...",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const updateBuildProgress = internalMutation({
	args: {
		buildId: v.id("profile_builds"),
		status: v.optional(v.union(
			v.literal("pending"),
			v.literal("scanning"),
			v.literal("building"),
			v.literal("complete"),
			v.literal("error"),
		)),
		progress: v.optional(v.number()),
		message: v.optional(v.string()),
		totalRecipients: v.optional(v.number()),
		profilesBuilt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { buildId, ...updates } = args;
		const filtered: Record<string, unknown> = { updatedAt: Date.now() };
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) filtered[key] = value;
		}
		await ctx.db.patch(buildId, filtered);
	},
});

// Internal: find matching contact by email
export const findContactByEmail = internalQuery({
	args: { userId: v.string(), email: v.string() },
	handler: async (ctx, args) => {
		const contacts = await ctx.db
			.query("contacts")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		return contacts.find((c) => c.emails?.includes(args.email)) ?? null;
	},
});

// Internal: get all connections
export const getAllConnections = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("google_connections")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

// ─── Main build action ───

// Helper: refresh Google token
async function refreshToken(ctx: any, connectionId: string): Promise<string> {
	const connection = await ctx.runQuery(internal.google.getConnection, { connectionId });
	if (!connection) throw new Error("Connection not found");

	if (connection.tokenExpiry > Date.now() + 5 * 60 * 1000) {
		return connection.accessToken;
	}

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID!,
			client_secret: GOOGLE_CLIENT_SECRET!,
			refresh_token: connection.refreshToken,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
	const tokens = await response.json();

	await ctx.runMutation(internal.google.updateConnectionTokens, {
		connectionId,
		accessToken: tokens.access_token,
		tokenExpiry: Date.now() + tokens.expires_in * 1000,
	});

	return tokens.access_token;
}

// Fetch sent emails from a Gmail account
async function fetchSentEmails(
	accessToken: string,
	maxResults: number = 200,
): Promise<Array<{ to: string; toName: string; subject: string; body: string; date: number }>> {
	const emails: Array<{ to: string; toName: string; subject: string; body: string; date: number }> = [];

	let pageToken: string | undefined;
	let fetched = 0;

	while (fetched < maxResults) {
		const batchSize = Math.min(100, maxResults - fetched);
		const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${batchSize}&labelIds=SENT${pageToken ? `&pageToken=${pageToken}` : ""}`;

		const listResp = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!listResp.ok) break;

		const listData = await listResp.json();
		const messages = listData.messages || [];
		pageToken = listData.nextPageToken;

		for (const msg of messages) {
			try {
				const msgResp = await fetch(
					`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
					{ headers: { Authorization: `Bearer ${accessToken}` } },
				);
				if (!msgResp.ok) continue;

				const msgData = await msgResp.json();
				const headers = msgData.payload.headers;
				const toHeader = headers.find((h: any) => h.name === "To")?.value || "";
				const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
				const date = parseInt(msgData.internalDate, 10);

				// Extract body
				let body = msgData.snippet || "";
				if (msgData.payload.parts) {
					const textPart = msgData.payload.parts.find((p: any) => p.mimeType === "text/plain");
					if (textPart?.body?.data) {
						body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
					}
				} else if (msgData.payload.body?.data) {
					body = atob(msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
				}

				// Strip quoted replies (lines starting with >)
				body = body.split("\n").filter((l: string) => !l.startsWith(">")).join("\n");
				// Strip signature blocks
				const sigIdx = body.indexOf("--\n");
				if (sigIdx > 0) body = body.substring(0, sigIdx);
				// Trim
				body = body.trim();
				if (body.length < 10) continue; // Skip empty/trivial

				// Parse all recipients
				const toAddresses = toHeader.split(",");
				for (const addr of toAddresses) {
					const emailMatch = addr.match(/<(.+?)>/);
					const email = emailMatch ? emailMatch[1].toLowerCase().trim() : addr.toLowerCase().trim();
					const nameMatch = addr.split("<")[0].trim().replace(/"/g, "");
					const name = nameMatch || email.split("@")[0];

					if (email && email.includes("@")) {
						emails.push({ to: email, toName: name, subject, body: body.slice(0, 1000), date });
					}
				}

				fetched++;
			} catch {
				continue;
			}
		}

		if (!pageToken) break;
	}

	return emails;
}

// Own email addresses to skip
const OWN_EMAILS = [
	"josh@onflourish.com",
	"josh@church.tech",
	"jburnett@gloo.us",
	"jmgburnett@gmail.com",
	"jbflobot@gmail.com",
];

const SYSTEM_PATTERN = /no-?reply|mailer-daemon|notifications?@|noreply|donotreply|unsubscribe|calendar-notification/i;

// Build profiles from email data
export const buildProfiles = action({
	args: {
		userId: v.string(),
		maxEmailsPerAccount: v.optional(v.number()), // default 200
	},
	handler: async (ctx, args) => {
		const maxEmails = args.maxEmailsPerAccount ?? 200;
		const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
		if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

		// Create build progress tracker
		const buildId = await ctx.runMutation(internal.profileBuilder.createBuildProgress, {
			userId: args.userId,
		});

		try {
			// ── Phase 1: Scan sent emails from all accounts ──
			await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
				buildId,
				status: "scanning",
				progress: 5,
				message: "Scanning sent emails across all accounts...",
			});

			const connections = await ctx.runQuery(internal.profileBuilder.getAllConnections, {
				userId: args.userId,
			});

			// Aggregate all sent emails grouped by recipient
			const recipientMap: Map<string, {
				name: string;
				sentEmails: Array<{ subject: string; body: string; date: number; fromAccount: string }>;
				receivedEmails: Array<{ subject: string; body: string; date: number }>;
			}> = new Map();

			let accountsScanned = 0;
			for (const conn of connections) {
				try {
					const accessToken = await refreshToken(ctx, conn._id);
					const sentEmails = await fetchSentEmails(accessToken, maxEmails);

					for (const email of sentEmails) {
						// Skip own emails and system addresses
						if (OWN_EMAILS.includes(email.to)) continue;
						if (SYSTEM_PATTERN.test(email.to)) continue;

						const existing = recipientMap.get(email.to) || {
							name: email.toName,
							sentEmails: [],
							receivedEmails: [],
						};
						existing.sentEmails.push({
							subject: email.subject,
							body: email.body,
							date: email.date,
							fromAccount: conn.email,
						});
						// Use most informative name
						if (email.toName && email.toName.length > existing.name.length && !email.toName.includes("@")) {
							existing.name = email.toName;
						}
						recipientMap.set(email.to, existing);
					}

					accountsScanned++;
					await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
						buildId,
						progress: Math.round(5 + (accountsScanned / connections.length) * 30),
						message: `Scanned ${conn.email} (${sentEmails.length} sent emails)`,
					});
				} catch (e) {
					console.error(`Error scanning ${conn.email}:`, e);
				}
			}

			// Also scan received emails (already in DB) to count
			// We'll match by sender email to existing contacts
			// (Received emails are already stored from syncGmailInbox)

			// ── Phase 2: Filter to meaningful contacts ──
			// Only build profiles for people Josh has emailed at least 2 times
			const qualifiedRecipients = Array.from(recipientMap.entries())
				.filter(([_, data]) => data.sentEmails.length >= 2)
				.sort((a, b) => b[1].sentEmails.length - a[1].sentEmails.length);

			const totalRecipients = qualifiedRecipients.length;

			await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
				buildId,
				status: "building",
				progress: 35,
				message: `Found ${totalRecipients} contacts to profile (from ${recipientMap.size} total recipients)`,
				totalRecipients,
			});

			// ── Phase 3: Build profiles with Claude ──
			let profilesBuilt = 0;

			// Process in batches of 5 to avoid rate limits
			for (let i = 0; i < qualifiedRecipients.length; i += 5) {
				const batch = qualifiedRecipients.slice(i, i + 5);

				await Promise.all(batch.map(async ([email, data]) => {
					try {
						// Take most recent 10 emails as samples
						const sortedEmails = data.sentEmails
							.sort((a, b) => b.date - a.date)
							.slice(0, 10);

						const emailSamples = sortedEmails.map((e) =>
							`[${new Date(e.date).toISOString().split("T")[0]}] Subject: ${e.subject}\nFrom account: ${e.fromAccount}\n${e.body.slice(0, 300)}`
						).join("\n\n---\n\n");

						// Call Claude to build profile
						const resp = await fetch("https://api.anthropic.com/v1/messages", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"x-api-key": ANTHROPIC_API_KEY!,
								"anthropic-version": "2023-06-01",
							},
							body: JSON.stringify({
								model: "claude-3-haiku-20240307",
								max_tokens: 800,
								messages: [{
									role: "user",
									content: `Analyze these ${data.sentEmails.length} sent emails from Josh Burnett to ${data.name} (${email}) and build a contact profile.

EMAILS:
${emailSamples}

Return a JSON object with these exact fields:
{
  "relationshipSummary": "Brief description of the relationship and context (1-2 sentences)",
  "topics": ["array", "of", "key", "topics", "discussed"],
  "communicationStyle": "How Josh communicates with this person (formal/casual, detailed/brief, etc)",
  "sentiment": "overall tone: warm/professional/casual/formal/friendly",
  "keyContext": "Important things an AI should know when drafting emails to this person — their role, shared projects, sensitivities, preferences"
}

JSON only, no markdown:`,
								}],
							}),
						});

						if (!resp.ok) {
							console.error(`Claude error for ${email}: ${await resp.text()}`);
							return;
						}

						const respData: { content: Array<{ text: string }> } = await resp.json();
						let profileJson;
						try {
							// Try to parse, handling potential markdown wrapping
							let text = respData.content[0].text.trim();
							if (text.startsWith("```")) {
								text = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
							}
							profileJson = JSON.parse(text);
						} catch {
							console.error(`Failed to parse profile for ${email}`);
							return;
						}

						// Find matching contact
						const contact = await ctx.runQuery(internal.profileBuilder.findContactByEmail, {
							userId: args.userId,
							email,
						});

						// Build recent interactions list
						const recentInteractions = sortedEmails.slice(0, 5).map((e) => ({
							date: e.date,
							type: "email_sent",
							summary: e.subject,
						}));

						const lastDate = sortedEmails[0]?.date;

						// Upsert the profile
						await ctx.runMutation(internal.profileBuilder.upsertProfile, {
							userId: args.userId,
							contactId: contact?._id,
							email,
							name: data.name,
							relationshipSummary: profileJson.relationshipSummary || "",
							topics: profileJson.topics || [],
							communicationStyle: profileJson.communicationStyle || "",
							sentiment: profileJson.sentiment || "professional",
							keyContext: profileJson.keyContext || "",
							recentInteractions,
							emailsSent: data.sentEmails.length,
							emailsReceived: 0, // Will be enriched later from inbox
							lastInteractionDate: lastDate,
							sources: ["email"],
							rawEmailSamples: JSON.stringify(sortedEmails.slice(0, 5).map((e) => ({
								subject: e.subject,
								body: e.body.slice(0, 200),
								date: e.date,
							}))),
						});

						profilesBuilt++;
					} catch (e) {
						console.error(`Error building profile for ${email}:`, e);
					}
				}));

				// Update progress
				await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
					buildId,
					progress: Math.round(35 + (Math.min(i + 5, qualifiedRecipients.length) / qualifiedRecipients.length) * 60),
					message: `Built ${profilesBuilt} of ${totalRecipients} profiles...`,
					profilesBuilt,
				});
			}

			// ── Phase 4: Done ──
			await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
				buildId,
				status: "complete",
				progress: 100,
				message: `Built ${profilesBuilt} profiles from ${accountsScanned} email accounts`,
				profilesBuilt,
			});

			return { profilesBuilt, totalRecipients, accountsScanned };
		} catch (e) {
			await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
				buildId,
				status: "error",
				message: `Error: ${String(e).slice(0, 200)}`,
			});
			throw e;
		}
	},
});

// Trigger profile build from the UI
export const startBuildProfiles = mutation({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		// Just a trigger — the actual work happens in the action
		// The UI will call buildProfiles action after this
		return { started: true };
	},
});
