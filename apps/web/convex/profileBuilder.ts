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
import { getAuthenticatedUserId } from "./lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ─── Queries ───

// Get all profiles for a user
export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);

    const profiles = await ctx.db
      .query("contact_profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return profiles.sort((a, b) => b.emailsSent - a.emailsSent);
  },
});

// Get profile by email
export const getProfileByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    return await ctx.db
      .query("contact_profiles")
      .withIndex("by_user_and_email", (q) =>
        q.eq("userId", userId).eq("email", args.email.toLowerCase()),
      )
      .first();
  },
});

// Internal: get profile by email (for use in actions)
export const getProfileByEmailInternal = internalQuery({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contact_profiles")
      .withIndex("by_user_and_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email.toLowerCase()),
      )
      .first();
  },
});

// Get profile for a contact
export const getProfileForContact = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contact_profiles")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .first();
  },
});

// Get build progress
export const getBuildProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);

    const builds = await ctx.db
      .query("profile_builds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return builds;
  },
});

// Profile count
export const profileCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);

    const profiles = await ctx.db
      .query("contact_profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return profiles.length;
  },
});

// ─── Internal mutations ───

export const upsertProfile = internalMutation({
  args: {
    userId: v.string(),
    contactId: v.optional(v.id("contacts")),
    email: v.string(),
    name: v.string(),
    relationshipSummary: v.string(),
    topics: v.array(v.string()),
    communicationStyle: v.string(),
    sentiment: v.string(),
    keyContext: v.string(),
    recentInteractions: v.array(
      v.object({
        date: v.number(),
        type: v.string(),
        summary: v.string(),
      }),
    ),
    emailsSent: v.number(),
    emailsReceived: v.number(),
    lastInteractionDate: v.optional(v.number()),
    sources: v.array(v.string()),
    rawEmailSamples: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("contact_profiles")
      .withIndex("by_user_and_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("contact_profiles", {
      ...args,
      builtAt: now,
      updatedAt: now,
    });
  },
});

export const createBuildProgress = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Clear old builds
    const old = await ctx.db
      .query("profile_builds")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const b of old) {
      await ctx.db.delete(b._id);
    }

    const now = Date.now();
    return await ctx.db.insert("profile_builds", {
      userId: args.userId,
      status: "pending",
      progress: 0,
      message: "Starting profile build...",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBuildProgress = internalMutation({
  args: {
    buildId: v.id("profile_builds"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("scanning"),
        v.literal("building"),
        v.literal("complete"),
        v.literal("error"),
      ),
    ),
    progress: v.optional(v.number()),
    message: v.optional(v.string()),
    totalRecipients: v.optional(v.number()),
    profilesBuilt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { buildId, ...updates } = args;
    const filtered: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) filtered[key] = value;
    }
    await ctx.db.patch(buildId, filtered);
  },
});

// Internal: find matching contact by email
export const findContactByEmail = internalQuery({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return contacts.find((c) => c.emails?.includes(args.email)) ?? null;
  },
});

