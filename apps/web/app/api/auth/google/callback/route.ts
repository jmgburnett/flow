import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI ||
    !CONVEX_URL
  ) {
    return NextResponse.json(
      {
        error: "Google OAuth not configured",
        vars: {
          cid: !!GOOGLE_CLIENT_ID,
          cs: !!GOOGLE_CLIENT_SECRET,
          ru: !!GOOGLE_REDIRECT_URI,
          cu: !!CONVEX_URL,
        },
      },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirect(
      request,
      `/dashboard/settings?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return redirect(request, "/dashboard/settings?error=missing_params");
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirect(request, "/dashboard/settings?error=invalid_state");
  }

  cookieStore.delete("google_oauth_state");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return redirect(
        request,
        "/dashboard/settings?error=token_exchange_failed",
      );
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoResponse.ok) {
      return redirect(request, "/dashboard/settings?error=userinfo_failed");
    }

    const userInfo = await userInfoResponse.json();

    const client = new ConvexHttpClient(CONVEX_URL);
    await client.mutation(api.google.storeGoogleConnection, {
      userId: "josh",
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope.split(" "),
    });

    return redirect(
      request,
      `/dashboard/settings?success=connected&email=${encodeURIComponent(userInfo.email)}`,
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return redirect(request, "/dashboard/settings?error=unknown_error");
  }
}
