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
		email: v.optional(v.string()),
		phone: v.optional(v.string()),
		lastInteraction: v.optional(v.number()),
		notes: v.optional(v.string()),
	}).index("by_user", ["userId"])
		.index("by_user_and_email", ["userId", "email"]),

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
