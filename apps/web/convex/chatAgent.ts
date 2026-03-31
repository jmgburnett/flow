import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUserId } from "./lib/auth";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Types ───

interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: "text";
  text: string;
}

type ContentBlock = ToolUseBlock | TextBlock;

interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

// ─── Tool Definitions ───

const TOOLS: Tool[] = [
  {
    name: "check_availability",
    description:
      "Check calendar availability (busy/free) for specified people over a time range using Google Calendar FreeBusy API. Works best for people in the same Google Workspace org. For external people, it may not return data.",
    input_schema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description:
            "Start of time range in ISO 8601 format (e.g. 2026-03-15T09:00:00-05:00)",
        },
        timeMax: {
          type: "string",
          description: "End of time range in ISO 8601 format",
        },
        attendeeEmails: {
          type: "array",
          items: { type: "string" },
          description:
            "Email addresses to check availability for. Always include Josh's calendars.",
        },
      },
      required: ["timeMin", "timeMax"],
    },
  },
  {
    name: "find_open_slots",
    description:
      "Find mutually available time slots between Josh and specified attendees. Checks all of Josh's 4 Google calendars and the attendees' calendars. Returns a list of available slots.",
    input_schema: {
      type: "object",
      properties: {
        attendeeEmails: {
          type: "array",
          items: { type: "string" },
          description:
            "Email addresses of people to find mutual availability with",
        },
        durationMinutes: {
          type: "number",
          description: "Duration of the meeting in minutes (default: 30)",
        },
        startDate: {
          type: "string",
          description: "Start date to search from in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date to search until in YYYY-MM-DD format",
        },
        preferredStartHour: {
          type: "number",
          description: "Preferred earliest hour in CT (24h format, default: 8)",
        },
        preferredEndHour: {
          type: "number",
          description: "Preferred latest hour in CT (24h format, default: 17)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "create_event",
    description:
      "Create a Google Calendar event with attendees. Sends calendar invitations to all attendees.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title/summary" },
        startTime: {
          type: "string",
          description:
            "Event start time in ISO 8601 format with timezone (e.g. 2026-03-15T10:00:00-05:00)",
        },
        endTime: {
          type: "string",
          description: "Event end time in ISO 8601 format with timezone",
        },
        attendeeEmails: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of attendees to invite",
        },
        description: {
          type: "string",
          description: "Event description/notes (optional)",
        },
        location: {
          type: "string",
          description: "Event location (optional)",
        },
        calendarAccountEmail: {
          type: "string",
          description:
            "Which of Josh's Google accounts to create the event on. Default: josh@onflourish.com",
        },
      },
      required: ["title", "startTime", "endTime"],
    },
  },
  {
    name: "get_my_calendar",
    description:
      "Get Josh's upcoming calendar events across all connected Google accounts. Returns events sorted by start time.",
    input_schema: {
      type: "object",
      properties: {
        daysAhead: {
          type: "number",
          description: "Number of days ahead to look (default: 7)",
        },
      },
    },
  },
  {
    name: "lookup_contact",
    description:
      "Search Josh's contacts by name to find their email address for scheduling. Use this when Josh mentions someone by name and you need their email.",
    input_schema: {
      type: "object",
      properties: {
        nameQuery: {
          type: "string",
          description: "Name or partial name to search for",
        },
      },
      required: ["nameQuery"],
    },
  },
  {
    name: "search_gloo_directory",
    description:
      "Search the Gloo.us Google Workspace directory for coworkers by name. Returns their name, email, title, and department. Use this to find anyone at Gloo when scheduling meetings or looking up colleagues. Can also read their calendar availability via FreeBusy since they're in the same org.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Name or partial name to search for in the Gloo directory",
        },
        pageSize: {
          type: "number",
          description: "Max results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_emails",
    description:
      "Search Josh's emails by keyword, sender name, or subject. Returns matching emails with subject, sender, body snippet, and triage status.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query — matches against subject, sender, and body text",
        },
        fromPerson: {
          type: "string",
          description: "Filter by sender name or email (optional)",
        },
        triageStatus: {
          type: "string",
          enum: ["needs_me", "draft_ready", "handled", "ignore"],
          description: "Filter by triage status (optional)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_email_thread",
    description:
      "Get the full email thread/conversation for a specific email thread ID. Use this when Josh asks to see or summarize a specific email conversation.",
    input_schema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "Gmail thread ID",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "get_inbox_summary",
    description:
      "Get a summary of Josh's inbox — counts by triage status, most recent important emails, and any unread items needing attention.",
    input_schema: {
      type: "object",
      properties: {
        accountEmail: {
          type: "string",
          description:
            "Filter to a specific account (optional, default: all accounts)",
        },
      },
    },
  },
];

