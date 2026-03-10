import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Auth tables (users, sessions, accounts, verifications) are managed
// by the Better Auth component in convex/betterAuth/.
// Add your app-specific tables here.
export default defineSchema({
	// Google OAuth connections
	google_connections: defineTable({
		userId: v.string(),
		email: v.string(),
		accessToken: v.string(),
		refreshToken: v.string(),
		tokenExpiry: v.number(),
		scopes: v.array(v.string()),
		connectedAt: v.number(),
		lastSyncAt: v.optional(v.number()),
	}).index("by_user", ["userId"])
		.index("by_email", ["email"]),

	// Email management
	emails: defineTable({
		userId: v.string(),
		accountEmail: v.string(), // Which Google account this email came from
		gmailMessageId: v.string(), // Gmail's unique message ID
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
		draftReply: v.optional(v.string()),
		receivedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_triage", ["userId", "triageStatus"])
		.index("by_thread", ["threadId"])
		.index("by_account_email", ["accountEmail"])
		.index("by_gmail_message_id", ["gmailMessageId"]),

	// Calendar management
	calendar_events: defineTable({
		userId: v.string(),
		accountEmail: v.string(), // Which Google account this event came from
		googleEventId: v.string(), // Google Calendar's unique event ID
		title: v.string(),
		description: v.optional(v.string()),
		startTime: v.number(),
		endTime: v.number(),
		location: v.optional(v.string()),
		attendees: v.optional(v.array(v.string())),
		prepNotes: v.optional(v.string()),
	}).index("by_user", ["userId"])
		.index("by_user_and_time", ["userId", "startTime"])
		.index("by_account_email", ["accountEmail"])
		.index("by_google_event_id", ["googleEventId"]),

	// Recording management
	recordings: defineTable({
		userId: v.string(),
		title: v.string(),
		fileId: v.optional(v.id("_storage")),
		duration: v.optional(v.number()),
		status: v.union(
			v.literal("uploading"),
			v.literal("transcribing"),
			v.literal("ready"),
			v.literal("error"),
		),
		transcriptText: v.optional(v.string()),
		summary: v.optional(v.string()),
		actionItems: v.optional(v.array(v.string())),
		uploadedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"]),

	// Task management
	tasks: defineTable({
		userId: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		source: v.union(
			v.literal("email"),
			v.literal("recording"),
			v.literal("manual"),
			v.literal("chat"),
		),
		sourceId: v.optional(v.string()),
		priority: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
			v.literal("urgent"),
		),
		status: v.union(
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("waiting"),
			v.literal("done"),
		),
		dueDate: v.optional(v.number()),
	}).index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"])
		.index("by_user_and_priority", ["userId", "priority"]),

	// Contact management
	contacts: defineTable({
		userId: v.string(),
		name: v.string(),
		emails: v.optional(v.array(v.string())),
		phones: v.optional(v.array(v.string())),
		type: v.union(
			v.literal("contact"),
			v.literal("coworker"),
			v.literal("team_member"),
		),
		company: v.optional(v.string()),
		role: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
		lastInteraction: v.optional(v.number()),
		interactionCount: v.optional(v.number()),
		notes: v.optional(v.string()),
		sources: v.optional(v.array(v.string())), // e.g. ["email", "calendar", "sms"]
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_type", ["userId", "type"])
		.index("by_user_and_name", ["userId", "name"]),

	// Pending contacts — awaiting user verification before merge or create
	pending_contacts: defineTable({
		userId: v.string(),
		name: v.string(),
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		source: v.union(
			v.literal("email"),
			v.literal("calendar"),
			v.literal("sms"),
			v.literal("recording"),
			v.literal("chat"),
		),
		sourceDetail: v.optional(v.string()), // e.g. email subject, event title
		suggestedType: v.union(
			v.literal("contact"),
			v.literal("coworker"),
			v.literal("team_member"),
		),
		// If we think this matches an existing contact
		matchedContactId: v.optional(v.id("contacts")),
		matchReason: v.optional(v.string()), // e.g. "Same email", "Similar name"
		matchConfidence: v.optional(v.number()), // 0-1
		status: v.union(
			v.literal("pending"),
			v.literal("approved"),
			v.literal("merged"),
			v.literal("dismissed"),
		),
		createdAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_status", ["userId", "status"])
		.index("by_email", ["email"]),

	// Chat with Flobot
	chat_messages: defineTable({
		userId: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		timestamp: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_timestamp", ["userId", "timestamp"]),

	// Daily briefs
	daily_briefs: defineTable({
		userId: v.string(),
		date: v.string(), // YYYY-MM-DD format
		content: v.string(),
		generatedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_date", ["userId", "date"]),

	// SMS Messages
	sms_messages: defineTable({
		userId: v.string(),
		direction: v.union(v.literal("inbound"), v.literal("outbound")),
		from: v.string(), // Phone number
		to: v.string(), // Phone number
		body: v.string(),
		timestamp: v.number(),
		read: v.boolean(),
		contactName: v.optional(v.string()),
	}).index("by_user", ["userId"])
		.index("by_user_and_timestamp", ["userId", "timestamp"])
		.index("by_from", ["from"])
		.index("by_to", ["to"]),

	// Memory / Notes
	memories: defineTable({
		userId: v.string(),
		title: v.string(),
		content: v.string(),
		category: v.union(
			v.literal("personal"),
			v.literal("project"),
			v.literal("meeting"),
			v.literal("idea"),
			v.literal("other"),
		),
		tags: v.optional(v.array(v.string())),
		pinned: v.boolean(),
		source: v.union(
			v.literal("manual"),
			v.literal("ai"),
			v.literal("email"),
			v.literal("recording"),
		),
		sourceId: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_category", ["userId", "category"])
		.index("by_user_and_pinned", ["userId", "pinned"]),

	// Slack connections
	slack_connections: defineTable({
		userId: v.string(),
		teamId: v.string(),
		teamName: v.string(),
		botToken: v.string(),
		userToken: v.string(),
		slackUserId: v.string(),
		slackUserName: v.string(),
		scopes: v.array(v.string()),
		connectedAt: v.number(),
		lastSyncAt: v.optional(v.number()),
	}).index("by_user", ["userId"])
		.index("by_team", ["teamId"]),

	// Slack messages (DMs, mentions, unreplied)
	slack_messages: defineTable({
		userId: v.string(),
		teamId: v.string(),
		channelId: v.string(),
		channelName: v.optional(v.string()),
		channelType: v.union(
			v.literal("dm"),
			v.literal("channel"),
			v.literal("group"),
			v.literal("mpim"),
		),
		messageTs: v.string(), // Slack message timestamp (unique ID)
		threadTs: v.optional(v.string()),
		senderSlackId: v.string(),
		senderName: v.string(),
		text: v.string(),
		isReply: v.boolean(),
		isMention: v.boolean(),
		needsResponse: v.boolean(),
		respondedAt: v.optional(v.number()),
		receivedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_needs_response", ["userId", "needsResponse"])
		.index("by_message_ts", ["messageTs"])
		.index("by_channel", ["channelId"]),

	// Contact profiles — AI-generated rich profiles from all communication sources
	contact_profiles: defineTable({
		userId: v.string(),
		contactId: v.optional(v.id("contacts")), // linked contact, if matched
		email: v.string(), // primary email (lookup key)
		name: v.string(),
		// AI-generated profile
		relationshipSummary: v.string(), // "Colleague at Gloo, works on platform engineering..."
		topics: v.array(v.string()), // ["AI product", "church planting", "API integrations"]
		communicationStyle: v.string(), // "Formal, detail-oriented, prefers bullet points"
		sentiment: v.string(), // "warm", "professional", "casual", "formal"
		keyContext: v.string(), // important context for AI to know when drafting
		recentInteractions: v.array(v.object({
			date: v.number(),
			type: v.string(), // "email_sent", "email_received", "calendar", "sms", "slack"
			summary: v.string(),
		})),
		// Metadata
		emailsSent: v.number(), // count of emails Josh sent to this person
		emailsReceived: v.number(), // count of emails received from this person
		lastInteractionDate: v.optional(v.number()),
		sources: v.array(v.string()), // ["email", "calendar", "sms", "slack"]
		// Calendar enrichment
		sharedMeetings: v.optional(v.number()),
		meetingTopics: v.optional(v.array(v.string())),
		// Filtration
		isReal: v.optional(v.boolean()), // true = real person, false = marketing/automated
		filterReason: v.optional(v.string()), // why it was filtered out
		// Raw data for re-processing
		rawEmailSamples: v.optional(v.string()), // JSON: sample email snippets used to build profile
		builtAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"])
		.index("by_email", ["email"])
		.index("by_contact", ["contactId"])
		.index("by_user_and_email", ["userId", "email"])
		.index("by_user_and_real", ["userId", "isReal"]),

	// Profile build progress tracking
	profile_builds: defineTable({
		userId: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("scanning"),
			v.literal("building"),
			v.literal("complete"),
			v.literal("error"),
		),
		progress: v.number(), // 0-100
		message: v.optional(v.string()),
		totalRecipients: v.optional(v.number()),
		profilesBuilt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	// Email style profiles
	style_profiles: defineTable({
		userId: v.string(),
		profile: v.string(), // JSON of full analysis
		prompt: v.string(), // AI drafting prompt
		emailsAnalyzed: v.number(),
		accountsAnalyzed: v.array(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	// Style analysis progress tracking
	style_analyses: defineTable({
		userId: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("fetching"),
			v.literal("analyzing"),
			v.literal("complete"),
			v.literal("error"),
		),
		progress: v.number(),
		message: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	// SMS Conversations
	sms_conversations: defineTable({
		userId: v.string(),
		phoneNumber: v.string(),
		contactName: v.optional(v.string()),
		lastMessage: v.string(),
		lastMessageAt: v.number(),
		unreadCount: v.number(),
	}).index("by_user", ["userId"])
		.index("by_user_and_last_message", ["userId", "lastMessageAt"])
		.index("by_phone_number", ["phoneNumber"]),
});
