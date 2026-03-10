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

export default crons;
