import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  if (
    !SLACK_CLIENT_ID ||
    !SLACK_CLIENT_SECRET ||
    !SLACK_REDIRECT_URI ||
    !CONVEX_URL
  ) {
    return NextResponse.json(
      { error: "Slack OAuth not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirect(
      request,
      `/dashboard/settings?error=slack_${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return redirect(request, "/dashboard/settings?error=slack_missing_params");
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("slack_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect(request, "/dashboard/settings?error=slack_invalid_state");
  }

  cookieStore.delete("slack_oauth_state");

  try {
    // Exchange code for tokens
    const tokenResp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    const tokenData: any = await tokenResp.json();

    if (!tokenData.ok) {
      console.error("Slack token exchange failed:", tokenData.error);
      return redirect(
        request,
        `/dashboard/settings?error=slack_token_${tokenData.error}`,
      );
    }

    // Get user info
    const userResp = await fetch("https://slack.com/api/auth.test", {
      headers: {
        Authorization: `Bearer ${tokenData.authed_user.access_token}`,
      },
    });
    const userData: any = await userResp.json();

    // Store in Convex
    const client = new ConvexHttpClient(CONVEX_URL);
    await client.mutation(api.slack.storeSlackConnection, {
      userId: "josh",
      teamId: tokenData.team.id,
      teamName: tokenData.team.name,
      botToken: tokenData.access_token,
      userToken: tokenData.authed_user.access_token,
      slackUserId: userData.user_id,
      slackUserName: userData.user,
      scopes: tokenData.authed_user.scope?.split(",") || [],
    });

    return redirect(
      request,
      `/dashboard/settings?success=slack_connected&team=${encodeURIComponent(tokenData.team.name)}`,
    );
  } catch (err) {
    console.error("Slack OAuth error:", err);
    return redirect(request, "/dashboard/settings?error=slack_unknown");
  }
}