// Internal: get all connections
export const getAllConnections = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("google_connections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ─── Main build action ───

// Helper: refresh Google token
async function refreshToken(ctx: any, connectionId: string): Promise<string> {
  const connection = await ctx.runQuery(internal.google.getConnection, {
    connectionId,
  });
  if (!connection) throw new Error("Connection not found");

  if (connection.tokenExpiry > Date.now() + 5 * 60 * 1000) {
    return connection.accessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok)
    throw new Error(`Token refresh failed: ${await response.text()}`);
  const tokens = await response.json();

  await ctx.runMutation(internal.google.updateConnectionTokens, {
    connectionId,
    accessToken: tokens.access_token,
    tokenExpiry: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token;
}

// Fetch sent emails from a Gmail account
async function fetchSentEmails(
  accessToken: string,
  maxResults: number = 200,
): Promise<
  Array<{
    to: string;
    toName: string;
    subject: string;
    body: string;
    date: number;
  }>
> {
  const emails: Array<{
    to: string;
    toName: string;
    subject: string;
    body: string;
    date: number;
  }> = [];

  let pageToken: string | undefined;
  let fetched = 0;

  while (fetched < maxResults) {
    const batchSize = Math.min(100, maxResults - fetched);
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${batchSize}&labelIds=SENT${pageToken ? `&pageToken=${pageToken}` : ""}`;

    const listResp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listResp.ok) break;

    const listData = await listResp.json();
    const messages = listData.messages || [];
    pageToken = listData.nextPageToken;

    for (const msg of messages) {
      try {
        const msgResp = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!msgResp.ok) continue;

        const msgData = await msgResp.json();
        const headers = msgData.payload.headers;
        const toHeader = headers.find((h: any) => h.name === "To")?.value || "";
        const subject =
          headers.find((h: any) => h.name === "Subject")?.value || "";
        const date = parseInt(msgData.internalDate, 10);

        // Extract body
        let body = msgData.snippet || "";
        if (msgData.payload.parts) {
          const textPart = msgData.payload.parts.find(
            (p: any) => p.mimeType === "text/plain",
          );
          if (textPart?.body?.data) {
            body = atob(
              textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"),
            );
          }
        } else if (msgData.payload.body?.data) {
          body = atob(
            msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"),
          );
        }

        // Strip quoted replies (lines starting with >)
        body = body
          .split("\n")
          .filter((l: string) => !l.startsWith(">"))
          .join("\n");
        // Strip signature blocks
        const sigIdx = body.indexOf("--\n");
        if (sigIdx > 0) body = body.substring(0, sigIdx);
        // Trim
        body = body.trim();
        if (body.length < 10) continue; // Skip empty/trivial

        // Parse all recipients
        const toAddresses = toHeader.split(",");
        for (const addr of toAddresses) {
          const emailMatch = addr.match(/<(.+?)>/);
          const email = emailMatch
            ? emailMatch[1].toLowerCase().trim()
            : addr.toLowerCase().trim();
          const nameMatch = addr.split("<")[0].trim().replace(/"/g, "");
          const name = nameMatch || email.split("@")[0];

          if (email && email.includes("@")) {
            emails.push({
              to: email,
              toName: name,
              subject,
              body: body.slice(0, 1000),
              date,
            });
          }
        }

        fetched++;
      } catch {
        continue;
      }
    }

    if (!pageToken) break;
  }

  return emails;
}

// Own email addresses to skip
const OWN_EMAILS = [
  "josh@onflourish.com",
  "josh@church.tech",
  "jburnett@gloo.us",
  "jmgburnett@gmail.com",
  "jbflobot@gmail.com",
];

const SYSTEM_PATTERN =
  /no-?reply|mailer-daemon|notifications?@|noreply|donotreply|unsubscribe|calendar-notification/i;

// Build profiles from email data
export const buildProfiles = action({
  args: {
    maxEmailsPerAccount: v.optional(v.number()), // default 200
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const maxEmails = args.maxEmailsPerAccount ?? 200;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // Create build progress tracker
    const buildId = await ctx.runMutation(
      internal.profileBuilder.createBuildProgress,
      {
        userId,
      },
    );

    try {
      // ── Phase 1: Scan sent emails from all accounts ──
      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "scanning",
        progress: 5,
        message: "Scanning sent emails across all accounts...",
      });

      const connections = await ctx.runQuery(
        internal.profileBuilder.getAllConnections,
        {
          userId,
        },
      );

      // Aggregate all sent emails grouped by recipient
      const recipientMap: Map<
        string,
        {
          name: string;
          sentEmails: Array<{
            subject: string;
            body: string;
            date: number;
            fromAccount: string;
          }>;
          receivedEmails: Array<{
            subject: string;
            body: string;
            date: number;
          }>;
        }
      > = new Map();

      let accountsScanned = 0;
      for (const conn of connections) {
        try {
          const accessToken = await refreshToken(ctx, conn._id);
          const sentEmails = await fetchSentEmails(accessToken, maxEmails);

          for (const email of sentEmails) {
            // Skip own emails and system addresses
            if (OWN_EMAILS.includes(email.to)) continue;
            if (SYSTEM_PATTERN.test(email.to)) continue;

            const existing = recipientMap.get(email.to) || {
              name: email.toName,
              sentEmails: [],
              receivedEmails: [],
            };
            existing.sentEmails.push({
              subject: email.subject,
              body: email.body,
              date: email.date,
              fromAccount: conn.email,
            });
            // Use most informative name
            if (
              email.toName &&
              email.toName.length > existing.name.length &&
              !email.toName.includes("@")
            ) {
              existing.name = email.toName;
            }
            recipientMap.set(email.to, existing);
          }

          accountsScanned++;
          await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
            buildId,
            progress: Math.round(
              5 + (accountsScanned / connections.length) * 30,
            ),
            message: `Scanned ${conn.email} (${sentEmails.length} sent emails)`,
          });
        } catch (e) {
          console.error(`Error scanning ${conn.email}:`, e);
        }
      }

      // Also scan received emails (already in DB) to count
      // We'll match by sender email to existing contacts
      // (Received emails are already stored from syncGmailInbox)

      // ── Phase 2: Filter to meaningful contacts ──
      // Only build profiles for people Josh has emailed at least 2 times
      const qualifiedRecipients = Array.from(recipientMap.entries())
        .filter(([_, data]) => data.sentEmails.length >= 2)
        .sort((a, b) => b[1].sentEmails.length - a[1].sentEmails.length);

      const totalRecipients = qualifiedRecipients.length;

      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "building",
        progress: 35,
        message: `Found ${totalRecipients} contacts to profile (from ${recipientMap.size} total recipients)`,
        totalRecipients,
      });

      // ── Phase 3: Build profiles with Claude ──
      let profilesBuilt = 0;

      // Process in batches of 5 to avoid rate limits
      for (let i = 0; i < qualifiedRecipients.length; i += 5) {
        const batch = qualifiedRecipients.slice(i, i + 5);

        await Promise.all(
          batch.map(async ([email, data]) => {
            try {
              // Take most recent 10 emails as samples
              const sortedEmails = data.sentEmails
                .sort((a, b) => b.date - a.date)
                .slice(0, 10);

              const emailSamples = sortedEmails
                .map(
                  (e) =>
                    `[${new Date(e.date).toISOString().split("T")[0]}] Subject: ${e.subject}\nFrom account: ${e.fromAccount}\n${e.body.slice(0, 300)}`,
                )
                .join("\n\n---\n\n");

              // Call Claude to build profile
              const resp = await fetch(
                "https://api.anthropic.com/v1/messages",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 800,
                    messages: [
                      {
                        role: "user",
                        content: `Analyze these ${data.sentEmails.length} sent emails from Josh Burnett to ${data.name} (${email}) and build a contact profile.

EMAILS:
${emailSamples}

Return a JSON object with these exact fields:
{
  "relationshipSummary": "Brief description of the relationship and context (1-2 sentences)",
  "topics": ["array", "of", "key", "topics", "discussed"],
  "communicationStyle": "How Josh communicates with this person (formal/casual, detailed/brief, etc)",
  "sentiment": "overall tone: warm/professional/casual/formal/friendly",
  "keyContext": "Important things an AI should know when drafting emails to this person — their role, shared projects, sensitivities, preferences"
}

JSON only, no markdown:`,
                      },
                    ],
                  }),
                },
              );

              if (!resp.ok) {
                console.error(
                  `Claude error for ${email}: ${await resp.text()}`,
                );
                return;
              }

              const respData: { content: Array<{ text: string }> } =
                await resp.json();
              let profileJson;
              try {
                // Try to parse, handling potential markdown wrapping
                let text = respData.content[0].text.trim();
                if (text.startsWith("```")) {
                  text = text
                    .replace(/```json?\n?/g, "")
                    .replace(/```/g, "")
                    .trim();
                }
                profileJson = JSON.parse(text);
              } catch {
                console.error(`Failed to parse profile for ${email}`);
                return;
              }

              // Find matching contact
              const contact = await ctx.runQuery(
                internal.profileBuilder.findContactByEmail,
                {
                  userId,
                  email,
                },
              );

              // Build recent interactions list
              const recentInteractions = sortedEmails.slice(0, 5).map((e) => ({
                date: e.date,
                type: "email_sent",
                summary: e.subject,
              }));

              const lastDate = sortedEmails[0]?.date;

              // Upsert the profile
              await ctx.runMutation(internal.profileBuilder.upsertProfile, {
                userId,
                contactId: contact?._id,
                email,
                name: data.name,
                relationshipSummary: profileJson.relationshipSummary || "",
                topics: profileJson.topics || [],
                communicationStyle: profileJson.communicationStyle || "",
                sentiment: profileJson.sentiment || "professional",
                keyContext: profileJson.keyContext || "",
                recentInteractions,
                emailsSent: data.sentEmails.length,
                emailsReceived: 0, // Will be enriched later from inbox
                lastInteractionDate: lastDate,
                sources: ["email"],
                rawEmailSamples: JSON.stringify(
                  sortedEmails.slice(0, 5).map((e) => ({
                    subject: e.subject,
                    body: e.body.slice(0, 200),
                    date: e.date,
                  })),
                ),
              });

              profilesBuilt++;
            } catch (e) {
              console.error(`Error building profile for ${email}:`, e);
            }
          }),
        );

        // Update progress
        await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
          buildId,
          progress: Math.round(
            35 +
              (Math.min(i + 5, qualifiedRecipients.length) /
                qualifiedRecipients.length) *
                60,
          ),
          message: `Built ${profilesBuilt} of ${totalRecipients} profiles...`,
          profilesBuilt,
        });
      }

      // ── Phase 4: Done ──
      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "complete",
        progress: 100,
        message: `Built ${profilesBuilt} profiles from ${accountsScanned} email accounts`,
        profilesBuilt,
      });

      return { profilesBuilt, totalRecipients, accountsScanned };
    } catch (e) {
      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "error",
        message: `Error: ${String(e).slice(0, 200)}`,
      });
      throw e;
    }
  },
});

