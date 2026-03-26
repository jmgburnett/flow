import { NextResponse } from "next/server";

export async function POST() {
	const apiKey = process.env.ASSEMBLYAI_API_KEY;
	if (!apiKey) {
		return NextResponse.json({ error: "AssemblyAI API key not configured" }, { status: 500 });
	}

	// Universal Streaming uses the API key directly — no token endpoint needed.
	// Return the key so the client can connect to wss://api.assemblyai.com/v2/realtime/ws
	// The key is short-lived in the browser context (WebSocket connection only).
	return NextResponse.json({ token: apiKey.trim() });
}
