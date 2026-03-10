import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const categoryValidator = v.union(
	v.literal("personal"),
	v.literal("project"),
	v.literal("meeting"),
	v.literal("idea"),
	v.literal("other"),
);

// List memories for a user, optionally filtered by category
export const list = query({
	args: {
		userId: v.string(),
		category: v.optional(categoryValidator),
	},
	handler: async (ctx, args) => {
		let memories;
		if (args.category) {
			memories = await ctx.db
				.query("memories")
				.withIndex("by_user_and_category", (q) =>
					q.eq("userId", args.userId).eq("category", args.category!),
				)
				.collect();
		} else {
			memories = await ctx.db
				.query("memories")
				.withIndex("by_user", (q) => q.eq("userId", args.userId))
				.collect();
		}

		// Sort: pinned first, then by updatedAt desc
		return memories.sort((a, b) => {
			if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
			return b.updatedAt - a.updatedAt;
		});
	},
});

// Get a single memory by ID
export const get = query({
	args: { id: v.id("memories") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

// Create a new memory
export const create = mutation({
	args: {
		userId: v.string(),
		title: v.string(),
		content: v.string(),
		category: categoryValidator,
		tags: v.optional(v.array(v.string())),
		pinned: v.optional(v.boolean()),
		source: v.optional(
			v.union(
				v.literal("manual"),
				v.literal("ai"),
				v.literal("email"),
				v.literal("recording"),
			),
		),
		sourceId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("memories", {
			userId: args.userId,
			title: args.title,
			content: args.content,
			category: args.category,
			tags: args.tags ?? [],
			pinned: args.pinned ?? false,
			source: args.source ?? "manual",
			sourceId: args.sourceId,
			createdAt: now,
			updatedAt: now,
		});
	},
});

// Update a memory
export const update = mutation({
	args: {
		id: v.id("memories"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		category: v.optional(categoryValidator),
		tags: v.optional(v.array(v.string())),
		pinned: v.optional(v.boolean()),
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

// Delete a memory
export const remove = mutation({
	args: { id: v.id("memories") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
	},
});

// Toggle pin status
export const togglePin = mutation({
	args: { id: v.id("memories") },
	handler: async (ctx, args) => {
		const memory = await ctx.db.get(args.id);
		if (!memory) throw new Error("Memory not found");
		await ctx.db.patch(args.id, {
			pinned: !memory.pinned,
			updatedAt: Date.now(),
		});
	},
});