// Trigger profile build from the UI
export const startBuildProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);

    // Just a trigger — the actual work happens in the action
    // The UI will call buildProfiles action after this
    return { started: true };
  },
});

// ─── Internal helpers for enrichment ───

// Get all profiles for a user (internal)
export const getAllProfiles = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contact_profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get all calendar events for a user (internal)
export const getAllCalendarEvents = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendar_events")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get all emails for a user (internal — for inbound counting)
export const getAllEmails = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Patch a profile (internal)
export const patchProfile = internalMutation({
  args: {
    profileId: v.id("contact_profiles"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, args.patch);
  },
});

// Delete a profile (internal)
export const deleteProfile = internalMutation({
  args: { profileId: v.id("contact_profiles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.profileId);
  },
});

// ═══════════════════════════════════════════════
// FILTRATION — Remove marketing/automated contacts
// ═══════════════════════════════════════════════

// Known junk patterns — these get auto-filtered without burning an API call
const JUNK_EMAIL_PATTERNS = [
  /bounces\+/i,
  /@em\./i,
  /@email\./i,
  /@mail\./i,
  /@send\./i,
  /@campaign/i,
  /@news\./i,
  /@newsletter/i,
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /mailer-daemon/i,
  /notifications?@/i,
  /unsubscribe/i,
  /calendar-notification/i,
  /@bounce/i,
  /@marketing/i,
  /@promo/i,
  /automated@/i,
];

const JUNK_DOMAIN_PATTERNS = [
  /nianticlabs\.com$/i,
  /blackboard\.com$/i,
  /schoology\.com$/i,
  /constantcontact\.com$/i,
  /mailchimp\.com$/i,
  /sendgrid\.net$/i,
  /hubspot\.(com|net)$/i,
  /salesforce\.com$/i,
  /marketo\.com$/i,
  /pardot\.com$/i,
  /amazonses\.com$/i,
  /mandrillapp\.com$/i,
  /intercom\.io$/i,
  /zendesk\.com$/i,
  /freshdesk\.com$/i,
  /mailgun\.(com|org)$/i,
  /postmarkapp\.com$/i,
  /convertkit\.com$/i,
  /substack\.com$/i,
  /beehiiv\.com$/i,
  /github\.com$/i,
  /gitlab\.com$/i,
  /atlassian\.(com|net)$/i,
  /jira\.com$/i,
  /slack\.com$/i,
  /google\.com$/i,
  /apple\.com$/i,
  /microsoft\.com$/i,
  /linkedin\.com$/i,
  /facebook\.com$/i,
  /twitter\.com$/i,
  /stripe\.com$/i,
  /paypal\.com$/i,
  /square\.com$/i,
  /notion\.so$/i,
  /figma\.com$/i,
  /vercel\.com$/i,
];

function isObviouslyJunk(email: string): { junk: boolean; reason: string } {
  // Check email patterns
  for (const pattern of JUNK_EMAIL_PATTERNS) {
    if (pattern.test(email)) {
      return { junk: true, reason: `Email matches junk pattern: ${pattern}` };
    }
  }

  // Check domain patterns
  const domain = email.split("@")[1];
  if (domain) {
    for (const pattern of JUNK_DOMAIN_PATTERNS) {
      if (pattern.test(domain)) {
        return {
          junk: true,
          reason: `Domain matches automated service: ${domain}`,
        };
      }
    }
  }

  // Email address contains long hash/tracking IDs
  const localPart = email.split("@")[0];
  if (localPart && localPart.length > 40) {
    return {
      junk: true,
      reason: "Email local part looks like tracking/bounce ID",
    };
  }

  // Contains + addressing with long suffix (tracking)
  if (
    localPart &&
    localPart.includes("+") &&
    localPart.split("+")[1].length > 15
  ) {
    return { junk: true, reason: "Email contains tracking identifier" };
  }

  return { junk: false, reason: "" };
}

// Filter profiles: auto-filter obvious junk, then use Claude for ambiguous ones
export const filterProfiles = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    autoFiltered: number;
    aiFiltered: number;
    kept: number;
    deleted: number;
    filtered: number;
    message: string;
  }> => {
    const userId = await getAuthenticatedUserId(ctx);
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      {
        userId,
      },
    );

    // Only filter profiles that haven't been classified yet
    const unclassified = profiles.filter((p: any) => p.isReal === undefined);
    if (unclassified.length === 0) {
      return {
        total: 0,
        autoFiltered: 0,
        aiFiltered: 0,
        filtered: 0,
        kept: 0,
        deleted: 0,
        message: "All profiles already classified",
      };
    }

    let autoFiltered = 0;
    let aiFiltered = 0;
    let kept = 0;
    let deleted = 0;
    const ambiguous: typeof unclassified = [];

    // Phase 1: Auto-filter obvious junk
    for (const profile of unclassified) {
      const check = isObviouslyJunk(profile.email);
      if (check.junk) {
        await ctx.runMutation(internal.profileBuilder.deleteProfile, {
          profileId: profile._id,
        });
        autoFiltered++;
        deleted++;
      } else {
        ambiguous.push(profile);
      }
    }

    // Phase 2: Batch classify ambiguous profiles with Claude
    // Send batches of 20 profiles at once to minimize API calls
    for (let i = 0; i < ambiguous.length; i += 20) {
      const batch = ambiguous.slice(i, i + 20);

      const profileList = batch
        .map(
          (p: any, idx: number) =>
            `${idx + 1}. "${p.name}" <${p.email}> — ${p.emailsSent} sent emails. Summary: ${p.relationshipSummary.slice(0, 100)}`,
        )
        .join("\n");

      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: `Classify each contact as REAL (a real person Josh communicates with) or JUNK (marketing, newsletter, automated service, school notification system, app notification, mailing list).

CONTACTS:
${profileList}

Return a JSON array where each element is:
{"index": 1, "real": true/false, "reason": "brief reason"}

JSON only, no markdown:`,
              },
            ],
          }),
        });

        if (!resp.ok) {
          console.error(`Claude filter error: ${await resp.text()}`);
          continue;
        }

        const respData: { content: Array<{ text: string }> } =
          await resp.json();
        let classifications;
        try {
          let text = respData.content[0].text.trim();
          if (text.startsWith("```")) {
            text = text
              .replace(/```json?\n?/g, "")
              .replace(/```/g, "")
              .trim();
          }
          classifications = JSON.parse(text);
        } catch {
          console.error("Failed to parse filter response");
          // Default to keeping all if parse fails
          for (const profile of batch) {
            await ctx.runMutation(internal.profileBuilder.patchProfile, {
              profileId: profile._id,
              patch: {
                isReal: true,
                filterReason: "classification_parse_error",
                updatedAt: Date.now(),
              },
            });
            kept++;
          }
          continue;
        }

        for (const classification of classifications) {
          const idx = classification.index - 1;
          if (idx < 0 || idx >= batch.length) continue;
          const profile = batch[idx];

          if (classification.real) {
            await ctx.runMutation(internal.profileBuilder.patchProfile, {
              profileId: profile._id,
              patch: {
                isReal: true,
                filterReason: classification.reason,
                updatedAt: Date.now(),
              },
            });
            kept++;
          } else {
            // Delete junk profiles entirely
            await ctx.runMutation(internal.profileBuilder.deleteProfile, {
              profileId: profile._id,
            });
            aiFiltered++;
            deleted++;
          }
        }
      } catch (e) {
        console.error("Filter batch error:", e);
      }
    }

    return {
      total: unclassified.length,
      autoFiltered,
      aiFiltered,
      filtered: autoFiltered + aiFiltered,
      kept,
      deleted,
      message: `Filtered ${deleted} junk profiles (${autoFiltered} auto, ${aiFiltered} AI). Kept ${kept} real contacts.`,
    };
  },
});

