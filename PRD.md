# Flow — AI Chief of Staff

**Your AI executive admin that handles everything that isn't leadership.**

## Vision

Josh shouldn't spend time on scheduling, email triage, follow-ups, reminders, or coordination. Flo is the dashboard where Josh interacts with Flobot as a chief of staff — reading every email, listening to daily recordings, managing the calendar, drafting responses, and executing tasks. Josh leads. Flo handles the rest.

## Core Philosophy

- **AI-first interface** — conversation and voice, not forms and buttons
- **Full context** — Flo sees everything (email, texts, calendar, recordings) so it can connect dots humans miss
- **Trust escalation** — starts by drafting and suggesting, earns autonomy over time
- **Leadership filter** — only surfaces things that require Josh's judgment, taste, or relationships

---

## Phase 1: Command Center (MVP)

### 1.1 Email Management
- **Inbox zero automation**: Read all emails from Josh's accounts (josh@onflourish.com, josh@church.tech, jburnett@gloo.us, jmgburnett@gmail.com)
- **Smart triage**: Categorize as 🔴 Needs Josh / 🟡 Draft ready for review / 🟢 Handled / ⚪ Ignore
- **Draft responses**: AI-generated replies for review/edit/send
- **Thread summaries**: Collapse long email threads into 2-3 sentence summaries
- **Follow-up tracking**: "You said you'd send X to Doug by Friday" — auto-remind
- **Bulk actions**: Archive, label, snooze batches with one click

### 1.2 Calendar Management  
- **Full read/write access** to Josh's calendar
- **Smart scheduling**: "Find 30 min with Carey next week" → suggests slots, sends invite
- **Prep briefs**: Before each meeting, surface relevant emails, docs, notes about attendees
- **Conflict detection**: Flag double-bookings, travel time issues, back-to-back exhaustion
- **Decline suggestions**: "This could be an email" — draft polite declines
- **Daily agenda**: Morning brief of what's ahead, evening recap of what happened

### 1.3 Daily Recording Analysis
- **Audio upload or live recording**: Drop in voice memos, meeting recordings, or end-of-day brain dumps
- **Transcription**: Whisper or Deepgram for accurate speech-to-text
- **Action item extraction**: Pull out todos, commitments, decisions, follow-ups
- **People & topic tagging**: Link mentions to contacts, projects, email threads
- **Auto-create tasks**: Turn "I need to call Doug about the pricing" into a tracked action item
- **Searchable archive**: "What did I say about the Exponential deal last Tuesday?"

### 1.4 Task Management
- **AI-generated task list** from emails, recordings, and calendar
- **Priority scoring**: Urgent/Important matrix, auto-sorted
- **Delegation suggestions**: "This doesn't need you — I can handle it" vs "This needs your voice"
- **Status tracking**: Open → In Progress → Waiting → Done
- **Recurring tasks**: Weekly reports, monthly reviews, etc.

---

## Phase 2: Communication Hub

### 2.1 Text/Message Management
- **Read incoming texts** (via Telnyx number + personal forwarding)
- **Draft text responses** for review
- **Smart routing**: Business texts get professional tone, family gets casual
- **Group text summaries**: "Sarah's group chat: planning dinner Friday, need headcount"

### 2.2 Meeting Intelligence
- **Live meeting notes**: Join Zoom/Teams via bot, real-time transcription
- **Auto-summary**: Key decisions, action items, who-said-what
- **Follow-up drafts**: After meeting, draft follow-up emails to attendees
- **Meeting ROI**: Track which recurring meetings actually produce decisions

### 2.3 Relationship Management (Lightweight CRM)
- **Contact intelligence**: Last interaction, pending items, relationship notes
- **Follow-up nudges**: "You haven't talked to EJ in 3 weeks"
- **Birthday/anniversary reminders**: Auto-draft messages
- **Meeting prep**: "Last time you met with Carey, you discussed X"

---

## Phase 3: Strategic Assistant

### 3.1 Decision Support
- **Weekly strategic summary**: Key metrics, decisions needed, blockers
- **Competitive intelligence**: Monitor industry news relevant to Church.tech/Gloo
- **Document drafting**: Proposals, decks, memos from bullet points
- **Research briefs**: "What's the latest on AI agents in enterprise SaaS?"

