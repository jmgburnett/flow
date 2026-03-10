import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
					body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
				}
			} else if (messageData.payload.body?.data) {
				body = atob(messageData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
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

			// Extract person from sender
			const senderName = from.split("<")[0].trim().replace(/"/g, "");
			const senderEmailMatch = from.match(/<(.+?)>/);
			const senderEmail = senderEmailMatch ? senderEmailMatch[1] : from;
			if (senderName && senderEmail) {
				try {
					await ctx.runMutation(internal.people.extractPerson, {
						userId: connection.userId,
						name: senderName,
						email: senderEmail.toLowerCase(),
						source: "email",
						sourceDetail: subject,
					});
				} catch (e) {
					// Don't fail sync if extraction fails
					console.error("Person extraction error:", e);
				}

				// Schedule real-time profile building (filter + profile in one shot)
				try {
					await ctx.scheduler.runAfter(0, internal.profileBuilder.profileNewContact, {
						userId: connection.userId,
						name: senderName,
						email: senderEmail.toLowerCase(),
						source: "email",
						context: `Subject: ${subject}\n${body.slice(0, 200)}`,
					});
				} catch (e) {
					console.error("Real-time profile scheduling error:", e);
				}
			}

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
			const eventAttendees: string[] = event.attendees?.map((a: any) => a.email) || [];
			await ctx.runMutation(internal.google.insertCalendarEvent, {
				userId: connection.userId,
				accountEmail: connection.email,
				googleEventId: event.id,
				title: event.summary || "(No Title)",
				description: event.description,
				startTime: new Date(event.start.dateTime || event.start.date).getTime(),
				endTime: new Date(event.end.dateTime || event.end.date).getTime(),
				location: event.location,
				attendees: eventAttendees,
			});

			// Extract people from attendees
			for (const attendee of (event.attendees || [])) {
				const attendeeEmail: string = attendee.email;
				const attendeeName: string = attendee.displayName || attendeeEmail.split("@")[0];
				try {
					await ctx.runMutation(internal.people.extractPerson, {
						userId: connection.userId,
						name: attendeeName,
						email: attendeeEmail.toLowerCase(),
						source: "calendar",
						sourceDetail: event.summary || "(No Title)",
					});
				} catch (e) {
					console.error("Calendar person extraction error:", e);
				}
			}

			newEventsCount++;
		}

		// Update last sync time
		await ctx.runMutation(internal.google.updateLastSync, {
			connectionId: args.connectionId,
		});

		return { newEvents: newEventsCount };
	},
});

// Update draft reply on an email
export const updateDraftReply = mutation({
	args: {
		emailId: v.id("emails"),
		draftReply: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailId, {
			draftReply: args.draftReply,
		});
	},
});

// Update email triage status
export const updateTriageStatus = mutation({
	args: {
		emailId: v.id("emails"),
		triageStatus: v.union(
			v.literal("needs_me"),
			v.literal("draft_ready"),
			v.literal("handled"),
			v.literal("ignore"),
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailId, {
			triageStatus: args.triageStatus,
		});
	},
});

// Internal query to get email by ID
export const getEmailById = internalQuery({
	args: { emailId: v.id("emails") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.emailId);
	},
});

// Internal query to get connection by email
export const getConnectionByEmail = internalQuery({
	args: { email: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("google_connections")
			.withIndex("by_email", (q) => q.eq("email", args.email))
			.first();
	},
});

// Send reply to an email via Gmail API
export const sendReply = action({
	args: {
		emailId: v.id("emails"),
		replyBody: v.string(),
	},
	handler: async (ctx, args) => {
		// Get the email we're replying to
		const email = await ctx.runQuery(internal.google.getEmailById, {
			emailId: args.emailId,
		});
		if (!email) throw new Error("Email not found");

		// Get the connection for this account email
		const connection = await ctx.runQuery(internal.google.getConnectionByEmail, {
			email: email.accountEmail,
		});
		if (!connection) throw new Error("No Google connection for this account");

		// Get fresh access token
		const accessToken = await refreshTokenIfNeeded(ctx, connection._id);

		// Build the RFC 2822 email message
		const replyTo = email.from;
		const subject = email.subject.startsWith("Re:")
			? email.subject
			: `Re: ${email.subject}`;

		// Extract the email address from "Name <email>" format
		const toMatch = replyTo.match(/<(.+?)>/);
		const toAddress = toMatch ? toMatch[1] : replyTo;

		const rawMessage = [
			`From: ${email.accountEmail}`,
			`To: ${toAddress}`,
			`Subject: ${subject}`,
			email.threadId ? `In-Reply-To: ${email.gmailMessageId}` : "",
			email.threadId ? `References: ${email.gmailMessageId}` : "",
			"Content-Type: text/plain; charset=utf-8",
			"",
			args.replyBody,
		]
			.filter(Boolean)
			.join("\r\n");

		// Base64url encode the message
		const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		// Send via Gmail API
		const sendUrl = email.threadId
			? `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
			: `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;

		const sendResponse = await fetch(sendUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				raw: encodedMessage,
				threadId: email.threadId,
			}),
		});

		if (!sendResponse.ok) {
			const errorText = await sendResponse.text();
			throw new Error(`Failed to send email: ${errorText}`);
		}

		// Mark the original email as handled
		await ctx.runMutation(internal.google.markEmailHandled, {
			emailId: args.emailId,
		});

		return { success: true };
	},
});

