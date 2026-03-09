import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Store or update Google OAuth connection
export const storeGoogleConnection = mutation({
	args: {
		userId: v.string(),
		email: v.string(),
		accessToken: v.string(),
		refreshToken: v.string(),
		tokenExpiry: v.number(),
		scopes: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if connection already exists
		const existing = await ctx.db
			.query("google_connections")
			.withIndex("by_email", (q) => q.eq("email", args.email))
			.first();

		if (existing) {
			// Update existing connection
			await ctx.db.patch(existing._id, {
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				tokenExpiry: args.tokenExpiry,
				scopes: args.scopes,
			});
			return existing._id;
		}

		// Create new connection
		const connectionId = await ctx.db.insert("google_connections", {
			userId: args.userId,
			email: args.email,
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			tokenExpiry: args.tokenExpiry,
			scopes: args.scopes,
			connectedAt: Date.now(),
		});

		return connectionId;
	},
});

// Get all Google connections for a user
export const getGoogleConnections = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const connections = await ctx.db
			.query("google_connections")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		// Don't expose tokens to client
		return connections.map((conn) => ({
			_id: conn._id,
			email: conn.email,
			connectedAt: conn.connectedAt,
			lastSyncAt: conn.lastSyncAt,
			scopes: conn.scopes,
		}));
	},
});

// Internal query to get connection
export const getConnection = internalQuery({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.connectionId);
	},
});

// Internal mutation to update connection tokens
export const updateConnectionTokens = internalMutation({
	args: {
		connectionId: v.id("google_connections"),
		accessToken: v.string(),
		tokenExpiry: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.connectionId, {
			accessToken: args.accessToken,
			tokenExpiry: args.tokenExpiry,
		});
	},
});

// Helper function to refresh token
async function refreshTokenIfNeeded(
	ctx: any,
	connectionId: string,
): Promise<string> {
	const connection = await ctx.runQuery(internal.google.getConnection, {
		connectionId,
	});

	if (!connection) {
		throw new Error("Connection not found");
	}

	// Check if token is expired or about to expire (within 5 minutes)
	const now = Date.now();
	if (connection.tokenExpiry > now + 5 * 60 * 1000) {
		// Token still valid
		return connection.accessToken;
	}

	// Refresh token
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: GOOGLE_CLIENT_ID!,
			client_secret: GOOGLE_CLIENT_SECRET!,
			refresh_token: connection.refreshToken,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) {
		const errorData = await response.text();
		throw new Error(`Failed to refresh token: ${errorData}`);
	}

	const tokens = await response.json();

	// Update connection with new access token
	await ctx.runMutation(internal.google.updateConnectionTokens, {
		connectionId,
		accessToken: tokens.access_token,
		tokenExpiry: Date.now() + tokens.expires_in * 1000,
	});

	return tokens.access_token;
}

// Refresh expired access token
export const refreshGoogleToken = action({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		return await refreshTokenIfNeeded(ctx, args.connectionId);
	},
});

// Delete a Google connection
export const deleteGoogleConnection = mutation({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.connectionId);
	},
});

// Get emails for a user with optional triage filter
export const getEmails = query({
	args: {
		userId: v.string(),
		triageStatus: v.optional(
			v.union(
				v.literal("needs_me"),
				v.literal("draft_ready"),
				v.literal("handled"),
				v.literal("ignore"),
			),
		),
	},
	handler: async (ctx, args) => {
		if (args.triageStatus) {
			const emails = await ctx.db
				.query("emails")
				.withIndex("by_user_and_triage", (q) =>
					q.eq("userId", args.userId).eq("triageStatus", args.triageStatus!),
				)
				.order("desc")
				.take(100);
			return emails;
		}

		const emails = await ctx.db
			.query("emails")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(100);

		return emails;
	},
});

// Get calendar events for a user
export const getCalendarEvents = query({
	args: {
		userId: v.string(),
		startTime: v.optional(v.number()),
		endTime: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		let eventsQuery = ctx.db
			.query("calendar_events")
			.withIndex("by_user_and_time", (q) => q.eq("userId", args.userId));

		const events = await eventsQuery
			.order("asc")
			.collect();

		// Filter by time range if provided
		if (args.startTime !== undefined && args.endTime !== undefined) {
			return events.filter(
				(event) => event.startTime >= args.startTime! && event.startTime <= args.endTime!,
			);
		}

		return events;
	},
});

