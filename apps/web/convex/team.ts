import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

// ─── Team Member Queries ───

// List team members (coworker or team_member type), with optional filters
export const listTeamMembers = query({
  args: {
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let teamMembers = contacts.filter(
      (c) => c.type === "coworker" || c.type === "team_member",
    );

    if (args.department) {
      teamMembers = teamMembers.filter((c) => c.department === args.department);
    }

    return teamMembers.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get a team member with resolved skills
export const getTeamMember = query({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact) return null;

    // Resolve skill names
    const resolvedSkills = contact.skills
      ? await Promise.all(
          contact.skills.map(async (s) => {
            const skill = await ctx.db.get(s.skillId);
            return {
              ...s,
              skillName: skill?.name ?? "Unknown",
              skillCategory: skill?.category ?? "custom",
              skillDescription: skill?.description,
            };
          }),
        )
      : [];

    // Get manager name
    let managerName: string | undefined;
    if (contact.reportingTo) {
      const manager = await ctx.db.get(contact.reportingTo);
      managerName = manager?.name;
    }

    // Get direct report names
    const directReportNames: Array<{ id: string; name: string }> = [];
    if (contact.directReports) {
      for (const reportId of contact.directReports) {
        const report = await ctx.db.get(reportId);
        if (report)
          directReportNames.push({ id: report._id, name: report.name });
      }
    }

    return {
      ...contact,
      resolvedSkills,
      managerName,
      directReportNames,
    };
  },
});

// Update team profile fields
export const updateTeamProfile = mutation({
  args: {
    id: v.id("contacts"),
    reportingTo: v.optional(v.id("contacts")),
    directReports: v.optional(v.array(v.id("contacts"))),
    skills: v.optional(
      v.array(
        v.object({
          skillId: v.id("skills"),
          level: v.union(
            v.literal("beginner"),
            v.literal("intermediate"),
            v.literal("advanced"),
            v.literal("expert"),
          ),
          isGap: v.optional(v.boolean()),
        }),
      ),
    ),
    personality: v.optional(
      v.object({
        enneagram: v.optional(v.string()),
        mbti: v.optional(v.string()),
        disc: v.optional(v.string()),
        leadershipStyle: v.optional(v.string()),
        workingStyle: v.optional(v.string()),
      }),
    ),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
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

// Build org chart tree from reporting relationships
export const getOrgChart = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const teamMembers = contacts.filter(
      (c) => c.type === "coworker" || c.type === "team_member",
    );

    // Build tree
    type OrgNode = {
      id: string;
      name: string;
      role?: string;
      department?: string;
      avatarUrl?: string;
      children: OrgNode[];
    };

    const nodeMap = new Map<string, OrgNode>();
    for (const m of teamMembers) {
      nodeMap.set(m._id, {
        id: m._id,
        name: m.name,
        role: m.role,
        department: m.department,
        avatarUrl: m.avatarUrl,
        children: [],
      });
    }

    const roots: OrgNode[] = [];
    for (const m of teamMembers) {
      const node = nodeMap.get(m._id)!;
      if (m.reportingTo && nodeMap.has(m.reportingTo)) {
        nodeMap.get(m.reportingTo)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  },
});

// Get skill gaps — skills where no team member is expert/advanced
export const getSkillGaps = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    const skills = await ctx.db.query("skills").collect();
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const teamMembers = contacts.filter(
      (c) => c.type === "coworker" || c.type === "team_member",
    );

    // Count how many team members have each skill at each level
    const skillCoverage = new Map<
      string,
      { total: number; advanced: number; expert: number }
    >();
    for (const skill of skills) {
      skillCoverage.set(skill._id, { total: 0, advanced: 0, expert: 0 });
    }

    for (const member of teamMembers) {
      for (const s of member.skills ?? []) {
        const coverage = skillCoverage.get(s.skillId);
        if (coverage) {
          coverage.total++;
          if (s.level === "advanced") coverage.advanced++;
          if (s.level === "expert") coverage.expert++;
        }
      }
    }

    const gaps = skills
      .filter((skill) => {
        const c = skillCoverage.get(skill._id);
        return c && c.total === 0;
      })
      .map((skill) => ({
        ...skill,
        coverage: skillCoverage.get(skill._id)!,
      }));

    return gaps;
  },
});

// Skill coverage summary
export const getSkillCoverage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    const skills = await ctx.db.query("skills").collect();
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const teamMembers = contacts.filter(
      (c) => c.type === "coworker" || c.type === "team_member",
    );

    let coveredCount = 0;
    for (const skill of skills) {
      const hasMember = teamMembers.some((m) =>
        m.skills?.some((s) => s.skillId === skill._id),
      );
      if (hasMember) coveredCount++;
    }

    return {
      totalSkills: skills.length,
      coveredSkills: coveredCount,
      coveragePercent:
        skills.length > 0
          ? Math.round((coveredCount / skills.length) * 100)
          : 0,
      teamSize: teamMembers.length,
    };
  },
});