// Internal mutation to mark email as handled after sending reply
export const markEmailHandled = internalMutation({
	args: { emailId: v.id("emails") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailId, {
			triageStatus: "handled",
		});
	},
});

// Internal: get user's style profile
export const getStyleProfile = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("style_profiles")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();
	},
});

// Generate AI draft reply for an email
export const generateDraftReply = action({
	args: {
		emailId: v.id("emails"),
	},
	handler: async (ctx, args): Promise<{ draft: string }> => {
		const email = await ctx.runQuery(internal.google.getEmailById, {
			emailId: args.emailId,
		});
		if (!email) throw new Error("Email not found");

		const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
		if (!ANTHROPIC_API_KEY) {
			throw new Error("ANTHROPIC_API_KEY not configured");
		}

		// Try to load dynamic style profile
		const styleProfile = await ctx.runQuery(internal.google.getStyleProfile, {
			userId: email.userId,
		});

		let stylePrompt: string;
		if (styleProfile?.prompt) {
			stylePrompt = styleProfile.prompt;
		} else {
			// Fallback to hardcoded style
			stylePrompt = `Write as Josh Burnett (Head of AI Product at Gloo, founder of Church.tech).
Warm and relational, never corporate-robotic. Opens with "Hi [Name]," or "Hey [Name]," (first name, casual).
Signs off with "Grateful,\\n\\nJosh" (his signature sign-off) or just "Josh" for quick replies.
Direct but kind — states positions clearly, asks specific questions.
If apologizing: "I apologize for the delay" or "I dropped the ball". Uses "Would love to connect" / "Looking forward to..." naturally.
No emojis, no corporate jargon, no "Best regards". Match length to content. Writes like talking to a friend he respects.`;
		}

		// Try to load recipient's contact profile for context
		const senderEmailMatch = email.from.match(/<(.+?)>/);
		const senderEmail = senderEmailMatch ? senderEmailMatch[1].toLowerCase() : email.from.toLowerCase();
		let recipientContext = "";
		try {
			const recipientProfile = await ctx.runQuery(internal.profileBuilder.getProfileByEmailInternal, {
				userId: email.userId,
				email: senderEmail,
			});
			if (recipientProfile) {
				recipientContext = `\n\nCONTACT PROFILE for ${recipientProfile.name}:
- Relationship: ${recipientProfile.relationshipSummary}
- Topics you discuss: ${recipientProfile.topics.join(", ")}
- Your communication style with them: ${recipientProfile.communicationStyle}
- Tone: ${recipientProfile.sentiment}
- Key context: ${recipientProfile.keyContext}
- You've sent them ${recipientProfile.emailsSent} emails previously.`;
			}
		} catch {
			// Profile not found, continue without it
		}

		const resp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": ANTHROPIC_API_KEY,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-3-haiku-20240307",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: `${stylePrompt}${recipientContext}

Output ONLY the email body. No subject line, no signature block.

Original email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.slice(0, 2000)}

Draft a reply:`,
					},
				],
			}),
		});

		if (!resp.ok) {
			throw new Error(`Claude API error: ${await resp.text()}`);
		}

		const respData: { content: Array<{ text: string }> } = await resp.json();
		const draft: string = respData.content[0].text.trim();

		// Save the draft
		await ctx.runMutation(internal.google.saveDraftReply, {
			emailId: args.emailId,
			draftReply: draft,
		});

		return { draft };
	},
});

