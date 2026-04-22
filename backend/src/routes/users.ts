import { authMiddleware } from "@/middleware/auth";
import Elysia from "elysia";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";

export const usersRouter = new Elysia({ prefix: "/users" })
    .use(authMiddleware)
    .get("/me", async ({ user }) => {
        const fullUser = await db.query.user.findFirst({
            where: eq(schema.user.id, user.id),
            columns: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                createdAt: true,
                updatedAt: true,
                points: true,
                role: true,
                twoFactorEnabled: true,
            },
        });
        return fullUser;
    }, { auth: true })