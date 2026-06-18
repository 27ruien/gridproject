import { buildApp } from "./app.js";
import { getConfig } from "./config/env.js";

const config = getConfig();
const app = await buildApp(config);

await app.listen({ host: config.host, port: config.port });
