import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Connections ───

export const storeSlackConnection = mutation({
	args: {
		userId: v.string(),
		teamId: v.string(),
		teamName: v.string(),
		botToken: v.string(),
		userToken: v.string(),
		slackUserId: v.string(),
		slackUserName: v.string(),
		scopes: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("slack_connections")
			.withIndex("by_team", (q) => q.eq("teamId", args.teamId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				botToken: args.botToken,
				userToken: args.userToken,
				scopes: args.scopes,
				slackUserId: args.slackUserId,
				slackUserName: args.slackUserName,
			});
			return existing._id;
		}

		return await ctx.db.insert("slack_connections", {
			...args,
			connectedAt: Date.now(),
		});
	},
});

export const getSlackConnections = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const connections = await ctx.db
			.query("slack_connections")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		return connections.map((c) => ({
			_id: c._id,
			teamId: c.teamId,
			teamName: c.teamName,
			slackUserName: c.slackUserName,
			connectedAt: c.connectedAt,
			lastSyncAt: c.lastSyncAt,
		}));
	},
});

export const deleteSlackConnection = mutation({
	args: { connectionId: v.id("slack_connections") },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.connectionId);
	},
});

// ─── Messages ───

export const getMessages = query({
	args: {
		userId: v.string(),
		needsResponse: v.optional(v.boolean()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		if (args.needsResponse !== undefined) {
			return await ctx.db
				.query("slack_messages")
				.withIndex("by_user_and_needs_response", (q) =>
					q.eq("userId", args.userId).eq("needsResponse", args.needsResponse!),
				)
				.order("desc")
				.take(limit);
		}

		return await ctx.db
			.query("slack_messages")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(limit);
	},
});

export const getUnrepliedCount = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const messages = await ctx.db
			.query("slack_messages")
			.withIndex("by_user_and_needs_response", (q) =>
				q.eq("userId", args.userId).eq("needsResponse", true),
			)
			.collect();
		return messages.length;
	},
});

// ─── Internal helpers ───

export const getConnection = internalQuery({
	args: { connectionId: v.id("slack_connections") },
	handler: async (ctx, args) => ctx.db.get(args.connectionId),
});

export const checkMessageExists = internalQuery({
	args: { messageTs: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("slack_messages")
			.withIndex("by_message_ts", (q) => q.eq("messageTs", args.messageTs))
			.first();
	},
});

export const insertMessage = internalMutation({
	args: {
		userId: v.string(),
		teamId: v.string(),
		channelId: v.string(),
		channelName: v.optional(v.string()),
		channelType: v.union(
			v.literal("dm"),
			v.literal("channel"),
			v.literal("group"),
			v.literal("mpim"),
		),
		messageTs: v.string(),
		threadTs: v.optional(v.string()),
		senderSlackId: v.string(),
		senderName: v.string(),
		text: v.string(),
		isReply: v.boolean(),
		isMention: v.boolean(),
		needsResponse: v.boolean(),
		receivedAt: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("slack_messages", {
			...args,
		});
	},
});

export const updateLastSync = internalMutation({
	args: { connectionId: v.id("slack_connections") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.connectionId, { lastSyncAt: Date.now() });
	},
});

// ─── Sync Action ───

