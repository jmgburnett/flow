import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function GET(request: NextRequest) {
	if (
		!GOOGLE_CLIENT_ID ||
		!GOOGLE_CLIENT_SECRET ||
		!GOOGLE_REDIRECT_URI ||
		!CONVEX_URL
	) {
		return NextResponse.json(
			{ error: "Google OAuth not configured" },
			{ status: 500 },
		);
	}

	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");

	// Check for OAuth errors
	if (error) {
		return NextResponse.redirect(
			`/dashboard/settings?error=${encodeURIComponent(error)}`,
		);
	}

	if (!code || !state) {
		return NextResponse.redirect(
			"/dashboard/settings?error=missing_params",
		);
	}

	// Verify state
	const cookieStore = await cookies();
	const storedState = cookieStore.get("google_oauth_state")?.value;

	if (!storedState || storedState !== state) {
		return NextResponse.redirect(
			"/dashboard/settings?error=invalid_state",
		);
	}

	// Clear state cookie
	cookieStore.delete("google_oauth_state");

	try {
		// Exchange code for tokens
		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
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
			return NextResponse.redirect(
				"/dashboard/settings?error=token_exchange_failed",
			);
		}

		const tokens = await tokenResponse.json();

		// Fetch user info to get email
		const userInfoResponse = await fetch(
			"https://www.googleapis.com/oauth2/v2/userinfo",
			{
				headers: {
					Authorization: `Bearer ${tokens.access_token}`,
				},
			},
		);

		if (!userInfoResponse.ok) {
			return NextResponse.redirect(
				"/dashboard/settings?error=userinfo_failed",
			);
		}

		const userInfo = await userInfoResponse.json();

		// Store tokens in Convex
		const client = new ConvexHttpClient(CONVEX_URL);

		await client.mutation(api.google.storeGoogleConnection, {
			userId: "josh", // Hardcoded since auth is bypassed
			email: userInfo.email,
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			tokenExpiry: Date.now() + tokens.expires_in * 1000,
			scopes: tokens.scope.split(" "),
		});

		// Redirect back to settings with success message
		return NextResponse.redirect(
			`/dashboard/settings?success=connected&email=${encodeURIComponent(userInfo.email)}`,
		);
	} catch (error) {
		console.error("OAuth callback error:", error);
		return NextResponse.redirect(
			"/dashboard/settings?error=unknown_error",
		);
	}
}
