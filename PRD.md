# Flow — AI Chief of Staff

**Your AI executive admin that handles everything that isn't leadership.**

---

## Vision

Flow is the AI-first operating system for Josh's professional life. Not a dashboard with AI bolted on — a conversational, context-aware system that sees everything (email, calendar, texts, voice, Slack), connects the dots humans miss, and acts on Josh's behalf with increasing autonomy. Josh leads. Flow handles the rest.

The core insight: leaders spend 60-70% of their time on coordination — scheduling, email triage, follow-ups, status checks, delegation tracking. None of that requires leadership judgment. Flow eliminates that overhead so Josh can focus on the 30% that actually needs him: strategy, relationships, and decisions.

Long-term, Flow is the reference implementation for what Josh believes all enterprise software becomes: **agent-driven systems where AI is the primary interface**, not dashboards with a chatbot sidebar.

---

## Core Philosophy

- **AI-first interface** — conversation and voice are primary; UI is for review, not input
- **Full context** — Flow sees everything (email, texts, calendar, recordings, Slack) so it can connect dots humans miss
- **Behavioral inference** — infer data from behavior rather than demanding manual entry
- **Trust escalation** — starts by drafting and suggesting, earns autonomy over time
- **Leadership filter** — only surfaces things that require Josh's judgment, taste, or relationships
- **Privacy-first** — Josh's data stays Josh's data. No sharing, no training, strict retention policies
- **Model-agnostic** — not locked to any single AI provider

---

## Who It's For

**Primary user:** Josh Burnett — Head of AI Product at Gloo, founder of Church.tech, operator across multiple organizations and contexts.

**User profile:** Executive/founder managing 4 Google accounts, multiple Slack workspaces, 200+ team members, continuous meetings, cross-org coordination. Comfortable with AI but not primarily an engineer. Needs a system that reduces cognitive load, not one that adds to it.

**Future potential:** Template for any executive/leader who needs an AI chief of staff. The patterns Flow establishes — particularly around trust escalation, multi-source context, and progressive autonomy — are reusable across roles.

---

## Technical Architecture

### Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) + React 19 | Turbopack in dev |
| Backend | Convex (real-time) | Reactive queries, actions, crons |
| Auth | BetterAuth | Multi-provider (Google, Microsoft) |
| Deployment | Vercel + Convex Cloud | Auto-deploy from GitHub |
| Monorepo | Turborepo | Shared with other projects |
| UI | shadcn/ui + Tailwind CSS 4 | Cypress Design System tokens |
| Design | Cypress Design System (Gloo) | Warm earth tones, teal primary, glass/paper materials |
| Fonts | DM Sans (body) + Plus Jakarta Sans (headings) | Stand-ins for licensed F37 Jan/Zagma |

### Connected Accounts
| Service | Purpose | Status |
|---------|---------|--------|
| Gmail (4 accounts) | Email read/write/sync | ✅ Connected |
| Google Calendar (4 accounts) | Event read/write, FreeBusy | ✅ Connected |
| Google Contacts + Directory | Contact lookup, Gloo directory search | ✅ Connected |
| Slack (Gloo + Church.tech) | DMs, mentions, channels | 🔄 In progress |
| AssemblyAI | Real-time audio transcription (v3 Universal Streaming) | ✅ Connected |
| Anthropic Claude | AI reasoning, drafting, tool use, extraction | ✅ Connected |
| Telnyx | SMS read/send, voice calls | ✅ Connected |
| ElevenLabs | Voice responses (Carey Nieuwhof voice) | ✅ Connected |

### Convex Deployments
| Environment | Deployment | URL |
|-------------|-----------|-----|
| Development | polite-ram-809 | polite-ram-809.convex.cloud |
| Production | posh-opossum-53 | posh-opossum-53.convex.cloud |

### Live URLs
- **Production:** https://flow-ten-sigma.vercel.app
- **GitHub:** github.com/jmgburnett/flow

---

## Feature Map

### ━━━ Phase 1: Command Center (MVP) ━━━
**Status: ✅ Shipped**

