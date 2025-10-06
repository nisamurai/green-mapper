import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import Elysia from "elysia";

export const auth = betterAuth({
	basePath: "/auth",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [openAPI({ path: "/swagger" })],
	advanced: {
		cookiePrefix: "swag",
		ipAddress: {
			ipAddressHeaders: ["x-client-ip", "x-forwarded-for"],
			disableIpTracking: false,
		},
	},
	rateLimit: { enabled: true, max: 5, window: 10, storage: "memory" },
	logger: { disabled: process.env.BETTER_AUTH_DISABLE_LOGGER === "true" },
});