// ─── System Prompt ───

function buildSystemPrompt(): string {
  // Get current time in Central Time
  const now = new Date();
  const ctFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const ctNow = ctFormatter.format(now);

  // Also get just the date parts for context
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  });
  const dayOfWeek = dateFormatter.format(now);

  return `You are Flobot, Josh Burnett's AI Chief of Staff in the Flow app. You help Josh manage his schedule, coordinate meetings, and stay on top of email.

## Current Time
Right now it is: **${ctNow} CT**
Day of week: ${dayOfWeek}
Use this to understand relative references like "today", "tomorrow", "next week", "this afternoon", etc.

## About Josh
- Josh is Head of AI Product at Gloo and founder of Church.tech
- Timezone: Central Time (America/Chicago, CT). ALWAYS display times in CT.
- Connected Google calendars: josh@onflourish.com, josh@church.tech, jburnett@gloo.us, jmgburnett@gmail.com

## Scheduling Preferences
- No meetings before 8:00 AM CT unless Josh says otherwise
- Prefers morning meetings (8-11 AM CT) when possible
- Default meeting duration: 30 minutes unless specified
- Default calendar for new events: josh@onflourish.com
- Buffer time between back-to-back meetings is appreciated

## Gloo Directory
- You have access to the full Gloo.us Google Workspace directory via search_gloo_directory
- This lets you find any Gloo coworker by name and get their email, title, department
- Since they're in the same org, you can also check their calendar availability via FreeBusy
- When Josh mentions a Gloo colleague by first name, search the directory to find them

## How to Schedule
1. When Josh asks to schedule with someone, first use search_gloo_directory (for Gloo people) or lookup_contact (for others) to find their email
2. Use find_open_slots to check mutual availability — this works especially well for Gloo coworkers since you can see their calendars
3. Present 2-3 slot options in a conversational way with times in CT
4. When Josh picks a slot, use create_event to book it
5. For external people whose calendars you can't query, propose Josh's open slots and offer to email them the options

## Email Capabilities
- You can search Josh's emails by keyword, sender, or subject
- You can pull up full email threads and summarize them
- You can give inbox status (how many need attention, drafts ready, etc.)
- When summarizing emails, be concise — pull out the key ask or information
- If Josh asks "what did [person] say about [topic]", search emails and summarize the relevant messages

## Communication Style
- Be concise and conversational — not corporate
- Format times as "Tuesday, March 17 at 10:00 AM CT" (readable, with CT)
- Don't say "I'd be happy to help" — just help
- When showing calendar, use a clean format with times and titles
- When summarizing emails, lead with the key point, then supporting details
- If something goes wrong with an API call, explain simply and suggest next steps

## Important
- Always check ALL 4 of Josh's calendars for conflicts before suggesting times
- When creating events, confirm the details before creating
- Convert all times to Central Time for display
- For email searches, search broadly then filter — the search is keyword-based`;
}

// ─── Internal Queries ───

