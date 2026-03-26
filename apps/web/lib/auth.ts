import { cache } from "react";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexAuth = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string,
});

export const {
  handler,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexAuth;

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};

/**
 * Per-request cached session getter.
 * Validates the Better Auth cookie by calling the Convex backend.
 */
export const getSession = cache(async () => {
  const { headers } = await import("next/headers");
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";

  try {
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string;
    const res = await fetch(`${siteUrl}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as Session | null;
  } catch {
    return null;
  }
});

/**
 * Compatibility wrapper for Better Auth patterns.
 * Allows existing code to use auth.api.getSession({ headers }).
 */
export const auth = {
  api: {
    getSession: async (opts: { headers: Headers }) => {
      const cookieHeader = opts.headers.get("cookie") ?? "";
      try {
        const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string;
        const res = await fetch(`${siteUrl}/api/auth/get-session`, {
          headers: { cookie: cookieHeader },
        });
        if (!res.ok) return null;
        return (await res.json()) as Session | null;
      } catch {
        return null;
      }
    },
  },
};