// ═══════════════════════════════════════════════
// CALENDAR ENRICHMENT — shared meetings per contact
// ═══════════════════════════════════════════════

export const enrichFromCalendar = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    enriched: number;
    newFromCalendar: number;
    totalMeetings: number;
    message: string;
  }> => {
    const userId = await getAuthenticatedUserId(ctx);

    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      {
        userId,
      },
    );
    const events = await ctx.runQuery(
      internal.profileBuilder.getAllCalendarEvents,
      {
        userId,
      },
    );

    // Build a map of email → meeting data
    const meetingMap: Map<
      string,
      { count: number; topics: string[]; latestDate: number }
    > = new Map();

    for (const event of events) {
      const attendees = event.attendees || [];
      for (const attendeeEmail of attendees) {
        const email = attendeeEmail.toLowerCase();
        // Skip own emails
        if (OWN_EMAILS.includes(email)) continue;

        const existing = meetingMap.get(email) || {
          count: 0,
          topics: [],
          latestDate: 0,
        };
        existing.count++;
        if (event.title && !existing.topics.includes(event.title)) {
          existing.topics.push(event.title);
        }
        if (event.startTime > existing.latestDate) {
          existing.latestDate = event.startTime;
        }
        meetingMap.set(email, existing);
      }
    }

    let enriched = 0;
    let newFromCalendar = 0;

    // Update existing profiles with calendar data
    for (const profile of profiles) {
      const calData = meetingMap.get(profile.email);
      if (calData) {
        const sources = [...profile.sources];
        if (!sources.includes("calendar")) sources.push("calendar");

        // Merge calendar interactions into recent interactions
        const interactions = [...profile.recentInteractions];
        // Add latest meeting if not already tracked
        if (calData.topics.length > 0) {
          const latestTopic = calData.topics[calData.topics.length - 1];
          const alreadyTracked = interactions.some(
            (i) => i.type === "calendar" && i.summary === latestTopic,
          );
          if (!alreadyTracked) {
            interactions.push({
              date: calData.latestDate,
              type: "calendar",
              summary: latestTopic,
            });
            // Keep most recent 10
            interactions.sort((a, b) => b.date - a.date);
            interactions.splice(10);
          }
        }

        // Update last interaction date if calendar is more recent
        const lastDate = Math.max(
          profile.lastInteractionDate || 0,
          calData.latestDate,
        );

        await ctx.runMutation(internal.profileBuilder.patchProfile, {
          profileId: profile._id,
          patch: {
            sharedMeetings: calData.count,
            meetingTopics: calData.topics.slice(-10), // Keep last 10 meeting titles
            sources,
            recentInteractions: interactions,
            lastInteractionDate: lastDate,
            updatedAt: Date.now(),
          },
        });
        enriched++;

        // Remove from map so we can track new-only contacts below
        meetingMap.delete(profile.email);
      }
    }

    // Calendar-only contacts (people Josh meets with but hasn't emailed much)
    // Only create profiles for people with 2+ meetings
    for (const [email, calData] of meetingMap.entries()) {
      if (calData.count < 2) continue;
      if (SYSTEM_PATTERN.test(email)) continue;
      if (isObviouslyJunk(email).junk) continue;

      // Check if this is a real-looking email
      const domain = email.split("@")[1];
      if (!domain) continue;

      // Find matching contact
      const contact = await ctx.runQuery(
        internal.profileBuilder.findContactByEmail,
        {
          userId,
          email,
        },
      );

      const name = email
        .split("@")[0]
        .replace(/\./g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      await ctx.runMutation(internal.profileBuilder.upsertProfile, {
        userId,
        contactId: contact?._id,
        email,
        name,
        relationshipSummary: `Meets with Josh regularly (${calData.count} shared meetings). No email correspondence analyzed.`,
        topics: calData.topics.slice(-5),
        communicationStyle: "Unknown — calendar-only contact",
        sentiment: "professional",
        keyContext: `Calendar-only contact. ${calData.count} shared meetings. Topics: ${calData.topics.slice(-3).join(", ")}`,
        recentInteractions: calData.topics.slice(-5).map((topic) => ({
          date: calData.latestDate,
          type: "calendar",
          summary: topic,
        })),
        emailsSent: 0,
        emailsReceived: 0,
        lastInteractionDate: calData.latestDate,
        sources: ["calendar"],
      });
      newFromCalendar++;
    }

    return {
      enriched,
      newFromCalendar,
      totalMeetings: events.length,
      message: `Enriched ${enriched} profiles with calendar data. Created ${newFromCalendar} new calendar-only profiles.`,
    };
  },
});