// Get all Google connections for tool use
export const getAllConnections = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("google_connections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Search contacts by name
export const searchContacts = internalQuery({
  args: {
    userId: v.string(),
    nameQuery: v.string(),
  },
  handler: async (ctx, args) => {
    const allContacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const query = args.nameQuery.toLowerCase();
    return allContacts
      .filter((c) => c.name.toLowerCase().includes(query))
      .map((c) => ({
        name: c.name,
        emails: c.emails,
        role: c.role,
        company: c.company,
        type: c.type,
      }))
      .slice(0, 10);
  },
});

// Also check contact_profiles for richer data
export const searchContactProfiles = internalQuery({
  args: {
    userId: v.string(),
    nameQuery: v.string(),
  },
  handler: async (ctx, args) => {
    const profiles = await ctx.db
      .query("contact_profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const query = args.nameQuery.toLowerCase();
    return profiles
      .filter((p) => p.name.toLowerCase().includes(query) && p.isReal !== false)
      .map((p) => ({
        name: p.name,
        email: p.email,
        relationshipSummary: p.relationshipSummary,
      }))
      .slice(0, 10);
  },
});

// Get upcoming events across all accounts
export const getUpcomingEvents = internalQuery({
  args: {
    userId: v.string(),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("calendar_events")
      .withIndex("by_user_and_time", (q) => q.eq("userId", args.userId))
      .collect();

    return events
      .filter(
        (e) => e.startTime >= args.startTime && e.startTime <= args.endTime,
      )
      .sort((a, b) => a.startTime - b.startTime)
      .map((e) => ({
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        attendees: e.attendees,
        accountEmail: e.accountEmail,
      }));
  },
});

// Search emails by query
export const searchEmails = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    fromPerson: v.optional(v.string()),
    triageStatus: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const allEmails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(500); // Search across recent emails

    const queryLower = args.query.toLowerCase();
    const fromLower = args.fromPerson?.toLowerCase();

    const filtered = allEmails.filter((email) => {
      // Text match
      const textMatch =
        email.subject.toLowerCase().includes(queryLower) ||
        email.from.toLowerCase().includes(queryLower) ||
        email.body.toLowerCase().includes(queryLower);

      // From filter
      const fromMatch = fromLower
        ? email.from.toLowerCase().includes(fromLower)
        : true;

      // Triage filter
      const triageMatch = args.triageStatus
        ? email.triageStatus === args.triageStatus
        : true;

      return textMatch && fromMatch && triageMatch;
    });

    return filtered.slice(0, limit).map((e) => ({
      _id: e._id,
      subject: e.subject,
      from: e.from,
      to: e.to,
      body: e.body.slice(0, 500), // Truncate body
      threadId: e.threadId,
      triageStatus: e.triageStatus,
      accountEmail: e.accountEmail,
      receivedAt: e.receivedAt,
      draftReply: e.draftReply,
    }));
  },
});

// Get emails in a thread
export const getEmailThread = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return emails
      .sort((a, b) => a.receivedAt - b.receivedAt)
      .map((e) => ({
        subject: e.subject,
        from: e.from,
        to: e.to,
        body: e.body.slice(0, 1000),
        receivedAt: e.receivedAt,
        triageStatus: e.triageStatus,
      }));
  },
});

// Get inbox summary
export const getInboxSummary = internalQuery({
  args: {
    userId: v.string(),
    accountEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let emails;
    if (args.accountEmail) {
      emails = await ctx.db
        .query("emails")
        .withIndex("by_account_email", (q) =>
          q.eq("accountEmail", args.accountEmail!),
        )
        .collect();
      emails = emails.filter((e) => e.userId === args.userId);
    } else {
      emails = await ctx.db
        .query("emails")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    const counts = {
      needs_me: 0,
      draft_ready: 0,
      handled: 0,
      ignore: 0,
      total: emails.length,
    };

    for (const e of emails) {
      counts[e.triageStatus]++;
    }

    // Get most recent "needs_me" emails
    const urgent = emails
      .filter((e) => e.triageStatus === "needs_me")
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, 5)
      .map((e) => ({
        subject: e.subject,
        from: e.from,
        receivedAt: e.receivedAt,
        bodySnippet: e.body.slice(0, 200),
      }));

    return { counts, urgent };
  },
});

// ─── Token Refresh Helper ───

