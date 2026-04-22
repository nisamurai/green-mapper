import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, twoFactor } from "better-auth/plugins";
import Elysia from "elysia";
import { sendEmail } from "@/utils/email";

export const auth = betterAuth({
    basePath: "/auth",
	appName: "GreenMapper",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		openAPI({ path: "/swagger" }),
		twoFactor({
			skipVerificationOnEnable: true,
			otpOptions: {
				async sendOTP({ user, otp }) {
					// Intentionally not awaited to reduce timing side-channels
					void sendEmail({
						to: user.email,
						subject: "GreenMapper:Код подтверждения входа",
						text: `Ваш код подтверждения: ${otp}`,
					}).catch((err) => {
						console.error("Failed to send 2FA OTP email", err);
					});
				},
			},
		}),
	],
	advanced: {
		cookiePrefix: "swag",
		disableCSRFCheck: true,
		ipAddress: {
			ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
			disableIpTracking: false,
		},
	},
	rateLimit: { enabled: true, max: 5, window: 10, storage: "memory" },
	logger: { disabled: process.env.BETTER_AUTH_DISABLE_LOGGER === "true" },
});
