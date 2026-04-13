import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, twoFactor, genericOAuth } from "better-auth/plugins";
import Elysia from "elysia";
import { sendEmail } from "@/utils/email";

export const auth = betterAuth({
    basePath: "/auth",
	trustedOrigins: ["http://localhost:5173"],
	appName: "GreenMapper",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: "yandex",
					authorizationUrl: "https://oauth.yandex.ru/authorize",
					tokenUrl: "https://oauth.yandex.ru/token",
					userInfoUrl: "https://login.yandex.ru/info?format=json",
					clientId: process.env.YANDEX_CLIENT_ID,
					clientSecret: process.env.YANDEX_CLIENT_SECRET,
					pkce: true,
					scopes: ["login:info", "login:email"],

					authorizationUrlParams: {
						prompt: "select_account"
					},

					getUserInfo: async (tokens: any) => {
						try {
							const resp = await fetch("https://login.yandex.ru/info?format=json", {
								method: "GET",
								headers: {
									Authorization: `OAuth ${tokens.accessToken}`
								}
							});
							if (!resp.ok) return null;
							const data = await resp.json();
							// Yandex may return email as `default_email` or `email`
							const email = data.default_email || data.email || null;
							return {
								id: data.id || data.uid || data.domain_user_id || data.sub,
								email,
								emailVerified: !!(data.is_email_confirmed || data.email_confirmed || data.email_verified),
								image: data.avatar_id || data.portrait || null,
								name: data.real_name || data.display_name || data.login || null,
								_raw: data
							};
						} catch (e) {
							console.error("Yandex getUserInfo failed", e);
							return null;
						}
					}
				}
			]
		}),
		openAPI({ path: "/swagger" }),
		twoFactor({
			skipVerificationOnEnable: true,
			otpOptions: {
				async sendOTP({ user, otp }) {
					void sendEmail({
						to: user.email,
						subject: "GreenMapper: Код подтверждения входа",
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
