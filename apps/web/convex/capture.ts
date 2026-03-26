import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// ─── Session Management ───

// Start a new capture session
export const startSession = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Stop any existing active sessions
    const active = await ctx.db
      .query("capture_sessions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "recording"),
      )
      .collect();

    for (const session of active) {
      await ctx.db.patch(session._id, {
        status: "stopped",
        stoppedAt: Date.now(),
      });
    }

    // Also stop paused sessions
    const paused = await ctx.db
      .query("capture_sessions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "paused"),
      )
      .collect();

    for (const session of paused) {
      await ctx.db.patch(session._id, {
        status: "stopped",
        stoppedAt: Date.now(),
      });
    }

    const now = Date.now();

    // Auto-detect current calendar meeting
    const calendarEvents = await ctx.db
      .query("calendar_events")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", args.userId).lte("startTime", now),
      )
      .order("desc")
      .take(10);

    // Find event that's currently happening (started before now, ends after now)
    const currentMeeting = calendarEvents.find(
      (e) => e.startTime <= now && e.endTime >= now,
    );

    return await ctx.db.insert("capture_sessions", {
      userId: args.userId,
      status: "recording",
      startedAt: now,
      totalDurationMs: 0,
      chunkCount: 0,
      ...(currentMeeting && {
        calendarEventId: currentMeeting._id,
        meetingTitle: currentMeeting.title,
        meetingAttendees: currentMeeting.attendees ?? [],
      }),
    });
  },
});

// Check for meeting transitions during recording (call periodically from client)
export const detectMeetingChange = mutation({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "recording") return null;

    const now = Date.now();
    const calendarEvents = await ctx.db
      .query("calendar_events")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", session.userId).lte("startTime", now),
      )
      .order("desc")
      .take(10);

    const currentMeeting = calendarEvents.find(
      (e) => e.startTime <= now && e.endTime >= now,
    );

    const currentEventId = currentMeeting?._id ?? null;
    const previousEventId = session.calendarEventId ?? null;

    // Meeting changed — update session
    if (currentEventId !== previousEventId) {
      await ctx.db.patch(args.sessionId, {
        calendarEventId: currentMeeting?._id,
        meetingTitle: currentMeeting?.title,
        meetingAttendees: currentMeeting?.attendees ?? [],
      });
      return {
        changed: true,
        meetingTitle: currentMeeting?.title ?? null,
        attendees: currentMeeting?.attendees ?? [],
      };
    }

    return { changed: false, meetingTitle: session.meetingTitle ?? null, attendees: session.meetingAttendees ?? [] };
  },
});

// Get current meeting context for a session
export const getSessionMeetingContext = query({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    let calendarEvent = null;
    if (session.calendarEventId) {
      calendarEvent = await ctx.db.get(session.calendarEventId);
    }

    return {
      meetingTitle: session.meetingTitle ?? null,
      attendees: session.meetingAttendees ?? [],
      calendarEvent: calendarEvent
        ? {
            title: calendarEvent.title,
            description: calendarEvent.description,
            startTime: calendarEvent.startTime,
            endTime: calendarEvent.endTime,
            attendees: calendarEvent.attendees ?? [],
          }
        : null,
    };
  },
});

// Pause the session
export const pauseSession = mutation({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: "paused" });
  },
});

// Resume the session
export const resumeSession = mutation({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { status: "recording" });
  },
});

// Stop the session
export const stopSession = mutation({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "stopped",
      stoppedAt: Date.now(),
    });
  },
});

// Get the active session for a user
export const getActiveSession = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Check recording first, then paused
    const recording = await ctx.db
      .query("capture_sessions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "recording"),
      )
      .first();

    if (recording) return recording;

    return await ctx.db
      .query("capture_sessions")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "paused"),
      )
      .first();
  },
});

// List recent sessions
export const listSessions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const sessions = await ctx.db
      .query("capture_sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return sessions;
  },
});

