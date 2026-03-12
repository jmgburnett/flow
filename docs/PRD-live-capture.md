# PRD: Live Capture — Always-On Audio + Real-Time Task Extraction

**Author:** Flobot (with Josh)  
**Date:** March 12, 2026  
**Status:** Draft  

---

## Vision

Josh hits "record" in the morning and Flow listens all day — meetings, calls, hallway conversations, voice memos. As the day unfolds, Flow is transcribing in near-real-time, extracting tasks, commitments, decisions, and action items. A live feed shows what's landing on Josh's plate and what his team is committing to — no manual entry, no end-of-day brain dump.

**The insight:** The most valuable data in a leader's day is spoken, not typed. Emails and Slack capture maybe 30% of commitments. The rest evaporates. Live Capture fixes that.

---

## Core User Stories

1. **As Josh**, I want to start recording when my day begins and forget about it — Flow handles the rest.
2. **As Josh**, I want to glance at Flow mid-day and see every commitment that's been made — mine and my team's — without reviewing hours of audio.
3. **As Josh**, I want to ask Flobot "what did I commit to in the meeting with Doug?" and get an instant answer.
4. **As Josh**, I want tasks auto-created from conversations, tagged with who owns them and when they're due.
5. **As Josh**, I want to review and approve/dismiss extracted tasks, not have them auto-fire without my sign-off.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                   Browser / PWA                   │
│                                                   │
│  ┌─────────────┐    ┌──────────────────────────┐ │
│  │ MediaRecorder│───▶│ Audio Chunks (30-60s)    │ │
│  │ (always-on)  │    │ uploaded via Convex       │ │
│  └─────────────┘    └──────────┬───────────────┘ │
│                                │                  │
│  ┌─────────────────────────────▼────────────────┐│
│  │           Live Task Feed UI                   ││
│  │  • New tasks appearing in real-time           ││
│  │  • "Your tasks" vs "Team commitments"         ││
│  │  • Approve / Dismiss / Edit                   ││
│  └───────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│                 Convex Backend                    │
│                                                   │
│  1. Store audio chunk in _storage                 │
│  2. Transcribe (Deepgram streaming or Whisper)    │
│  3. Append to running transcript                  │
│  4. AI extraction pipeline:                       │
│     a. Identify speakers (diarization)            │
│     b. Extract tasks, commitments, decisions      │
│     c. Assign to people (match against contacts)  │
│     d. Detect urgency / deadlines                 │
│  5. Insert into live_tasks table                  │
│  6. Client gets real-time updates via Convex sub  │
└──────────────────────────────────────────────────┘
```

---

## Technical Design

### Phase 1: Record + Transcribe + Extract (MVP)

#### 1.1 Audio Recording (Browser)

- **MediaRecorder API** with `audio/webm;codecs=opus` (small files, good quality)
- Record in **60-second chunks** — each chunk uploaded immediately
- Visual indicator: red dot + elapsed time (like iOS voice memos)
- Pause/resume without losing state
- Works in background tab (with `keepalive` and service worker)
- **Mobile PWA support** — must work on iPhone/Android browser
- Battery consideration: opus encoding is lightweight; the upload is the main drain

```typescript
// Simplified recording loop
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
recorder.ondataavailable = (e) => uploadChunk(e.data, sessionId, chunkIndex++);
recorder.start(60000); // 60s chunks
```

#### 1.2 Convex Schema Additions

```typescript
// A recording session (one per "day" or manually started/stopped)
capture_sessions: defineTable({
  userId: v.string(),
  status: v.union(v.literal("recording"), v.literal("paused"), v.literal("stopped")),
  startedAt: v.number(),
  stoppedAt: v.optional(v.number()),
  totalDurationMs: v.number(),
  chunkCount: v.number(),
  // Running context for AI (updated as chunks process)
  currentContext: v.optional(v.string()), // rolling summary of recent conversation
})

// Individual audio chunks
capture_chunks: defineTable({
  sessionId: v.id("capture_sessions"),
  chunkIndex: v.number(),
  audioFileId: v.id("_storage"),
  status: v.union(
    v.literal("uploaded"),
    v.literal("transcribing"),
    v.literal("transcribed"),
    v.literal("extracted"),
    v.literal("error"),
  ),
  transcriptText: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  processedAt: v.optional(v.number()),
})

