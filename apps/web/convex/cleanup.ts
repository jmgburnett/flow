import { internalMutation } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Data retention cleanup — runs daily via cron.
 *
 * - Emails older than 90 days
 * - Capture audio chunks older than 30 days (deletes storage files too)
 * - Stale pending_contacts older than 30 days (status = "pending")
 * - Audit logs older than 180 days
 */
export const runRetentionCleanup = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		let deleted = { emails: 0, audioChunks: 0, pendingContacts: 0, auditLogs: 0 };

		// ── Emails older than 90 days ──
		const emailCutoff = now - 90 * DAY_MS;
		const oldEmails = await ctx.db
			.query("emails")
			.filter((q) => q.lt(q.field("receivedAt"), emailCutoff))
			.take(500);
		for (const email of oldEmails) {
			await ctx.db.delete(email._id);
			deleted.emails++;
		}

		// ── Capture audio chunks older than 30 days ──
		const audioCutoff = now - 30 * DAY_MS;
		const oldSessions = await ctx.db
			.query("capture_sessions")
			.filter((q) => q.lt(q.field("startedAt"), audioCutoff))
			.take(100);

		for (const session of oldSessions) {
			// Delete associated chunks and their storage files
			const chunks = await ctx.db
				.query("capture_chunks")
				.withIndex("by_session", (q) => q.eq("sessionId", session._id))
				.collect();

			for (const chunk of chunks) {
				try {
					await ctx.storage.delete(chunk.audioFileId);
				} catch {
					// Storage file may already be deleted
				}
				await ctx.db.delete(chunk._id);
				deleted.audioChunks++;
			}
		}

		// ── Stale pending contacts older than 30 days ──
		const contactCutoff = now - 30 * DAY_MS;
		const stalePending = await ctx.db
			.query("pending_contacts")
			.filter((q) =>
				q.and(
					q.eq(q.field("status"), "pending"),
					q.lt(q.field("createdAt"), contactCutoff),
				),
			)
			.take(500);
		for (const contact of stalePending) {
			await ctx.db.delete(contact._id);
			deleted.pendingContacts++;
		}

		// ── Audit logs older than 180 days ──
		const auditCutoff = now - 180 * DAY_MS;
		const oldAuditLogs = await ctx.db
			.query("audit_logs")
			.withIndex("by_timestamp")
			.filter((q) => q.lt(q.field("timestamp"), auditCutoff))
			.take(500);
		for (const log of oldAuditLogs) {
			await ctx.db.delete(log._id);
			deleted.auditLogs++;
		}

		if (
			deleted.emails +
				deleted.audioChunks +
				deleted.pendingContacts +
				deleted.auditLogs >
			0
		) {
			console.log(
				`🧹 Retention cleanup: ${deleted.emails} emails, ${deleted.audioChunks} audio chunks, ${deleted.pendingContacts} pending contacts, ${deleted.auditLogs} audit logs`,
			);
		}
	},
});