// ─── Chunk Upload ───

// Generate an upload URL for audio chunks
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Store a chunk after upload
export const storeChunk = mutation({
  args: {
    sessionId: v.id("capture_sessions"),
    chunkIndex: v.number(),
    storageId: v.id("_storage"),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Insert the chunk
    const chunkId = await ctx.db.insert("capture_chunks", {
      sessionId: args.sessionId,
      chunkIndex: args.chunkIndex,
      audioFileId: args.storageId,
      status: "uploaded",
      durationMs: args.durationMs,
    });

    // Update session chunk count and duration
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      await ctx.db.patch(args.sessionId, {
        chunkCount: session.chunkCount + 1,
        totalDurationMs: session.totalDurationMs + (args.durationMs ?? 60000),
      });
    }

    // Schedule transcription
    await ctx.scheduler.runAfter(0, internal.capture.transcribeChunk, {
      chunkId,
    });

    return chunkId;
  },
});

// ─── Transcription ───

// Internal: get chunk details
export const getChunk = internalQuery({
  args: { chunkId: v.id("capture_chunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chunkId);
  },
});

// Internal: update chunk status
export const updateChunkStatus = internalMutation({
  args: {
    chunkId: v.id("capture_chunks"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("transcribing"),
      v.literal("transcribed"),
      v.literal("error"),
    ),
    transcriptText: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
      processedAt: Date.now(),
    };
    if (args.transcriptText !== undefined) {
      updates.transcriptText = args.transcriptText;
    }
    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }
    await ctx.db.patch(args.chunkId, updates);
  },
});

// Internal: update session context
export const updateSessionContext = internalMutation({
  args: {
    sessionId: v.id("capture_sessions"),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { currentContext: args.context });
  },
});