export const syncSlackMessages = action({
	args: { connectionId: v.id("slack_connections") },
	handler: async (ctx, args): Promise<{ newMessages: number }> => {
		const connection = await ctx.runQuery(internal.slack.getConnection, {
			connectionId: args.connectionId,
		});
		if (!connection) throw new Error("Slack connection not found");

		const token = connection.userToken;
		const mySlackId = connection.slackUserId;
		let newMessages = 0;

		// 1. Get DMs (IMs) — conversations where someone messaged Josh
		const imsResp = await slackApi("conversations.list", token, {
			types: "im",
			limit: "20",
		});

		if (imsResp.ok && imsResp.channels) {
			for (const im of imsResp.channels) {
				// Get recent messages in this DM
				const histResp = await slackApi("conversations.history", token, {
					channel: im.id,
					limit: "10",
				});

				if (!histResp.ok || !histResp.messages) continue;

				for (const msg of histResp.messages) {
					if (msg.subtype) continue; // Skip system messages
					if (msg.user === mySlackId) continue; // Skip my own messages

					const exists = await ctx.runQuery(internal.slack.checkMessageExists, {
						messageTs: msg.ts,
					});
					if (exists) continue;

					// Check if Josh has replied after this message
					const hasReply = histResp.messages.some(
						(m: any) =>
							m.user === mySlackId &&
							Number.parseFloat(m.ts) > Number.parseFloat(msg.ts),
					);

					// Get sender info
					const senderName = await getUserName(token, msg.user);

					await ctx.runMutation(internal.slack.insertMessage, {
						userId: connection.userId,
						teamId: connection.teamId,
						channelId: im.id,
						channelType: "dm",
						messageTs: msg.ts,
						threadTs: msg.thread_ts,
						senderSlackId: msg.user,
						senderName,
						text: msg.text || "",
						isReply: !!msg.thread_ts,
						isMention: false,
						needsResponse: !hasReply,
						receivedAt: Math.floor(Number.parseFloat(msg.ts) * 1000),
					});

					// Extract person
					await ctx.runMutation(internal.people.extractPerson, {
						userId: connection.userId,
						name: senderName,
						source: "chat",
						sourceDetail: `Slack DM`,
					});

					newMessages++;
				}
			}
		}

		// 2. Get channels where Josh is mentioned
		const channelsResp = await slackApi("conversations.list", token, {
			types: "public_channel,private_channel",
			limit: "50",
		});

		if (channelsResp.ok && channelsResp.channels) {
			for (const channel of channelsResp.channels) {
				if (!channel.is_member) continue;

				const histResp = await slackApi("conversations.history", token, {
					channel: channel.id,
					limit: "20",
				});

				if (!histResp.ok || !histResp.messages) continue;

				for (const msg of histResp.messages) {
					if (msg.subtype) continue;
					if (msg.user === mySlackId) continue;

					// Only capture messages that mention Josh
					const mentionsMe =
						msg.text?.includes(`<@${mySlackId}>`) || false;
					if (!mentionsMe) continue;

					const exists = await ctx.runQuery(internal.slack.checkMessageExists, {
						messageTs: msg.ts,
					});
					if (exists) continue;

					// Check if Josh replied in thread
					let hasReply = false;
					if (msg.thread_ts) {
						const threadResp = await slackApi("conversations.replies", token, {
							channel: channel.id,
							ts: msg.thread_ts,
							limit: "20",
						});
						if (threadResp.ok && threadResp.messages) {
							hasReply = threadResp.messages.some(
								(m: any) => m.user === mySlackId,
							);
						}
					}

					const senderName = await getUserName(token, msg.user);

					await ctx.runMutation(internal.slack.insertMessage, {
						userId: connection.userId,
						teamId: connection.teamId,
						channelId: channel.id,
						channelName: channel.name,
						channelType: channel.is_private ? "group" : "channel",
						messageTs: msg.ts,
						threadTs: msg.thread_ts,
						senderSlackId: msg.user,
						senderName,
						text: msg.text || "",
						isReply: !!msg.thread_ts,
						isMention: true,
						needsResponse: !hasReply,
						receivedAt: Math.floor(Number.parseFloat(msg.ts) * 1000),
					});

					newMessages++;
				}
			}
		}

		await ctx.runMutation(internal.slack.updateLastSync, {
			connectionId: args.connectionId,
		});

		return { newMessages };
	},
});

// ─── Send a Slack message ───

export const sendMessage = action({
	args: {
		connectionId: v.id("slack_connections"),
		channelId: v.string(),
		text: v.string(),
		threadTs: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<{ ok: boolean }> => {
		const connection = await ctx.runQuery(internal.slack.getConnection, {
			connectionId: args.connectionId,
		});
		if (!connection) throw new Error("Connection not found");

		const body: Record<string, string> = {
			channel: args.channelId,
			text: args.text,
		};
		if (args.threadTs) body.thread_ts = args.threadTs;

		const resp = await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${connection.userToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data: { ok: boolean; error?: string } = await resp.json();
		if (!data.ok) throw new Error(`Slack send failed: ${data.error}`);
		return { ok: true };
	},
});

// Mark message as responded
export const markResponded = mutation({
	args: { messageId: v.id("slack_messages") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.messageId, {
			needsResponse: false,
			respondedAt: Date.now(),
		});
	},
});

// ─── Helpers ───

async function slackApi(method: string, token: string, params: Record<string, string> = {}) {
	const url = new URL(`https://slack.com/api/${method}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

	const resp = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${token}` },
	});

	return resp.json() as Promise<any>;
}

const userNameCache = new Map<string, string>();

async function getUserName(token: string, userId: string): Promise<string> {
	if (userNameCache.has(userId)) return userNameCache.get(userId)!;

	try {
		const resp = await slackApi("users.info", token, { user: userId });
		const name: string =
			resp.user?.profile?.real_name ||
			resp.user?.real_name ||
			resp.user?.name ||
			userId;
		userNameCache.set(userId, name);
		return name;
	} catch {
		return userId;
	}
}
