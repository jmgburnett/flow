import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthenticatedUserId } from "./lib/auth";

// ─── Conversations ───

// Create a new conversation
export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    return await ctx.db.insert("chat_conversations", {
      userId,
      title: args.title ?? "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// List conversations for a user (most recent first)
export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const limit = args.limit ?? 30;
    const conversations = await ctx.db
      .query("chat_conversations")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return conversations;
  },
});

// Update conversation title
export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("chat_conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, { title: args.title });
  },
});

// Delete a conversation and its messages
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("chat_conversations"),
  },
  handler: async (ctx, args) => {
    // Delete all messages in conversation
    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);
  },
});

// ─── Messages ───

// Store a chat message (with optional conversationId)
export const sendMessage = mutation({
  args: {
    conversationId: v.optional(v.id("chat_conversations")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const msgId = await ctx.db.insert("chat_messages", {
      userId,
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    });

    // Update conversation timestamp
    if (args.conversationId) {
      await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });
    }

    return msgId;
  },
});

// Get messages for a specific conversation
export const getMessages = query({
  args: {
    conversationId: v.optional(v.id("chat_conversations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const limit = args.limit ?? 50;

    if (args.conversationId) {
      const messages = await ctx.db
        .query("chat_messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId),
        )
        .order("desc")
        .take(limit);
      return messages.reverse();
    }

    // Fallback: get messages without a conversationId (legacy)
    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});

// ─── Process Message ───

export const processMessage = action({
  args: {
    conversationId: v.optional(v.id("chat_conversations")),
    message: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ response: string; conversationId: string }> => {
    const userId = await getAuthenticatedUserId(ctx);
    let conversationId = args.conversationId;

    // Create conversation if none provided
    if (!conversationId) {
      conversationId = await ctx.runMutation(api.chat.createConversation, {
        title:
          args.message.slice(0, 60) + (args.message.length > 60 ? "..." : ""),
      });
    }

    // Store user message
    await ctx.runMutation(api.chat.sendMessage, {
      conversationId,
      role: "user",
      content: args.message,
    });

    // Get conversation history
    const recentMessages = await ctx.runQuery(api.chat.getMessages, {
      conversationId,
      limit: 20,
    });

    // Build history (exclude the just-stored user message)
    const history = recentMessages.slice(0, -1).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Call AI agent
    const response = await ctx.runAction(api.chatAgent.chat, {
      message: args.message,
      conversationHistory: history,
    });

    // Store assistant response
    await ctx.runMutation(api.chat.sendMessage, {
      conversationId,
      role: "assistant",
      content: response,
    });

    return { response, conversationId: conversationId as string };
  },
});