// Transcribe a chunk using Deepgram
export const transcribeChunk = internalAction({
  args: { chunkId: v.id("capture_chunks") },
  handler: async (ctx, args) => {
    const chunk = await ctx.runQuery(internal.capture.getChunk, {
      chunkId: args.chunkId,
    });

    if (!chunk) {
      console.error("Chunk not found:", args.chunkId);
      return;
    }

    // Mark as transcribing
    await ctx.runMutation(internal.capture.updateChunkStatus, {
      chunkId: args.chunkId,
      status: "transcribing",
    });

    try {
      // Get the audio blob from storage
      const audioUrl = await ctx.storage.getUrl(chunk.audioFileId);
      if (!audioUrl) {
        throw new Error("Audio file not found in storage");
      }

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error("Failed to fetch audio from storage");
      }

      const audioBlob = await audioResponse.arrayBuffer();

      let transcript: string;

      if (ASSEMBLYAI_API_KEY) {
        // Use AssemblyAI (preferred)
        transcript = await transcribeWithAssemblyAI(audioBlob);
      } else {
        // Fallback: use OpenAI Whisper API
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (OPENAI_API_KEY) {
          transcript = await transcribeWithWhisper(audioBlob, OPENAI_API_KEY);
        } else {
          throw new Error(
            "No transcription API key configured. Set ASSEMBLYAI_API_KEY or OPENAI_API_KEY in Convex env vars.",
          );
        }
      }

      // Save transcript
      await ctx.runMutation(internal.capture.updateChunkStatus, {
        chunkId: args.chunkId,
        status: "transcribed",
        transcriptText: transcript,
      });

      // Update rolling context every 5 chunks
      if (chunk.chunkIndex > 0 && chunk.chunkIndex % 5 === 0) {
        await updateRollingContext(ctx, chunk.sessionId);
      }

      // Schedule AI task extraction
      await ctx.scheduler.runAfter(0, internal.capture.extractTasksFromChunk, {
        chunkId: args.chunkId,
        sessionId: chunk.sessionId,
      });
    } catch (error) {
      console.error("Transcription error:", error);
      await ctx.runMutation(internal.capture.updateChunkStatus, {
        chunkId: args.chunkId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// AssemblyAI transcription
async function transcribeWithAssemblyAI(
  audioData: ArrayBuffer,
): Promise<string> {
  // Step 1: Upload audio to AssemblyAI
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: ASSEMBLYAI_API_KEY!,
      "Content-Type": "application/octet-stream",
    },
    body: audioData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`AssemblyAI upload error: ${await uploadResponse.text()}`);
  }

  const { upload_url } = await uploadResponse.json();

  // Step 2: Create transcript with speaker diarization
  const transcriptResponse = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        language_code: "en",
      }),
    },
  );

  if (!transcriptResponse.ok) {
    throw new Error(
      `AssemblyAI transcript error: ${await transcriptResponse.text()}`,
    );
  }

  const { id: transcriptId } = await transcriptResponse.json();

  // Step 3: Poll for completion (max ~2 minutes for a 60s chunk)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s between polls

    const pollResponse = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: { Authorization: ASSEMBLYAI_API_KEY! },
      },
    );

    if (!pollResponse.ok) {
      throw new Error(`AssemblyAI poll error: ${await pollResponse.text()}`);
    }

    const result = await pollResponse.json();

    if (result.status === "completed") {
      // Format with speaker labels if available
      if (result.utterances && result.utterances.length > 0) {
        return result.utterances
          .map((u: any) => `[Speaker ${u.speaker}]: ${u.text}`)
          .join("\n");
      }
      return result.text || "[No speech detected]";
    }

    if (result.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${result.error}`);
    }

    // status is "queued" or "processing" — keep polling
  }

  throw new Error("AssemblyAI transcription timed out");
}

// Whisper transcription (fallback)
async function transcribeWithWhisper(
  audioData: ArrayBuffer,
  apiKey: string,
): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioData], { type: "audio/webm" }),
    "chunk.webm",
  );
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(`Whisper API error: ${await response.text()}`);
  }

  const text = await response.text();
  return text.trim() || "[No speech detected]";
}

// Update rolling context summary
async function updateRollingContext(ctx: any, sessionId: string) {
  // Get recent transcripts (last 5 chunks)
  const chunks = await ctx.runQuery(internal.capture.getRecentTranscripts, {
    sessionId,
    limit: 5,
  });

  if (chunks.length === 0) return;

  const combinedText = chunks
    .filter((c: any) => c.transcriptText)
    .map((c: any) => c.transcriptText)
    .join("\n\n");

  if (!combinedText) return;

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Summarize this conversation in 2-3 sentences, focusing on key topics, people mentioned, and any action items or decisions. Keep it brief — this is context for understanding what comes next.\n\n${combinedText.slice(0, 3000)}`,
        },
      ],
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const summary = data.content[0].text;
    await ctx.runMutation(internal.capture.updateSessionContext, {
      sessionId,
      context: summary,
    });
  }
}

// Internal: get recent transcripts for context building
export const getRecentTranscripts = internalQuery({
  args: {
    sessionId: v.id("capture_sessions"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("capture_chunks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit);

    return chunks.reverse();
  },
});

// ─── Queries for UI ───

// Get transcript for a session (all chunks combined)
export const getSessionTranscript = query({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("capture_chunks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return chunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map((c) => ({
        chunkIndex: c.chunkIndex,
        status: c.status,
        transcript: c.transcriptText,
        durationMs: c.durationMs,
      }));
  },
});

// ─── AI Task Extraction (Sprint 2) ───

// Get session for context
export const getSession = internalQuery({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Insert extracted live task
export const insertLiveTask = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("capture_sessions"),
    chunkId: v.id("capture_chunks"),
    description: v.string(),
    owner: v.union(v.literal("josh"), v.literal("team")),
    ownerName: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    deadline: v.optional(v.string()),
    urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.union(
      v.literal("task"),
      v.literal("commitment"),
      v.literal("decision"),
      v.literal("follow_up"),
      v.literal("question"),
    ),
    sourceText: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("live_tasks", {
      ...args,
      status: "pending",
    });
  },
});

