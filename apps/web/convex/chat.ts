import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Store a chat message
export const sendMessage = mutation({
	args: {
		userId: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("chat_messages", {
			userId: args.userId,
			role: args.role,
			content: args.content,
			timestamp: Date.now(),
		});
	},
});

// Get recent chat messages for a user
export const getMessages = query({
	args: {
		userId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;
		const messages = await ctx.db
			.query("chat_messages")
			.withIndex("by_user_and_timestamp", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(limit);

		return messages.reverse();
	},
});

// Process a user message: store it, call AI, store response, return it
export const processMessage = action({
	args: {
		userId: v.string(),
		message: v.string(),
	},
	handler: async (ctx, args): Promise<string> => {
		// Store user message
		await ctx.runMutation(api.chat.sendMessage, {
			userId: args.userId,
			role: "user",
			content: args.message,
		});

		// Get recent conversation history for context
		const recentMessages = await ctx.runQuery(api.chat.getMessages, {
			userId: args.userId,
			limit: 20,
		});

		// Build conversation history (exclude the message we just stored — it's the current input)
		const history = recentMessages
			.slice(0, -1) // exclude the just-stored user message
			.map((msg) => ({
				role: msg.role as "user" | "assistant",
				content: msg.content,
			}));

		// Call the AI agent
		const response = await ctx.runAction(api.chatAgent.chat, {
			userId: args.userId,
			message: args.message,
			conversationHistory: history,
		});

		// Store assistant response
		await ctx.runMutation(api.chat.sendMessage, {
			userId: args.userId,
			role: "assistant",
			content: response,
		});

		return response;
	},
});
