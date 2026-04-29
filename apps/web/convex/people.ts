import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const contactTypeValidator = v.union(
  v.literal("contact"),
  v.literal("coworker"),
  v.literal("team_member"),
);

const sourceValidator = v.union(
  v.literal("email"),
  v.literal("calendar"),
  v.literal("sms"),
  v.literal("recording"),
  v.literal("chat"),
);

// ─── Contacts CRUD ───

export const list = query({
  args: {
    userId: v.string(),
    type: v.optional(contactTypeValidator),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("contacts")
        .withIndex("by_user_and_type", (q) =>
          q.eq("userId", args.userId).eq("type", args.type!),
        )
        .collect();
    }
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    // Sort by most recently interacted
    return contacts.sort(
      (a, b) => (b.lastInteraction ?? 0) - (a.lastInteraction ?? 0),
    );
  },
});

export const get = query({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
    type: contactTypeValidator,
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    notes: v.optional(v.string()),
    sources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("contacts", {
      ...args,
      lastInteraction: now,
      interactionCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("contacts"),
    name: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
    type: v.optional(contactTypeValidator),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    notes: v.optional(v.string()),
    engineeringManagerId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) filtered[key] = value;
    }
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => ctx.db.delete(args.id),
});

// ─── Designations ───

export const toggleDesignation = mutation({
  args: {
    id: v.id("contacts"),
    designation: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact) throw new Error("Contact not found");
    const current = contact.designations ?? [];
    const idx = current.indexOf(args.designation);
    const updated = idx >= 0
      ? current.filter((d) => d !== args.designation)
      : [...current, args.designation];
    await ctx.db.patch(args.id, {
      designations: updated,
      updatedAt: Date.now(),
    });
    return updated;
  },
});

export const setEngineeringManager = mutation({
  args: {
    id: v.id("contacts"),
    engineeringManagerId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      engineeringManagerId: args.engineeringManagerId,
      updatedAt: Date.now(),
    });
  },
});

export const listByDesignation = query({
  args: {
    userId: v.string(),
    designation: v.string(),
  },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return contacts.filter(
      (c) => c.designations?.includes(args.designation) ?? false,
    );
  },
});

// ─── Pending Contacts ───

export const listPending = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_contacts")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending"),
      )
      .collect();
    return pending.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const pendingCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_contacts")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending"),
      )
      .collect();
    return pending.length;
  },
});