// ═══════════════════════════════════════════════
// INBOUND EMAIL ENRICHMENT — received email counts
// ═══════════════════════════════════════════════

export const enrichFromInboundEmails = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    enriched: number;
    totalInboundEmails: number;
    uniqueSenders: number;
    message: string;
  }> => {
    const userId = await getAuthenticatedUserId(ctx);

    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      {
        userId,
      },
    );
    const emails = await ctx.runQuery(internal.profileBuilder.getAllEmails, {
      userId,
    });

    // Count received emails by sender
    const inboundMap: Map<
      string,
      { count: number; latestDate: number; latestSubject: string }
    > = new Map();

    for (const email of emails) {
      // Extract sender email
      const senderMatch = email.from.match(/<(.+?)>/);
      const senderEmail = senderMatch
        ? senderMatch[1].toLowerCase()
        : email.from.toLowerCase().trim();
      if (!senderEmail.includes("@")) continue;
      if (OWN_EMAILS.includes(senderEmail)) continue;

      const existing = inboundMap.get(senderEmail) || {
        count: 0,
        latestDate: 0,
        latestSubject: "",
      };
      existing.count++;
      if (email.receivedAt > existing.latestDate) {
        existing.latestDate = email.receivedAt;
        existing.latestSubject = email.subject;
      }
      inboundMap.set(senderEmail, existing);
    }

    let enriched = 0;

    // Update existing profiles with inbound counts
    for (const profile of profiles) {
      const inbound = inboundMap.get(profile.email);
      if (inbound) {
        // Merge inbound interaction into recent
        const interactions = [...profile.recentInteractions];
        const alreadyHasInbound = interactions.some(
          (i) =>
            i.type === "email_received" && i.summary === inbound.latestSubject,
        );
        if (!alreadyHasInbound && inbound.latestSubject) {
          interactions.push({
            date: inbound.latestDate,
            type: "email_received",
            summary: inbound.latestSubject,
          });
          interactions.sort((a, b) => b.date - a.date);
          interactions.splice(10);
        }

        const lastDate = Math.max(
          profile.lastInteractionDate || 0,
          inbound.latestDate,
        );

        await ctx.runMutation(internal.profileBuilder.patchProfile, {
          profileId: profile._id,
          patch: {
            emailsReceived: inbound.count,
            recentInteractions: interactions,
            lastInteractionDate: lastDate,
            updatedAt: Date.now(),
          },
        });
        enriched++;
      }
    }

    return {
      enriched,
      totalInboundEmails: emails.length,
      uniqueSenders: inboundMap.size,
      message: `Enriched ${enriched} profiles with inbound email data from ${emails.length} received emails.`,
    };
  },
});

// ═══════════════════════════════════════════════
// REAL-TIME PROFILE — triggered on new inbound contact
// ═══════════════════════════════════════════════

// Check if a profile already exists (internal)
export const profileExists = internalQuery({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.email) {
      const p = await ctx.db
        .query("contact_profiles")
        .withIndex("by_user_and_email", (q) =>
          q.eq("userId", args.userId).eq("email", args.email!.toLowerCase()),
        )
        .first();
      if (p) return true;
    }
    // For phone-only contacts, search all profiles (no phone index yet)
    if (args.phone && !args.email) {
      // Phone-only profiles are rare, skip for now
      return false;
    }
    return false;
  },
});

// Real-time: profile a new inbound contact
// Called from email sync, SMS receive, Slack message sync
export const profileNewContact = internalAction({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.union(
      v.literal("email"),
      v.literal("sms"),
      v.literal("slack"),
      v.literal("calendar"),
    ),
    context: v.optional(v.string()), // e.g. email subject, SMS body snippet
  },
  handler: async (ctx, args) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return { skipped: true, reason: "no_api_key" };

    // 1. Skip if profile already exists
    const exists = await ctx.runQuery(internal.profileBuilder.profileExists, {
      userId: args.userId,
      email: args.email,
      phone: args.phone,
    });
    if (exists) return { skipped: true, reason: "profile_exists" };

    // 2. Skip own emails
    if (args.email && OWN_EMAILS.includes(args.email.toLowerCase())) {
      return { skipped: true, reason: "own_email" };
    }

    // 3. Filter check — is this a real person?
    const email = args.email?.toLowerCase() || "";

    // Auto-filter obvious junk
    if (email) {
      const junkCheck = isObviouslyJunk(email);
      if (junkCheck.junk) {
        return { skipped: true, reason: `junk: ${junkCheck.reason}` };
      }
    }

    // AI filter for ambiguous contacts
    try {
      const filterResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: `Is this a real person or a marketing/automated/newsletter sender?
Name: "${args.name}"
Email: ${email || "N/A"}
Phone: ${args.phone || "N/A"}
Source: ${args.source}
Context: ${args.context?.slice(0, 200) || "N/A"}

Reply with ONLY "real" or "junk" followed by a brief reason.`,
            },
          ],
        }),
      });

      if (filterResp.ok) {
        const filterData: { content: Array<{ text: string }> } =
          await filterResp.json();
        const verdict = filterData.content[0].text.trim().toLowerCase();
        if (verdict.startsWith("junk")) {
          return { skipped: true, reason: `ai_filtered: ${verdict}` };
        }
      }
    } catch {
      // If filter fails, proceed anyway (better to profile than miss someone)
    }

    // 4. Build profile
    // For email contacts, check if we have any sent emails to them in the DB
    let profileContext = args.context || "";
    if (email) {
      // Check sent emails from all accounts
      const connections = await ctx.runQuery(
        internal.profileBuilder.getAllConnections,
        {
          userId: args.userId,
        },
      );

      // Fetch a few sent emails to this person if we can
      for (const conn of connections) {
        try {
          const accessToken = await refreshToken(ctx, conn._id);
          const searchResp = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=to:${email}+in:sent`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!searchResp.ok) continue;
          const searchData = await searchResp.json();
          const messages = searchData.messages || [];

          for (const msg of messages.slice(0, 3)) {
            const msgResp = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (!msgResp.ok) continue;
            const msgData = await msgResp.json();
            const subject =
              msgData.payload?.headers?.find((h: any) => h.name === "Subject")
                ?.value || "";
            if (subject)
              profileContext += `\nPrevious email subject: ${subject}`;
          }
          break; // Got some context, no need to check other accounts
        } catch {
          continue;
        }
      }
    }

    // Check calendar for shared meetings
    const events = await ctx.runQuery(
      internal.profileBuilder.getAllCalendarEvents,
      {
        userId: args.userId,
      },
    );
    const sharedMeetings = email
      ? events.filter((e: any) =>
          e.attendees?.some((a: string) => a.toLowerCase() === email),
        )
      : [];
    if (sharedMeetings.length > 0) {
      profileContext += `\nShared meetings: ${sharedMeetings.map((e: any) => e.title).join(", ")}`;
    }

    // Generate profile with Claude
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Build a contact profile for someone who just contacted Josh Burnett (Head of AI Product at Gloo, founder of Church.tech).

Name: ${args.name}
Email: ${email || "N/A"}
Phone: ${args.phone || "N/A"}
Source: ${args.source}
Available context: ${profileContext.slice(0, 500) || "First contact, no prior history"}

Return JSON:
{
  "relationshipSummary": "Brief description based on available info (1-2 sentences)",
  "topics": ["inferred", "topics"],
  "communicationStyle": "Unknown — new contact" or inferred from context,
  "sentiment": "professional" or inferred,
  "keyContext": "What an AI should know when drafting responses to this person"
}

JSON only:`,
            },
          ],
        }),
      });

      if (!resp.ok) {
        console.error(`Claude profile error: ${await resp.text()}`);
        return { skipped: true, reason: "claude_error" };
      }

      const respData: { content: Array<{ text: string }> } = await resp.json();
      let profileJson;
      try {
        let text = respData.content[0].text.trim();
        if (text.startsWith("```")) {
          text = text
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
        }
        profileJson = JSON.parse(text);
      } catch {
        return { skipped: true, reason: "parse_error" };
      }

      // Find matching contact record
      const contact = email
        ? await ctx.runQuery(internal.profileBuilder.findContactByEmail, {
            userId: args.userId,
            email,
          })
        : null;

      // Upsert profile
      await ctx.runMutation(internal.profileBuilder.upsertProfile, {
        userId: args.userId,
        contactId: contact?._id,
        email:
          email || args.phone || args.name.toLowerCase().replace(/\s+/g, "."),
        name: args.name,
        relationshipSummary: profileJson.relationshipSummary || "",
        topics: profileJson.topics || [],
        communicationStyle:
          profileJson.communicationStyle || "Unknown — new contact",
        sentiment: profileJson.sentiment || "professional",
        keyContext: profileJson.keyContext || "",
        recentInteractions: [
          {
            date: Date.now(),
            type: `${args.source}_received`,
            summary:
              args.context?.slice(0, 100) || `First ${args.source} contact`,
          },
        ],
        emailsSent: 0,
        emailsReceived: args.source === "email" ? 1 : 0,
        lastInteractionDate: Date.now(),
        sources: [args.source],
      });

      return { created: true, name: args.name, email: email || args.phone };
    } catch (e) {
      console.error("Profile creation error:", e);
      return { skipped: true, reason: `error: ${String(e).slice(0, 100)}` };
    }
  },
});

