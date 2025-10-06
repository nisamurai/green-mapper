import { authMiddleware } from "@/middleware/auth";
import Elysia from "elysia";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";

export const usersRouter = new Elysia({ prefix: "/users" })
    .use(authMiddleware)
    .get("/me", async ({ user }) => {
        return db.query.user.findFirst({ where: eq(schema.user.id, user.id) })
    }, { auth: true })