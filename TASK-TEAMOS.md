# TeamOS Integration into Flow

## Context
Flow is an AI Chief of Staff app. We're adding TeamOS — team leadership, skill profiling, OKRs, org chart, and meeting intelligence — as a new dashboard alongside the existing communication dashboard.

**Read the full codebase first** — schema.ts, all pages, all convex functions, all components. Understand the existing architecture before changing anything.

## Stack & Design
- Next.js 15 (App Router) + Convex + shadcn/ui + Tailwind CSS v4
- **Gloo project** — use Cypress design system: warm earth tones, teal primary (#08a39e), glass morphism, rounded-xl, DM Sans body + Plus Jakarta Sans headings
- Existing design patterns: glass sidebar, frosted surfaces, warm off-white backgrounds
- Look at existing pages (inbox, calendar, people, tasks) and match their style exactly

## Convex Deploy
- `cd apps/web && npx convex deploy --cmd 'npx next build'`
- `CONVEX_DEPLOY_KEY` is already set in env
- Deploy after every schema change

## Git
- `git config user.email "jmgburnett@gmail.com"` and `git config user.name "jmgburnett"`
- Commit after each major feature with descriptive messages
- Push to GitHub when features are complete

---

## Implementation Plan

### Phase 1: Schema Extensions (non-breaking)

#### Extend existing `contacts` table — add these optional fields:
- `reportingTo` — v.optional(v.id("contacts")) — who this person reports to
- `directReports` — v.optional(v.array(v.id("contacts"))) — who reports to them  
- `skills` — v.optional(v.array(v.object({ skillId: v.id("skills"), level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"), v.literal("expert")), isGap: v.optional(v.boolean()) })))
- `personality` — v.optional(v.object({ enneagram: v.optional(v.string()), mbti: v.optional(v.string()), disc: v.optional(v.string()), leadershipStyle: v.optional(v.string()), workingStyle: v.optional(v.string()) }))
- `department` — v.optional(v.string())
- `location` — v.optional(v.string())
- `jobDescription` — v.optional(v.string())

#### New tables:

**`skills`** — Global skill library
- name: v.string()
- category: v.union(v.literal("leadership"), v.literal("communication"), v.literal("strategic"), v.literal("technical"), v.literal("interpersonal"), v.literal("custom"))
- description: v.optional(v.string())
- createdBy: v.optional(v.string()) — userId if custom
- Indexes: by_category, search_name

**`objectives`** — OKR objectives
- userId: v.string() — who created/owns this
- title: v.string()
- description: v.optional(v.string())
- status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived"))
- ragStatus: v.union(v.literal("green"), v.literal("amber"), v.literal("red"), v.literal("not_started"))
- startDate: v.number()
- endDate: v.number()
- createdAt: v.number()
- updatedAt: v.number()
- Indexes: by_user, by_user_and_status

**`key_results`** — Key results under objectives
- objectiveId: v.id("objectives")
- userId: v.string()
- title: v.string()
- targetValue: v.number()
- currentValue: v.number()
- unit: v.optional(v.string()) — e.g. "%", "count", "$"
- ownerId: v.optional(v.id("contacts")) — team member responsible
- ownerName: v.optional(v.string())
- status: v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("behind"), v.literal("completed"))
- deadline: v.optional(v.number())
- updatedAt: v.number()
- Indexes: by_objective, by_owner

**`meeting_actions`** — Extracted action items from meetings
- userId: v.string()
- recordingId: v.optional(v.id("recordings")) — source meeting
- sourceText: v.optional(v.string()) — transcript excerpt
- action: v.string() — the action item text
- assigneeId: v.optional(v.id("contacts")) — suggested/confirmed assignee
- assigneeName: v.optional(v.string())
- suggestedAssigneeId: v.optional(v.id("contacts")) — AI suggestion
- suggestedReason: v.optional(v.string()) — why AI suggested this person
- taskId: v.optional(v.id("tasks")) — linked task if created
- status: v.union(v.literal("pending_review"), v.literal("confirmed"), v.literal("dismissed"), v.literal("converted_to_task"))
- dueDate: v.optional(v.number())
- createdAt: v.number()
- Indexes: by_user, by_recording, by_assignee, by_status

### Phase 2: Convex Functions

**`convex/team.ts`** — Team management functions:
- `listTeamMembers` — query contacts where type is "coworker" or "team_member", with optional department/skill filters
- `getTeamMember` — get full profile with skills resolved
- `updateTeamProfile` — mutation to update reporting, personality, skills, department, etc.
- `getOrgChart` — query that builds tree structure from reportingTo relationships
- `getSkillGaps` — query that finds skills with no/few team members
- `getSkillCoverage` — summary of skills across the team

**`convex/skills.ts`** — Skill library:
- `listSkills` — all skills, filterable by category
- `searchSkills` — full-text search
- `createSkill` — add custom skill
- `seedDefaultSkills` — action to populate default skill library with AI-generated descriptions

**`convex/okrs.ts`** — OKR CRUD:
- `listObjectives` — by user, filterable by status
- `createObjective` — with validation
- `updateObjective` — status, RAG, dates
- `deleteObjective`
- `listKeyResults` — by objective
- `createKeyResult`
- `updateKeyResult` — progress updates
- `deleteKeyResult`
- `getOKRDashboard` — aggregated view with progress percentages

**`convex/meetingActions.ts`** — Meeting intelligence:
- `extractActionsFromTranscript` — action that takes transcript text, calls Claude to extract action items with suggested assignees (matches against team skills)
- `listMeetingActions` — query by user, filterable by status
- `confirmAction` — mutation to confirm/reassign
- `dismissAction` — mutation to dismiss
- `convertToTask` — mutation that creates a task from the action item and links them

### Phase 3: UI — Team Dashboard

**New route: `/dashboard/team`** — Main team dashboard
- Overview cards: Team size, skill coverage %, active OKRs, pending actions
- Quick stats with glass card styling (match existing dashboard cards)

**Sub-routes:**

**`/dashboard/team/members`** — Team directory
- Grid/list of team members with avatar, name, role, department
- Skill badges on each card
- Click → team member detail with full profile, skills, personality, reporting chain
- Edit profile inline or via sheet

**`/dashboard/team/okrs`** — OKR dashboard  
- Active objectives with RAG status indicators (colored dots: green/amber/red)
- Expand objective → see key results with progress bars
- Create/edit objective and key results via sheet/dialog
- Filter by status, time period

**`/dashboard/team/org-chart`** — Visual org chart
- Tree layout showing reporting structure
- Click node → profile preview
- Color-code by department
- Skill gap overlay option

**`/dashboard/team/actions`** — Meeting action items
- List of extracted actions from meetings
- Each shows: action text, suggested assignee (with reason), source meeting, due date
- Buttons: Confirm, Reassign, Dismiss, Convert to Task
- Upload transcript or paste text → extract actions

### Phase 4: People Section Enhancement

**Update `/dashboard/people`** — Add tab bar:
- All | Contacts | Team | Review Queue (existing)
- "Team" tab shows coworkers/team_members with enriched profile data
- Team member cards show skills, personality badges, reporting line

### Phase 5: Extend Flobot Chat

Update the chat system prompt / context to include:
- Team member data (names, roles, skills, gaps)
- Active OKRs and their status
- Recent meeting action items
- So Flobot can answer questions like "Who on my team has project management skills?" or "What's the status of Q2 OKRs?"

### Phase 6: Seed Data

Create a seed action that populates:
- ~30 default skills across all categories with descriptions
- Sample personality assessment descriptions

---

## Priority Order
1. Schema extensions + deploy (Phase 1)
2. Convex functions (Phase 2)  
3. Team dashboard UI (Phase 3)
4. People section tabs (Phase 4)
5. Meeting actions extraction (Phase 2 + 3 partial)
6. Chat context (Phase 5)
7. Seed data (Phase 6)

## Important Notes
- ALL schema changes to contacts must be OPTIONAL fields (v.optional) — don't break existing data
- Match the existing Flow design language exactly — look at inbox, calendar pages for reference
- Use existing component patterns (glass cards, bottom sheets on mobile, etc.)
- The team dashboard should feel like a natural part of Flow, not a bolted-on feature