#### 1.1 Email Management
| Feature | Status | Notes |
|---------|--------|-------|
| Gmail sync (4 accounts) | ✅ | josh@onflourish.com, josh@church.tech, jburnett@gloo.us, jmgburnett@gmail.com |
| Smart triage (Needs Josh / Draft Ready / Handled / Ignore) | ✅ | AI auto-categorization on sync |
| AI draft replies | ✅ | Matches Josh's writing style (analyzed from 100+ sent emails) |
| Thread view | ✅ | Collapsible threads with full conversation |
| Reply from inbox | ✅ | Send replies directly from Flow |
| Email style analysis | ✅ | "Grateful, Josh" sign-off, warm-relational tone, casual-professional |
| Bulk actions (archive, label, snooze) | ❌ | Not yet built |
| Follow-up tracking ("You said you'd send X by Friday") | ❌ | Planned for Phase 3 |

#### 1.2 Calendar Management
| Feature | Status | Notes |
|---------|--------|-------|
| Full calendar view (4 accounts) | ✅ | Week/day view with event details |
| FreeBusy availability check | ✅ | Cross-org via Gloo OAuth |
| Smart scheduling via chat ("Find 30 min with Carey") | ✅ | Tool-use: find_open_slots → suggest → create_event |
| Create events with invites | ✅ | Via Flobot chat, sends calendar invites |
| Gloo directory search | ✅ | Lookup coworkers by name → email, title, department |
| Contact lookup for scheduling | ✅ | Search contacts + profiles for email resolution |
| Conflict detection | ❌ | Planned |
| Meeting prep briefs | ❌ | Planned for Phase 2 |
| Decline suggestions ("This could be an email") | ❌ | Planned for Phase 3 |
| Daily agenda (morning brief + evening recap) | ❌ | Planned |

#### 1.3 Chat (Flobot)
| Feature | Status | Notes |
|---------|--------|-------|
| Natural language chat interface | ✅ | Floating panel, mobile-responsive |
| Conversation history with sidebar | ✅ | Persistent conversations in Convex |
| Tool-use: calendar scheduling | ✅ | FreeBusy, create event, find slots, contact lookup |
| Tool-use: email search/query | ✅ | Search by keyword, sender, triage status |
| Tool-use: email thread retrieval | ✅ | Pull full threads and summarize |
| Tool-use: inbox summary | ✅ | Counts by triage status, urgent items |
| Streaming responses | ✅ | Progressive token display via Convex reactive queries |
| Voice input ("Schedule lunch with Doug") | ❌ | Planned |
| Voice output (TTS responses) | ❌ | Planned (ElevenLabs integration) |

#### 1.4 Live Capture (Always-On Recording)
| Feature | Status | Notes |
|---------|--------|-------|
| Browser microphone recording | ✅ | AudioWorklet + PCM16 → AssemblyAI WebSocket |
| Real-time transcription (AssemblyAI v3) | ✅ | Universal Streaming English, format_turns |
| Live transcript panel with speaker colors | ✅ | Animated word-by-word display, smooth partials |
| Pause/resume recording | ✅ | Suspends AudioContext, preserves session |
| Session management (start/stop) | ✅ | Convex capture_sessions table |
| Transcript segment storage | ✅ | Final turns stored as segments in Convex |
| Meeting context detection | ✅ | Cross-reference with calendar events |
| AI session summaries | ✅ | Claude generates summary, topics, action items, people |
| Live Feed (real-time task extraction) | ✅ | Claude Haiku extracts tasks/commitments as chunks arrive |
| Task approve/dismiss/convert flow | ✅ | Pending → approved/dismissed/converted |
| Session list (past recordings) | ✅ | Browse, view transcript, summary, tasks |
| Persistent recording across page navigation | ✅ | CaptureProvider wraps entire app |
| Background audio processing (chunk-based) | ✅ | 60s audio chunks uploaded and transcribed |

#### 1.5 People / Contacts
| Feature | Status | Notes |
|---------|--------|-------|
| Auto-extract contacts from email + calendar | ✅ | Pending contacts with match suggestions |
| Contact deduplication | ✅ | Confidence-scored matching |
| AI contact profiles | ✅ | Relationship summaries, topics, communication style, sentiment |
| Profile builder (batch analysis) | ✅ | Scans all sent emails, builds rich profiles |
| Contact types (contact/coworker/team_member) | ✅ | With company, role, department |
| Interaction history | ✅ | Last interaction date, counts, sources |
| Gloo directory integration | ✅ | Search org directory from chat |

