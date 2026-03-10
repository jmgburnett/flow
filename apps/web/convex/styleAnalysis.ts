import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Schema: stored in user's profile ───

export const getStyleProfile = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("style_profiles")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();
	},
});

export const getAnalysisStatus = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("style_analyses")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.first();
	},
});

// Save the analyzed style profile
export const saveStyleProfile = internalMutation({
	args: {
		userId: v.string(),
		profile: v.string(), // JSON string of the full profile
		prompt: v.string(), // The prompt to use for AI drafting
		emailsAnalyzed: v.number(),
		accountsAnalyzed: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("style_profiles")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				profile: args.profile,
				prompt: args.prompt,
				emailsAnalyzed: args.emailsAnalyzed,
				accountsAnalyzed: args.accountsAnalyzed,
				updatedAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("style_profiles", {
			userId: args.userId,
			profile: args.profile,
			prompt: args.prompt,
			emailsAnalyzed: args.emailsAnalyzed,
			accountsAnalyzed: args.accountsAnalyzed,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
	},
});

// Track analysis progress
export const updateAnalysisStatus = internalMutation({
	args: {
		userId: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("fetching"),
			v.literal("analyzing"),
			v.literal("complete"),
			v.literal("error"),
		),
		progress: v.optional(v.number()), // 0-100
		message: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("style_analyses")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.first();

		if (existing && existing.status !== "complete" && existing.status !== "error") {
			await ctx.db.patch(existing._id, {
				status: args.status,
				progress: args.progress,
				message: args.message,
				updatedAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("style_analyses", {
			userId: args.userId,
			status: args.status,
			progress: args.progress ?? 0,
			message: args.message ?? "Starting...",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
	},
});

// Get connection with tokens (internal only)
export const getGoogleConnection = internalQuery({
	args: { connectionId: v.id("google_connections") },
	handler: async (ctx, args) => ctx.db.get(args.connectionId),
});

// ─── Main analysis action ───

export const analyzeEmailStyle = action({
	args: {
		userId: v.string(),
		emailCount: v.number(), // How many sent emails to scan (50-500)
		connectionIds: v.optional(v.array(v.id("google_connections"))), // Specific accounts, or all
	},
	handler: async (ctx, args): Promise<{ success: boolean; emailsAnalyzed: number }> => {
		const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
		if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

		const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
		const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
		if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
			throw new Error("Google OAuth not configured");
		}

		const maxEmails = Math.min(Math.max(args.emailCount, 20), 500);

		await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
			userId: args.userId,
			status: "fetching",
			progress: 5,
			message: "Fetching your sent emails...",
		});

		// Get connections
		let connectionIds = args.connectionIds;
		if (!connectionIds) {
			const conns = await ctx.runQuery(internal.styleAnalysis.getAllConnections, {
				userId: args.userId,
			});
			connectionIds = conns.map((c: any) => c._id);
		}

		const perAccount = Math.ceil(maxEmails / connectionIds.length);
		const allEmails: Array<{ to: string; subject: string; body: string; account: string }> = [];
		const accountsUsed: string[] = [];

		for (let i = 0; i < connectionIds.length; i++) {
			const connId = connectionIds[i];
			try {
				// Refresh token
				const token = await refreshGoogleToken(ctx, connId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
				const conn = await ctx.runQuery(internal.styleAnalysis.getGoogleConnection, { connectionId: connId });
				if (!conn) continue;
				accountsUsed.push(conn.email);

				await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
					userId: args.userId,
					status: "fetching",
					progress: 10 + Math.floor((i / connectionIds.length) * 40),
					message: `Fetching from ${conn.email}...`,
				});

				// Fetch sent messages
				const listResp = await fetch(
					`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${perAccount}&labelIds=SENT`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				const listData: any = await listResp.json();
				const messages = listData.messages || [];

				for (const msg of messages) {
					const msgResp = await fetch(
						`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
						{ headers: { Authorization: `Bearer ${token}` } },
					);
					const msgData: any = await msgResp.json();

					const headers = msgData.payload?.headers || [];
					const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
					const to = headers.find((h: any) => h.name === "To")?.value || "";

					let body = "";
					if (msgData.payload?.parts) {
						const textPart = msgData.payload.parts.find((p: any) => p.mimeType === "text/plain");
						if (textPart?.body?.data) {
							body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
						}
					} else if (msgData.payload?.body?.data) {
						body = atob(msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
					}
					if (!body) body = msgData.snippet || "";

					// Strip quoted replies
					const lines = body.split("\n");
					const own: string[] = [];
					for (const line of lines) {
						if (line.startsWith(">")) break;
						if (/^On .+ wrote:$/.test(line.trim())) break;
						if (line.includes("---------- Forwarded")) break;
						own.push(line);
					}
					const clean = own.join("\n").trim();

					// Strip signatures
					const stripped = clean
						.replace(/Joshua Burnett[\s\S]*$/m, "")
						.replace(/Josh Burnett[\s\S]*FLOURISH[\s\S]*/m, "")
						.replace(/\[image:[^\]]*\]/g, "")
						.replace(/<https?:\/\/[^>]+>/g, "")
						.replace(/IMPORTANT: The contents[\s\S]*/m, "")
						.trim();

					if (stripped.length > 20 && stripped.length < 2000) {
						allEmails.push({
							to: to.substring(0, 60),
							subject: subject.substring(0, 80),
							body: stripped,
							account: conn.email,
						});
					}
				}
			} catch (e: any) {
				console.error(`Style analysis error for connection:`, e.message);
			}
		}

		if (allEmails.length < 5) {
			await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
				userId: args.userId,
				status: "error",
				progress: 0,
				message: "Not enough sent emails found to analyze style.",
			});
			return { success: false, emailsAnalyzed: 0 };
		}

		// ─── Analyze with Claude ───
		await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
			userId: args.userId,
			status: "analyzing",
			progress: 60,
			message: `Analyzing ${allEmails.length} emails with AI...`,
		});

		// Build a sample for Claude (max ~30 diverse emails to stay within context)
		const sample = allEmails
			.filter((_, i) => i % Math.max(1, Math.floor(allEmails.length / 30)) === 0)
			.slice(0, 30);

		const emailSamples = sample
			.map((e, i) => `--- Email ${i + 1} ---\nTo: ${e.to}\nSubject: ${e.subject}\n${e.body}`)
			.join("\n\n");

		const analysisResp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": ANTHROPIC_API_KEY,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: "claude-sonnet-4-20250514",
				max_tokens: 2000,
				messages: [
					{
						role: "user",
						content: `Analyze these ${allEmails.length} sent emails and create a detailed writing style profile. Output JSON with these fields:

{
  "tone": "description of overall tone",
  "openings": ["list of common opening patterns with examples"],
  "signoffs": ["list of sign-offs in order of frequency"],
  "defaultSignoff": "most common sign-off",
  "keyPhrases": ["distinctive phrases they use often"],
  "structure": "how they typically structure emails",
  "avoids": ["things they never do"],
  "lengthPreference": "short/medium/long and when",
  "personality": "brief personality summary from writing",
  "draftPrompt": "A system prompt (200 words max) that would instruct an AI to write emails in this exact voice. Include the sign-off, tone, specific phrases to use, and things to avoid."
}

Emails to analyze:
${emailSamples}`,
					},
				],
			}),
		});

		if (!analysisResp.ok) {
			const errText = await analysisResp.text();
			await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
				userId: args.userId,
				status: "error",
				message: `AI analysis failed: ${errText.substring(0, 100)}`,
			});
			return { success: false, emailsAnalyzed: allEmails.length };
		}

		const analysisData: any = await analysisResp.json();
		const analysisText: string = analysisData.content[0].text;

		// Extract JSON from response
		let profile: any;
		try {
			const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
			profile = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysisText);
		} catch {
			profile = { raw: analysisText, draftPrompt: analysisText };
		}

		// Save profile
		await ctx.runMutation(internal.styleAnalysis.saveStyleProfile, {
			userId: args.userId,
			profile: JSON.stringify(profile),
			prompt: profile.draftPrompt || "",
			emailsAnalyzed: allEmails.length,
			accountsAnalyzed: accountsUsed,
		});

		await ctx.runMutation(internal.styleAnalysis.updateAnalysisStatus, {
			userId: args.userId,
			status: "complete",
			progress: 100,
			message: `Analyzed ${allEmails.length} emails across ${accountsUsed.length} accounts`,
		});

		return { success: true, emailsAnalyzed: allEmails.length };
	},
});

// Internal: get all google connections for a user
export const getAllConnections = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("google_connections")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

// ─── Token refresh helper ───
async function refreshGoogleToken(
	ctx: any,
	connectionId: string,
	clientId: string,
	clientSecret: string,
): Promise<string> {
	const connection = await ctx.runQuery(internal.styleAnalysis.getGoogleConnection, {
		connectionId,
	});
	if (!connection) throw new Error("Connection not found");

	if (connection.tokenExpiry > Date.now() + 5 * 60 * 1000) {
		return connection.accessToken;
	}

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: connection.refreshToken,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
	const tokens: any = await response.json();

	await ctx.runMutation(internal.google.updateConnectionTokens, {
		connectionId,
		accessToken: tokens.access_token,
		tokenExpiry: Date.now() + tokens.expires_in * 1000,
	});

	return tokens.access_token;
}
