import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "./client.ts";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}

// `pnpm db:migrate`
if (import.meta.main) {
  await runMigrations();
  await sqlClient.end();
  console.log("Migraciones aplicadas");
}