#### 1.6 Memory / Notes
| Feature | Status | Notes |
|---------|--------|-------|
| Manual notes with categories | ✅ | Personal, project, meeting, idea, other |
| Pinned notes | ✅ | Pin important notes to top |
| AI-generated notes from recordings | ✅ | Source attribution |
| Tags | ✅ | Freeform tagging |

#### 1.7 Tasks
| Feature | Status | Notes |
|---------|--------|-------|
| Task list with priority + status | ✅ | Urgent/high/medium/low, todo/in_progress/waiting/done |
| Source attribution (email/recording/manual/chat) | ✅ | Links back to origin |
| Due dates | ✅ | Optional date tracking |
| Conversion from live capture tasks | ✅ | live_tasks → tasks |

#### 1.8 Journal (Field Notes)
| Feature | Status | Notes |
|---------|--------|-------|
| Auto-generated daily journals | ✅ | Built from capture sessions, emails, calendar |
| Field Notes v2 format | ✅ | Epigraph, mood, wins, meetings, action items, falling-through-cracks |
| Meeting breakdown with decisions + action items | ✅ | Per-meeting summaries with attendees, confidence |
| Master action list (Josh / delegated / engineering / scheduling) | ✅ | Categorized across all sources |
| Journal review page | ✅ | Browse past journals by date |
| Full-text search across journals | ✅ | Convex search index on searchText |
| Cron-based auto-generation | ✅ | Scheduled journal creation |
| Include/exclude sessions toggle | ✅ | Per-session journal inclusion |

#### 1.9 SMS / Messages
| Feature | Status | Notes |
|---------|--------|-------|
| Telnyx SMS integration | ✅ | Inbound/outbound messages |
| Conversation threading | ✅ | Grouped by phone number |
| Contact name resolution | ✅ | Match phone → contact |

#### 1.10 Slack Integration
| Feature | Status | Notes |
|---------|--------|-------|
| OAuth connection | 🔄 | Client ID configured, redirect set up |
| DM sync | ❌ | Pending connection |
| Mention tracking | ❌ | Schema ready (slack_messages table) |
| Unreplied message flagging | ❌ | Schema ready (needsResponse field) |

---

### ━━━ Phase 2: Intelligence Layer ━━━
**Status: 🔜 Next**

#### 2.1 Meeting Intelligence
| Feature | Status |
|---------|--------|
| Meeting prep briefs (before each meeting: relevant emails, notes, attendee context) | ❌ |
| Post-meeting auto-summary + follow-up email drafts | ❌ |
| Meeting ROI tracking (which recurring meetings produce decisions vs. waste time) | ❌ |
| Meeting action item assignment with team member matching | Partial (meeting_actions table exists) |

#### 2.2 Communication Hub
| Feature | Status |
|---------|--------|
| Unified inbox (email + Slack + SMS in one stream) | ❌ |
| Smart routing (business texts → professional tone, family → casual) | ❌ |
| Group text/Slack summaries | ❌ |
| Cross-channel context ("Doug emailed about this, then mentioned it in Slack") | ❌ |

#### 2.3 Relationship Intelligence (Lightweight CRM)
| Feature | Status |
|---------|--------|
| Relationship health scoring | ❌ |
| Follow-up nudges ("You haven't talked to EJ in 3 weeks") | ❌ |
| Birthday/anniversary reminders + auto-drafted messages | ❌ |
| Pre-meeting context ("Last time you met with Carey, you discussed X") | ❌ |
| Relationship decay alerts | ❌ |

#### 2.4 Speaker Identification
| Feature | Status |
|---------|--------|
| Match speakers to contacts by voice profile | ❌ |
| Calendar cross-reference (auto-tag "Meeting with Doug" from calendar overlap) | Partial (meetingTitle/meetingAttendees in capture_sessions) |
| Speaker-attributed action items | ❌ |

#### 2.5 Semantic Search / RAG
| Feature | Status |
|---------|--------|
| Embed transcript chunks for semantic search | ❌ |
| "What did we discuss about pricing last week?" → searches embedded transcripts | ❌ |
| Cross-source search (emails + transcripts + notes + Slack) | ❌ |
| Flobot uses retrieval to answer questions about past conversations | ❌ |

---

