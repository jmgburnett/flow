# TASK-V2: Upgrade Journal UI to Full "Field Notes" Vision

## Context
The journal v1 is already built and deployed. It has:
- `apps/web/convex/journal.ts` — generateJournal action (Claude API), queries, mutations
- `apps/web/app/(app)/dashboard/journal/page.tsx` — Basic journal with calendar strip, section cards, schedule modal
- `apps/web/convex/schema.ts` — journals + user_preferences tables
- Existing audio capture + AssemblyAI v3 streaming transcription (DO NOT TOUCH)

**DO NOT change the recording/capture architecture.** It uses AssemblyAI v3 Universal Streaming and works great. Leave `capture-provider.tsx`, `capture.ts`, and the token endpoint alone.

## What Needs to Change

### 1. CRITICAL: Update Journal Schema to Daily Journal Skill Format

The current schema uses 6 generic sections. It MUST be changed to match this exact output tree:

```json
{
  "date": "2026-03-25",
  "title": "Evocative day title",
  "epigraph": "Best win or quote for the cover",
  "mood": "focused",
  "wins": ["Specific win 1", "Specific win 2", "...3-7 total"],
  "meetings": [
    {
      "approximate_time": "10:30 AM",
      "name": "Weekly Product Standup",
      "type": "meeting",
      "attendees": ["Ben", "Sarah", "Doug"],
      "summary": "2-4 paragraph narrative prose in first person...",
      "decisions": ["Decision 1", "Decision 2"],
      "action_items": [
        { "owner": "Josh", "action": "Review the API spec by Thursday" },
        { "owner": "Ben", "action": "Ship the auth fix" }
      ],
      "confidence": "high"
    }
  ],
  "falling_through_cracks": [
    { "text": "Q2 budget review — was due last week", "urgency": "high" },
    { "text": "Need to follow up with Doug on launch timeline", "urgency": "medium" }
  ],
  "master_action_list": {
    "josh_only": ["Write the board deck intro", "Review comp proposal"],
    "delegated": ["Ben: ship auth fix", "Sarah: finalize event venue"],
    "engineering": ["Migrate auth to BetterAuth v2", "Fix WebSocket reconnect"],
    "scheduling": ["Book 1:1 with EJ for Thursday", "Move sprint retro to Friday"]
  },
  "conversation_count": 5,
  "action_item_count": 12,
  "capture_minutes": 340
}
```

Update the Convex schema (`journals` table) to store this structure. Update the Claude prompt in `generateJournal` to produce this exact format. Use model `claude-sonnet-4-6-20250514`.

### 2. Journal Cover Page

When opening a journal, show a **cover page** first:
- Full-bleed warm cream/aged paper background with subtle grain texture (CSS only)
- Large display font: **Playfair Display** (Google Font) — day name + date
- Epigraph: a single featured win in italic Lora below the title
- "Today at a glance" strip: conversation count, action item count, top 2 wins
- Tap/click to "open" the journal with a smooth page-turn/fade animation
- Subtle vignette at edges for depth (CSS radial-gradient)

### 3. Page-Turn Navigation

Replace the current scroll-through-sections with a **paginated book experience**:
- Each section is a "page" (or multiple pages for long sections)
- Swipe left/right OR click page edges to turn
- Page-turn animation: CSS transform with perspective, slight shadow, realistic curl feel
- Page indicator dots or chapter tabs at bottom
- Section ribbon tabs on right edge:
  - ⚡ Gold for Wins
  - 💬 Navy for Meetings  
  - 🔴 Red for Cracks
  - ⚫ Charcoal for Master Actions

### 4. Section Page Designs

**Wins Page:**
- Header: "⚡ Today's Wins" in **Caveat** font (Google Font, hand-lettered feel)
- Each win on its own line with generous leading (1.8+)
- Subtle horizontal rules between wins
- Warm cream background

