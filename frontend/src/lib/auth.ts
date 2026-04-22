import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_BASE_URL,
	plugins: [twoFactorClient()],
});