### 3.2 Proactive Intelligence
- **Pattern detection**: "You've been in 6 meetings about X but no decision — want me to force a resolution?"
- **Energy management**: "You have 4 back-to-back meetings Tuesday — want me to move one?"
- **Opportunity flagging**: Connect dots across emails, meetings, and recordings

---

## Technical Architecture

### Stack
- **Framework**: Next.js 15 (App Router) + React 19
- **Backend**: Convex (real-time, same as Grosh)
- **Auth**: BetterAuth (multi-provider: Google, Microsoft)
- **Deployment**: Vercel + Convex Cloud
- **Monorepo**: Turborepo (shared with Grosh potentially)
- **UI**: shadcn/ui + Tailwind CSS 4

### Integrations
| Service | Purpose | Auth |
|---------|---------|------|
| Gmail API | Read/send email | OAuth2 (already have via gog) |
| Google Calendar API | Read/write events | OAuth2 (already have via gog) |
| Telnyx | SMS read/send, voice | API key (already have) |
| Deepgram/Whisper | Audio transcription | API key |
| Anthropic Claude | AI reasoning, drafting | API key (already have) |
| ElevenLabs | Voice responses (Jessica/Flobot) | API key (already have) |

### Data Model (Convex)
```
users — authenticated user profiles
email_accounts — connected email accounts (Gmail, Outlook)
emails — synced email data (subject, from, to, body, thread_id, labels)
email_drafts — AI-generated draft responses pending review
calendar_accounts — connected calendar accounts  
calendar_events — synced events with prep notes
recordings — uploaded audio files with transcriptions
recording_segments — timestamped transcript chunks
action_items — extracted tasks from all sources
contacts — people mentioned across all channels
contact_interactions — last email, meeting, text with each contact
daily_briefs — generated morning/evening summaries
```

### Key Patterns
- **Real-time sync**: Convex subscriptions for live updates
- **Background processing**: Convex actions for email sync, transcription, AI analysis
- **Incremental sync**: Only fetch new emails/events since last sync
- **Confidence scoring**: AI labels everything with confidence — low confidence = show to Josh

---

## Dashboard Layout

### Left Sidebar
- 📬 Inbox (unread count badge)
- 📅 Calendar (today's event count)
- 🎙️ Recordings
- ✅ Tasks
- 👥 People
- ⚙️ Settings

### Main Area
- **Home**: Today's brief — agenda, priority emails, pending tasks, recent recordings
- **Inbox**: Email list with triage controls (approve draft / edit / archive / escalate)
- **Calendar**: Week view with prep briefs on each event
- **Recordings**: Upload + transcript viewer + extracted action items
- **Tasks**: Priority-sorted task list with source attribution
- **People**: Contact cards with interaction history

### Top Bar
- 🎤 Voice command input ("Schedule lunch with Doug next Thursday")
- 🔍 Universal search (across emails, recordings, tasks, contacts)
- 💬 Chat with Flo (natural language for any action)

---

## Trust Levels (Progressive Autonomy)

### Level 1: Suggest (Week 1-2)
- Read everything, surface summaries
- Draft responses for review
- Suggest calendar changes
- All actions require explicit approval

### Level 2: Act with Review (Week 3-4)
- Send pre-approved response templates
- Accept/decline obvious calendar requests
- Create tasks automatically
- Josh reviews a daily action log

### Level 3: Autonomous (Month 2+)
- Handle routine emails independently
- Schedule meetings without asking
- Follow up on commitments automatically  
- Only escalate leadership decisions

---

## Success Metrics

- **Time saved**: Target 2+ hours/day by Month 2
- **Inbox processed**: 90%+ emails triaged within 1 hour
- **Zero dropped balls**: Every commitment tracked to completion
- **Response time**: External emails answered within 4 hours (working hours)
- **Calendar optimization**: No unnecessary meetings, prep for every important one

---

## MVP Scope (2-Week Sprint)

Build enough to start using daily:

1. ✅ Gmail integration (read inbox, show summaries, draft replies)
2. ✅ Calendar view (today + this week, with event details)  
3. ✅ Recording upload + transcription + action item extraction
4. ✅ Task list (auto-generated from emails + recordings)
5. ✅ Chat interface ("Draft a reply to Doug's last email")
6. ✅ Morning brief (auto-generated daily summary)
7. ✅ Dashboard home page tying it all together

---

*Built for Josh Burnett. Powered by Flobot. Shipped by Hatch.*