// ═══════════════════════════════════════════════
// DAILY ENRICHMENT PIPELINE — runs from Convex cron
// ═══════════════════════════════════════════════

export const dailyEnrichmentPipeline = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error(
        "dailyEnrichmentPipeline: ANTHROPIC_API_KEY not configured",
      );
      return;
    }

    console.log("═══ Daily Profile Enrichment Starting ═══");

    // ── Step 1: Sync Gmail inboxes ──
    const connections = await ctx.runQuery(
      internal.profileBuilder.getAllConnections,
      {
        userId: args.userId,
      },
    );

    let totalNewEmails = 0;
    let totalNewEvents = 0;

    for (const conn of connections) {
      try {
        const emailResult = await ctx.runAction(
          internal.google.syncGmailInboxInternal,
          {
            connectionId: conn._id,
          },
        );
        totalNewEmails += emailResult.newEmails;
        console.log(`Email sync ${conn.email}: ${emailResult.newEmails} new`);
      } catch (e) {
        console.error(`Email sync failed for ${conn.email}:`, e);
      }

      try {
        const calResult = await ctx.runAction(
          internal.google.syncCalendarInternal,
          {
            connectionId: conn._id,
          },
        );
        totalNewEvents += calResult.newEvents;
        console.log(`Calendar sync ${conn.email}: ${calResult.newEvents} new`);
      } catch (e) {
        console.error(`Calendar sync failed for ${conn.email}:`, e);
      }
    }

    // ── Step 2: Build new profiles from sent emails ──
    const buildResult = await ctx.runAction(
      internal.profileBuilder.buildProfilesInternal,
      {
        userId: args.userId,
        maxEmailsPerAccount: 200,
      },
    );
    console.log(`Profile build: ${buildResult.profilesBuilt} new profiles`);

    // ── Step 3: Filter junk ──
    const filterResult = await ctx.runAction(
      internal.profileBuilder.filterProfilesInternal,
      {
        userId: args.userId,
      },
    );
    console.log(
      `Filter: removed ${filterResult.deleted}, kept ${filterResult.kept}`,
    );

    // ── Step 4: Enrich from calendar ──
    const calEnrich = await ctx.runAction(
      internal.profileBuilder.enrichFromCalendarInternal,
      {
        userId: args.userId,
      },
    );
    console.log(
      `Calendar enrich: ${calEnrich.enriched} updated, ${calEnrich.newFromCalendar} new`,
    );

    // ── Step 5: Enrich from inbound emails ──
    const inboundEnrich = await ctx.runAction(
      internal.profileBuilder.enrichFromInboundEmailsInternal,
      {
        userId: args.userId,
      },
    );
    console.log(`Inbound enrich: ${inboundEnrich.enriched} updated`);

    console.log("═══ Daily Profile Enrichment Complete ═══");
    console.log(
      `Summary: ${totalNewEmails} new emails, ${totalNewEvents} new events, ${buildResult.profilesBuilt} new profiles, ${filterResult.deleted} filtered, ${calEnrich.enriched + inboundEnrich.enriched} enriched`,
    );
  },
});

// Internal versions of all pipeline actions (callable from other actions)

