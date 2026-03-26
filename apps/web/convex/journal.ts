import { v } from "convex/values";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Types ───

interface Meeting {
	approximate_time: string;
	name: string;
	type: string;
	attendees: string[];
	summary: string;
	decisions: string[];
	action_items: Array<{ owner: string; action: string }>;
	confidence: string;
}

interface CrackItem {
	text: string;
	urgency: string;
}

interface MasterActionList {
	josh_only: string[];
	delegated: string[];
	engineering: string[];
	scheduling: string[];
}

interface JournalData {
	date: string;
	title: string;
	epigraph: string;
	mood: string;
	wins: string[];
	meetings: Meeting[];
	falling_through_cracks: CrackItem[];
	master_action_list: MasterActionList;
	conversation_count: number;
	action_item_count: number;
	capture_minutes: number;
}

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

export const searchJournals = query({
	args: { userId: v.string(), query: v.string() },
	handler: async (ctx, args) => {
		if (!args.query.trim()) return [];
		return await ctx.db
			.query("journals")
			.withSearchIndex("search_content", (q) =>
				q.search("searchText", args.query).eq("userId", args.userId),
			)
			.take(20);
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

export const getCaptureSessions = query({
	args: { userId: v.string(), date: v.string(), timezone: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const tz = args.timezone ?? "America/Chicago";
		const [year, month, day] = args.date.split("-").map(Number);
		const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const startOfDay = new Date(`${dateStr}T00:00:00`);
		const endOfDay = new Date(`${dateStr}T23:59:59.999`);

		const tzOffsets: Record<string, number> = {
			"America/New_York": -5, "America/Chicago": -6,
			"America/Denver": -7, "America/Los_Angeles": -8,
		};
		const isDST = month >= 3 && month <= 11;
		const baseOffset = tzOffsets[tz] ?? -6;
		const offset = isDST ? baseOffset + 1 : baseOffset;

		const startMs = startOfDay.getTime() - (offset * 60 * 60 * 1000);
		const endMs = endOfDay.getTime() - (offset * 60 * 60 * 1000);

		const sessions = await ctx.db
			.query("capture_sessions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		return sessions
			.filter(
				(s) =>
					s.status === "stopped" &&
					s.startedAt >= startMs &&
					s.startedAt <= endMs,
			)
			.sort((a, b) => a.startedAt - b.startedAt);
	},
});

// ─── Mutations ───

export const setUserPreferences = mutation({
	args: {
		userId: v.string(),
		journalTime: v.optional(v.string()),
		journalTimezone: v.optional(v.string()),
		journalEnabled: v.optional(v.boolean()),
		journalTheme: v.optional(v.string()),
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

export const updateSessionTitle = mutation({
	args: {
		sessionId: v.id("capture_sessions"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.sessionId, { title: args.title });
	},
});

// Internal: create or update journal record
export const upsertJournal = internalMutation({
	args: {
		userId: v.string(),
		date: v.string(),
		status: v.string(),
		title: v.optional(v.string()),
		// v2 fields
		epigraph: v.optional(v.string()),
		mood: v.optional(v.string()),
		wins: v.optional(v.array(v.string())),
		meetings: v.optional(
			v.array(
				v.object({
					approximate_time: v.string(),
					name: v.string(),
					type: v.string(),
					attendees: v.array(v.string()),
					summary: v.string(),
					decisions: v.array(v.string()),
					action_items: v.array(
						v.object({ owner: v.string(), action: v.string() }),
					),
					confidence: v.string(),
				}),
			),
		),
		falling_through_cracks: v.optional(
			v.array(v.object({ text: v.string(), urgency: v.string() })),
		),
		master_action_list: v.optional(
			v.object({
				josh_only: v.array(v.string()),
				delegated: v.array(v.string()),
				engineering: v.array(v.string()),
				scheduling: v.array(v.string()),
			}),
		),
		conversation_count: v.optional(v.number()),
		action_item_count: v.optional(v.number()),
		capture_minutes: v.optional(v.number()),
		searchText: v.optional(v.string()),
		// legacy v1 fields
		summary: v.optional(v.string()),
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
				...(args.epigraph !== undefined && { epigraph: args.epigraph }),
				...(args.mood !== undefined && { mood: args.mood }),
				...(args.wins !== undefined && { wins: args.wins }),
				...(args.meetings !== undefined && { meetings: args.meetings }),
				...(args.falling_through_cracks !== undefined && {
					falling_through_cracks: args.falling_through_cracks,
				}),
				...(args.master_action_list !== undefined && {
					master_action_list: args.master_action_list,
				}),
				...(args.conversation_count !== undefined && {
					conversation_count: args.conversation_count,
				}),
				...(args.action_item_count !== undefined && {
					action_item_count: args.action_item_count,
				}),
				...(args.capture_minutes !== undefined && {
					capture_minutes: args.capture_minutes,
				}),
				...(args.searchText !== undefined && { searchText: args.searchText }),
				...(args.summary !== undefined && { summary: args.summary }),
				generatedAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("journals", {
			userId: args.userId,
			date: args.date,
			status: args.status,
			title: args.title ?? "Generating...",
			generatedAt: now,
			...(args.epigraph !== undefined && { epigraph: args.epigraph }),
			...(args.mood !== undefined && { mood: args.mood }),
			...(args.wins !== undefined && { wins: args.wins }),
			...(args.meetings !== undefined && { meetings: args.meetings }),
			...(args.falling_through_cracks !== undefined && {
				falling_through_cracks: args.falling_through_cracks,
			}),
			...(args.master_action_list !== undefined && {
				master_action_list: args.master_action_list,
			}),
			...(args.conversation_count !== undefined && {
				conversation_count: args.conversation_count,
			}),
			...(args.action_item_count !== undefined && {
				action_item_count: args.action_item_count,
			}),
			...(args.capture_minutes !== undefined && {
				capture_minutes: args.capture_minutes,
			}),
			...(args.searchText !== undefined && { searchText: args.searchText }),
			...(args.summary !== undefined && { summary: args.summary }),
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

		// Collect all transcript segments + calendar context for those sessions
		const allSegments: Array<{
			text: string;
			startMs: number;
			endMs: number;
			isFinal: boolean;
		}> = [];
		let totalDurationMs = 0;

		// Build calendar context from sessions
		const meetingContexts: Array<{
			sessionTitle: string;
			meetingTitle: string | undefined;
			attendees: string[];
			startedAt: number;
		}> = [];

		for (const session of includedSessions) {
			const segments = await ctx.runQuery(
				internal.journal.getSegmentsForSession,
				{
					sessionId: session._id,
				},
			);
			allSegments.push(...segments);
			totalDurationMs += session.totalDurationMs ?? 0;

			// Gather meeting context if available
			if (session.meetingTitle || session.meetingAttendees?.length) {
				meetingContexts.push({
					sessionTitle: session.title ?? "Untitled",
					meetingTitle: session.meetingTitle,
					attendees: session.meetingAttendees ?? [],
					startedAt: session.startedAt,
				});
			}
		}

		// Also fetch calendar events for this day to fill gaps
		const calendarEvents = await ctx.runQuery(
			internal.journal.getCalendarEventsForDate,
			{ userId: args.userId, date: args.date },
		);

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
		const conversationCount = includedSessions.length;

		// Format date nicely for prompt
		const [year, month, day] = args.date.split("-").map(Number);
		const dateObj = new Date(year, month - 1, day);
		const dateFormatted = dateObj.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		// Build calendar context block for the prompt
		let calendarBlock = "";
		if (meetingContexts.length > 0 || (calendarEvents && calendarEvents.length > 0)) {
			calendarBlock = "\n\nCALENDAR CONTEXT FOR TODAY:\n";

			// From recording sessions with detected meetings
			for (const mc of meetingContexts) {
				const time = new Date(mc.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
				calendarBlock += `- [${time}] "${mc.meetingTitle ?? mc.sessionTitle}" — Attendees: ${mc.attendees.length > 0 ? mc.attendees.join(", ") : "unknown"}\n`;
			}

			// From calendar events (even if no recording matched)
			if (calendarEvents) {
				for (const evt of calendarEvents) {
					const time = new Date(evt.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
					const endTime = new Date(evt.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
					const attendeeList = evt.attendees?.join(", ") ?? "no attendees listed";
					calendarBlock += `- [${time}-${endTime}] "${evt.title}" — Attendees: ${attendeeList}\n`;
				}
			}

			calendarBlock += "\nIMPORTANT: Use the calendar attendee names above to identify WHO said what in transcripts and assign action items to specific people by name. If transcript mentions a topic that matches a calendar meeting, associate it with that meeting and its attendees.\n";
		}

		const prompt = `You are generating Josh Burnett's personal "Field Notes" daily journal. Josh is Head of AI Product at Gloo. Today is ${dateFormatted}. The transcripts below are from ${captureMinutes} minutes of recorded audio across ${conversationCount} session(s).
${calendarBlock}
TRANSCRIPT:
${transcriptText.slice(0, 18000)}

Generate a rich, structured Field Notes journal. Be specific — reference actual names, decisions, topics from the transcript. Identify distinct meetings/conversations even if they flow together. Write meeting summaries as narrative first-person prose (2-4 paragraphs).

Respond with ONLY a valid JSON object matching this exact structure:

{
  "date": "${args.date}",
  "title": "Short evocative day title (e.g. 'The Architecture Decision' or 'Three Hard Conversations')",
  "epigraph": "The single most important win or insight from the day — used as a cover quote. 1 sentence, punchy.",
  "mood": "One word: focused | energized | scattered | reflective | productive | stressed | calm | creative",
  "wins": ["Specific win 1", "Specific win 2"],
  "meetings": [
    {
      "approximate_time": "10:30 AM",
      "name": "Meeting or conversation name",
      "type": "meeting",
      "attendees": ["Person A", "Person B"],
      "summary": "2-4 paragraph narrative prose in first person describing what happened, what was discussed, why it mattered.",
      "decisions": ["Decision made during this conversation"],
      "action_items": [
        { "owner": "Josh", "action": "Specific action item" },
        { "owner": "Ben", "action": "What Ben needs to do" }
      ],
      "confidence": "high"
    }
  ],
  "falling_through_cracks": [
    { "text": "Thing that needs attention — add context", "urgency": "high" },
    { "text": "Something overdue or at risk", "urgency": "medium" }
  ],
  "master_action_list": {
    "josh_only": ["Actions only Josh can do"],
    "delegated": ["Person: what they need to do"],
    "engineering": ["Tech tasks from the day"],
    "scheduling": ["Meetings to book or reschedule"]
  },
  "conversation_count": ${conversationCount},
  "action_item_count": 0,
  "capture_minutes": ${captureMinutes}
}

Rules:
- wins: 3-7 specific wins from the day
- meetings: one entry per distinct conversation/meeting — identify natural breakpoints
- falling_through_cracks: things that slipped through, follow-ups overdue, risks identified
- master_action_list: comprehensive — every action item bucketed by type
- action_item_count: total count across all action_items in meetings + master_action_list
- urgency values: "high", "medium", "low"
- confidence values: "high", "medium", "low"
- Respond with ONLY the JSON, no markdown fences, no other text`;

		let journalData: JournalData;

		try {
			const response = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": ANTHROPIC_API_KEY,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: "claude-sonnet-4-6-20250514",
					max_tokens: 6000,
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

		// Build search text from all content
		const searchText = [
			journalData.title,
			journalData.epigraph,
			...(journalData.wins ?? []),
			...(journalData.meetings ?? []).flatMap((m) => [
				m.name,
				m.summary,
				...m.decisions,
				...m.action_items.map((ai) => ai.action),
			]),
			...(journalData.falling_through_cracks ?? []).map((c) => c.text),
			...(journalData.master_action_list
				? [
						...journalData.master_action_list.josh_only,
						...journalData.master_action_list.delegated,
						...journalData.master_action_list.engineering,
						...journalData.master_action_list.scheduling,
					]
				: []),
		]
			.filter(Boolean)
			.join(" ");

		// Count total action items
		const totalActionItems =
			(journalData.meetings ?? []).reduce(
				(sum, m) => sum + (m.action_items?.length ?? 0),
				0,
			) +
			(journalData.master_action_list
				? journalData.master_action_list.josh_only.length +
					journalData.master_action_list.delegated.length +
					journalData.master_action_list.engineering.length +
					journalData.master_action_list.scheduling.length
				: 0);

		await ctx.runMutation(internal.journal.upsertJournal, {
			userId: args.userId,
			date: args.date,
			status: "complete",
			title: journalData.title,
			epigraph: journalData.epigraph,
			mood: journalData.mood,
			wins: journalData.wins ?? [],
			meetings: journalData.meetings ?? [],
			falling_through_cracks: journalData.falling_through_cracks ?? [],
			master_action_list: journalData.master_action_list ?? {
				josh_only: [],
				delegated: [],
				engineering: [],
				scheduling: [],
			},
			conversation_count: journalData.conversation_count ?? conversationCount,
			action_item_count: totalActionItems,
			capture_minutes: captureMinutes,
			searchText,
		});
	},
});

// ─── Internal queries for generateJournal ───

export const getSessionsForDate = internalQuery({
	args: { userId: v.string(), date: v.string(), timezone: v.optional(v.string()) },
	handler: async (ctx, args) => {
		// Use timezone-aware day boundaries (default: America/Chicago for Josh)
		const tz = args.timezone ?? "America/Chicago";
		const [year, month, day] = args.date.split("-").map(Number);

		// Create start/end of day in user's timezone
		// Construct ISO string with timezone offset
		const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const startOfDay = new Date(`${dateStr}T00:00:00`);
		const endOfDay = new Date(`${dateStr}T23:59:59.999`);

		// Convert to UTC by accounting for timezone offset
		// Use a simple offset approach for US timezones
		const tzOffsets: Record<string, number> = {
			"America/New_York": -5, "America/Chicago": -6,
			"America/Denver": -7, "America/Los_Angeles": -8,
			"US/Eastern": -5, "US/Central": -6, "US/Mountain": -7, "US/Pacific": -8,
		};
		// During DST (roughly Mar-Nov), offset is 1 hour less negative
		const isDST = month >= 3 && month <= 11; // rough DST check
		const baseOffset = tzOffsets[tz] ?? -6; // default CT
		const offset = isDST ? baseOffset + 1 : baseOffset;

		const startMs = startOfDay.getTime() - (offset * 60 * 60 * 1000);
		const endMs = endOfDay.getTime() - (offset * 60 * 60 * 1000);

		const sessions = await ctx.db
			.query("capture_sessions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		return sessions.filter(
			(s) =>
				s.status === "stopped" &&
				s.startedAt >= startMs &&
				s.startedAt <= endMs,
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

// Get calendar events for a specific date (for journal context)
export const getCalendarEventsForDate = internalQuery({
	args: { userId: v.string(), date: v.string(), timezone: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const tz = args.timezone ?? "America/Chicago";
		const [year, month, day] = args.date.split("-").map(Number);
		const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const startOfDay = new Date(`${dateStr}T00:00:00`);
		const endOfDay = new Date(`${dateStr}T23:59:59.999`);

		const tzOffsets: Record<string, number> = {
			"America/New_York": -5, "America/Chicago": -6,
			"America/Denver": -7, "America/Los_Angeles": -8,
		};
		const isDST = month >= 3 && month <= 11;
		const baseOffset = tzOffsets[tz] ?? -6;
		const offset = isDST ? baseOffset + 1 : baseOffset;

		const startMs = startOfDay.getTime() - (offset * 60 * 60 * 1000);
		const endMs = endOfDay.getTime() - (offset * 60 * 60 * 1000);

		const events = await ctx.db
			.query("calendar_events")
			.withIndex("by_user_and_time", (q) =>
				q.eq("userId", args.userId).gte("startTime", startMs),
			)
			.collect();

		return events.filter((e) => e.startTime <= endMs);
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
