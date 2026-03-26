# Task: Real-Time Streaming Transcription with Live Summary

## What to Build

Replace the current batch chunk-upload-and-poll transcription system with AssemblyAI's real-time WebSocket streaming API. The recordings page should have two live panels:

1. **Top Panel — Live Streaming Transcript**: Words appear in real-time as the user speaks. Speaker labels when possible. Partial (gray/italic) words that solidify into final text.
2. **Bottom Panel — Running Summary + Action Items**: AI-generated summary that updates every ~30-60 seconds of new final transcript. Shows topics discussed, key decisions, and action items with suggested assignees.

## Architecture

### Browser-Side (capture-provider.tsx)
- Use AudioWorklet or ScriptProcessorNode to capture raw PCM16 audio at 16kHz
- Connect via WebSocket to an API route that proxies to AssemblyAI real-time API
- Send base64-encoded audio frames every 250ms
- Receive `PartialTranscript` and `FinalTranscript` messages back
- Store final transcripts in Convex via mutation (for persistence + AI processing)
- Keep the existing start/pause/resume/stop controls

### API Route (Next.js route handler)
- `POST /api/capture/token` — creates a temporary AssemblyAI real-time session token
- The browser uses this token to connect directly to `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=TOKEN`
- This avoids exposing the API key to the browser

### Convex Backend
- Add a `transcript_segments` table for real-time segments:
  ```
  transcript_segments: {
    sessionId: Id<"capture_sessions">,
    text: string,
    speaker: optional string,
    startMs: number,
    endMs: number,
    isFinal: boolean,
    timestamp: number,
  }
  ```
- Add a `session_summaries` table:
  ```
  session_summaries: {
    sessionId: Id<"capture_sessions">,
    summary: string,
    topics: string[],
    actionItems: { description: string, assignedTo?: string, urgency: string }[],
    updatedAt: number,
    segmentCount: number,  // how many segments were included
  }
  ```
- Mutation: `storeTranscriptSegment` — saves final segments from the browser
- Mutation: `storePartialTranscript` — updates a "current partial" field on the session (for UI display)
- Action: `updateSessionSummary` — triggered every ~10 new final segments. Pulls all segments for the session, calls Claude to generate/update the running summary + action items + assignees. Stores result in session_summaries.
- Keep existing `live_tasks` table and `extractTasksFromChunk` logic but adapt it to work with segments instead of chunks

### UI — Recordings Page Redesign
The `/dashboard/recordings` page needs a complete redesign for this real-time experience:

**When recording is active:**
- Split view with two panels
- **Top: Live Transcript Panel**
  - Auto-scrolling transcript with speaker labels
  - Partial words shown in gray/italic, final words in solid text
  - Timestamps on the left margin
  - Smooth auto-scroll to bottom as new text arrives
- **Bottom: Live Intelligence Panel** 
  - Tabbed: "Summary" | "Action Items" | "People Mentioned"
  - Summary tab: running paragraph summary, updates live
  - Action Items tab: extracted items with assignee chips, urgency dots, approve/dismiss buttons (reuse existing LiveTaskCard component)
  - People tab: names mentioned with relationship context if available

**When no recording is active:**
- Show list of past sessions with their summaries
- Click a session to see full transcript + summary + action items

### Design
Follow Flow's existing design system (DESIGN_SYSTEM.md):
- Warm cream backgrounds (#F8F7F4)
- Glass card surfaces 
- Teal primary (#08a39e) for active states
- DM Sans body text
- Lucide icons
- Existing glass-card, glass-heavy CSS classes

## Files to Modify/Create

1. `apps/web/app/api/capture/token/route.ts` — NEW: AssemblyAI token endpoint
2. `apps/web/components/providers/capture-provider.tsx` — REWRITE: WebSocket streaming instead of MediaRecorder chunks
3. `apps/web/components/live-capture.tsx` — UPDATE: adapt transcript viewer for streaming segments
4. `apps/web/components/live-transcript.tsx` — NEW: real-time streaming transcript panel
5. `apps/web/components/session-summary.tsx` — NEW: live summary + action items panel  
6. `apps/web/app/(app)/dashboard/recordings/page.tsx` — REWRITE: two-panel live view
7. `apps/web/convex/schema.ts` — ADD: transcript_segments, session_summaries tables
8. `apps/web/convex/capture.ts` — ADD: new mutations/actions for streaming segments + summary generation

## Important Notes

- AssemblyAI API key is already in Convex env vars as `ASSEMBLYAI_API_KEY`
- Also available in process.env for the Next.js API route
- Keep backward compatibility with existing capture_sessions / live_tasks
- The existing `capture_chunks` table can stay but new recordings won't use it
- Use `ANTHROPIC_API_KEY` (already in Convex env) for Claude summary generation
- Convex deploy: `cd apps/web && npx convex deploy --cmd 'npx next build'`
- CONVEX_DEPLOY_KEY is set in env
- Git: user.email=jmgburnett@gmail.com, user.name=jmgburnett

## After completing:
1. `cd apps/web && npx convex deploy --cmd 'npx next build'`
2. `git add -A && git commit -m 'feat(capture): real-time streaming transcription + live summary panel'`
3. `git push origin main`
4. Run: `openclaw system event --text "Done: Flow real-time streaming transcription with live summary + action items panel" --mode now`
