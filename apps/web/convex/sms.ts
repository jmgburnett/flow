import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";

const TELNYX_FROM = "+16156408799";

// List all SMS conversations for a user, sorted by most recent
export const listConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sms_conversations")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get all messages for a specific conversation (phone number)
export const getMessages = query({
  args: {
    userId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("sms_messages")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", args.userId))
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

// Get unread count across all conversations
export const unreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const convos = await ctx.db
      .query("sms_conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return convos.reduce((sum, c) => sum + c.unreadCount, 0);
  },
});

// Send SMS via Telnyx API + store in Convex
export const sendSMS = action({
  args: {
    userId: v.string(),
    to: v.string(),
    body: v.string(),
    contactName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; messageId?: string }> => {
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
    if (!TELNYX_API_KEY) throw new Error("TELNYX_API_KEY not configured");

    // Send via Telnyx
    const resp = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: TELNYX_FROM,
        to: args.to,
        text: args.body,
        messaging_profile_id: "40019cca-23bf-45ae-915e-29f994a75030",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Telnyx send failed:", err);
      throw new Error(`SMS send failed: ${err.substring(0, 200)}`);
    }

    // Store in Convex
    await ctx.runMutation(internal.sms.storeMessage, {
      userId: args.userId,
      direction: "outbound",
      from: TELNYX_FROM,
      to: args.to,
      body: args.body,
      contactName: args.contactName,
    });

    return { success: true };
  },
});

// Internal mutation to store a message and update conversation
export const storeMessage = internalMutation({
  args: {
    userId: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    from: v.string(),
    to: v.string(),
    body: v.string(),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const isInbound = args.direction === "inbound";
    const contactPhone = isInbound ? args.from : args.to;

    // Store message
    await ctx.db.insert("sms_messages", {
      userId: args.userId,
      direction: args.direction,
      from: args.from,
      to: args.to,
      body: args.body,
      timestamp,
      read: !isInbound,
      contactName: args.contactName,
    });

    // Update or create conversation
    const existing = await ctx.db
      .query("sms_conversations")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", contactPhone))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastMessage: args.body,
        lastMessageAt: timestamp,
        ...(isInbound ? { unreadCount: existing.unreadCount + 1 } : {}),
        ...(args.contactName ? { contactName: args.contactName } : {}),
      });
    } else {
      await ctx.db.insert("sms_conversations", {
        userId: args.userId,
        phoneNumber: contactPhone,
        contactName: args.contactName,
        lastMessage: args.body,
        lastMessageAt: timestamp,
        unreadCount: isInbound ? 1 : 0,
      });
    }
  },
});

// Public mutation for webhook to call (inbound SMS)
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
    const contactPhone = args.from;

    await ctx.db.insert("sms_messages", {
      userId: args.userId,
      direction: "inbound",
      from: args.from,
      to: args.to,
      body: args.body,
      timestamp,
      read: false,
      contactName: args.contactName,
    });

    const existing = await ctx.db
      .query("sms_conversations")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", contactPhone))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastMessage: args.body,
        lastMessageAt: timestamp,
        unreadCount: existing.unreadCount + 1,
        ...(args.contactName ? { contactName: args.contactName } : {}),
      });
    } else {
      await ctx.db.insert("sms_conversations", {
        userId: args.userId,
        phoneNumber: contactPhone,
        contactName: args.contactName,
        lastMessage: args.body,
        lastMessageAt: timestamp,
        unreadCount: 1,
      });

      // New SMS contact — schedule real-time profile building
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.profileBuilder.profileNewContact,
          {
            userId: args.userId,
            name: args.contactName || contactPhone,
            phone: contactPhone,
            source: "sms" as const,
            context: args.body.slice(0, 200),
          },
        );
      } catch (e) {
        console.error("SMS profile scheduling error:", e);
      }
    }
  },
});

// Mark a conversation as read
export const markRead = mutation({
  args: {
    userId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("sms_conversations")
      .withIndex("by_phone_number", (q) =>
        q.eq("phoneNumber", args.phoneNumber),
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (conversation) {
      await ctx.db.patch(conversation._id, { unreadCount: 0 });
    }

    // Mark all messages from this number as read
    const unread = await ctx.db
      .query("sms_messages")
      .withIndex("by_from", (q) => q.eq("from", args.phoneNumber))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("read"), false),
        ),
      )
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { read: true });
    }
  },
});