// Tasks extracted from live capture
live_tasks: defineTable({
  userId: v.string(),
  sessionId: v.id("capture_sessions"),
  chunkId: v.id("capture_chunks"),
  // Task details
  description: v.string(),
  owner: v.union(v.literal("josh"), v.literal("team")),
  ownerName: v.optional(v.string()), // "Doug", "Sarah", etc.
  ownerContactId: v.optional(v.id("contacts")),
  assignedTo: v.optional(v.string()), // who needs to do it
  deadline: v.optional(v.string()), // extracted deadline text
  urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  category: v.union(
    v.literal("task"),        // "I need to send Doug the report"
    v.literal("commitment"),  // "I'll have that to you by Friday"
    v.literal("decision"),    // "Let's go with option B"
    v.literal("follow_up"),   // "Let's circle back on this next week"
    v.literal("question"),    // unresolved question that needs answering
  ),
  // Context
  sourceText: v.string(), // the exact transcript excerpt
  timestamp: v.number(),  // when in the recording this was said
  // User actions
  status: v.union(
    v.literal("pending"),    // just extracted, needs review
    v.literal("approved"),   // user confirmed it's real
    v.literal("dismissed"),  // false positive
    v.literal("converted"),  // turned into a real task
  ),
  taskId: v.optional(v.id("tasks")), // linked task after conversion
})
```

#### 1.3 Transcription Pipeline

**Option A: Deepgram Streaming (recommended)**
- WebSocket-based, near-real-time transcription
- Supports speaker diarization out of the box
- ~$0.0043/min (Nova-2 model) — a full 8-hour day is ~$2
- Latency: <1 second for interim results

**Option B: Whisper (self-hosted or API)**
- Process 60s chunks as they arrive
- Slower (5-10s per chunk) but no streaming dependency
- No built-in diarization (would need pyannote or similar)

**Recommendation:** Start with **Deepgram Nova-2** for streaming transcription + diarization. Fall back to chunk-based Whisper if cost is a concern later.

#### 1.4 AI Extraction Pipeline

Each transcribed chunk runs through Claude (Haiku for speed/cost) with:

```
System: You are analyzing a live transcript from Josh Burnett's day. Extract any:
1. TASKS — things someone needs to do ("I'll send that over", "Can you update the doc?")
2. COMMITMENTS — promises made ("I'll have that by Friday", "We'll ship it next week")  
3. DECISIONS — choices made ("Let's go with the blue design", "We're killing that feature")
4. FOLLOW-UPS — things to revisit ("Let's circle back", "Remind me to check on this")

For each, identify:
- WHO said it (speaker name if identifiable)
- WHO it's assigned to (Josh or a team member)
- URGENCY (low/medium/high)
- Any DEADLINE mentioned
- The exact quote from the transcript

Context from earlier in the day:
{rolling_context_summary}

Current chunk transcript:
{transcript_text}
```

**Rolling context:** After every 5 chunks, generate a summary of the conversation so far. This keeps the extraction contextual without sending the full day's transcript every time.

#### 1.5 Live Task Feed UI

Split-screen or tabbed view on the home page:

```
┌─────────────────────────────────────────────┐
│  🔴 Recording — 2h 34m                [⏸ ⏹] │
├──────────────────────┬──────────────────────┤
│                      │  LIVE FEED           │
│    Chat with         │                      │
│    Flobot            │  🆕 2:31 PM          │
│                      │  "Send Doug the      │
│    (existing         │   pricing deck"      │
│     chat UI)         │  → You  ⚡ High      │
│                      │  [✓ Approve] [✕]     │
│                      │                      │
│                      │  🆕 2:28 PM          │
│                      │  "Sarah will update  │
│                      │   the onboarding     │
│                      │   flow by Monday"    │
│                      │  → Sarah  📋 Team    │
│                      │  [✓] [✕]             │
│                      │                      │
│                      │  ✅ 1:45 PM          │
│                      │  "Go with Convex     │
│                      │   for the backend"   │
│                      │  → Decision          │
│                      │  [Approved]          │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

- Real-time updates via Convex subscriptions (no polling)
- Tasks appear as they're extracted — feels alive
- Filter: "My Tasks" / "Team" / "Decisions" / "All"
- Approve → creates a real task in the tasks table
- Dismiss → marks as false positive (trains future extraction)

---

### Phase 2: Intelligence Layer

#### 2.1 Speaker Identification
- Use Deepgram's diarization to separate speakers
- Match speakers to known contacts by voice profile (stretch goal)
- For MVP: AI infers who's speaking from context ("Hey Doug, can you...")

#### 2.2 Meeting Detection
- Detect meeting start/end from audio patterns (multiple speakers, formal greetings)
- Auto-tag transcript segments as "Meeting with [attendees]"
- Cross-reference with calendar: if there's a meeting at 2pm with Doug, tag that section

#### 2.3 Smart Summaries
- End of each meeting: auto-generate summary + action items
- End of day: daily digest of everything captured
- "What happened today?" → Flobot searches the day's transcript

#### 2.4 Embeddings Integration
- Embed transcript chunks for semantic search (ties into the RAG feature)
- "What did we discuss about pricing last week?" → searches embedded transcripts
- This is where Live Capture + the embeddings feature from earlier converge

