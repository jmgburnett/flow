import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Queries ───

export const getJournal = query({
  args: { userId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journals")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .first();
  },
});

export const getJournalList = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    return await ctx.db
      .query("journals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const getUserPreferences = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// ─── Mutations ───

export const setUserPreferences = mutation({
  args: {
    userId: v.string(),
    journalTime: v.optional(v.string()),
    journalTimezone: v.optional(v.string()),
    journalEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const { userId, ...prefs } = args;

    if (existing) {
      await ctx.db.patch(existing._id, prefs);
      return existing._id;
    }

    return await ctx.db.insert("user_preferences", { userId, ...prefs });
  },
});

export const toggleSessionJournal = mutation({
  args: {
    sessionId: v.id("capture_sessions"),
    include: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { includeInJournal: args.include });
  },
});

// Internal: create or update journal record
export const upsertJournal = internalMutation({
  args: {
    userId: v.string(),
    date: v.string(),
    status: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    sections: v.optional(
      v.array(
        v.object({
          type: v.string(),
          title: v.string(),
          content: v.string(),
          timeRange: v.optional(
            v.object({ start: v.string(), end: v.string() }),
          ),
        }),
      ),
    ),
    mood: v.optional(v.string()),
    keyDecisions: v.optional(v.array(v.string())),
    actionItems: v.optional(
      v.array(v.object({ text: v.string(), priority: v.string() })),
    ),
    peopleMetioned: v.optional(v.array(v.string())),
    themes: v.optional(v.array(v.string())),
    wordCount: v.optional(v.number()),
    captureMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("journals")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date),
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        ...(args.title !== undefined && { title: args.title }),
        ...(args.summary !== undefined && { summary: args.summary }),
        ...(args.sections !== undefined && { sections: args.sections }),
        ...(args.mood !== undefined && { mood: args.mood }),
        ...(args.keyDecisions !== undefined && {
          keyDecisions: args.keyDecisions,
        }),
        ...(args.actionItems !== undefined && {
          actionItems: args.actionItems,
        }),
        ...(args.peopleMetioned !== undefined && {
          peopleMetioned: args.peopleMetioned,
        }),
        ...(args.themes !== undefined && { themes: args.themes }),
        ...(args.wordCount !== undefined && { wordCount: args.wordCount }),
        ...(args.captureMinutes !== undefined && {
          captureMinutes: args.captureMinutes,
        }),
        generatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("journals", {
      userId: args.userId,
      date: args.date,
      status: args.status,
      title: args.title ?? "Generating...",
      summary: args.summary ?? "",
      sections: args.sections ?? [],
      keyDecisions: args.keyDecisions ?? [],
      actionItems: args.actionItems ?? [],
      peopleMetioned: args.peopleMetioned ?? [],
      themes: args.themes ?? [],
      wordCount: args.wordCount ?? 0,
      captureMinutes: args.captureMinutes ?? 0,
      generatedAt: now,
    });
  },
});

// ─── Journal Generation Action ───

