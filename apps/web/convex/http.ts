import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import devAuth from "./devAuth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
	path: "/api/dev-auth",
	method: "POST",
	handler: devAuth,
});

export default http;
