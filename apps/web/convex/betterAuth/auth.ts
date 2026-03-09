import { createClient } from "@convex-dev/better-auth";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
	components.betterAuth,
	{
		local: { schema },
		verbose: false,
	},
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	return {
		appName: "My App",
		baseURL: process.env.SITE_URL,
		secret: process.env.BETTER_AUTH_SECRET,
		database: authComponent.adapter(ctx),
		trustedOrigins: [
			...(process.env.SITE_URL ? [process.env.SITE_URL] : []),
			// Allow exe.dev VMs and Vercel preview deployments
			"https://*.exe.xyz",
			"https://*.vercel.app",
		],
		emailAndPassword: {
			enabled: false,
		},
		plugins: [
			emailOTP({
				async sendVerificationOTP({ email, otp }) {
					const apiKey = process.env.RESEND_API_KEY;
					const from = process.env.EMAIL_FROM || "noreply@example.com";

					if (!apiKey) {
						console.log(`[DEV] OTP for ${email}: ${otp}`);
						return;
					}

					const res = await fetch("https://api.resend.com/emails", {
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							from,
							to: [email],
							subject: "Your verification code",
							html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
						}),
					});

					if (!res.ok) {
						const text = await res.text();
						console.error(`Failed to send OTP email: ${res.status} ${text}`);
						throw new Error("Failed to send verification email");
					}
				},
			}),
		],
	} satisfies BetterAuthOptions;
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx));
};
