import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Extract the authenticated user ID from the Convex request context.
 * Works with query, mutation, and action contexts.
 * Throws "Unauthorized" if no valid session exists.
 */
export async function getAuthenticatedUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  // BetterAuth stores the user ID in the `subject` field of the identity token
  return identity.subject;
}
