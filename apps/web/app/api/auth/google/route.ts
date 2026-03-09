import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const SCOPES = [
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/gmail.modify",
	"https://www.googleapis.com/auth/calendar.readonly",
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/userinfo.email",
];

export async function GET(request: NextRequest) {
	if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
		return NextResponse.json(
			{ error: "Google OAuth not configured" },
			{ status: 500 },
		);
	}

	const searchParams = request.nextUrl.searchParams;
	const emailHint = searchParams.get("email");

	// Generate state for CSRF protection
	const state = randomUUID();

	// Store state in cookie
	const cookieStore = await cookies();
	cookieStore.set("google_oauth_state", state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600, // 10 minutes
	});

	// Build OAuth URL
	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: GOOGLE_REDIRECT_URI,
		response_type: "code",
		scope: SCOPES.join(" "),
		access_type: "offline",
		prompt: "consent",
		state,
	});

	// Add login hint if email provided
	if (emailHint) {
		params.set("login_hint", emailHint);
	}

	const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

	return NextResponse.redirect(authUrl);
}
