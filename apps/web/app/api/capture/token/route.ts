import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AssemblyAI API key not configured" },
      { status: 500 },
    );
  }

  // Use AssemblyAI v3 streaming token endpoint
  const response = await fetch(
    "https://streaming.assemblyai.com/v3/token?expires_in_seconds=600",
    {
      method: "GET",
      headers: {
        Authorization: apiKey.trim(),
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("AssemblyAI v3 token error:", response.status, text);
    return NextResponse.json(
      { error: "Failed to create session token" },
      { status: 502 },
    );
  }

  const data = await response.json();
  return NextResponse.json({ token: data.token });
}