// Extract tasks from a transcribed chunk
export const extractTasksFromChunk = internalAction({
  args: {
    chunkId: v.id("capture_chunks"),
    sessionId: v.id("capture_sessions"),
  },
  handler: async (ctx, args) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not set, skipping task extraction");
      return;
    }

    const chunk = await ctx.runQuery(internal.capture.getChunk, {
      chunkId: args.chunkId,
    });

    if (!chunk || !chunk.transcriptText) return;

    // Get session context
    const session = await ctx.runQuery(internal.capture.getSession, {
      sessionId: args.sessionId,
    });

    const contextBlock = session?.currentContext
      ? `\nContext from earlier in the day:\n${session.currentContext}\n`
      : "";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `You are analyzing a live transcript from Josh Burnett's workday (Head of AI Product at Gloo). Extract any actionable items.

Look for:
1. TASK — something someone needs to do ("I'll send that over", "Can you update the doc?")
2. COMMITMENT — a promise made ("I'll have that by Friday", "We'll ship next week")
3. DECISION — a choice made ("Let's go with option B", "We're killing that feature")
4. FOLLOW_UP — something to revisit ("Let's circle back", "Remind me to check")
5. QUESTION — an unresolved question that needs answering

For each item, determine:
- description: clear, actionable summary (not the raw quote)
- owner: "josh" if it's Josh's responsibility, "team" if someone else's
- ownerName: the person's name if identifiable (e.g. "Doug", "Sarah")
- assignedTo: who needs to act on it
- deadline: any mentioned deadline (e.g. "by Friday", "next week")
- urgency: "high" (explicit deadline or urgent language), "medium" (important but no rush), "low" (nice-to-have)
- category: one of task, commitment, decision, follow_up, question
- sourceText: the exact relevant quote from the transcript

Respond with a JSON array. If nothing actionable is found, respond with an empty array [].
Do NOT extract greetings, small talk, or routine conversation. Only extract genuine action items and commitments.
${contextBlock}
Current transcript chunk:
${chunk.transcriptText}

Respond with ONLY a JSON array, no other text:`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Extraction API error:", await response.text());
      return;
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Parse JSON response
    let items: Array<{
      description: string;
      owner: string;
      ownerName?: string;
      assignedTo?: string;
      deadline?: string;
      urgency: string;
      category: string;
      sourceText: string;
    }>;

    try {
      // Handle potential markdown code block wrapping
      const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      items = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse extraction response:", text);
      return;
    }

    if (!Array.isArray(items) || items.length === 0) return;

    // Insert each extracted task
    for (const item of items) {
      const owner =
        item.owner === "josh" ? ("josh" as const) : ("team" as const);
      const urgency = (
        ["low", "medium", "high"].includes(item.urgency)
          ? item.urgency
          : "medium"
      ) as "low" | "medium" | "high";
      const category = (
        ["task", "commitment", "decision", "follow_up", "question"].includes(
          item.category,
        )
          ? item.category
          : "task"
      ) as "task" | "commitment" | "decision" | "follow_up" | "question";

      await ctx.runMutation(internal.capture.insertLiveTask, {
        userId: session?.userId ?? "josh",
        sessionId: args.sessionId,
        chunkId: args.chunkId,
        description: item.description,
        owner,
        ownerName: item.ownerName,
        assignedTo: item.assignedTo,
        deadline: item.deadline,
        urgency,
        category,
        sourceText: item.sourceText || item.description,
        timestamp: Date.now(),
      });
    }
  },
});

// ─── Live Task Queries ───