export const buildProfilesInternal = internalAction({
  args: {
    userId: v.string(),
    maxEmailsPerAccount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Reuse the same logic as buildProfiles but as internalAction
    const maxEmails = args.maxEmailsPerAccount ?? 200;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY)
      return { profilesBuilt: 0, totalRecipients: 0, accountsScanned: 0 };

    const buildId = await ctx.runMutation(
      internal.profileBuilder.createBuildProgress,
      {
        userId: args.userId,
      },
    );

    try {
      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "scanning",
        progress: 5,
        message: "Scanning sent emails...",
      });

      const connections = await ctx.runQuery(
        internal.profileBuilder.getAllConnections,
        {
          userId: args.userId,
        },
      );

      const recipientMap: Map<
        string,
        {
          name: string;
          sentEmails: Array<{
            subject: string;
            body: string;
            date: number;
            fromAccount: string;
          }>;
        }
      > = new Map();

      let accountsScanned = 0;
      for (const conn of connections) {
        try {
          const accessToken = await refreshToken(ctx, conn._id);
          const sentEmails = await fetchSentEmails(accessToken, maxEmails);

          for (const email of sentEmails) {
            if (OWN_EMAILS.includes(email.to)) continue;
            if (SYSTEM_PATTERN.test(email.to)) continue;

            const existing = recipientMap.get(email.to) || {
              name: email.toName,
              sentEmails: [],
            };
            existing.sentEmails.push({
              subject: email.subject,
              body: email.body,
              date: email.date,
              fromAccount: conn.email,
            });
            if (
              email.toName &&
              email.toName.length > existing.name.length &&
              !email.toName.includes("@")
            ) {
              existing.name = email.toName;
            }
            recipientMap.set(email.to, existing);
          }
          accountsScanned++;
        } catch (e) {
          console.error(`Error scanning ${conn.email}:`, e);
        }
      }

      const qualifiedRecipients = Array.from(recipientMap.entries())
        .filter(([_, data]) => data.sentEmails.length >= 2)
        .sort((a, b) => b[1].sentEmails.length - a[1].sentEmails.length);

      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "building",
        progress: 35,
        message: `Found ${qualifiedRecipients.length} contacts to profile`,
        totalRecipients: qualifiedRecipients.length,
      });

      let profilesBuilt = 0;

      for (let i = 0; i < qualifiedRecipients.length; i += 5) {
        const batch = qualifiedRecipients.slice(i, i + 5);
        await Promise.all(
          batch.map(async ([email, data]) => {
            try {
              // Check if profile already exists
              const exists = await ctx.runQuery(
                internal.profileBuilder.profileExists,
                {
                  userId: args.userId,
                  email,
                },
              );
              if (exists) return; // Skip — already profiled

              const sortedEmails = data.sentEmails
                .sort((a, b) => b.date - a.date)
                .slice(0, 10);
              const emailSamples = sortedEmails
                .map(
                  (e) =>
                    `[${new Date(e.date).toISOString().split("T")[0]}] Subject: ${e.subject}\nFrom: ${e.fromAccount}\n${e.body.slice(0, 300)}`,
                )
                .join("\n\n---\n\n");

              const resp = await fetch(
                "https://api.anthropic.com/v1/messages",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 800,
                    messages: [
                      {
                        role: "user",
                        content: `Analyze these ${data.sentEmails.length} sent emails from Josh Burnett to ${data.name} (${email}) and build a contact profile.\n\nEMAILS:\n${emailSamples}\n\nReturn a JSON object with these exact fields:\n{\n  "relationshipSummary": "Brief description (1-2 sentences)",\n  "topics": ["array", "of", "topics"],\n  "communicationStyle": "How Josh communicates with this person",\n  "sentiment": "overall tone",\n  "keyContext": "Important context for AI drafting"\n}\n\nJSON only, no markdown:`,
                      },
                    ],
                  }),
                },
              );

              if (!resp.ok) return;
              const respData: { content: Array<{ text: string }> } =
                await resp.json();
              let text = respData.content[0].text.trim();
              if (text.startsWith("```"))
                text = text
                  .replace(/```json?\n?/g, "")
                  .replace(/```/g, "")
                  .trim();
              const profileJson = JSON.parse(text);

              const contact = await ctx.runQuery(
                internal.profileBuilder.findContactByEmail,
                { userId: args.userId, email },
              );
              const recentInteractions = sortedEmails.slice(0, 5).map((e) => ({
                date: e.date,
                type: "email_sent",
                summary: e.subject,
              }));

              await ctx.runMutation(internal.profileBuilder.upsertProfile, {
                userId: args.userId,
                contactId: contact?._id,
                email,
                name: data.name,
                relationshipSummary: profileJson.relationshipSummary || "",
                topics: profileJson.topics || [],
                communicationStyle: profileJson.communicationStyle || "",
                sentiment: profileJson.sentiment || "professional",
                keyContext: profileJson.keyContext || "",
                recentInteractions,
                emailsSent: data.sentEmails.length,
                emailsReceived: 0,
                lastInteractionDate: sortedEmails[0]?.date,
                sources: ["email"],
                rawEmailSamples: JSON.stringify(
                  sortedEmails.slice(0, 5).map((e) => ({
                    subject: e.subject,
                    body: e.body.slice(0, 200),
                    date: e.date,
                  })),
                ),
              });
              profilesBuilt++;
            } catch {
              /* skip failed profiles */
            }
          }),
        );
      }

      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "complete",
        progress: 100,
        message: `Built ${profilesBuilt} profiles from ${accountsScanned} accounts`,
        profilesBuilt,
      });

      return {
        profilesBuilt,
        totalRecipients: qualifiedRecipients.length,
        accountsScanned,
      };
    } catch (e) {
      await ctx.runMutation(internal.profileBuilder.updateBuildProgress, {
        buildId,
        status: "error",
        message: `Error: ${String(e).slice(0, 200)}`,
      });
      return { profilesBuilt: 0, totalRecipients: 0, accountsScanned: 0 };
    }
  },
});