// Internal mutation to save draft reply
export const saveDraftReply = internalMutation({
	args: {
		emailId: v.id("emails"),
		draftReply: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.emailId, {
			draftReply: args.draftReply,
			triageStatus: "draft_ready",
		});
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
				model: "claude-3-haiku-20240307",
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

// ─── Internal action wrappers for cron pipeline ───
// These allow the daily enrichment cron (in profileBuilder) to call sync functions

export const syncGmailInboxInternal = internalAction({
	args: { connectionId: v.id("google_connections") },
	handler: async (ctx, args): Promise<{ newEmails: number }> => {
		const accessToken = await refreshTokenIfNeeded(ctx, args.connectionId);
		const connection = await ctx.runQuery(internal.google.getConnection, {
			connectionId: args.connectionId,
		});
		if (!connection) throw new Error("Connection not found");

		const listResponse = await fetch(
			"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX",
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		if (!listResponse.ok) throw new Error(`Gmail API error: ${await listResponse.text()}`);

		const listData = await listResponse.json();
		const messages = listData.messages || [];
		let newEmailsCount = 0;

		for (const message of messages) {
			const existing = await ctx.runQuery(internal.google.checkEmailExists, {
				gmailMessageId: message.id,
			});
			if (existing) continue;

			const messageResponse = await fetch(
				`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);
			if (!messageResponse.ok) continue;

			const messageData = await messageResponse.json();
			const headers = messageData.payload.headers;
			const subject = headers.find((h: any) => h.name === "Subject")?.value || "(No Subject)";
			const from = headers.find((h: any) => h.name === "From")?.value || "";
			const toHeader = headers.find((h: any) => h.name === "To")?.value || "";
			const to = toHeader.split(",").map((email: string) => email.trim());

			let body = messageData.snippet || "";
			if (messageData.payload.parts) {
				const textPart = messageData.payload.parts.find((part: any) => part.mimeType === "text/plain");
				if (textPart?.body?.data) {
					body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
				}
			} else if (messageData.payload.body?.data) {
				body = atob(messageData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
			}

			const labels = messageData.labelIds || [];
			const receivedAt = Number.parseInt(messageData.internalDate, 10);
			const triageStatus = await triageEmailWithClaude(subject, from, body);

			await ctx.runMutation(internal.google.insertEmail, {
				userId: connection.userId,
				accountEmail: connection.email,
				gmailMessageId: message.id,
				subject, from, to, body,
				threadId: messageData.threadId,
				labels, triageStatus, receivedAt,
			});

			// Extract person
			const senderName = from.split("<")[0].trim().replace(/"/g, "");
			const senderEmailMatch = from.match(/<(.+?)>/);
			const senderEmail = senderEmailMatch ? senderEmailMatch[1] : from;
			if (senderName && senderEmail) {
				try {
					await ctx.runMutation(internal.people.extractPerson, {
						userId: connection.userId,
						name: senderName,
						email: senderEmail.toLowerCase(),
						source: "email",
						sourceDetail: subject,
					});
				} catch (e) {
					console.error("Person extraction error:", e);
				}
				// Real-time profile
				try {
					ctx.scheduler.runAfter(0, internal.profileBuilder.profileNewContact, {
						userId: connection.userId,
						name: senderName,
						email: senderEmail.toLowerCase(),
						source: "email",
						context: `Subject: ${subject}\n${body.slice(0, 200)}`,
					});
				} catch (e) {
					console.error("Profile scheduling error:", e);
				}
			}
			newEmailsCount++;
		}

		await ctx.runMutation(internal.google.updateLastSync, { connectionId: args.connectionId });
		return { newEmails: newEmailsCount };
	},
});

export const syncCalendarInternal = internalAction({
	args: { connectionId: v.id("google_connections") },
	handler: async (ctx, args): Promise<{ newEvents: number }> => {
		const accessToken = await refreshTokenIfNeeded(ctx, args.connectionId);
		const connection = await ctx.runQuery(internal.google.getConnection, {
			connectionId: args.connectionId,
		});
		if (!connection) throw new Error("Connection not found");

		const now = new Date();
		const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		const eventsResponse = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${sevenDaysLater.toISOString()}&singleEvents=true&orderBy=startTime`,
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);
		if (!eventsResponse.ok) throw new Error(`Calendar API error: ${await eventsResponse.text()}`);

		const eventsData = await eventsResponse.json();
		const events = eventsData.items || [];
		let newEventsCount = 0;

		for (const event of events) {
			const existing = await ctx.runQuery(internal.google.checkEventExists, {
				googleEventId: event.id,
			});

			const eventAttendees: string[] = event.attendees?.map((a: any) => a.email) || [];

			if (existing) {
				await ctx.runMutation(internal.google.updateCalendarEvent, {
					eventId: existing._id,
					title: event.summary || "(No Title)",
					description: event.description,
					startTime: new Date(event.start.dateTime || event.start.date).getTime(),
					endTime: new Date(event.end.dateTime || event.end.date).getTime(),
					location: event.location,
					attendees: eventAttendees,
				});
				continue;
			}

			await ctx.runMutation(internal.google.insertCalendarEvent, {
				userId: connection.userId,
				accountEmail: connection.email,
				googleEventId: event.id,
				title: event.summary || "(No Title)",
				description: event.description,
				startTime: new Date(event.start.dateTime || event.start.date).getTime(),
				endTime: new Date(event.end.dateTime || event.end.date).getTime(),
				location: event.location,
				attendees: eventAttendees,
			});

			for (const attendee of (event.attendees || [])) {
				try {
					await ctx.runMutation(internal.people.extractPerson, {
						userId: connection.userId,
						name: attendee.displayName || attendee.email.split("@")[0],
						email: attendee.email.toLowerCase(),
						source: "calendar",
						sourceDetail: event.summary || "(No Title)",
					});
				} catch (e) {
					console.error("Calendar person extraction error:", e);
				}
			}
			newEventsCount++;
		}

		await ctx.runMutation(internal.google.updateLastSync, { connectionId: args.connectionId });
		return { newEvents: newEventsCount };
	},
});
