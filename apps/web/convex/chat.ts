import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

// TODO: Add AI chat action when Anthropic API key is configured
// The action would use ctx.runMutation and ctx.runQuery to store messages
// and call the Claude API for responses
