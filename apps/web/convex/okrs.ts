import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

const statusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("archived"),
);
const ragValidator = v.union(
  v.literal("green"),
  v.literal("amber"),
  v.literal("red"),
  v.literal("not_started"),
);
const krStatusValidator = v.union(
  v.literal("on_track"),
  v.literal("at_risk"),
  v.literal("behind"),
  v.literal("completed"),
);

// ─── Objectives ───

export const listObjectives = query({
  args: {
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (args.status) {
      return await ctx.db
        .query("objectives")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("objectives")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getObjective = query({
  args: { id: v.id("objectives") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const createObjective = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("objectives", {
      ...args,
      userId,
      status: "active",
      ragStatus: "not_started",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateObjective = mutation({
  args: {
    id: v.id("objectives"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusValidator),
    ragStatus: v.optional(ragValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
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

export const deleteObjective = mutation({
  args: { id: v.id("objectives") },
  handler: async (ctx, args) => {
    // Also delete all key results
    const krs = await ctx.db
      .query("key_results")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.id))
      .collect();
    for (const kr of krs) {
      await ctx.db.delete(kr._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ─── Key Results ───

export const listKeyResults = query({
  args: { objectiveId: v.id("objectives") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("key_results")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
      .collect();
  },
});

export const createKeyResult = mutation({
  args: {
    objectiveId: v.id("objectives"),
    title: v.string(),
    targetValue: v.number(),
    unit: v.optional(v.string()),
    ownerId: v.optional(v.id("contacts")),
    ownerName: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    return await ctx.db.insert("key_results", {
      ...args,
      userId,
      currentValue: 0,
      status: "on_track",
      updatedAt: Date.now(),
    });
  },
});

export const updateKeyResult = mutation({
  args: {
    id: v.id("key_results"),
    title: v.optional(v.string()),
    currentValue: v.optional(v.number()),
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    status: v.optional(krStatusValidator),
    ownerId: v.optional(v.id("contacts")),
    ownerName: v.optional(v.string()),
    deadline: v.optional(v.number()),
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

export const deleteKeyResult = mutation({
  args: { id: v.id("key_results") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ─── Dashboard aggregate ───

export const getOKRDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    const objectives = await ctx.db
      .query("objectives")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeObjectives = objectives.filter((o) => o.status === "active");

    const objectivesWithKRs = await Promise.all(
      activeObjectives.map(async (obj) => {
        const keyResults = await ctx.db
          .query("key_results")
          .withIndex("by_objective", (q) => q.eq("objectiveId", obj._id))
          .collect();

        const totalProgress =
          keyResults.length > 0
            ? keyResults.reduce((sum, kr) => {
                const pct =
                  kr.targetValue > 0
                    ? (kr.currentValue / kr.targetValue) * 100
                    : 0;
                return sum + Math.min(pct, 100);
              }, 0) / keyResults.length
            : 0;

        return {
          ...obj,
          keyResults,
          progress: Math.round(totalProgress),
        };
      }),
    );

    const overallProgress =
      objectivesWithKRs.length > 0
        ? Math.round(
            objectivesWithKRs.reduce((s, o) => s + o.progress, 0) /
              objectivesWithKRs.length,
          )
        : 0;

    return {
      objectives: objectivesWithKRs,
      totalObjectives: objectives.length,
      activeCount: activeObjectives.length,
      completedCount: objectives.filter((o) => o.status === "completed").length,
      overallProgress,
      ragBreakdown: {
        green: activeObjectives.filter((o) => o.ragStatus === "green").length,
        amber: activeObjectives.filter((o) => o.ragStatus === "amber").length,
        red: activeObjectives.filter((o) => o.ragStatus === "red").length,
        not_started: activeObjectives.filter(
          (o) => o.ragStatus === "not_started",
        ).length,
      },
    };
  },
});
