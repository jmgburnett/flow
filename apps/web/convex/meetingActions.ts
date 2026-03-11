import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const statusValidator = v.union(
	v.literal("pending_review"),
	v.literal("confirmed"),
	v.literal("dismissed"),
	v.literal("converted_to_task"),
);

// List meeting actions for a user
export const listMeetingActions = query({
	args: {
		userId: v.string(),
		status: v.optional(statusValidator),
	},
	handler: async (ctx, args) => {
		const all = await ctx.db
			.query("meeting_actions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		const filtered = args.status ? all.filter((a) => a.status === args.status) : all;
		return filtered.sort((a, b) => b.createdAt - a.createdAt);
	},
});

// List actions by recording
export const listByRecording = query({
	args: { recordingId: v.id("recordings") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("meeting_actions")
			.withIndex("by_recording", (q) => q.eq("recordingId", args.recordingId))
			.collect();
	},
});

// Create a meeting action (for manual or AI-extracted)
export const createMeetingAction = mutation({
	args: {
		userId: v.string(),
		recordingId: v.optional(v.id("recordings")),
		sourceText: v.optional(v.string()),
		action: v.string(),
		assigneeId: v.optional(v.id("contacts")),
		assigneeName: v.optional(v.string()),
		suggestedAssigneeId: v.optional(v.id("contacts")),
		suggestedReason: v.optional(v.string()),
		dueDate: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("meeting_actions", {
			...args,
			status: "pending_review",
			createdAt: Date.now(),
		});
	},
});

// Confirm an action with optional reassignment
export const confirmAction = mutation({
	args: {
		id: v.id("meeting_actions"),
		assigneeId: v.optional(v.id("contacts")),
		assigneeName: v.optional(v.string()),
		dueDate: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args;
		const patch: Record<string, unknown> = { status: "confirmed" };
		if (updates.assigneeId !== undefined) patch.assigneeId = updates.assigneeId;
		if (updates.assigneeName !== undefined) patch.assigneeName = updates.assigneeName;
		if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
		await ctx.db.patch(id, patch);
	},
});

// Dismiss an action
export const dismissAction = mutation({
	args: { id: v.id("meeting_actions") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, { status: "dismissed" });
	},
});

// Convert to task
export const convertToTask = mutation({
	args: {
		id: v.id("meeting_actions"),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const action = await ctx.db.get(args.id);
		if (!action) throw new Error("Meeting action not found");

		// Create task
		const taskId = await ctx.db.insert("tasks", {
			userId: args.userId,
			title: action.action,
			description: action.sourceText ? `From meeting transcript: "${action.sourceText}"` : undefined,
			source: "recording" as const,
			sourceId: action.recordingId,
			priority: "medium" as const,
			status: "todo" as const,
			dueDate: action.dueDate,
		});

		// Update meeting action
		await ctx.db.patch(args.id, {
			status: "converted_to_task",
			taskId,
		});

		return taskId;
	},
});

// Batch create actions (used by AI extraction)
export const batchCreateActions = mutation({
	args: {
		userId: v.string(),
		recordingId: v.optional(v.id("recordings")),
		actions: v.array(v.object({
			action: v.string(),
			sourceText: v.optional(v.string()),
			suggestedAssigneeId: v.optional(v.id("contacts")),
			suggestedAssigneeName: v.optional(v.string()),
			suggestedReason: v.optional(v.string()),
			dueDate: v.optional(v.number()),
		})),
	},
	handler: async (ctx, args) => {
		const ids = [];
		for (const item of args.actions) {
			const id = await ctx.db.insert("meeting_actions", {
				userId: args.userId,
				recordingId: args.recordingId,
				action: item.action,
				sourceText: item.sourceText,
				suggestedAssigneeId: item.suggestedAssigneeId,
				assigneeName: item.suggestedAssigneeName,
				suggestedReason: item.suggestedReason,
				dueDate: item.dueDate,
				status: "pending_review",
				createdAt: Date.now(),
			});
			ids.push(id);
		}
		return ids;
	},
});

// Get action counts by status
export const getActionCounts = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const all = await ctx.db
			.query("meeting_actions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		return {
			pending: all.filter((a) => a.status === "pending_review").length,
			confirmed: all.filter((a) => a.status === "confirmed").length,
			dismissed: all.filter((a) => a.status === "dismissed").length,
			converted: all.filter((a) => a.status === "converted_to_task").length,
			total: all.length,
		};
	},
});