// Internal mutation to insert email
export const insertEmail = internalMutation({
	args: {
		userId: v.string(),
		accountEmail: v.string(),
		gmailMessageId: v.string(),
		subject: v.string(),
		from: v.string(),
		to: v.array(v.string()),
		body: v.string(),
		threadId: v.optional(v.string()),
		labels: v.optional(v.array(v.string())),
		triageStatus: v.union(
			v.literal("needs_me"),
			v.literal("draft_ready"),
			v.literal("handled"),
			v.literal("ignore"),
		),
		receivedAt: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("emails", args);
	},
});

// Internal query to check if email exists
export const checkEmailExists = internalQuery({
	args: {
		gmailMessageId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emails")
			.withIndex("by_gmail_message_id", (q) => q.eq("gmailMessageId", args.gmailMessageId))
			.first();
	},
});

// Internal mutation to update last sync time
export const updateLastSync = internalMutation({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.connectionId, {
			lastSyncAt: Date.now(),
		});
	},
});

// Sync Gmail inbox
export const syncGmailInbox = action({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		// Get fresh access token
		const accessToken = await refreshTokenIfNeeded(ctx, args.connectionId);

		const connection = await ctx.runQuery(internal.google.getConnection, {
			connectionId: args.connectionId,
		});

		if (!connection) {
			throw new Error("Connection not found");
		}

		// Fetch latest 50 messages
		const listResponse = await fetch(
			"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX",
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		if (!listResponse.ok) {
			throw new Error(`Gmail API error: ${await listResponse.text()}`);
		}

		const listData = await listResponse.json();
		const messages = listData.messages || [];

		let newEmailsCount = 0;

		// Fetch and process each message
		for (const message of messages) {
			// Check if we already have this message
			const existing = await ctx.runQuery(internal.google.checkEmailExists, {
				gmailMessageId: message.id,
			});

			if (existing) {
				continue; // Skip already synced messages
			}

			// Fetch full message details
			const messageResponse = await fetch(
				`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			if (!messageResponse.ok) {
				console.error(`Failed to fetch message ${message.id}`);
				continue;
			}

			const messageData = await messageResponse.json();

			// Parse headers
			const headers = messageData.payload.headers;
			const subject = headers.find((h: any) => h.name === "Subject")?.value || "(No Subject)";
			const from = headers.find((h: any) => h.name === "From")?.value || "";
			const toHeader = headers.find((h: any) => h.name === "To")?.value || "";
			const to = toHeader.split(",").map((email: string) => email.trim());

			// Extract body
			let body = messageData.snippet || "";
			if (messageData.payload.parts) {
				const textPart = messageData.payload.parts.find(
					(part: any) => part.mimeType === "text/plain",
				);
				if (textPart && textPart.body.data) {
					body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
				}
			} else if (messageData.payload.body?.data) {
				body = Buffer.from(messageData.payload.body.data, "base64").toString("utf-8");
			}

			// Get labels
			const labels = messageData.labelIds || [];

			// Get internal date (timestamp)
			const receivedAt = Number.parseInt(messageData.internalDate, 10);

			// AI triage using Claude
			const triageStatus = await triageEmailWithClaude(subject, from, body);

			// Store in database
			await ctx.runMutation(internal.google.insertEmail, {
				userId: connection.userId,
				accountEmail: connection.email,
				gmailMessageId: message.id,
				subject,
				from,
				to,
				body,
				threadId: messageData.threadId,
				labels,
				triageStatus,
				receivedAt,
			});

			newEmailsCount++;
		}

		// Update last sync time
		await ctx.runMutation(internal.google.updateLastSync, {
			connectionId: args.connectionId,
		});

		return { newEmails: newEmailsCount };
	},
});

// Internal query to check if event exists
export const checkEventExists = internalQuery({
	args: {
		googleEventId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("calendar_events")
			.withIndex("by_google_event_id", (q) => q.eq("googleEventId", args.googleEventId))
			.first();
	},
});

// Internal mutation to insert calendar event
export const insertCalendarEvent = internalMutation({
	args: {
		userId: v.string(),
		accountEmail: v.string(),
		googleEventId: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		startTime: v.number(),
		endTime: v.number(),
		location: v.optional(v.string()),
		attendees: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("calendar_events", args);
	},
});

// Internal mutation to update calendar event
export const updateCalendarEvent = internalMutation({
	args: {
		eventId: v.id("calendar_events"),
		title: v.string(),
		description: v.optional(v.string()),
		startTime: v.number(),
		endTime: v.number(),
		location: v.optional(v.string()),
		attendees: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const { eventId, ...updates } = args;
		await ctx.db.patch(eventId, updates);
	},
});

// Sync Google Calendar
export const syncCalendar = action({
	args: {
		connectionId: v.id("google_connections"),
	},
	handler: async (ctx, args) => {
		// Get fresh access token
		const accessToken = await refreshTokenIfNeeded(ctx, args.connectionId);

		const connection = await ctx.runQuery(internal.google.getConnection, {
			connectionId: args.connectionId,
		});

		if (!connection) {
			throw new Error("Connection not found");
		}

		// Fetch events for next 7 days
		const now = new Date();
		const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		const eventsResponse = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${sevenDaysLater.toISOString()}&singleEvents=true&orderBy=startTime`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		if (!eventsResponse.ok) {
			throw new Error(`Calendar API error: ${await eventsResponse.text()}`);
		}

		const eventsData = await eventsResponse.json();
		const events = eventsData.items || [];

		let newEventsCount = 0;

		for (const event of events) {
			// Check if we already have this event
			const existing = await ctx.runQuery(internal.google.checkEventExists, {
				googleEventId: event.id,
			});

			if (existing) {
				// Update existing event
				await ctx.runMutation(internal.google.updateCalendarEvent, {
					eventId: existing._id,
					title: event.summary || "(No Title)",
					description: event.description,
					startTime: new Date(event.start.dateTime || event.start.date).getTime(),
					endTime: new Date(event.end.dateTime || event.end.date).getTime(),
					location: event.location,
					attendees: event.attendees?.map((a: any) => a.email) || [],
				});
				continue;
			}

			// Create new event
			await ctx.runMutation(internal.google.insertCalendarEvent, {
				userId: connection.userId,
				accountEmail: connection.email,
				googleEventId: event.id,
				title: event.summary || "(No Title)",
				description: event.description,
				startTime: new Date(event.start.dateTime || event.start.date).getTime(),
				endTime: new Date(event.end.dateTime || event.end.date).getTime(),
				location: event.location,
				attendees: event.attendees?.map((a: any) => a.email) || [],
			});

			newEventsCount++;
		}

		// Update last sync time
		await ctx.runMutation(internal.google.updateLastSync, {
			connectionId: args.connectionId,
		});

		return { newEvents: newEventsCount };
	},
});

// Helper function to triage emails using Claude
async function triageEmailWithClaude(
	subject: string,
	from: string,
	body: string,
): Promise<"needs_me" | "draft_ready" | "handled" | "ignore"> {
	const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

	if (!ANTHROPIC_API_KEY) {
		console.warn("ANTHROPIC_API_KEY not set, defaulting to needs_me");
		return "needs_me";
	}

	try {
		const response = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": ANTHROPIC_API_KEY,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 100,
				messages: [
					{
						role: "user",
						content: `You are an AI assistant triaging emails for an executive. Classify this email into one of these categories:

- needs_me: Requires personal attention, decision, or action from the user
- draft_ready: Can be responded to with a template/draft (meeting requests, simple questions)
- handled: Already resolved, FYI only, or automated notifications
- ignore: Spam, newsletters, or irrelevant

Respond with ONLY the category name, nothing else.

From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 500)}`,
					},
				],
			}),
		});

		if (!response.ok) {
			console.error("Claude API error:", await response.text());
			return "needs_me";
		}

		const data = await response.json();
		const category = data.content[0].text.trim().toLowerCase();

		if (
			category === "needs_me" ||
			category === "draft_ready" ||
			category === "handled" ||
			category === "ignore"
		) {
			return category;
		}

		return "needs_me";
	} catch (error) {
		console.error("Error triaging email with Claude:", error);
		return "needs_me";
	}
}