**Meeting Pages (one per meeting):**
- Meeting name in Playfair Display, attendees in small-caps (Plus Jakarta Sans) below
- Timestamp at top right
- Body: flowing prose in **Lora** (Google Font serif), comfortable reading size
- Action items at bottom in slightly inset box with different background
- Each action item has owner badge
- If meeting is long, content flows naturally (scrollable within page)

**Falling Through the Cracks Page:**
- Slightly distressed feel — faint red left border
- Title in Caveat: "Things Falling Through the Cracks"
- Each item: **bold first phrase** + context text
- High urgency items have red underline
- Medium urgency: amber dot

**Master Action List Pages:**
- Organized by delegation bucket with colored headers:
  - "Josh Only" — red/dark header
  - "Delegated" — amber header  
  - "Engineering" — blue header
  - "Scheduling" — green header
- Clean list items under each bucket
- Print-style editorial design

### 5. Journal Shelf (List View)

Replace the current date sidebar with a **Journal Shelf**:
- Horizontal scroll of journal "spines" — tall, narrow cards
- Each spine shows: day abbreviation, date number, one-line title teaser
- Colored dot: green (all action items done), yellow (some), red (none) — for now just show based on action item count
- Tapping a spine opens that journal with cover animation
- Current day highlighted

### 6. Daily Review Screen

Add `/dashboard/journal/review` page (or inline modal):
- Timeline of today's capture sessions with timestamps
- Each chunk shows: time, duration, first ~50 chars of transcript
- Toggle to include/exclude each session from journal generation
- "Add note" button per chunk (annotate: "this was the Ben call")
- Big "Generate Journal" CTA at bottom
- Generation progress: animated stages ("Analyzing conversations..." → "Writing summaries..." → "Compiling actions...")

### 7. Search

- Search bar at top of journal shelf
- Full-text search across all journal content (wins, meetings, actions, cracks)
- Results show highlighted excerpts with date
- Tap to open that journal to the relevant page

### 8. Field Notes Theme

Default theme with these characteristics:
- **Background:** Warm cream `#FAF8F5` with subtle paper grain (CSS noise texture)
- **Headers:** Playfair Display 700
- **Hand-lettered accents:** Caveat 500-600  
- **Body text:** Lora 400/500 italic
- **Metadata:** Plus Jakarta Sans (existing)
- **Accents:** Tan/warm brown tones, forest green for CTAs
- **Cards:** Slightly warm white with soft shadows, no harsh borders

Add Google Fonts import:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@400;500;600;700&display=swap');
```

### 9. Theme Switching Infrastructure

Add a `journalTheme` field to user_preferences. Create a ThemeProvider or CSS class approach:
- `.journal-field-notes` (default) — warm cream, Playfair + Lora
- `.journal-moleskine` — off-white, minimal (placeholder CSS)  
- `.journal-night` — near-black with gold accents (placeholder CSS)

Theme selector in journal settings (3 preview cards).

## Technical Notes

- **DO NOT TOUCH** capture-provider.tsx, capture.ts, or the AssemblyAI integration
- Existing audio capture + streaming works perfectly — leave it alone
- Convex env var `ANTHROPIC_API_KEY` is set
- Model for journal generation: `claude-sonnet-4-6-20250514`
- Git config: `user.email "jmgburnett@gmail.com"`, `user.name "jmgburnett"`
- Google Fonts: import in the journal page or layout, not globally (to avoid affecting other pages)
- For page-turn animation, use CSS transforms with `perspective` and `rotateY` — no heavy libraries needed
- Keep it performant — no massive JS animation libraries

## Deliverables
1. Updated Convex schema (journals table with new structure)
2. Updated `generateJournal` prompt (Daily Journal skill format)
3. Journal cover page with animation
4. Page-turn navigation between sections
5. Styled section pages (Wins, Meetings, Cracks, Master Actions)
6. Journal Shelf view
7. Daily Review screen (or modal)
8. Search across journals
9. Field Notes theme + theme switching infrastructure
10. All committed and pushed to main

When completely finished, run:
openclaw system event --text "Done: Flow journal v2 — cover page, page-turn navigation, Field Notes theme, journal shelf, daily review, search, full Daily Journal skill schema" --mode now
