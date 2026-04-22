import { auth } from "@/utils/auth";
import { db } from "@/db/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import Elysia from "elysia";

export const authMiddleware = new Elysia({ name: "better-auth" })
	.mount(auth.handler)
	.macro({
		auth: {
			async resolve({ status, request: { headers } }) {
				const session = await auth.api.getSession({
					headers,
				});

				if (!session) return status(401);

                const fullUser = await db.query.user.findFirst({
                    where: eq(schema.user.id, session.user.id),
                });

				return {
					user: fullUser,
					session: session.session,
				};
			},
		},
	});
