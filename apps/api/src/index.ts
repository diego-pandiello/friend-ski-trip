import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { db } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { env } from "./env.ts";
import { admin } from "./routes/admin.ts";
import { destinationsRoutes } from "./routes/destinations.ts";
import { tripsRoutes } from "./routes/trips.ts";
import { startWorker } from "./worker.ts";

const app = new Hono();
app.use(logger());

const api = new Hono();
api.get("/health", async (c) => {
  await db.execute(sql`select 1`);
  return c.json({ ok: true });
});
api.route("/admin", admin);
api.route("/trips", tripsRoutes);
api.route("/", destinationsRoutes);
app.route("/api", api);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return c.json({ error: issue?.message ?? "Datos inválidos", path: issue?.path.join(".") }, 400);
  }
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Error interno" }, 500);
});
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Frontend: estáticos + fallback SPA a index.html
const webDist = resolve(import.meta.dirname, "..", env.WEB_DIST);
if (existsSync(webDist)) {
  const indexHtml = await readFile(join(webDist, "index.html"), "utf8");
  app.use("*", serveStatic({ root: webDist }));
  app.get("*", (c) => c.html(indexHtml));
}

await runMigrations();
await startWorker();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`);
});