// Approve a pending contact → create new contact
export const approvePending = mutation({
  args: {
    pendingId: v.id("pending_contacts"),
    type: v.optional(contactTypeValidator),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending contact not found");

    const now = Date.now();
    const emails = pending.email ? [pending.email] : [];
    const phones = pending.phone ? [pending.phone] : [];

    const contactId = await ctx.db.insert("contacts", {
      userId: pending.userId,
      name: args.name || pending.name,
      emails,
      phones,
      type: args.type || pending.suggestedType,
      sources: [pending.source],
      lastInteraction: now,
      interactionCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.pendingId, { status: "approved" });
    return contactId;
  },
});

// Merge a pending contact into an existing contact
export const mergePending = mutation({
  args: {
    pendingId: v.id("pending_contacts"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Pending contact not found");

    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    const now = Date.now();
    const emails = [...(contact.emails ?? [])];
    const phones = [...(contact.phones ?? [])];
    const sources = [...(contact.sources ?? [])];

    if (pending.email && !emails.includes(pending.email)) {
      emails.push(pending.email);
    }
    if (pending.phone && !phones.includes(pending.phone)) {
      phones.push(pending.phone);
    }
    if (!sources.includes(pending.source)) {
      sources.push(pending.source);
    }

    await ctx.db.patch(args.contactId, {
      emails,
      phones,
      sources,
      interactionCount: (contact.interactionCount ?? 0) + 1,
      lastInteraction: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.pendingId, { status: "merged" });
  },
});

// Dismiss a pending contact
export const dismissPending = mutation({
  args: { pendingId: v.id("pending_contacts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingId, { status: "dismissed" });
  },
});

// ─── Auto-extraction (called from sync flows) ───

// Mutation: extract person from any source and route to pending/merge
// This is a mutation so it can be called from actions (sync flows)
export const extractPerson = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: sourceValidator,
    sourceDetail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Skip our own email addresses
    const ownEmails = [
      "josh@onflourish.com",
      "josh@church.tech",
      "jburnett@gloo.us",
      "jmgburnett@gmail.com",
      "jbflobot@gmail.com",
    ];
    if (args.email && ownEmails.includes(args.email.toLowerCase())) {
      return "skipped_self";
    }

    // Skip no-reply and system addresses
    if (
      args.email &&
      /no-?reply|mailer-daemon|notifications?@/i.test(args.email)
    ) {
      return "skipped_system";
    }

    // Look for matching contacts
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let match: {
      contactId: (typeof contacts)[0]["_id"];
      reason: string;
      confidence: number;
    } | null = null;

    for (const contact of contacts) {
      // Exact email match → high confidence
      if (args.email && contact.emails?.includes(args.email)) {
        match = {
          contactId: contact._id,
          reason: "Same email address",
          confidence: 0.95,
        };
        break;
      }
      // Exact phone match → high confidence
      if (args.phone && contact.phones?.includes(args.phone)) {
        match = {
          contactId: contact._id,
          reason: "Same phone number",
          confidence: 0.95,
        };
        break;
      }
      // Exact name match
      if (contact.name.toLowerCase() === args.name.toLowerCase()) {
        match = {
          contactId: contact._id,
          reason: "Same name",
          confidence: 0.8,
        };
        break;
      }
      // Partial name match
      const nameParts = args.name.toLowerCase().split(/\s+/);
      const contactParts = contact.name.toLowerCase().split(/\s+/);
      const overlap = nameParts.filter((p) => contactParts.includes(p));
      if (overlap.length > 0 && nameParts.length > 1) {
        match = {
          contactId: contact._id,
          reason: `Shared name: "${overlap.join(" ")}"`,
          confidence: 0.5,
        };
        // Don't break — keep looking for better matches
      }
    }

    // Check if already pending
    const existingPending = await ctx.db
      .query("pending_contacts")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending"),
      )
      .collect();

    for (const p of existingPending) {
      if (args.email && p.email === args.email) return "already_pending";
      if (args.phone && p.phone === args.phone) return "already_pending";
      if (p.name.toLowerCase() === args.name.toLowerCase())
        return "already_pending";
    }

    // High confidence match → auto-merge silently
    if (match && match.confidence >= 0.9) {
      const contact = await ctx.db.get(match.contactId);
      if (contact) {
        const now = Date.now();
        const sources = [...(contact.sources ?? [])];
        if (!sources.includes(args.source)) sources.push(args.source);
        await ctx.db.patch(match.contactId, {
          interactionCount: (contact.interactionCount ?? 0) + 1,
          lastInteraction: now,
          sources,
          updatedAt: now,
        });
      }
      return "auto_merged";
    }

    // Lower confidence match → queue for review
    if (match && match.confidence < 0.9) {
      await ctx.db.insert("pending_contacts", {
        userId: args.userId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        source: args.source,
        sourceDetail: args.sourceDetail,
        suggestedType: inferType(args.email, args.source),
        matchedContactId: match.contactId,
        matchReason: match.reason,
        matchConfidence: match.confidence,
        status: "pending",
        createdAt: Date.now(),
      });
      return "queued_for_review";
    }

    // No match → queue as new pending contact
    await ctx.db.insert("pending_contacts", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      source: args.source,
      sourceDetail: args.sourceDetail,
      suggestedType: inferType(args.email, args.source),
      status: "pending",
      createdAt: Date.now(),
    });
    return "queued_new";
  },
});

// Infer contact type from context
function inferType(
  email: string | undefined,
  source: string,
): "contact" | "coworker" | "team_member" {
  if (email) {
    if (email.endsWith("@gloo.us") || email.endsWith("@gloo.tech"))
      return "coworker";
    if (email.endsWith("@church.tech")) return "team_member";
    if (email.endsWith("@onflourish.com")) return "team_member";
  }
  if (source === "calendar") return "coworker"; // Calendar attendees are often work contacts
  return "contact";
}
