import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

const categoryValidator = v.union(
  v.literal("leadership"),
  v.literal("communication"),
  v.literal("strategic"),
  v.literal("technical"),
  v.literal("interpersonal"),
  v.literal("custom"),
);

// List all skills, optionally filtered by category
export const listSkills = query({
  args: {
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    if (args.category) {
      return await ctx.db
        .query("skills")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    }
    return await ctx.db.query("skills").collect();
  },
});

// Full-text search for skills
export const searchSkills = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return await ctx.db.query("skills").collect();
    }
    return await ctx.db
      .query("skills")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .collect();
  },
});

// Create a custom skill
export const createSkill = mutation({
  args: {
    name: v.string(),
    category: categoryValidator,
    description: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("skills", args);
  },
});

// Seed default skills
export const seedDefaultSkills = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if skills already exist
    const existing = await ctx.db.query("skills").first();
    if (existing) return { seeded: false, message: "Skills already exist" };

    const defaults: Array<{
      name: string;
      category:
        | "leadership"
        | "communication"
        | "strategic"
        | "technical"
        | "interpersonal";
      description: string;
    }> = [
      // Leadership
      {
        name: "Team Management",
        category: "leadership",
        description:
          "Ability to lead, motivate, and develop team members toward shared goals",
      },
      {
        name: "Decision Making",
        category: "leadership",
        description:
          "Making sound decisions under uncertainty with appropriate stakeholder input",
      },
      {
        name: "Vision Casting",
        category: "leadership",
        description:
          "Articulating a compelling future state that inspires action",
      },
      {
        name: "Delegation",
        category: "leadership",
        description:
          "Effectively distributing work and authority across team members",
      },
      {
        name: "Change Management",
        category: "leadership",
        description:
          "Leading organizations through transitions and transformations",
      },
      {
        name: "Coaching & Mentoring",
        category: "leadership",
        description:
          "Developing others through guidance, feedback, and growth opportunities",
      },
      // Communication
      {
        name: "Public Speaking",
        category: "communication",
        description:
          "Delivering compelling presentations to audiences of all sizes",
      },
      {
        name: "Written Communication",
        category: "communication",
        description:
          "Clear, persuasive writing across emails, docs, and proposals",
      },
      {
        name: "Active Listening",
        category: "communication",
        description:
          "Fully engaging with speakers to understand their perspective",
      },
      {
        name: "Stakeholder Communication",
        category: "communication",
        description:
          "Tailoring messages for different audiences and organizational levels",
      },
      {
        name: "Difficult Conversations",
        category: "communication",
        description: "Navigating sensitive topics with empathy and directness",
      },
      // Strategic
      {
        name: "Strategic Planning",
        category: "strategic",
        description:
          "Setting long-term direction and translating it into actionable plans",
      },
      {
        name: "Market Analysis",
        category: "strategic",
        description:
          "Understanding market dynamics, competitors, and opportunities",
      },
      {
        name: "OKR Design",
        category: "strategic",
        description:
          "Creating and tracking objectives and key results that drive alignment",
      },
      {
        name: "Resource Allocation",
        category: "strategic",
        description:
          "Optimizing distribution of time, budget, and people across priorities",
      },
      {
        name: "Business Development",
        category: "strategic",
        description:
          "Identifying and pursuing growth opportunities and partnerships",
      },
      // Technical
      {
        name: "Product Management",
        category: "technical",
        description: "Defining product vision, roadmap, and driving execution",
      },
      {
        name: "Data Analysis",
        category: "technical",
        description: "Extracting insights from data to inform decisions",
      },
      {
        name: "Project Management",
        category: "technical",
        description:
          "Planning, executing, and closing projects on time and scope",
      },
      {
        name: "AI & Machine Learning",
        category: "technical",
        description:
          "Understanding and applying AI/ML concepts in product and strategy",
      },
      {
        name: "Software Architecture",
        category: "technical",
        description: "Designing scalable, maintainable software systems",
      },
      {
        name: "UX Design",
        category: "technical",
        description: "Creating intuitive, user-centered digital experiences",
      },
      {
        name: "Financial Modeling",
        category: "technical",
        description:
          "Building and analyzing financial projections and business cases",
      },
      // Interpersonal
      {
        name: "Conflict Resolution",
        category: "interpersonal",
        description:
          "Mediating disagreements and finding mutually beneficial solutions",
      },
      {
        name: "Empathy",
        category: "interpersonal",
        description:
          "Understanding and sharing the feelings of others to build trust",
      },
      {
        name: "Collaboration",
        category: "interpersonal",
        description:
          "Working effectively with diverse teams toward shared outcomes",
      },
      {
        name: "Influence",
        category: "interpersonal",
        description:
          "Persuading others through relationships, expertise, and credibility",
      },
      {
        name: "Cultural Awareness",
        category: "interpersonal",
        description:
          "Navigating diverse cultural contexts with sensitivity and adaptability",
      },
      {
        name: "Networking",
        category: "interpersonal",
        description:
          "Building and maintaining professional relationships strategically",
      },
      {
        name: "Emotional Intelligence",
        category: "interpersonal",
        description: "Recognizing and managing emotions in self and others",
      },
    ];

    for (const skill of defaults) {
      await ctx.db.insert("skills", skill);
    }

    return { seeded: true, count: defaults.length };
  },
});
