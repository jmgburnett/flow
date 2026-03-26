import { NextResponse } from "next/server";

export async function POST() {
	const apiKey = process.env.ASSEMBLYAI_API_KEY;
	if (!apiKey) {
		return NextResponse.json({ error: "AssemblyAI API key not configured" }, { status: 500 });
	}

	const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
		method: "POST",
		headers: {
			Authorization: apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ expires_in: 3600 }),
	});

	if (!response.ok) {
		const text = await response.text();
		console.error("AssemblyAI token error:", text);
		return NextResponse.json({ error: "Failed to create session token" }, { status: 502 });
	}

	const data = await response.json();
	return NextResponse.json({ token: data.token });
}
