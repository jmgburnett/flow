import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ═══════════════════════════════════════════════
// Daily profile enrichment pipeline — runs at 6 AM CT (12:00 UTC)
// Syncs emails + calendar, builds new profiles, filters junk, enriches
// ═══════════════════════════════════════════════
crons.daily(
  "daily-profile-enrichment",
  { hourUTC: 12, minuteUTC: 0 },
  internal.profileBuilder.dailyEnrichmentPipeline,
  { userId: "josh" },
);

// ═══════════════════════════════════════════════
// Daily Figma design token sync — runs at 5 AM CT (11:00 UTC)
// Pulls latest Cypress tokens from Figma and stores in DB
// ═══════════════════════════════════════════════
crons.daily(
  "daily-figma-token-sync",
  { hourUTC: 11, minuteUTC: 0 },
  internal.designTokens.syncFromFigma,
  { fileKey: "UA7g21UklfSbtc2fXvNOHS" },
);

// ═══════════════════════════════════════════════
// Daily data retention cleanup — runs at 3 AM CT (09:00 UTC)
// Removes old emails (90d), audio chunks (30d), stale pending contacts (30d)
// ═══════════════════════════════════════════════
crons.daily(
  "daily-retention-cleanup",
  { hourUTC: 9, minuteUTC: 0 },
  internal.cleanup.runRetentionCleanup,
);

export default crons;
