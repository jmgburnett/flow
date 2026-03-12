import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

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

		return await ctx.db.insert("capture_sessions", {
			userId: args.userId,
			status: "recording",
			startedAt: Date.now(),
			totalDurationMs: 0,
			chunkCount: 0,
		});
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

			if (DEEPGRAM_API_KEY) {
				// Use Deepgram
				transcript = await transcribeWithDeepgram(audioBlob);
			} else {
				// Fallback: use OpenAI Whisper API
				const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
				if (OPENAI_API_KEY) {
					transcript = await transcribeWithWhisper(audioBlob, OPENAI_API_KEY);
				} else {
					throw new Error(
						"No transcription API key configured. Set DEEPGRAM_API_KEY or OPENAI_API_KEY in Convex env vars.",
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

// Deepgram transcription
async function transcribeWithDeepgram(audioData: ArrayBuffer): Promise<string> {
	const response = await fetch(
		"https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true",
		{
			method: "POST",
			headers: {
				Authorization: `Token ${DEEPGRAM_API_KEY}`,
				"Content-Type": "audio/webm",
			},
			body: audioData,
		},
	);

	if (!response.ok) {
		throw new Error(`Deepgram API error: ${await response.text()}`);
	}

	const data = await response.json();

	// Extract transcript with speaker labels
	const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || [];

	if (words.length === 0) {
		const plainTranscript =
			data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
		return plainTranscript || "[No speech detected]";
	}

	// Group words by speaker
	let currentSpeaker = -1;
	const segments: string[] = [];
	let currentSegment = "";

	for (const word of words) {
		if (word.speaker !== currentSpeaker) {
			if (currentSegment) {
				segments.push(`[Speaker ${currentSpeaker}]: ${currentSegment.trim()}`);
			}
			currentSpeaker = word.speaker;
			currentSegment = word.punctuated_word || word.word;
		} else {
			currentSegment += ` ${word.punctuated_word || word.word}`;
		}
	}

	if (currentSegment) {
		segments.push(`[Speaker ${currentSpeaker}]: ${currentSegment.trim()}`);
	}

	return segments.join("\n");
}

// Whisper transcription (fallback)
async function transcribeWithWhisper(
	audioData: ArrayBuffer,
	apiKey: string,
): Promise<string> {
	const formData = new FormData();
	formData.append("file", new Blob([audioData], { type: "audio/webm" }), "chunk.webm");
	formData.append("model", "whisper-1");
	formData.append("response_format", "text");

	const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		body: formData,
	});

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
