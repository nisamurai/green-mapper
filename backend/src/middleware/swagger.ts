import { rainbowColorInkantation } from "@/utils/rainbow";
import swagger from "@elysiajs/swagger";
import Elysia from "elysia";

export const swaggerMiddleware = new Elysia().use((app) => {
	if (process.env.DEVELOPMENT === "true") {
		app.use(
			swagger({
				documentation: {
					info: {
						title: "Mapper",
						version: "0.0.1",
					},
				},
			}),
		);
		console.log(rainbowColorInkantation("Swagger enabled"));
	}

	return app;
});