export const filterProfilesInternal = internalAction({
  args: { userId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    filtered: number;
    autoFiltered: number;
    aiFiltered: number;
    kept: number;
    deleted: number;
    message: string;
  }> => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY)
      return {
        filtered: 0,
        autoFiltered: 0,
        aiFiltered: 0,
        kept: 0,
        deleted: 0,
        message: "no api key",
      };

    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      { userId: args.userId },
    );
    const unclassified = profiles.filter((p: any) => p.isReal === undefined);
    if (unclassified.length === 0)
      return {
        filtered: 0,
        autoFiltered: 0,
        aiFiltered: 0,
        kept: 0,
        deleted: 0,
        message: "all classified",
      };

    let autoFiltered = 0,
      aiFiltered = 0,
      kept = 0,
      deleted = 0;
    const ambiguous: typeof unclassified = [];

    for (const profile of unclassified) {
      const check = isObviouslyJunk(profile.email);
      if (check.junk) {
        await ctx.runMutation(internal.profileBuilder.deleteProfile, {
          profileId: profile._id,
        });
        autoFiltered++;
        deleted++;
      } else {
        ambiguous.push(profile);
      }
    }

    for (let i = 0; i < ambiguous.length; i += 20) {
      const batch = ambiguous.slice(i, i + 20);
      const profileList = batch
        .map(
          (p: any, idx: number) =>
            `${idx + 1}. "${p.name}" <${p.email}> — ${p.emailsSent} sent. Summary: ${p.relationshipSummary.slice(0, 100)}`,
        )
        .join("\n");

      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 1000,
            messages: [
              {
                role: "user",
                content: `Classify each as REAL (real person) or JUNK (marketing/automated/newsletter).\n\nCONTACTS:\n${profileList}\n\nReturn JSON array: [{"index": 1, "real": true/false, "reason": "brief reason"}]\n\nJSON only:`,
              },
            ],
          }),
        });
        if (!resp.ok) continue;
        const respData: { content: Array<{ text: string }> } =
          await resp.json();
        let text = respData.content[0].text.trim();
        if (text.startsWith("```"))
          text = text
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
        const classifications = JSON.parse(text);

        for (const c of classifications) {
          const idx = c.index - 1;
          if (idx < 0 || idx >= batch.length) continue;
          if (c.real) {
            await ctx.runMutation(internal.profileBuilder.patchProfile, {
              profileId: batch[idx]._id,
              patch: {
                isReal: true,
                filterReason: c.reason,
                updatedAt: Date.now(),
              },
            });
            kept++;
          } else {
            await ctx.runMutation(internal.profileBuilder.deleteProfile, {
              profileId: batch[idx]._id,
            });
            aiFiltered++;
            deleted++;
          }
        }
      } catch {
        /* skip batch on error */
      }
    }

    return {
      filtered: autoFiltered + aiFiltered,
      autoFiltered,
      aiFiltered,
      kept,
      deleted,
      message: `Filtered ${deleted} junk, kept ${kept} real`,
    };
  },
});

export const enrichFromCalendarInternal = internalAction({
  args: { userId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    enriched: number;
    newFromCalendar: number;
    totalMeetings: number;
    message: string;
  }> => {
    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      { userId: args.userId },
    );
    const events = await ctx.runQuery(
      internal.profileBuilder.getAllCalendarEvents,
      { userId: args.userId },
    );

    const meetingMap: Map<
      string,
      { count: number; topics: string[]; latestDate: number }
    > = new Map();
    for (const event of events) {
      for (const attendeeEmail of event.attendees || []) {
        const email = attendeeEmail.toLowerCase();
        if (OWN_EMAILS.includes(email)) continue;
        const existing = meetingMap.get(email) || {
          count: 0,
          topics: [],
          latestDate: 0,
        };
        existing.count++;
        if (event.title && !existing.topics.includes(event.title))
          existing.topics.push(event.title);
        if (event.startTime > existing.latestDate)
          existing.latestDate = event.startTime;
        meetingMap.set(email, existing);
      }
    }

    let enriched = 0,
      newFromCalendar = 0;

    for (const profile of profiles) {
      const calData = meetingMap.get(profile.email);
      if (calData) {
        const sources = [...profile.sources];
        if (!sources.includes("calendar")) sources.push("calendar");
        const lastDate = Math.max(
          profile.lastInteractionDate || 0,
          calData.latestDate,
        );
        await ctx.runMutation(internal.profileBuilder.patchProfile, {
          profileId: profile._id,
          patch: {
            sharedMeetings: calData.count,
            meetingTopics: calData.topics.slice(-10),
            sources,
            lastInteractionDate: lastDate,
            updatedAt: Date.now(),
          },
        });
        enriched++;
        meetingMap.delete(profile.email);
      }
    }

    for (const [email, calData] of meetingMap.entries()) {
      if (calData.count < 2) continue;
      if (SYSTEM_PATTERN.test(email)) continue;
      if (isObviouslyJunk(email).junk) continue;
      const contact = await ctx.runQuery(
        internal.profileBuilder.findContactByEmail,
        { userId: args.userId, email },
      );
      const name = email
        .split("@")[0]
        .replace(/\./g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      await ctx.runMutation(internal.profileBuilder.upsertProfile, {
        userId: args.userId,
        contactId: contact?._id,
        email,
        name,
        relationshipSummary: `Meets with Josh regularly (${calData.count} meetings).`,
        topics: calData.topics.slice(-5),
        communicationStyle: "Unknown — calendar-only",
        sentiment: "professional",
        keyContext: `Calendar-only. ${calData.count} meetings.`,
        recentInteractions: [
          {
            date: calData.latestDate,
            type: "calendar",
            summary: calData.topics[calData.topics.length - 1] || "Meeting",
          },
        ],
        emailsSent: 0,
        emailsReceived: 0,
        lastInteractionDate: calData.latestDate,
        sources: ["calendar"],
      });
      newFromCalendar++;
    }

    return {
      enriched,
      newFromCalendar,
      totalMeetings: events.length,
      message: `Enriched ${enriched}, created ${newFromCalendar} new`,
    };
  },
});

export const enrichFromInboundEmailsInternal = internalAction({
  args: { userId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    enriched: number;
    totalInboundEmails: number;
    uniqueSenders: number;
    message: string;
  }> => {
    const profiles = await ctx.runQuery(
      internal.profileBuilder.getAllProfiles,
      { userId: args.userId },
    );
    const emails = await ctx.runQuery(internal.profileBuilder.getAllEmails, {
      userId: args.userId,
    });

    const inboundMap: Map<
      string,
      { count: number; latestDate: number; latestSubject: string }
    > = new Map();
    for (const email of emails) {
      const senderMatch = email.from.match(/<(.+?)>/);
      const senderEmail = senderMatch
        ? senderMatch[1].toLowerCase()
        : email.from.toLowerCase().trim();
      if (!senderEmail.includes("@") || OWN_EMAILS.includes(senderEmail))
        continue;
      const existing = inboundMap.get(senderEmail) || {
        count: 0,
        latestDate: 0,
        latestSubject: "",
      };
      existing.count++;
      if (email.receivedAt > existing.latestDate) {
        existing.latestDate = email.receivedAt;
        existing.latestSubject = email.subject;
      }
      inboundMap.set(senderEmail, existing);
    }

    let enriched = 0;
    for (const profile of profiles) {
      const inbound = inboundMap.get(profile.email);
      if (inbound) {
        const lastDate = Math.max(
          profile.lastInteractionDate || 0,
          inbound.latestDate,
        );
        await ctx.runMutation(internal.profileBuilder.patchProfile, {
          profileId: profile._id,
          patch: {
            emailsReceived: inbound.count,
            lastInteractionDate: lastDate,
            updatedAt: Date.now(),
          },
        });
        enriched++;
      }
    }

    return {
      enriched,
      totalInboundEmails: emails.length,
      uniqueSenders: inboundMap.size,
      message: `Enriched ${enriched} profiles`,
    };
  },
});