---

### Phase 3: Team Visibility

#### 3.1 Commitment Tracking
- Track commitments over time: "Sarah said she'd do X by Monday" → check on Tuesday if it's done
- Flobot can proactively remind: "Sarah committed to updating the onboarding flow by today. Want me to check in?"

#### 3.2 Decision Log
- Searchable log of all decisions made in conversations
- "When did we decide to go with Convex?" → exact timestamp and context

#### 3.3 Team Task Board
- Live view of what each team member has committed to (from captured conversations)
- Not a traditional Kanban — more like "commitments heard today"

---

## Cost Analysis

| Component | Cost | Notes |
|-----------|------|-------|
| Deepgram Nova-2 | ~$2/day | 8 hours of audio |
| Claude Haiku extraction | ~$0.50/day | ~480 chunks × small prompt |
| Convex storage | ~$0.10/day | Audio chunks (auto-cleanup after 30 days) |
| Embeddings (Phase 2) | ~$0.05/day | OpenAI text-embedding-3-small |
| **Total** | **~$2.65/day** | **~$80/month** |

This is incredibly cheap for what it does. A human assistant doing this would cost $4,000+/month.

---

## Privacy & Consent

- **Recording indicator** must be visible at all times (red dot)
- **Two-party consent:** Josh needs to inform meeting participants in states that require it (Tennessee is one-party consent, but some meeting participants may be in other states)
- **Auto-pause in certain apps** (stretch): detect if Josh opens a personal app/browser
- **Data retention:** Auto-delete raw audio after 30 days, keep only transcripts and extracted items
- **No sharing:** Extracted tasks are visible only to Josh, not to team members (unless he explicitly shares)

---

## Technical Risks

| Risk | Mitigation |
|------|------------|
| Browser tab killed = recording lost | Service worker + periodic chunk upload (60s max loss) |
| Battery drain on mobile | Opus is efficient; test empirically. Offer "low power" mode with longer chunks |
| Noisy environments = bad transcription | Deepgram handles noise well; flag low-confidence segments |
| False positive tasks | Human review step (approve/dismiss). ML improves over time |
| Cost scales with hours recorded | Cap at 10h/day. Offer "meetings only" mode |
| Multi-speaker confusion | Deepgram diarization + calendar cross-reference |

---

## Implementation Plan

### Sprint 1 (Week 1-2): Recording + Transcription
- [ ] `capture_sessions` and `capture_chunks` tables
- [ ] Browser MediaRecorder component with start/stop/pause
- [ ] Chunk upload to Convex storage
- [ ] Deepgram integration (streaming or chunk-based)
- [ ] Transcript stored per chunk
- [ ] Basic recording UI with red dot + timer

### Sprint 2 (Week 2-3): AI Extraction + Live Feed
- [ ] `live_tasks` table
- [ ] Claude extraction pipeline (runs after each chunk transcribed)
- [ ] Rolling context summary (every 5 chunks)
- [ ] Live Task Feed component with real-time Convex subscriptions
- [ ] Approve/Dismiss actions
- [ ] Convert to task (links to existing tasks table)

### Sprint 3 (Week 3-4): Integration + Polish
- [ ] Calendar cross-reference (tag segments with meeting names)
- [ ] Meeting-end auto-summary
- [ ] "Ask about today" in Flobot chat (searches day's transcript)
- [ ] End-of-day digest
- [ ] Mobile PWA testing + battery optimization
- [ ] Data retention policy (auto-cleanup)

### Sprint 4 (Week 4-5): Intelligence + Embeddings
- [ ] Embed transcript chunks for semantic search
- [ ] Commitment tracking across days
- [ ] Decision log
- [ ] Proactive reminders ("Sarah's deadline is today")

---

## Success Metrics

- **Capture rate:** % of commitments from meetings that are captured vs. manual tracking
- **False positive rate:** % of extracted tasks that are dismissed (target: <30%)
- **Time saved:** Minutes per day Josh spends on manual task entry (target: save 30+ min)
- **Adoption:** Does Josh actually leave it recording? (usage hours/day)

---

## Open Questions

1. **Deepgram vs Whisper?** Deepgram is better for real-time but adds a vendor. Whisper is free but slower.
2. **Recording scope:** All day, or just meetings? All-day is more powerful but more audio to process.
3. **Team access:** Should team members ever see commitments extracted from Josh's recordings? Or is this Josh-only?
4. **Phone calls:** Can we also capture Telnyx calls and feed them into the same pipeline?
5. **Offline recording:** Should it work when the phone has no connection? (record locally, upload later)

---

*This feature turns Flow from a dashboard into a true AI Chief of Staff that's listening, learning, and organizing in real-time. It's the kind of thing that, once you have it, you wonder how you ever worked without it.*