async function refreshTokenIfNeeded(
  ctx: any,
  connectionId: string,
): Promise<string> {
  const connection = await ctx.runQuery(internal.google.getConnection, {
    connectionId,
  });

  if (!connection) {
    throw new Error("Connection not found");
  }

  const now = Date.now();
  if (connection.tokenExpiry > now + 5 * 60 * 1000) {
    return connection.accessToken;
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${await response.text()}`);
  }

  const tokens = await response.json();
  await ctx.runMutation(internal.google.updateConnectionTokens, {
    connectionId,
    accessToken: tokens.access_token,
    tokenExpiry: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token;
}

// ─── Tool Handlers ───

async function handleCheckAvailability(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { timeMin, timeMax, attendeeEmails } = input as {
    timeMin: string;
    timeMax: string;
    attendeeEmails?: string[];
  };

  const connections = await ctx.runQuery(internal.chatAgent.getAllConnections, {
    userId,
  });

  if (connections.length === 0) {
    return JSON.stringify({ error: "No Google accounts connected" });
  }

  // Build list of calendars to check: Josh's accounts + any specified attendees
  const calendarIds = connections.map((c: any) => c.email);
  if (attendeeEmails) {
    for (const email of attendeeEmails) {
      if (!calendarIds.includes(email)) {
        calendarIds.push(email);
      }
    }
  }

  // Prefer gloo.us token for FreeBusy — gives org-level calendar visibility
  const glooConn = connections.find((c: any) => c.email.endsWith("@gloo.us"));
  const accessToken = await refreshTokenIfNeeded(
    ctx,
    (glooConn || connections[0])._id,
  );

  const freeBusyResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: calendarIds.map((id: string) => ({ id })),
      }),
    },
  );

  if (!freeBusyResponse.ok) {
    return JSON.stringify({
      error: `FreeBusy API error: ${await freeBusyResponse.text()}`,
    });
  }

  const data = await freeBusyResponse.json();
  const result: Record<string, unknown> = {};

  for (const [calId, calData] of Object.entries(data.calendars || {})) {
    const cal = calData as {
      busy?: Array<{ start: string; end: string }>;
      errors?: unknown[];
    };
    if (cal.errors && cal.errors.length > 0) {
      result[calId] = {
        status: "unavailable",
        note: "Cannot access this calendar (likely external)",
      };
    } else if (cal.busy && cal.busy.length > 0) {
      result[calId] = {
        status: "has_busy_slots",
        busy: cal.busy.map((b) => ({
          start: b.start,
          end: b.end,
        })),
      };
    } else {
      result[calId] = { status: "free" };
    }
  }

  return JSON.stringify(result);
}

async function handleFindOpenSlots(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const {
    attendeeEmails = [],
    durationMinutes = 30,
    startDate,
    endDate,
    preferredStartHour = 8,
    preferredEndHour = 17,
  } = input as {
    attendeeEmails?: string[];
    durationMinutes?: number;
    startDate: string;
    endDate: string;
    preferredStartHour?: number;
    preferredEndHour?: number;
  };

  const connections = await ctx.runQuery(internal.chatAgent.getAllConnections, {
    userId,
  });

  if (connections.length === 0) {
    return JSON.stringify({ error: "No Google accounts connected" });
  }

  // CT offset (Central Time) — handle both CST (-6) and CDT (-5)
  // For simplicity, use -5 (CDT) during March-November, -6 (CST) otherwise
  const month = new Date(startDate).getMonth() + 1;
  const ctOffset = month >= 3 && month <= 10 ? -5 : -6;
  const offsetStr = ctOffset === -5 ? "-05:00" : "-06:00";

  const timeMin = `${startDate}T00:00:00${offsetStr}`;
  const timeMax = `${endDate}T23:59:59${offsetStr}`;

  // Get all calendars to check
  const joshEmails = connections.map((c: any) => c.email);
  const allEmails = [
    ...joshEmails,
    ...attendeeEmails.filter((e: string) => !joshEmails.includes(e)),
  ];

  // Prefer gloo.us token for org-level calendar visibility
  const glooConn = connections.find((c: any) => c.email.endsWith("@gloo.us"));
  const accessToken = await refreshTokenIfNeeded(
    ctx,
    (glooConn || connections[0])._id,
  );

  const freeBusyResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: allEmails.map((id: string) => ({ id })),
      }),
    },
  );

  if (!freeBusyResponse.ok) {
    return JSON.stringify({
      error: `FreeBusy API error: ${await freeBusyResponse.text()}`,
    });
  }

  const data = await freeBusyResponse.json();

  // Collect ALL busy periods across all calendars
  const allBusy: Array<{ start: number; end: number }> = [];
  const unavailableCalendars: string[] = [];

  for (const [calId, calData] of Object.entries(data.calendars || {})) {
    const cal = calData as {
      busy?: Array<{ start: string; end: string }>;
      errors?: unknown[];
    };
    if (cal.errors && cal.errors.length > 0) {
      if (!joshEmails.includes(calId)) {
        unavailableCalendars.push(calId);
      }
      continue;
    }
    if (cal.busy) {
      for (const slot of cal.busy) {
        allBusy.push({
          start: new Date(slot.start).getTime(),
          end: new Date(slot.end).getTime(),
        });
      }
    }
  }

  // Sort busy periods
  allBusy.sort((a, b) => a.start - b.start);

  // Find open slots within preferred hours
  const slots: Array<{ start: string; end: string }> = [];
  const durationMs = durationMinutes * 60 * 1000;

  let currentDate = new Date(
    `${startDate}T${String(preferredStartHour).padStart(2, "0")}:00:00${offsetStr}`,
  );
  const searchEnd = new Date(
    `${endDate}T${String(preferredEndHour).padStart(2, "0")}:00:00${offsetStr}`,
  );

  while (currentDate < searchEnd && slots.length < 8) {
    const dayOfWeek = currentDate.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      currentDate.setHours(preferredStartHour, 0, 0, 0);
      continue;
    }

    const slotStart = currentDate.getTime();
    const slotEnd = slotStart + durationMs;

    // Check if within preferred hours
    const hour = currentDate.getHours();
    if (hour >= preferredEndHour) {
      // Move to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      const nextDay = new Date(currentDate);
      nextDay.setHours(preferredStartHour, 0, 0, 0);
      currentDate = nextDay;
      continue;
    }

    // Check if this slot conflicts with any busy period
    const hasConflict = allBusy.some(
      (busy) => slotStart < busy.end && slotEnd > busy.start,
    );

    if (!hasConflict) {
      const startDt = new Date(slotStart);
      const endDt = new Date(slotEnd);
      slots.push({
        start: startDt.toISOString(),
        end: endDt.toISOString(),
      });
      // Skip ahead past this slot
      currentDate = new Date(slotEnd);
    } else {
      // Move forward by 15 minutes
      currentDate = new Date(currentDate.getTime() + 15 * 60 * 1000);
    }
  }

  return JSON.stringify({
    availableSlots: slots,
    unavailableCalendars,
    note:
      unavailableCalendars.length > 0
        ? `Could not check availability for: ${unavailableCalendars.join(", ")}. They may be external to the organization.`
        : undefined,
  });
}

async function handleCreateEvent(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const {
    title,
    startTime,
    endTime,
    attendeeEmails = [],
    description,
    location,
    calendarAccountEmail = "josh@onflourish.com",
  } = input as {
    title: string;
    startTime: string;
    endTime: string;
    attendeeEmails?: string[];
    description?: string;
    location?: string;
    calendarAccountEmail?: string;
  };

  const connections = await ctx.runQuery(internal.chatAgent.getAllConnections, {
    userId,
  });

  // Find the connection for the specified account
  const connection = connections.find(
    (c: any) => c.email === calendarAccountEmail,
  );
  if (!connection) {
    return JSON.stringify({
      error: `No connection found for ${calendarAccountEmail}`,
    });
  }

  const accessToken = await refreshTokenIfNeeded(ctx, connection._id);

  const event: Record<string, unknown> = {
    summary: title,
    start: { dateTime: startTime },
    end: { dateTime: endTime },
  };

  if (attendeeEmails.length > 0) {
    event.attendees = attendeeEmails.map((email: string) => ({ email }));
  }
  if (description) event.description = description;
  if (location) event.location = location;

  const createResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!createResponse.ok) {
    return JSON.stringify({
      error: `Failed to create event: ${await createResponse.text()}`,
    });
  }

  const created = await createResponse.json();

  return JSON.stringify({
    success: true,
    eventId: created.id,
    htmlLink: created.htmlLink,
    title: created.summary,
    start: created.start?.dateTime,
    end: created.end?.dateTime,
    attendees: created.attendees?.map((a: any) => a.email),
  });
}

async function handleGetMyCalendar(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { daysAhead = 7 } = input as { daysAhead?: number };

  const now = Date.now();
  const endTime = now + daysAhead * 24 * 60 * 60 * 1000;

  const events = await ctx.runQuery(internal.chatAgent.getUpcomingEvents, {
    userId,
    startTime: now,
    endTime,
  });

  if (events.length === 0) {
    return JSON.stringify({ events: [], message: "No upcoming events found" });
  }

  return JSON.stringify({
    events: events.map((e: any) => ({
      title: e.title,
      start: new Date(e.startTime).toISOString(),
      end: new Date(e.endTime).toISOString(),
      location: e.location,
      attendees: e.attendees,
      account: e.accountEmail,
    })),
  });
}

async function handleLookupContact(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { nameQuery } = input as { nameQuery: string };

  // Search both contacts and contact_profiles
  const [contacts, profiles] = await Promise.all([
    ctx.runQuery(internal.chatAgent.searchContacts, {
      userId,
      nameQuery,
    }),
    ctx.runQuery(internal.chatAgent.searchContactProfiles, {
      userId,
      nameQuery,
    }),
  ]);

  // Merge results, preferring contact_profiles for richer data
  const results: Array<{
    name: string;
    email?: string;
    emails?: string[];
    role?: string;
    company?: string;
    relationship?: string;
  }> = [];

  // Add from contact_profiles
  for (const p of profiles) {
    results.push({
      name: p.name,
      email: p.email,
      relationship: p.relationshipSummary,
    });
  }

  // Add from contacts (if not already covered)
  const profileEmails = new Set(profiles.map((p: any) => p.email));
  for (const c of contacts) {
    const hasOverlap = c.emails?.some((e: string) => profileEmails.has(e));
    if (!hasOverlap) {
      results.push({
        name: c.name,
        emails: c.emails,
        role: c.role,
        company: c.company,
      });
    }
  }

  if (results.length === 0) {
    return JSON.stringify({
      results: [],
      message: `No contacts found matching "${nameQuery}". You may need to ask Josh for their email address.`,
    });
  }

  return JSON.stringify({ results });
}

async function handleSearchGlooDirectory(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { query, pageSize = 10 } = input as {
    query: string;
    pageSize?: number;
  };

  // Get the gloo.us connection for org directory access
  const connections = await ctx.runQuery(internal.chatAgent.getAllConnections, {
    userId,
  });

  const glooConnection = connections.find((c: any) =>
    c.email.endsWith("@gloo.us"),
  );
  if (!glooConnection) {
    return JSON.stringify({
      error:
        "No Gloo.us Google account connected. Cannot search org directory.",
    });
  }

  const accessToken = await refreshTokenIfNeeded(ctx, glooConnection._id);

  // Search the Google Workspace directory using People API
  const searchUrl = new URL(
    "https://people.googleapis.com/v1/people:searchDirectoryPeople",
  );
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set(
    "readMask",
    "names,emailAddresses,organizations,photos",
  );
  searchUrl.searchParams.set("sources", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE");
  searchUrl.searchParams.set("pageSize", String(Math.min(pageSize, 20)));

  const response = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If directory API isn't available, try the contacts API as fallback
    if (response.status === 403) {
      return await searchGlooViaContacts(ctx, accessToken, query, pageSize);
    }
    return JSON.stringify({ error: `Directory API error: ${errorText}` });
  }

  const data = await response.json();
  const people = data.people || [];

  if (people.length === 0) {
    return JSON.stringify({
      results: [],
      message: `No one found matching "${query}" in the Gloo directory.`,
    });
  }

  const results = people.map((person: any) => {
    const name = person.names?.[0]?.displayName || "Unknown";
    const email = person.emailAddresses?.[0]?.value || null;
    const org = person.organizations?.[0] || {};
    return {
      name,
      email,
      title: org.title || null,
      department: org.department || null,
    };
  });

  return JSON.stringify({ results });
}

// Fallback: search via Google Contacts/People API if directory search requires extra scopes
async function searchGlooViaContacts(
  ctx: any,
  accessToken: string,
  query: string,
  pageSize: number,
): Promise<string> {
  // Try listing connections with a search
  const searchUrl = new URL(
    "https://people.googleapis.com/v1/people:searchContacts",
  );
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("readMask", "names,emailAddresses,organizations");
  searchUrl.searchParams.set("pageSize", String(Math.min(pageSize, 20)));

  const response = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return JSON.stringify({
      error:
        "Could not search Gloo directory. May need to add directory scopes to the Google OAuth connection.",
      suggestion:
        "Try searching by email directly or ask Josh for the person's email.",
    });
  }

  const data = await response.json();
  const results = (data.results || []).map((r: any) => {
    const person = r.person;
    const name = person.names?.[0]?.displayName || "Unknown";
    const email = person.emailAddresses?.[0]?.value || null;
    const org = person.organizations?.[0] || {};
    return {
      name,
      email,
      title: org.title || null,
      department: org.department || null,
    };
  });

  return JSON.stringify({
    results,
    note: "Results from Google Contacts (not full org directory). Some coworkers may be missing.",
  });
}

// ─── Email Tool Handlers ───

async function handleSearchEmails(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { query, fromPerson, triageStatus, limit } = input as {
    query: string;
    fromPerson?: string;
    triageStatus?: string;
    limit?: number;
  };

  const results = await ctx.runQuery(internal.chatAgent.searchEmails, {
    userId,
    query,
    fromPerson,
    triageStatus,
    limit,
  });

  if (results.length === 0) {
    return JSON.stringify({
      results: [],
      message: `No emails found matching "${query}"${fromPerson ? ` from ${fromPerson}` : ""}`,
    });
  }

  return JSON.stringify({
    results: results.map((e: any) => ({
      subject: e.subject,
      from: e.from,
      bodySnippet: e.body,
      threadId: e.threadId,
      triageStatus: e.triageStatus,
      account: e.accountEmail,
      receivedAt: new Date(e.receivedAt).toISOString(),
      hasDraft: !!e.draftReply,
    })),
    count: results.length,
  });
}

async function handleGetEmailThread(
  ctx: any,
  input: Record<string, unknown>,
): Promise<string> {
  const { threadId } = input as { threadId: string };

  const thread = await ctx.runQuery(internal.chatAgent.getEmailThread, {
    threadId,
  });

  if (thread.length === 0) {
    return JSON.stringify({ error: "No emails found in this thread" });
  }

  return JSON.stringify({
    thread: thread.map((e: any) => ({
      from: e.from,
      subject: e.subject,
      body: e.body,
      receivedAt: new Date(e.receivedAt).toISOString(),
    })),
    messageCount: thread.length,
  });
}

async function handleGetInboxSummary(
  ctx: any,
  userId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const { accountEmail } = input as { accountEmail?: string };

  const summary = await ctx.runQuery(internal.chatAgent.getInboxSummary, {
    userId,
    accountEmail,
  });

  return JSON.stringify({
    counts: summary.counts,
    urgentEmails: summary.urgent.map((e: any) => ({
      subject: e.subject,
      from: e.from,
      snippet: e.bodySnippet,
      receivedAt: new Date(e.receivedAt).toISOString(),
    })),
  });
}

// ─── Tool Dispatcher ───

async function executeTool(
  ctx: any,
  userId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (toolName) {
    case "check_availability":
      return handleCheckAvailability(ctx, userId, input);
    case "find_open_slots":
      return handleFindOpenSlots(ctx, userId, input);
    case "create_event":
      return handleCreateEvent(ctx, userId, input);
    case "get_my_calendar":
      return handleGetMyCalendar(ctx, userId, input);
    case "lookup_contact":
      return handleLookupContact(ctx, userId, input);
    case "search_gloo_directory":
      return handleSearchGlooDirectory(ctx, userId, input);
    case "search_emails":
      return handleSearchEmails(ctx, userId, input);
    case "get_email_thread":
      return handleGetEmailThread(ctx, input);
    case "get_inbox_summary":
      return handleGetInboxSummary(ctx, userId, input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ─── Main Chat Agent Action ───

export const chat = action({
  args: {
    message: v.string(),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Build messages array with history
    const messages: Message[] = [];

    for (const msg of args.conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: args.message });

    // Claude tool-use loop
    let maxIterations = 5;
    let currentMessages = [...messages];

    while (maxIterations > 0) {
      maxIterations--;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: buildSystemPrompt(),
          tools: TOOLS,
          messages: currentMessages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${errorText}`);
      }

      const data = await response.json();
      const content: ContentBlock[] = data.content;

      // Check if we need to handle tool calls
      const toolUses = content.filter(
        (block): block is ToolUseBlock => block.type === "tool_use",
      );

      if (toolUses.length === 0 || data.stop_reason === "end_turn") {
        // No tool calls — extract text response
        const textBlocks = content.filter(
          (block): block is TextBlock => block.type === "text",
        );
        return textBlocks.map((b) => b.text).join("\n");
      }

      // Handle tool calls
      currentMessages.push({ role: "assistant", content });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolUse of toolUses) {
        const result = await executeTool(
          ctx,
          userId,
          toolUse.name,
          toolUse.input,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      currentMessages.push({
        role: "user",
        content: toolResults as unknown as ContentBlock[],
      });
    }

    return "I ran into an issue processing your request — too many steps. Could you try a simpler request?";
  },
});
