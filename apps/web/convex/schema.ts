import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Auth tables (users, sessions, accounts, verifications) are managed
// by the Better Auth component in convex/betterAuth/.
// Add your app-specific tables here.
export default defineSchema({
  // Google OAuth connections
  google_connections: defineTable({
    userId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    tokensEncrypted: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // Email management
  emails: defineTable({
    userId: v.string(),
    accountEmail: v.string(), // Which Google account this email came from
    gmailMessageId: v.string(), // Gmail's unique message ID
    subject: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    body: v.string(),
    threadId: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    triageStatus: v.union(
      v.literal("needs_me"),
      v.literal("draft_ready"),
      v.literal("handled"),
      v.literal("ignore"),
    ),
    draftReply: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_triage", ["userId", "triageStatus"])
    .index("by_thread", ["threadId"])
    .index("by_account_email", ["accountEmail"])
    .index("by_gmail_message_id", ["gmailMessageId"]),

  // Calendar management
  calendar_events: defineTable({
    userId: v.string(),
    accountEmail: v.string(), // Which Google account this event came from
    googleEventId: v.string(), // Google Calendar's unique event ID
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    prepNotes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_time", ["userId", "startTime"])
    .index("by_account_email", ["accountEmail"])
    .index("by_google_event_id", ["googleEventId"]),

  // Recording management
  recordings: defineTable({
    userId: v.string(),
    title: v.string(),
    fileId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    status: v.union(
      v.literal("uploading"),
      v.literal("transcribing"),
      v.literal("ready"),
      v.literal("error"),
    ),
    transcriptText: v.optional(v.string()),
    summary: v.optional(v.string()),
    actionItems: v.optional(v.array(v.string())),
    uploadedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  // Task management
  tasks: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.union(
      v.literal("email"),
      v.literal("recording"),
      v.literal("manual"),
      v.literal("chat"),
    ),
    sourceId: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("waiting"),
      v.literal("done"),
    ),
    dueDate: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_and_priority", ["userId", "priority"]),

  // Contact management
  contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
    type: v.union(
      v.literal("contact"),
      v.literal("coworker"),
      v.literal("team_member"),
    ),
    company: v.optional(v.string()),
    role: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    lastInteraction: v.optional(v.number()),
    interactionCount: v.optional(v.number()),
    notes: v.optional(v.string()),
    sources: v.optional(v.array(v.string())), // e.g. ["email", "calendar", "sms"]
    // TeamOS extensions
    reportingTo: v.optional(v.id("contacts")),
    directReports: v.optional(v.array(v.id("contacts"))),
    skills: v.optional(
      v.array(
        v.object({
          skillId: v.id("skills"),
          level: v.union(
            v.literal("beginner"),
            v.literal("intermediate"),
            v.literal("advanced"),
            v.literal("expert"),
          ),
          isGap: v.optional(v.boolean()),
        }),
      ),
    ),
    personality: v.optional(
      v.object({
        enneagram: v.optional(v.string()),
        mbti: v.optional(v.string()),
        disc: v.optional(v.string()),
        leadershipStyle: v.optional(v.string()),
        workingStyle: v.optional(v.string()),
      }),
    ),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_type", ["userId", "type"])
    .index("by_user_and_name", ["userId", "name"]),

  // Pending contacts — awaiting user verification before merge or create
  pending_contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.union(
      v.literal("email"),
      v.literal("calendar"),
      v.literal("sms"),
      v.literal("recording"),
      v.literal("chat"),
    ),
    sourceDetail: v.optional(v.string()), // e.g. email subject, event title
    suggestedType: v.union(
      v.literal("contact"),
      v.literal("coworker"),
      v.literal("team_member"),
    ),
    // If we think this matches an existing contact
    matchedContactId: v.optional(v.id("contacts")),
    matchReason: v.optional(v.string()), // e.g. "Same email", "Similar name"
    matchConfidence: v.optional(v.number()), // 0-1
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("merged"),
      v.literal("dismissed"),
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_email", ["email"]),

  // Chat conversations with Flobot
  chat_conversations: defineTable({
    userId: v.string(),
    title: v.string(), // Auto-generated from first message or AI summary
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  // Chat messages within conversations
  chat_messages: defineTable({
    userId: v.string(),
    conversationId: v.optional(v.id("chat_conversations")), // optional for backward compat
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_conversation", ["conversationId", "timestamp"]),

  // Daily briefs
  daily_briefs: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    content: v.string(),
    generatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"]),

  // SMS Messages
  sms_messages: defineTable({
    userId: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    from: v.string(), // Phone number
    to: v.string(), // Phone number
    body: v.string(),
    timestamp: v.number(),
    read: v.boolean(),
    contactName: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_from", ["from"])
    .index("by_to", ["to"]),

  // Memory / Notes
  memories: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("personal"),
      v.literal("project"),
      v.literal("meeting"),
      v.literal("idea"),
      v.literal("other"),
    ),
    tags: v.optional(v.array(v.string())),
    pinned: v.boolean(),
    source: v.union(
      v.literal("manual"),
      v.literal("ai"),
      v.literal("email"),
      v.literal("recording"),
    ),
    sourceId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_category", ["userId", "category"])
    .index("by_user_and_pinned", ["userId", "pinned"]),

  // Slack connections
  slack_connections: defineTable({
    userId: v.string(),
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    userToken: v.string(),
    slackUserId: v.string(),
    slackUserName: v.string(),
    scopes: v.array(v.string()),
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    tokensEncrypted: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"]),

  // Slack messages (DMs, mentions, unreplied)
  slack_messages: defineTable({
    userId: v.string(),
    teamId: v.string(),
    channelId: v.string(),
    channelName: v.optional(v.string()),
    channelType: v.union(
      v.literal("dm"),
      v.literal("channel"),
      v.literal("group"),
      v.literal("mpim"),
    ),
    messageTs: v.string(), // Slack message timestamp (unique ID)
    threadTs: v.optional(v.string()),
    senderSlackId: v.string(),
    senderName: v.string(),
    text: v.string(),
    isReply: v.boolean(),
    isMention: v.boolean(),
    needsResponse: v.boolean(),
    respondedAt: v.optional(v.number()),
    receivedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_needs_response", ["userId", "needsResponse"])
    .index("by_message_ts", ["messageTs"])
    .index("by_channel", ["channelId"]),

  // Contact profiles — AI-generated rich profiles from all communication sources
  contact_profiles: defineTable({
    userId: v.string(),
    contactId: v.optional(v.id("contacts")), // linked contact, if matched
    email: v.string(), // primary email (lookup key)
    name: v.string(),
    // AI-generated profile
    relationshipSummary: v.string(), // "Colleague at Gloo, works on platform engineering..."
    topics: v.array(v.string()), // ["AI product", "church planting", "API integrations"]
    communicationStyle: v.string(), // "Formal, detail-oriented, prefers bullet points"
    sentiment: v.string(), // "warm", "professional", "casual", "formal"
    keyContext: v.string(), // important context for AI to know when drafting
    recentInteractions: v.array(
      v.object({
        date: v.number(),
        type: v.string(), // "email_sent", "email_received", "calendar", "sms", "slack"
        summary: v.string(),
      }),
    ),
    // Metadata
    emailsSent: v.number(), // count of emails Josh sent to this person
    emailsReceived: v.number(), // count of emails received from this person
    lastInteractionDate: v.optional(v.number()),
    sources: v.array(v.string()), // ["email", "calendar", "sms", "slack"]
    // Calendar enrichment
    sharedMeetings: v.optional(v.number()),
    meetingTopics: v.optional(v.array(v.string())),
    // Filtration
    isReal: v.optional(v.boolean()), // true = real person, false = marketing/automated
    filterReason: v.optional(v.string()), // why it was filtered out
    // Raw data for re-processing
    rawEmailSamples: v.optional(v.string()), // JSON: sample email snippets used to build profile
    builtAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_contact", ["contactId"])
    .index("by_user_and_email", ["userId", "email"])
    .index("by_user_and_real", ["userId", "isReal"]),

  // Profile build progress tracking
  profile_builds: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("scanning"),
      v.literal("building"),
      v.literal("complete"),
      v.literal("error"),
    ),
    progress: v.number(), // 0-100
    message: v.optional(v.string()),
    totalRecipients: v.optional(v.number()),
    profilesBuilt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Design tokens synced from Figma
  design_tokens: defineTable({
    fileKey: v.string(),
    syncedAt: v.number(),
    colors: v.any(),
    typography: v.any(),
    spacing: v.any(),
    materials: v.any(),
    cssVariables: v.string(), // Full generated CSS
    tokenCount: v.number(),
  }),

  // Email style profiles
  style_profiles: defineTable({
    userId: v.string(),
    profile: v.string(), // JSON of full analysis
    prompt: v.string(), // AI drafting prompt
    emailsAnalyzed: v.number(),
    accountsAnalyzed: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Style analysis progress tracking
  style_analyses: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("analyzing"),
      v.literal("complete"),
      v.literal("error"),
    ),
    progress: v.number(),
    message: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ─── TeamOS Tables ───

  // Global skill library
  skills: defineTable({
    name: v.string(),
    category: v.union(
      v.literal("leadership"),
      v.literal("communication"),
      v.literal("strategic"),
      v.literal("technical"),
      v.literal("interpersonal"),
      v.literal("custom"),
    ),
    description: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  })
    .index("by_category", ["category"])
    .searchIndex("search_name", { searchField: "name" }),

  // OKR objectives
  objectives: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived"),
    ),
    ragStatus: v.union(
      v.literal("green"),
      v.literal("amber"),
      v.literal("red"),
      v.literal("not_started"),
    ),
    startDate: v.number(),
    endDate: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  // Key results under objectives
  key_results: defineTable({
    objectiveId: v.id("objectives"),
    userId: v.string(),
    title: v.string(),
    targetValue: v.number(),
    currentValue: v.number(),
    unit: v.optional(v.string()),
    ownerId: v.optional(v.id("contacts")),
    ownerName: v.optional(v.string()),
    status: v.union(
      v.literal("on_track"),
      v.literal("at_risk"),
      v.literal("behind"),
      v.literal("completed"),
    ),
    deadline: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_objective", ["objectiveId"])
    .index("by_owner", ["ownerId"]),

  // Meeting action items
  meeting_actions: defineTable({
    userId: v.string(),
    recordingId: v.optional(v.id("recordings")),
    sourceText: v.optional(v.string()),
    action: v.string(),
    assigneeId: v.optional(v.id("contacts")),
    assigneeName: v.optional(v.string()),
    suggestedAssigneeId: v.optional(v.id("contacts")),
    suggestedReason: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    status: v.union(
      v.literal("pending_review"),
      v.literal("confirmed"),
      v.literal("dismissed"),
      v.literal("converted_to_task"),
    ),
    dueDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_recording", ["recordingId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"]),

  // SMS Conversations
  // ─── Live Capture ───

  // A recording session (one per recording period)
  capture_sessions: defineTable({
    userId: v.string(),
    status: v.union(
      v.literal("recording"),
      v.literal("paused"),
      v.literal("stopped"),
    ),
    title: v.optional(v.string()),
    startedAt: v.number(),
    stoppedAt: v.optional(v.number()),
    totalDurationMs: v.number(),
    chunkCount: v.number(),
    // Rolling context for AI extraction
    currentContext: v.optional(v.string()),
    // Journal inclusion toggle (default: included)
    includeInJournal: v.optional(v.boolean()),
    // Calendar meeting context (auto-detected)
    calendarEventId: v.optional(v.id("calendar_events")),
    meetingTitle: v.optional(v.string()),
    meetingAttendees: v.optional(v.array(v.string())),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  // Individual audio chunks (60s each)
  capture_chunks: defineTable({
    sessionId: v.id("capture_sessions"),
    chunkIndex: v.number(),
    audioFileId: v.id("_storage"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("transcribing"),
      v.literal("transcribed"),
      v.literal("error"),
    ),
    transcriptText: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_session", ["sessionId", "chunkIndex"])
    .index("by_status", ["status"]),

  // Tasks extracted from live capture (Sprint 2 — schema only for now)
  live_tasks: defineTable({
    userId: v.string(),
    sessionId: v.id("capture_sessions"),
    chunkId: v.id("capture_chunks"),
    description: v.string(),
    owner: v.union(v.literal("josh"), v.literal("team")),
    ownerName: v.optional(v.string()),
    ownerContactId: v.optional(v.id("contacts")),
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
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("dismissed"),
      v.literal("converted"),
    ),
    taskId: v.optional(v.id("tasks")),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_user_and_status", ["userId", "status"]),

  sms_conversations: defineTable({
    userId: v.string(),
    phoneNumber: v.string(),
    contactName: v.optional(v.string()),
    lastMessage: v.string(),
    lastMessageAt: v.number(),
    unreadCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"])
    .index("by_phone_number", ["phoneNumber"]),

  // User preferences (journal schedule, etc.)
  user_preferences: defineTable({
    userId: v.string(),
    journalTime: v.optional(v.string()), // "HH:MM" 24h format
    journalTimezone: v.optional(v.string()), // e.g. "America/Denver"
    journalEnabled: v.optional(v.boolean()),
    journalTheme: v.optional(v.string()), // "field-notes" | "moleskine" | "night"
  }).index("by_user", ["userId"]),

  // AI-generated daily journals (Field Notes v2 format)
  journals: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    title: v.string(),
    status: v.string(), // "generating" | "complete" | "failed"
    generatedAt: v.number(),

    // ── Field Notes v2 fields ──
    epigraph: v.optional(v.string()),
    mood: v.optional(v.string()),
    wins: v.optional(v.array(v.string())),
    meetings: v.optional(
      v.array(
        v.object({
          approximate_time: v.string(),
          name: v.string(),
          type: v.string(),
          attendees: v.array(v.string()),
          summary: v.string(),
          decisions: v.array(v.string()),
          action_items: v.array(
            v.object({ owner: v.string(), action: v.string() }),
          ),
          confidence: v.string(),
        }),
      ),
    ),
    falling_through_cracks: v.optional(
      v.array(v.object({ text: v.string(), urgency: v.string() })),
    ),
    master_action_list: v.optional(
      v.object({
        josh_only: v.array(v.string()),
        delegated: v.array(v.string()),
        engineering: v.array(v.string()),
        scheduling: v.array(v.string()),
      }),
    ),
    conversation_count: v.optional(v.number()),
    action_item_count: v.optional(v.number()),
    capture_minutes: v.optional(v.number()),
    // Denormalized text for full-text search
    searchText: v.optional(v.string()),

    // ── Legacy v1 fields (optional for backwards compat) ──
    summary: v.optional(v.string()),
    sections: v.optional(
      v.array(
        v.object({
          type: v.string(),
          title: v.string(),
          content: v.string(),
          timeRange: v.optional(
            v.object({ start: v.string(), end: v.string() }),
          ),
        }),
      ),
    ),
    keyDecisions: v.optional(v.array(v.string())),
    actionItems: v.optional(
      v.array(v.object({ text: v.string(), priority: v.string() })),
    ),
    peopleMetioned: v.optional(v.array(v.string())),
    themes: v.optional(v.array(v.string())),
    wordCount: v.optional(v.number()),
    captureMinutes: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "date"])
    .searchIndex("search_content", {
      searchField: "searchText",
      filterFields: ["userId"],
    }),

  // Real-time streaming transcript segments
  transcript_segments: defineTable({
    sessionId: v.id("capture_sessions"),
    text: v.string(),
    speaker: v.optional(v.string()),
    startMs: v.number(),
    endMs: v.number(),
    isFinal: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_final", ["sessionId", "isFinal"]),

  // AI-generated session summaries
  session_summaries: defineTable({
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
    updatedAt: v.number(),
    segmentCount: v.number(),
  }).index("by_session", ["sessionId"]),

  // ─── Audit logs ───
  audit_logs: defineTable({
    userId: v.string(),
    action: v.string(),
    resource: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
    ip: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"]),
});