// Get live tasks for a user (real-time feed)
export const getLiveTasks = query({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("capture_sessions")),
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("mine"),
        v.literal("team"),
        v.literal("decisions"),
        v.literal("pending"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let tasks;
    const sessionId = args.sessionId;

    if (sessionId) {
      tasks = await ctx.db
        .query("live_tasks")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
    } else {
      tasks = await ctx.db
        .query("live_tasks")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    // Apply filter
    const filter = args.filter ?? "all";
    if (filter === "mine") {
      tasks = tasks.filter((t) => t.owner === "josh");
    } else if (filter === "team") {
      tasks = tasks.filter((t) => t.owner === "team");
    } else if (filter === "decisions") {
      tasks = tasks.filter((t) => t.category === "decision");
    } else if (filter === "pending") {
      tasks = tasks.filter((t) => t.status === "pending");
    }

    // Sort by most recent first
    return tasks.sort((a, b) => b.timestamp - a.timestamp);
  },
});

// Get live task counts by category
export const getLiveTaskCounts = query({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("capture_sessions")),
  },
  handler: async (ctx, args) => {
    let tasks;
    const sessionId = args.sessionId;
    if (sessionId) {
      tasks = await ctx.db
        .query("live_tasks")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
    } else {
      tasks = await ctx.db
        .query("live_tasks")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      mine: tasks.filter((t) => t.owner === "josh").length,
      team: tasks.filter((t) => t.owner === "team").length,
      tasks: tasks.filter((t) => t.category === "task").length,
      commitments: tasks.filter((t) => t.category === "commitment").length,
      decisions: tasks.filter((t) => t.category === "decision").length,
      followUps: tasks.filter((t) => t.category === "follow_up").length,
    };
  },
});

