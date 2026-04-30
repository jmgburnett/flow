import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// ─── Conversations ───

// Create a new conversation
export const createConversation = mutation({
  args: {
    userId: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chat_conversations", {
      userId: args.userId,
      title: args.title ?? "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// List conversations for a user (most recent first)
export const listConversations = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const conversations = await ctx.db
      .query("chat_conversations")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", args.userId))
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
    userId: v.string(),
    conversationId: v.optional(v.id("chat_conversations")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const msgId = await ctx.db.insert("chat_messages", {
      userId: args.userId,
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
    userId: v.string(),
    conversationId: v.optional(v.id("chat_conversations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});

// Update message content (for streaming)
export const updateMessageContent = mutation({
  args: {
    messageId: v.id("chat_messages"),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      ...(args.isStreaming !== undefined ? { isStreaming: args.isStreaming } : {}),
    });
  },
});

// ─── Process Message ───

export const processMessage = action({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.id("chat_conversations")),
    message: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ response: string; conversationId: string }> => {
    let conversationId = args.conversationId;

    // Create conversation if none provided
    if (!conversationId) {
      conversationId = await ctx.runMutation(api.chat.createConversation, {
        userId: args.userId,
        title:
          args.message.slice(0, 60) + (args.message.length > 60 ? "..." : ""),
      });
    }

    // Store user message
    await ctx.runMutation(api.chat.sendMessage, {
      userId: args.userId,
      conversationId,
      role: "user",
      content: args.message,
    });

    // Get conversation history
    const recentMessages = await ctx.runQuery(api.chat.getMessages, {
      userId: args.userId,
      conversationId,
      limit: 20,
    });

    // Build history (exclude the just-stored user message)
    const history = recentMessages.slice(0, -1).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Create placeholder assistant message for streaming
    const assistantMsgId = await ctx.runMutation(api.chat.sendMessage, {
      userId: args.userId,
      conversationId,
      role: "assistant",
      content: "",
    });

    // Mark as streaming
    await ctx.runMutation(api.chat.updateMessageContent, {
      messageId: assistantMsgId,
      content: "",
      isStreaming: true,
    });

    // Call AI agent with streaming
    const response = await ctx.runAction(api.chatAgent.chatStreaming, {
      userId: args.userId,
      message: args.message,
      conversationHistory: history,
      messageId: assistantMsgId,
    });

    // Final update — mark streaming complete
    await ctx.runMutation(api.chat.updateMessageContent, {
      messageId: assistantMsgId,
      content: response,
      isStreaming: false,
    });

    return { response, conversationId: conversationId as string };
  },
});
