import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all SMS conversations for a user, sorted by most recent
export const listConversations = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversations = await ctx.db
			.query("sms_conversations")
			.withIndex("by_user_and_last_message", (q) =>
				q.eq("userId", args.userId),
			)
			.order("desc")
			.collect();

		return conversations;
	},
});

// Get all messages for a specific conversation (phone number)
export const getMessages = query({
	args: {
		userId: v.string(),
		phoneNumber: v.string(),
	},
	handler: async (ctx, args) => {
		// Get messages where either from or to matches the phone number
		const messages = await ctx.db
			.query("sms_messages")
			.withIndex("by_user_and_timestamp", (q) =>
				q.eq("userId", args.userId),
			)
			.filter((q) =>
				q.or(
					q.eq(q.field("from"), args.phoneNumber),
					q.eq(q.field("to"), args.phoneNumber),
				),
			)
			.order("asc")
			.collect();

		return messages;
	},
});

// Send an outbound SMS message
export const sendMessage = mutation({
	args: {
		userId: v.string(),
		to: v.string(),
		body: v.string(),
		from: v.string(), // Josh's Telnyx number
		contactName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const timestamp = Date.now();

		// Store the message
		const messageId = await ctx.db.insert("sms_messages", {
			userId: args.userId,
			direction: "outbound",
			from: args.from,
			to: args.to,
			body: args.body,
			timestamp,
			read: true, // Outbound messages are always "read"
			contactName: args.contactName,
		});

		// Update or create the conversation
		const existingConversation = await ctx.db
			.query("sms_conversations")
			.withIndex("by_phone_number", (q) =>
				q.eq("phoneNumber", args.to),
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.first();

		if (existingConversation) {
			await ctx.db.patch(existingConversation._id, {
				lastMessage: args.body,
				lastMessageAt: timestamp,
				// Don't change unreadCount for outbound messages
			});
		} else {
			await ctx.db.insert("sms_conversations", {
				userId: args.userId,
				phoneNumber: args.to,
				contactName: args.contactName,
				lastMessage: args.body,
				lastMessageAt: timestamp,
				unreadCount: 0,
			});
		}

		return messageId;
	},
});

// Receive an inbound SMS message (called by webhook)
export const receiveMessage = mutation({
	args: {
		userId: v.string(),
		from: v.string(),
		to: v.string(),
		body: v.string(),
		contactName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const timestamp = Date.now();

		// Store the message
		const messageId = await ctx.db.insert("sms_messages", {
			userId: args.userId,
			direction: "inbound",
			from: args.from,
			to: args.to,
			body: args.body,
			timestamp,
			read: false,
			contactName: args.contactName,
		});

		// Update or create the conversation
		const existingConversation = await ctx.db
			.query("sms_conversations")
			.withIndex("by_phone_number", (q) =>
				q.eq("phoneNumber", args.from),
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.first();

		if (existingConversation) {
			await ctx.db.patch(existingConversation._id, {
				lastMessage: args.body,
				lastMessageAt: timestamp,
				unreadCount: existingConversation.unreadCount + 1,
			});
		} else {
			await ctx.db.insert("sms_conversations", {
				userId: args.userId,
				phoneNumber: args.from,
				contactName: args.contactName,
				lastMessage: args.body,
				lastMessageAt: timestamp,
				unreadCount: 1,
			});
		}

		return messageId;
	},
});

// Mark a conversation as read
export const markRead = mutation({
	args: {
		userId: v.string(),
		phoneNumber: v.string(),
	},
	handler: async (ctx, args) => {
		// Find the conversation
		const conversation = await ctx.db
			.query("sms_conversations")
			.withIndex("by_phone_number", (q) =>
				q.eq("phoneNumber", args.phoneNumber),
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.first();

		if (!conversation) {
			return;
		}

		// Mark the conversation as read
		await ctx.db.patch(conversation._id, {
			unreadCount: 0,
		});

		// Mark all messages from this number as read
		const messages = await ctx.db
			.query("sms_messages")
			.withIndex("by_from", (q) =>
				q.eq("from", args.phoneNumber),
			)
			.filter((q) =>
				q.and(
					q.eq(q.field("userId"), args.userId),
					q.eq(q.field("read"), false),
				),
			)
			.collect();

		for (const message of messages) {
			await ctx.db.patch(message._id, { read: true });
		}
	},
});

// Seed some example conversations for development
export const seedExampleConversations = mutation({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const oneHourAgo = now - 60 * 60 * 1000;
		const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
		const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

		// Sarah Burnett conversation
		const sarahPhone = "+17036597403";
		await ctx.db.insert("sms_conversations", {
			userId: args.userId,
			phoneNumber: sarahPhone,
			contactName: "Sarah Burnett",
			lastMessage: "Hey, can you pick up milk on the way home?",
			lastMessageAt: oneHourAgo,
			unreadCount: 1,
		});
		await ctx.db.insert("sms_messages", {
			userId: args.userId,
			direction: "inbound",
			from: sarahPhone,
			to: "+16156408799",
			body: "Hey, can you pick up milk on the way home?",
			timestamp: oneHourAgo,
			read: false,
			contactName: "Sarah Burnett",
		});

		// Savannah conversation
		const savannahPhone = "+14102991873";
		await ctx.db.insert("sms_conversations", {
			userId: args.userId,
			phoneNumber: savannahPhone,
			contactName: "Savannah",
			lastMessage: "Dad, what time is dinner?",
			lastMessageAt: twoDaysAgo,
			unreadCount: 1,
		});
		await ctx.db.insert("sms_messages", {
			userId: args.userId,
			direction: "inbound",
			from: savannahPhone,
			to: "+16156408799",
			body: "Dad, what time is dinner?",
			timestamp: twoDaysAgo,
			read: false,
			contactName: "Savannah",
		});

		// Doug Foltz conversation
		const dougPhone = "+15551234567"; // Placeholder since we don't have his real number
		await ctx.db.insert("sms_conversations", {
			userId: args.userId,
			phoneNumber: dougPhone,
			contactName: "Doug Foltz",
			lastMessage: "Call me when you get a chance about the church planter launch",
			lastMessageAt: threeDaysAgo,
			unreadCount: 0,
		});
		await ctx.db.insert("sms_messages", {
			userId: args.userId,
			direction: "inbound",
			from: dougPhone,
			to: "+16156408799",
			body: "Call me when you get a chance about the church planter launch",
			timestamp: threeDaysAgo,
			read: true,
			contactName: "Doug Foltz",
		});

		return { success: true };
	},
});
