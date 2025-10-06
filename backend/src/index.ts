import { auth } from "@/utils/auth";
import { Elysia } from "elysia";
import { swaggerMiddleware } from "./middleware/swagger";
import { cors } from "@elysiajs/cors";
import { reportsRouter } from "./routes/reports";
import { usersRouter } from "./routes/users";

const app = new Elysia()
	.use(
		cors({
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.use(swaggerMiddleware)
	.mount(auth.handler)
	.use(usersRouter)
	.use(reportsRouter)
	.listen(3000);

console.log(`Started at ${app.server?.hostname}:${app.server?.port}`);
