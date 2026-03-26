# TASK: Journal Feature — All-Day Audio Capture + AI Journal Generation

## Context
Flow is a Next.js 15 + Convex + shadcn/ui app (Turborepo monorepo). Code lives in `apps/web/`.
It already has working audio capture with real-time streaming transcription (AssemblyAI v3 Universal Streaming).

Key existing files:
- `apps/web/components/providers/capture-provider.tsx` — Audio capture context, WebSocket to AssemblyAI, PCM16 audio worklet
- `apps/web/app/api/capture/token/route.ts` — AssemblyAI token endpoint
- `apps/web/convex/capture.ts` — Convex mutations/queries for capture sessions & transcript segments
- `apps/web/convex/schema.ts` — Convex schema (has `capture_sessions` and `transcript_segments` tables)
- `apps/web/app/dashboard/recordings/page.tsx` — Recordings list page

Design system: Cypress theme — frosted glass surfaces, backdrop-blur, DM Sans + Plus Jakarta Sans fonts, teal accent (#08a39e).

## Processing Pipeline

```
Existing recording/transcript segments (already in Convex DB)
 ↓
Collect all transcript_segments for the day
 ↓
Diarization + Speaker tagging (from existing data)
 ↓
Segment chunking + metadata tagging
 ↓
Daily Journal Skill (Claude claude-sonnet-4-6 via Anthropic API)
 ↓
Structured journal JSON
 ↓
Flow Journal UI
```

## Journal Structure (from Daily Journal Skill)

The AI output MUST follow this exact schema:

1. **⚡ Daily Wins** — 3–7 bullets, specific, honest, no padding
2. **Meeting/Conversation Summaries** — One section per identified conversation block; 2–4 paragraph narrative in the user's voice, decisions and tensions surfaced
3. **Action Items** — Per-meeting, inline, verb-forward, owner-assigned
4. **Running List — Things Falling Through the Cracks** — The hot list; time-sensitive, at-risk items
5. **Master Action List with Delegation** — Full consolidated table organized by delegation bucket:
   - Josh Only
   - Initiates + Delegates
   - Engineering
   - Scheduling

### Conversation Detection Logic

The AI is responsible for:
- Grouping transcript chunks into logical conversation units (standup, phone call, 1:1, brainstorm, etc.)
- Estimating approximate timestamps and meeting titles based on context
- Identifying attendees from names mentioned in conversation
- Distinguishing between meetings, phone calls, in-person conversations, and solo thinking-out-loud
- Flagging low-confidence sections (marked as "unclear — review audio chunk")

## User Controls Before Generating

Before processing, user sees a **Daily Review Screen**:
- Timeline view of all captured conversation chunks (time, estimated duration, first-word preview)
- Ability to delete any chunk before it gets processed
- Ability to merge chunks that belong to the same meeting
- Ability to add a manual note to any chunk ("this was the Ben call")
- One-tap "Generate Journal" button

### Generation Speed Target
- Target: full journal generated in under 45 seconds for a typical 10-hour day
- Progress indicator shows during generation (not a spinner — see UI section)
- Journal is cached locally so it reopens instantly on subsequent views

---

## The Journal UI — "The Field Notes You Actually Keep"

Not a notes app. Not a dashboard. An actual journal with texture, weight, and physicality. Think leather-bound Moleskine crossed with editorial print design. Dark cream pages. Real typography. The kind of thing you'd leave on your desk.

### Journal Cover

Every day's journal opens with a **Cover Page**:
- Full-bleed, slightly textured dark warm-cream or aged-paper background
- Large handwritten-style display font (e.g., Fraunces, Playfair Display) showing the day and date
- A single line quote or win pulled from the ⚡ Wins section — feels like an epigraph
- Subtle grain overlay and vignette at edges for depth
- Animated: the cover "opens" with a page curl or soft fold reveal when you tap to enter
- Below the fold: a small "Today at a glance" strip — # of conversations captured, # action items, top 2 wins — like a newspaper subhead

### Page Navigation

The journal is navigated as actual pages:
- Swipe left/right to turn pages with a physically realistic page-turn animation (shadow, slight curl, weight)
- Page corners slightly dog-eared on sections you've visited before
- A spine/chapter strip on the left edge (landscape) — shows all sections with page numbers, lets you jump directly (like thumb tabs)
- Chapter markers: tiny colored ribbon tabs on the right edge, one per section type:
  - Gold for Wins
  - Navy for Meetings
  - Red for Cracks
  - Charcoal for Actions

### Section Pages Design

Each section should feel like a beautifully typeset page:
- Serif body font (Georgia, Playfair Display, or Fraunces) for journal content
- Sans-serif for metadata/headers (DM Sans / Plus Jakarta Sans)
- Warm cream/paper background for content area
- Frosted glass cards within the Cypress design system
- Real typography hierarchy — large section headers, proper leading, comfortable margins

### Generation Progress

While generating, show a **progress indicator** (NOT a spinner):
- Animated quill/pen writing on paper effect
- Or: sections appearing one by one with a typewriter fade-in
- Show which section is being generated: "Identifying conversations..." → "Writing summaries..." → "Compiling action items..."

---

## What to Build (Backend — Convex)

### Schema Updates (in `apps/web/convex/schema.ts`)

**`journals` table:**
- `userId: v.string()`
- `date: v.string()` (YYYY-MM-DD)
- `title: v.string()` — AI-generated title
- `epigraph: v.string()` — Featured win/quote for cover
- `status: v.string()` — "reviewing" | "generating" | "complete" | "failed"
- `wins: v.array(v.string())` — 3-7 daily wins
- `conversations: v.array(v.object({ ... }))` — Meeting/conversation summaries
- `actionItems: v.array(v.object({ text: v.string(), owner: v.string(), meeting: v.optional(v.string()), priority: v.optional(v.string()) }))`
- `cracksList: v.array(v.object({ text: v.string(), urgency: v.string() }))` — Things falling through cracks
- `masterActions: v.object({ joshOnly: v.array(v.string()), delegates: v.array(v.string()), engineering: v.array(v.string()), scheduling: v.array(v.string()) })`
- `conversationCount: v.number()`
- `actionItemCount: v.number()`
- `captureMinutes: v.number()`
- `generatedAt: v.optional(v.number())`
- `journalPreference: v.optional(v.string())` — Time preference

**`journal_conversations` table:**
- `journalId: v.id("journals")`
- `order: v.number()`
- `type: v.string()` — "meeting" | "phone_call" | "one_on_one" | "brainstorm" | "solo" | "unclear"
- `title: v.string()` — AI-estimated meeting title
- `startTime: v.optional(v.string())`
- `endTime: v.optional(v.string())`
- `attendees: v.array(v.string())`
- `summary: v.string()` — 2-4 paragraph narrative
- `decisions: v.array(v.string())`
- `actionItems: v.array(v.object({ text: v.string(), owner: v.string() }))`
- `confidence: v.string()` — "high" | "medium" | "low"
- `relatedSegmentIds: v.array(v.id("transcript_segments"))`

**`user_preferences` table (or add to existing user/settings):**
- `userId: v.string()`
- `journalTime: v.optional(v.string())` — "21:00" format
- `journalTimezone: v.optional(v.string())`
- `journalAutoGenerate: v.optional(v.boolean())`

### Actions (in `apps/web/convex/journal.ts`)

- `generateJournal` — Main action: collects transcript segments for date, calls Claude claude-sonnet-4-6, produces structured journal
- `getJournal` — Query by date
- `getJournalList` — List journals (paginated)
- `getReviewData` — Get transcript chunks for daily review screen (before generation)
- `deleteChunk` / `mergeChunks` / `addChunkNote` — Review screen mutations
- `updateJournalPreference` — Set generation time
- `scheduleJournalGeneration` — Convex scheduled function for daily auto-generation

Use the Anthropic API key already in Convex env vars: `ANTHROPIC_API_KEY`
Use model: `claude-sonnet-4-6` (claude-sonnet-4-6)

### AI Prompt Design

The prompt to Claude should:
- Receive all transcript segments as structured input
- Be instructed to group them into conversations
- Follow the exact 5-section journal schema above
- Write in the user's voice (casual-professional, direct)
- Be specific and honest (no padding or generic platitudes)
- Flag low-confidence sections
- Return structured JSON that maps to the schema

---

## What to Build (Frontend)

### 1. Journal Page — `/dashboard/journal`

**Route: `apps/web/app/dashboard/journal/page.tsx`**

**Default view: Journal List**
- Calendar strip at top (horizontally scrollable recent days)
- Each day: date, title, mood indicator, conversation count
- Empty days: "No captures" muted
- "Generate Now" button for today

**Detail view: Full Journal Experience**
- Cover page with title, date, epigraph, stats
- Page-turn navigation between sections
- Sections: Wins → Conversations → Action Items → Cracks → Master Actions
- Beautiful typography, warm paper feel
- Dog-eared visited pages, ribbon tab markers

### 2. Daily Review Screen — `/dashboard/journal/review`

**Route: `apps/web/app/dashboard/journal/review/page.tsx`**

- Timeline of transcript chunks from today
- Delete, merge, annotate controls
- "Generate Journal" CTA button
- Generation progress view (animated, shows stages)

### 3. Journal Schedule Prompt

- After first recording OR from Settings
- "When should Flow generate your daily journal?"
- Time picker, default 9 PM
- "I'll trigger it manually" option

### 4. Dashboard Integration

- Add "Journal" to sidebar nav (📓 icon)
- "Today's Journal" card on dashboard showing status

### 5. Settings Integration

- Journal generation time preference
- Auto-generate toggle

---

## Technical Notes

- Convex env var `ANTHROPIC_API_KEY` is already set
- Use `@anthropic-ai/sdk` npm package (install if not present)
- AssemblyAI streaming transcription already works
- Git config: `user.email "jmgburnett@gmail.com"`, `user.name "jmgburnett"`
- Deploy: `cd apps/web && npx convex deploy --cmd 'npx next build'`
- Convex: `dev:polite-ram-809` (dev) / `posh-opossum-53` (prod)
- For dev, just make sure code builds with `npx next build`

## What NOT to Do
- Don't touch existing capture/recording functionality (it works)
- Don't implement on-device Whisper (future mobile feature)
- Don't build mobile-specific features (background modes, battery, lock screen)
- Don't implement E2E encryption (future)
- Focus on: Journal generation from existing transcripts, journal UI, review screen, schedule, dashboard

## Deliverables
1. Schema updates (journals, journal_conversations, user_preferences)
2. `convex/journal.ts` with all actions/queries
3. `/dashboard/journal` page (list + detail with cover + page navigation)
4. `/dashboard/journal/review` page (daily review before generation)
5. Journal schedule prompt
6. Dashboard card + sidebar nav
7. Settings integration
8. All committed and pushed to main

---

## Detailed Page Designs

### Wins Page
- Single page, landscape or portrait
- Section header in hand-lettered style: "⚡ Today's Wins"
- Each win on its own line with generous leading — feels like a list in a real journal
- Subtle horizontal rule between wins
- Optional: user can tap a win to expand it (linked to the meeting it came from) or star it

### Meeting Summary Pages
Each meeting gets its own 1–2 pages:
- Top of page: meeting name in display type, attendees in small-caps below, timestamp at top right
- Body: flowing prose, regular weight, comfortable reading size
- Action items at bottom in distinct visual treatment — slightly inset box, different background, icon per owner
- If meeting spans 2 pages, page turn works naturally — narrative continues
- Audio chip: small waveform icon top right — tap to hear original audio clip

### Falling Through the Cracks Page
- Single page, slightly distressed feel — faint red border or torn-edge top treatment
- Section title in slightly irregular hand-lettered type
- Each item: bold first phrase + context text — like margin notes
- Time-sensitive items have subtle red underline

### Master Action List Pages
- 2–4 pages, most data-dense section
- Organized by delegation bucket with colored section headers (red, yellow, green)
- Tables as clean print-style grids — editorial table design, not app tables
- "Josh Only" items separated with heavier visual weight
- Scheduling items render as mini calendar-card layout

### Journal Shelf (Exit View)
When exiting a journal, show the **Journal Shelf**:
- Horizontal scroll of journal spines, one per day, going back through history
- Tapping a spine opens that day's journal with cover-open animation
- Spines show: day, one-line teaser, colored dot for action item completion (green=all done, yellow=some, red=none)

### Search
- Pull-to-reveal search bar above shelf
- Full-text search across all journal content
- Results as highlighted excerpts with day + page reference
- Tap to navigate directly to that page

### Journal Themes
Three switchable themes:

| Theme | Feel | Background | Typography |
|---|---|---|---|
| Field Notes | Worn craft paper, utilitarian | Warm cream, tan accents | Freight Text + Playfair headers |
| Moleskine | Minimal, classic | Off-white, charcoal type | Libre Baskerville + Cardinal |
| Night Mode | Deep editorial, moody | Near-black with gold accents | Canela + small-caps labels |

For v1, implement **Field Notes** as default. Add theme switching infrastructure but other themes can be placeholder.

---

## Font Strategy (for v1)
Since we can't easily get Freight Text/Canela (paid fonts), use these Google Fonts:
- **Headers:** Playfair Display (display serif, hand-lettered feel)
- **Body:** Lora or Crimson Text (readable serif for long-form)
- **Metadata/Labels:** Plus Jakarta Sans or DM Sans (existing design system)
- **Hand-lettered accent:** Caveat or Kalam (for section titles like "⚡ Today's Wins")
- Import via `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@400;500;600;700&display=swap')`

---

---

## User Stories (for reference — implement what's feasible in v1)

1. Start my day with a single tap and Flow captures everything — no manual notes
2. Review captured chunks before generating — remove anything unwanted
3. Open journal at end of day and be surprised by accomplishments — Wins section leads
4. Navigate journal like flipping through a real book — page-turn experience
5. Tap audio icon on meeting summary for brief playback (future — v2)
6. Find any decision/action item from any day via search
7. Star wins → "Best of" collection (v2)
8. Audio never leaves device (mobile — future)
9. Share a specific journal page (v2)
10. Journal Shelf — visual weight of consistent daily journaling

## V1 Scope (What to Actually Build Now)

Focus on what works with the EXISTING web app + existing transcription:
- ✅ Journal generation from existing transcript segments (Convex + Claude claude-sonnet-4-6)
- ✅ Daily Review screen (view/delete/annotate chunks before generation)
- ✅ Journal UI with cover + page-turn + all 5 sections
- ✅ Journal Shelf (list view with spines)
- ✅ Search across journals
- ✅ Dashboard card + sidebar nav
- ✅ Schedule prompt (when to auto-generate)
- ✅ Field Notes theme (default)
- ✅ Theme switching infrastructure (Moleskine + Night Mode as CSS-only variants)
- ❌ Skip: on-device Whisper, mobile background capture, audio playback, E2E encryption, sync, monetization gates, starred wins collection

---

---

## AI Journal Output Schema (CRITICAL — UI must map 1:1 to this)

The Claude prompt MUST produce JSON matching this exact tree:

```
Journal
├── date
├── wins[] → Wins Page
├── meetings[] → Meeting Pages (one per meeting)
│   ├── approximate_time
│   ├── name
│   ├── attendees[]
│   ├── summary (prose narrative)
│   └── action_items[]
│       ├── owner
│       └── action
├── falling_through_cracks[] → Cracks Page
└── master_action_list → Action Pages
    ├── josh_only[]
    ├── delegated[] (one bucket per team member)
    ├── engineering[]
    ├── hr_legal_ops[]
    └── scheduling[]
```

This is the Daily Journal skill schema. Every UI section maps directly to a node in this tree. The Convex schema should store this structure faithfully.

---

## Out of Scope for v1
- Real-time transcription visible while recording (revisit v2)
- Video capture
- Calendar integration for auto-labeling meetings (v2)
- AI-generated follow-up emails from action items (v2)
- Team sharing beyond page export (v2)
- Task management integrations (Things, Todoist, Linear) (v2)
- Sensitive content auto-detection (v2)
- Consent/recording indicators for group settings (v2 / legal review)
- Diarization confidence UI + user corrections (v2)

---

When completely finished, run:
openclaw system event --text "Done: Built Flow journal feature — AI journal generation, journal UI with page-turn navigation, daily review screen, schedule prompt, dashboard integration" --mode now