// Approve a live task
export const approveLiveTask = mutation({
  args: { taskId: v.id("live_tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: "approved" });
  },
});

// Dismiss a live task
export const dismissLiveTask = mutation({
  args: { taskId: v.id("live_tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: "dismissed" });
  },
});

// Convert a live task to a real task
export const convertLiveTask = mutation({
  args: { liveTaskId: v.id("live_tasks") },
  handler: async (ctx, args) => {
    const liveTask = await ctx.db.get(args.liveTaskId);
    if (!liveTask) throw new Error("Live task not found");

    // Create a real task
    const taskId = await ctx.db.insert("tasks", {
      userId: liveTask.userId,
      title: liveTask.description,
      description: `Source: Live Capture\nQuote: "${liveTask.sourceText}"${liveTask.deadline ? `\nDeadline: ${liveTask.deadline}` : ""}${liveTask.assignedTo ? `\nAssigned to: ${liveTask.assignedTo}` : ""}`,
      source: "recording",
      priority:
        liveTask.urgency === "high"
          ? "urgent"
          : liveTask.urgency === "medium"
            ? "medium"
            : "low",
      status: "todo",
    });

    // Update live task
    await ctx.db.patch(args.liveTaskId, {
      status: "converted",
      taskId,
    });

    return taskId;
  },
});

// ─── Real-Time Streaming ───

// Store a final transcript segment from WebSocket stream
export const storeTranscriptSegment = mutation({
  args: {
    sessionId: v.id("capture_sessions"),
    text: v.string(),
    speaker: v.optional(v.string()),
    startMs: v.number(),
    endMs: v.number(),
    isFinal: v.boolean(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("transcript_segments", args);

    // Every 10 final segments, trigger a summary update
    if (args.isFinal) {
      const finalSegments = await ctx.db
        .query("transcript_segments")
        .withIndex("by_session_and_final", (q) =>
          q.eq("sessionId", args.sessionId).eq("isFinal", true),
        )
        .collect();

      if (finalSegments.length > 0 && finalSegments.length % 10 === 0) {
        await ctx.scheduler.runAfter(0, internal.capture.updateSessionSummary, {
          sessionId: args.sessionId,
        });
      }
    }

    return id;
  },
});

// Update partial transcript on session (for live display without storing each partial)
export const storePartialTranscript = mutation({
  args: {
    sessionId: v.id("capture_sessions"),
    partialText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { currentContext: args.partialText });
  },
});

// Get transcript segments for a session
export const getTranscriptSegments = query({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcript_segments")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

// Get session summary
export const getSessionSummary = query({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("session_summaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Internal: get all final segments for summary generation
export const getFinalSegments = internalQuery({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcript_segments")
      .withIndex("by_session_and_final", (q) =>
        q.eq("sessionId", args.sessionId).eq("isFinal", true),
      )
      .order("asc")
      .collect();
  },
});

// Internal: upsert session summary
export const upsertSessionSummary = internalMutation({
  args: {
    sessionId: v.id("capture_sessions"),
    summary: v.string(),
    topics: v.array(v.string()),
    actionItems: v.array(
      v.object({
        description: v.string(),
        assignedTo: v.optional(v.string()),
        urgency: v.string(),
      }),
    ),
    peopleMentioned: v.optional(
      v.array(
        v.object({
          name: v.string(),
          context: v.optional(v.string()),
        }),
      ),
    ),
    segmentCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("session_summaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const data = {
      sessionId: args.sessionId,
      summary: args.summary,
      topics: args.topics,
      actionItems: args.actionItems,
      peopleMentioned: args.peopleMentioned,
      updatedAt: Date.now(),
      segmentCount: args.segmentCount,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("session_summaries", data);
    }
  },
});

// Action: generate/update session summary using Claude
export const updateSessionSummary = internalAction({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.warn("ANTHROPIC_API_KEY not set, skipping summary generation");
      return;
    }

    const segments = await ctx.runQuery(internal.capture.getFinalSegments, {
      sessionId: args.sessionId,
    });

    if (segments.length === 0) return;

    const transcriptText = segments
      .map((s) => {
        const time = new Date(s.startMs).toISOString().substr(11, 8);
        const speaker = s.speaker ? `[${s.speaker}] ` : "";
        return `[${time}] ${speaker}${s.text}`;
      })
      .join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `Analyze this live meeting/conversation transcript and provide a structured summary.

Transcript:
${transcriptText.slice(0, 8000)}

Respond with ONLY valid JSON matching this structure:
{
  "summary": "2-4 sentence paragraph summarizing the conversation",
  "topics": ["topic1", "topic2", "topic3"],
  "actionItems": [
    { "description": "action item", "assignedTo": "person name or null", "urgency": "high|medium|low" }
  ],
  "peopleMentioned": [
    { "name": "person name", "context": "brief context about their role/relationship" }
  ]
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Summary API error:", await response.text());
      return;
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    let parsed: {
      summary: string;
      topics: string[];
      actionItems: Array<{
        description: string;
        assignedTo?: string;
        urgency: string;
      }>;
      peopleMentioned?: Array<{ name: string; context?: string }>;
    };

    try {
      const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Failed to parse summary response:", text);
      return;
    }

    await ctx.runMutation(internal.capture.upsertSessionSummary, {
      sessionId: args.sessionId,
      summary: parsed.summary,
      topics: parsed.topics || [],
      actionItems: (parsed.actionItems || []).map((item) => ({
        description: item.description,
        assignedTo: item.assignedTo ?? undefined,
        urgency: item.urgency || "medium",
      })),
      peopleMentioned: parsed.peopleMentioned?.map((p) => ({
        name: p.name,
        context: p.context ?? undefined,
      })),
      segmentCount: segments.length,
    });
  },
});

// Get chunk stats for a session
export const getSessionStats = query({
  args: { sessionId: v.id("capture_sessions") },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("capture_chunks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const stats = {
      total: chunks.length,
      uploaded: chunks.filter((c) => c.status === "uploaded").length,
      transcribing: chunks.filter((c) => c.status === "transcribing").length,
      transcribed: chunks.filter((c) => c.status === "transcribed").length,
      error: chunks.filter((c) => c.status === "error").length,
    };

    return stats;
  },
});
