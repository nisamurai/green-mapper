import { auth } from "@/utils/auth";
import { createBucketInNotExist } from "@/utils/minio";
import { Elysia } from "elysia";
import { swaggerMiddleware } from "./middleware/swagger";
import { cors } from "@elysiajs/cors";
import { reportsRouter } from "./routes/reports";
import { usersRouter } from "./routes/users";
import * as Minio from 'minio';

export const minioClient = new Minio.Client({
  endPoint: process.env.IN_CONTAINER ? "minio" : 'localhost', // IP or hostname
  port: 9000,
  useSSL: false, 
  accessKey: process.env.MINIO_ROOT_USER, 
  secretKey: process.env.MINIO_ROOT_PASSWORD
});

const app = new Elysia()
	.use(
		cors({
			origin: process.env.CORS_ORIGIN,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.post("/auth/sign-in/social", async (ctx) => {
			try {
				const rawBody = ctx.body;
				const provider = (rawBody && (rawBody.provider || rawBody.providerId)) || undefined;
				const callbackURL = rawBody?.callbackURL || rawBody?.redirectUrl || rawBody?.redirect_uri;
				if (!provider) {
					return new Response(JSON.stringify({ error: "Missing provider" }), { status: 400 });
				}
				const mapped = { providerId: provider } as any;
				if (callbackURL) mapped.callbackURL = callbackURL;

				const forwardHeaders: Record<string, string> = { "Content-Type": "application/json" };
				if (ctx.headers?.origin) forwardHeaders["origin"] = String(ctx.headers.origin);
				if (ctx.headers?.referer) forwardHeaders["referer"] = String(ctx.headers.referer);
				if (ctx.headers?.cookie) forwardHeaders["cookie"] = String(ctx.headers.cookie);

				const authBase = process.env.BETTER_AUTH_URL || "http://localhost:3000";
				const resp = await fetch(`${authBase}/auth/sign-in/oauth2`, {
					method: "POST",
					headers: forwardHeaders,
					body: JSON.stringify(mapped),
				});

				const text = await resp.text();
				const contentType = resp.headers.get("content-type") || "";
				if (contentType.includes("application/json")) {
					return new Response(text, { status: resp.status, headers: { "Content-Type": "application/json" } });
				}
				return new Response(text, { status: resp.status });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
			}
	})
	.get("/health", async () => {
		return {status: "ok"}
	})
	.use(swaggerMiddleware)
	.mount(auth.handler)
	.use(usersRouter)
	.use(reportsRouter)
	.listen(3000);

console.log(`Started at ${app.server?.hostname}:${app.server?.port}`);
setTimeout(() => {
	createBucketInNotExist()
}, 1000)