export const generateJournal = action({
  args: {
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Mark as generating
    await ctx.runMutation(internal.journal.upsertJournal, {
      userId: args.userId,
      date: args.date,
      status: "generating",
    });

    // Get all capture sessions for this date (that are included in journal)
    const sessions = await ctx.runQuery(internal.journal.getSessionsForDate, {
      userId: args.userId,
      date: args.date,
    });

    // Filter to only included sessions (default: include)
    const includedSessions = sessions.filter(
      (s: { includeInJournal?: boolean }) => s.includeInJournal !== false,
    );

    if (includedSessions.length === 0) {
      await ctx.runMutation(internal.journal.upsertJournal, {
        userId: args.userId,
        date: args.date,
        status: "failed",
        title: "No captures for this day",
        summary: "No recording sessions were found for this date.",
      });
      return;
    }

    // Collect all transcript segments for those sessions
    const allSegments: Array<{
      text: string;
      startMs: number;
      endMs: number;
      isFinal: boolean;
    }> = [];
    let totalDurationMs = 0;

    for (const session of includedSessions) {
      const segments = await ctx.runQuery(
        internal.journal.getSegmentsForSession,
        {
          sessionId: session._id,
        },
      );
      allSegments.push(...segments);
      totalDurationMs += session.totalDurationMs ?? 0;
    }

    // Build transcript text with approximate timestamps
    const transcriptText = allSegments
      .filter((s) => s.isFinal && s.text.trim())
      .map((s) => {
        const minutes = Math.floor(s.startMs / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
        return `[${timeStr}] ${s.text.trim()}`;
      })
      .join("\n");

    if (!transcriptText) {
      await ctx.runMutation(internal.journal.upsertJournal, {
        userId: args.userId,
        date: args.date,
        status: "failed",
        title: "No transcripts available",
        summary: "Sessions were found but contained no transcript text.",
      });
      return;
    }

    const captureMinutes = Math.round(totalDurationMs / 60000);

    // Format date nicely for prompt
    const [year, month, day] = args.date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dateFormatted = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const prompt = `You are generating a personal daily journal for Josh Burnett (Head of AI Product at Gloo) based on his audio capture transcripts from ${dateFormatted}.

The transcripts below are from ${captureMinutes} minutes of recorded audio. Timestamps are approximate minutes from the start of each session.

TRANSCRIPT:
${transcriptText.slice(0, 20000)}

Generate a rich, personal daily journal entry with the following structure. Be specific and reference actual conversations, names, and topics from the transcript. Write in first-person as if Josh is writing his own journal. Use natural, reflective language — not bullet-point corporate speak.

Respond with a JSON object with this exact structure:
{
  "title": "A short, evocative title for the day (e.g., 'The API Architecture Decision' or 'Deep Work on the Platform')",
  "summary": "2-3 sentence overview of the day's highlights",
  "mood": "one word or short phrase describing the day's energy (e.g., 'focused', 'scattered', 'energized', 'reflective')",
  "sections": [
    {
      "type": "morning_context",
      "title": "Morning Context",
      "content": "How the day started, initial energy, first conversations or tasks"
    },
    {
      "type": "key_conversations",
      "title": "Key Conversations",
      "content": "Major discussions — who was involved, what was discussed, what mattered"
    },
    {
      "type": "decisions_made",
      "title": "Decisions Made",
      "content": "What was decided and the reasoning behind those choices"
    },
    {
      "type": "insights",
      "title": "Insights & Ideas",
      "content": "Novel thoughts, connections made, aha moments, things worth remembering"
    },
    {
      "type": "evening_reflection",
      "title": "Evening Reflection",
      "content": "How the day went overall — what went well, what was hard, how you're feeling"
    },
    {
      "type": "tomorrow_prep",
      "title": "Tomorrow",
      "content": "What needs attention tomorrow based on what came up today"
    }
  ],
  "keyDecisions": ["array of specific decisions made today"],
  "actionItems": [
    { "text": "specific action item", "priority": "high|medium|low" }
  ],
  "peopleMetioned": ["list of names mentioned in transcripts"],
  "themes": ["2-5 recurring topics or themes from the day"]
}

Only include sections with meaningful content. If there's nothing relevant for a section (e.g., no clear decisions), still include it but keep it brief and honest. Respond with ONLY the JSON, no other text.`;

    let journalData: {
      title: string;
      summary: string;
      mood: string;
      sections: Array<{
        type: string;
        title: string;
        content: string;
        timeRange?: { start: string; end: string };
      }>;
      keyDecisions: string[];
      actionItems: Array<{ text: string; priority: string }>;
      peopleMetioned: string[];
      themes: string[];
    };

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5-20251101",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic API error:", errText);
        await ctx.runMutation(internal.journal.upsertJournal, {
          userId: args.userId,
          date: args.date,
          status: "failed",
          title: "Generation failed",
          summary: `API error: ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      const rawText: string = data.content[0].text;

      // Strip markdown code fences if present
      const jsonText = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      journalData = JSON.parse(jsonText);
    } catch (err) {
      console.error("Journal generation error:", err);
      await ctx.runMutation(internal.journal.upsertJournal, {
        userId: args.userId,
        date: args.date,
        status: "failed",
        title: "Generation failed",
        summary: "An error occurred while generating your journal.",
      });
      return;
    }

    // Count words across all section content
    const allContent = [
      journalData.summary,
      ...journalData.sections.map((s) => s.content),
    ].join(" ");
    const wordCount = allContent.split(/\s+/).filter(Boolean).length;

    await ctx.runMutation(internal.journal.upsertJournal, {
      userId: args.userId,
      date: args.date,
      status: "complete",
      title: journalData.title,
      summary: journalData.summary,
      sections: journalData.sections,
      mood: journalData.mood,
      keyDecisions: journalData.keyDecisions ?? [],
      actionItems: journalData.actionItems ?? [],
      peopleMetioned: journalData.peopleMetioned ?? [],
      themes: journalData.themes ?? [],
      wordCount,
      captureMinutes,
    });
  },
});

// ─── Internal queries for generateJournal ───

export const getSessionsForDate = internalQuery({
  args: { userId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    // Parse date to get start/end timestamps for the day
    const [year, month, day] = args.date.split("-").map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0).getTime();
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59).getTime();

    const sessions = await ctx.db
      .query("capture_sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return sessions.filter(
      (s) =>
        s.status === "stopped" &&
        s.startedAt >= startOfDay &&
        s.startedAt <= endOfDay,
    );
  },
});

export const getSegmentsForSession = internalQuery({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcript_segments")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// ─── Schedule journal generation ───

export const scheduleJournalGeneration = mutation({
  args: {
    userId: v.string(),
    journalTime: v.string(), // "HH:MM" 24h
    journalTimezone: v.string(),
    journalEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Save preferences
    const existing = await ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        journalTime: args.journalTime,
        journalTimezone: args.journalTimezone,
        journalEnabled: args.journalEnabled,
      });
    } else {
      await ctx.db.insert("user_preferences", {
        userId: args.userId,
        journalTime: args.journalTime,
        journalTimezone: args.journalTimezone,
        journalEnabled: args.journalEnabled,
      });
    }
  },
});