### ━━━ Phase 3: Strategic Assistant ━━━
**Status: 📋 Planned**

#### 3.1 Proactive Intelligence
| Feature | Status |
|---------|--------|
| Pattern detection ("You've been in 6 meetings about X but no decision — force a resolution?") | ❌ |
| Energy management ("4 back-to-back meetings Tuesday — want me to move one?") | ❌ |
| Opportunity flagging (connect dots across emails, meetings, recordings) | ❌ |
| Commitment tracking across days ("Sarah committed to X by Monday — it's Tuesday") | ❌ |
| Proactive follow-up ("Doug hasn't replied to your email from 3 days ago") | ❌ |

#### 3.2 Decision Support
| Feature | Status |
|---------|--------|
| Weekly strategic summary (key metrics, decisions needed, blockers) | ❌ |
| Decision log (searchable archive of all decisions from conversations) | ❌ |
| Document drafting (proposals, decks, memos from bullet points) | ❌ |
| Research briefs ("What's the latest on AI agents in enterprise SaaS?") | ❌ |
| Competitive intelligence monitoring | ❌ |

#### 3.3 Daily Operating Rhythm
| Feature | Status |
|---------|--------|
| Morning brief (agenda, priority emails, pending tasks, weather) | ❌ |
| Evening recap (what happened, what's pending, tomorrow preview) | ❌ |
| Weekly review (patterns, wins, dropped balls, relationship health) | ❌ |
| Voice briefing via ElevenLabs ("Good morning Josh, here's your day...") | ❌ |

---

### ━━━ Phase 4: TeamOS ━━━
**Status: 🔧 Partially Built**

Team management layer that turns Flow from a personal tool into a leadership operating system.

#### 4.1 Team Structure
| Feature | Status | Notes |
|---------|--------|-------|
| Org chart with reporting lines | ✅ | Visual tree with drag-and-drop |
| Team member profiles (role, department, location) | ✅ | Rich contact fields |
| Skill tracking (beginner → expert) | ✅ | skills table + per-contact skill assignments |
| Personality profiles (enneagram, MBTI, DISC) | ✅ | Stored on contacts |
| Job descriptions per role | ✅ | jobDescription field |
| Engineering manager designation | ✅ | engineeringManagerId field |
| Designations (labels/tags for team members) | ✅ | Array of strings |

#### 4.2 OKRs
| Feature | Status | Notes |
|---------|--------|-------|
| Objectives with RAG status | ✅ | Green/amber/red/not started |
| Key results with progress tracking | ✅ | Target vs. current value, owner assignment |
| Timeline (start/end dates) | ✅ | Per-objective date range |

#### 4.3 Meeting Actions
| Feature | Status | Notes |
|---------|--------|-------|
| AI-extracted action items from recordings | ✅ | meeting_actions table |
| Assignee suggestion (AI matches action to team member) | ✅ | suggestedAssigneeId with reason |
| Review flow (pending → confirmed/dismissed/converted) | ✅ | Status tracking |
| Convert to task | ✅ | Links to tasks table |

#### 4.4 Team Visibility (Planned)
| Feature | Status |
|---------|--------|
| Team commitment board (what each person has committed to from conversations) | ❌ |
| 1:1 prep (auto-generate talking points from recent interactions + pending items) | ❌ |
| Team pulse (sentiment from Slack + meetings) | ❌ |
| Skill gap analysis | ❌ |

---

### ━━━ Phase 5: Autonomous Operations ━━━
**Status: 📋 Future**

The end-game: Flow acts on Josh's behalf with minimal oversight.

#### 5.1 Progressive Autonomy (Trust Levels)

| Level | Timeline | Capabilities |
|-------|----------|-------------|
| **L1: Suggest** | Week 1-2 | Read everything, surface summaries. Draft responses for review. Suggest calendar changes. All actions require explicit approval. |
| **L2: Act with Review** | Week 3-4 | Send pre-approved response templates. Accept/decline obvious calendar requests. Create tasks automatically. Josh reviews daily action log. |
| **L3: Autonomous** | Month 2+ | Handle routine emails independently. Schedule meetings without asking. Follow up on commitments automatically. Only escalate leadership decisions. |

#### 5.2 Autonomous Features (Planned)
| Feature | Status |
|---------|--------|
| Auto-respond to routine emails (with learned patterns) | ❌ |
| Auto-schedule meetings (from email requests) | ❌ |
| Auto-follow-up on unanswered commitments | ❌ |
| Auto-decline low-value meetings | ❌ |
| Daily action log for review | ❌ |
| Confidence-scored actions (high confidence = auto-act, low = ask Josh) | ❌ |
| Learning from Josh's edits/corrections | ❌ |

---

## Data Model Summary

```
google_connections        — OAuth tokens for 4 Google accounts
emails                    — Synced emails with triage status + AI drafts
calendar_events           — Synced events across all accounts
contacts                  — People with types, skills, personality, org structure
pending_contacts          — Awaiting verification before merge/create
contact_profiles          — AI-generated rich profiles from all sources
chat_conversations        — Flobot conversation threads
chat_messages             — Messages with streaming support
capture_sessions          — Live recording sessions
capture_chunks            — Audio chunks with transcription status
transcript_segments       — Real-time streaming transcript segments
live_tasks                — AI-extracted tasks from recordings
session_summaries         — AI-generated session summaries
tasks                     — Master task list from all sources
recordings                — Uploaded audio files with transcriptions
memories                  — Notes with categories and tags
daily_briefs              — Generated daily summaries
journals                  — Field Notes v2 daily journals
sms_messages              — Telnyx SMS messages
sms_conversations         — SMS conversation threads
slack_connections          — Slack workspace OAuth
slack_messages             — Slack DMs, mentions, channels
style_profiles             — Josh's email writing style profile
style_analyses             — Style analysis progress tracking
profile_builds             — Contact profile batch build progress
design_tokens              — Figma-synced Cypress Design System tokens
skills                     — Global skill library for team management
objectives                 — OKR objectives
key_results                — Key results under objectives
meeting_actions            — AI-extracted meeting action items
user_preferences           — Journal schedule, theme preferences
```

---

## UI Architecture

### App Shell
- **Left sidebar:** Navigation with section icons + unread badges
- **Top bar:** Universal search + voice input (planned)
- **Floating chat:** Flobot panel (bottom-right, expandable)
- **Live capture bar:** Persistent recording controls across all pages

### Pages
| Route | Purpose |
|-------|---------|
| `/dashboard` | Home — today's brief, priority items, recent activity |
| `/dashboard/inbox` | Email triage — list view with AI draft controls |
| `/dashboard/calendar` | Calendar view — week/day with prep notes |
| `/dashboard/recordings` | Live capture — record, transcript, live feed, past sessions |
| `/dashboard/tasks` | Priority-sorted task list with source attribution |
| `/dashboard/people` | Contact cards with interaction history |
| `/dashboard/memory` | Notes organized by category with pin/tag |
| `/dashboard/messages` | SMS conversations |
| `/dashboard/journal` | AI-generated daily journals (Field Notes format) |
| `/dashboard/journal/review` | Browse and search past journals |
| `/dashboard/team` | Team overview |
| `/dashboard/team/members` | Team member profiles |
| `/dashboard/team/org-chart` | Visual org chart |
| `/dashboard/team/okrs` | OKR tracking |
| `/dashboard/team/actions` | Meeting action items |
| `/dashboard/settings` | Connected accounts, preferences |
| `/dashboard/more` | Additional features |

### Design System
- **Cypress Design System** — Gloo's foundation tokens extracted from Figma
- **Palette:** Warm earth tones — Paper (#eeedeb background), Teal primary (#08a39e), Glass materials
- **Materials:** `glass` (frosted overlays), `paper` (card surfaces), `surface` (elevated)
- **Motion:** Smooth transitions, fade-in segments, animated live transcript
- **CRT scanline effect** on live capture (subtle)

---

## Integration Architecture

### Flobot Chat Agent (Tool-Use)

Flobot is a Claude-powered agent with access to structured tools. Current tool set:

| Tool | Purpose |
|------|---------|
| `check_availability` | FreeBusy API across all 4 calendars |
| `find_open_slots` | Mutual availability with attendees |
| `create_event` | Create Google Calendar events with invites |
| `get_my_calendar` | Upcoming events across all accounts |
| `lookup_contact` | Search contacts + profiles by name |
| `search_gloo_directory` | Search Gloo org directory for coworkers |
| `search_emails` | Keyword/sender/triage search across emails |
| `get_email_thread` | Full thread retrieval and summary |
| `get_inbox_summary` | Inbox counts and urgent items |

**Planned tools:**
- `send_email` — Compose and send emails in Josh's style
- `create_task` — Add tasks from chat
- `search_transcripts` — Semantic search across recordings
- `get_relationship_context` — Pull contact profile for meeting prep
- `draft_slack_reply` — Draft Slack responses
- `set_reminder` — Schedule follow-ups
- `run_weekly_review` — Generate weekly strategic summary

### Live Capture Pipeline

```
Microphone → AudioWorklet (PCM16) → AssemblyAI v3 WebSocket
                                          ↓
                              Turn messages (partial/final)
                                          ↓
                          Final turns → Convex (transcript_segments)
                                          ↓
                       Every 5 segments → Claude Haiku (task extraction)
                                          ↓
                                    live_tasks table
                                          ↓
                              Convex reactive query → Live Feed UI
```

### Email Style Analysis Pipeline

```
Scan sent emails (4 accounts) → Sample 50+ emails
         ↓
Claude analysis → Tone, structure, sign-off, vocabulary, patterns
         ↓
Style profile → Stored in style_profiles table
         ↓
Draft prompt → Used when AI generates email replies
```

---

## Cost Analysis

| Component | Est. Monthly Cost | Notes |
|-----------|------------------|-------|
| AssemblyAI Streaming | ~$60 | 4-8 hours/day of audio |
| Claude Sonnet (chat + drafting) | ~$30 | Tool-use conversations |
| Claude Haiku (live extraction) | ~$15 | ~480 chunks/day × small prompt |
| Convex | Free tier → ~$25 | Real-time sync, storage |
| Vercel | Free tier → ~$20 | Hobby → Pro if needed |
| **Total** | **~$100-150/month** | vs. $4,000+/month human assistant |

---

## Privacy & Security

- **Recording indicator** visible at all times (red dot)
- **Tennessee is one-party consent** — Josh can record his own conversations. Multi-state meetings require awareness.
- **Data retention:** Raw audio auto-deleted after 30 days, transcripts + extracted items kept indefinitely
- **Auth:** BetterAuth with Google OAuth, session-based access
- **Encryption:** Google tokens encrypted in Convex (security hardening branch exists)
- **No sharing:** All data is user-scoped. No multi-tenant access to Josh's data.
- **Supply chain:** `.npmrc` with 7-day release wait + ignore-scripts

### Security Hardening (Branch: `security/auth-hardening`)
All 6 phases complete, not yet merged to main:
1. Server-side auth helper
2. userId refactor
3. Middleware protection
4. Token encryption
5. Audit logging
6. Retention cron

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Time saved | 2+ hours/day by Month 2 | Self-reported + task counts |
| Inbox processed | 90%+ triaged within 1 hour | Triage status timestamps |
| Zero dropped balls | Every commitment tracked | live_tasks completion rate |
| Response time | External emails answered within 4 hours | Email send timestamps |
| Calendar optimization | No unnecessary meetings | Decline rate + meeting ROI |
| Live capture adoption | 4+ hours/day recorded | capture_sessions duration |
| False positive rate | <30% of extracted tasks dismissed | live_tasks dismiss ratio |
| Relationship health | No contact goes dark >3 weeks | contact_profiles lastInteractionDate |

---

## What Makes Flow Different

**It's not a CRM.** CRMs fail because data entry is too burdensome and systems can't infer context. Flow infers everything from behavior — emails sent, meetings attended, words spoken — and surfaces insights without Josh typing anything.

**It's not a dashboard.** Dashboards are for humans who want to look at data. Flow is for humans who want things done. The primary interface is a conversation. The UI exists for review and course-correction, not input.

**It's not a chatbot.** Chatbots answer questions. Flow has context. It knows who Josh talked to yesterday, what he committed to, what's falling through the cracks, and who needs follow-up. It doesn't wait to be asked — it proactively surfaces what matters.

**It's the future of software.** Agent-driven systems where the AI is the primary interface, not an add-on. Flow is what every enterprise tool becomes when you design AI-first instead of AI-on-top.

---

*Built for Josh Burnett. Powered by Flobot. Shipped by Flow.*
