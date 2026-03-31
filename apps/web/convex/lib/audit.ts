import type { MutationCtx } from "../_generated/server";

/**
 * Write an audit log entry.
 *
 * Call from mutations where security-relevant actions occur:
 * - OAuth connect/disconnect
 * - Email sync triggers
 * - Chat agent invocations
 * - Profile data access
 */
export async function auditLog(
	ctx: MutationCtx,
	entry: {
		userId: string;
		action: string;
		resource: string;
		resourceId?: string;
		metadata?: Record<string, unknown>;
	},
) {
	await ctx.db.insert("audit_logs", {
		...entry,
		timestamp: Date.now(),
	});
}
