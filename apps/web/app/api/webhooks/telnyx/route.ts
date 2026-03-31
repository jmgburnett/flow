import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Initialize Convex client for server-side use
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Telnyx webhook endpoint for receiving SMS messages
 *
 * Telnyx sends webhooks when SMS messages are received.
 *
 * Example webhook payload:
 * {
 *   "data": {
 *     "event_type": "message.received",
 *     "payload": {
 *       "from": {
 *         "phone_number": "+17036597403"
 *       },
 *       "to": [{
 *         "phone_number": "+16156408799"
 *       }],
 *       "text": "Hey, can you pick up milk on the way home?"
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Validate webhook structure
		if (!body.data || body.data.event_type !== "message.received") {
			return NextResponse.json(
				{ error: "Invalid webhook event type" },
				{ status: 400 },
			);
		}

		const payload = body.data.payload;

		// Extract message details
		const from = payload.from?.phone_number;
		const to = payload.to?.[0]?.phone_number;
		const text = payload.text;

		if (!from || !to || !text) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Store the message via public action (userId resolved server-side in Convex)
		await convex.action(api.sms.receiveInboundSMS, {
			from,
			to,
			body: text,
		});

		console.log(`SMS received from ${from}: ${text}`);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error processing Telnyx webhook:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// Handle GET requests (for testing/verification)
export async function GET() {
	return NextResponse.json({
		message: "Telnyx webhook endpoint is active",
		timestamp: new Date().toISOString(),
	});
}
