import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "./db/client.ts";
import { accommodations, destinations, trips } from "./db/schema.ts";
import { extractAccommodation } from "./extract/accommodation.ts";
import { extractForfait } from "./extract/forfait.ts";
import { driveMinutesFromOrigin, parseMapsUrl, resolveMapsUrl } from "./geo.ts";

/**
 * Worker de extracción en el propio proceso. El estado vive en la base de datos:
 * se reclama un registro `pending`, se procesa y queda `done` o `failed`.
 */

const POLL_MS = 5_000;
let running = false;
let timer: NodeJS.Timeout | undefined;

/** Marca como `processing` el siguiente registro pendiente y lo devuelve (SKIP LOCKED por si hay varias instancias). */
async function claim<T extends typeof destinations | typeof accommodations>(table: T) {
  const [row] = await db
    .update(table as PgTable)
    .set({ status: "processing", error: null })
    .where(
      sql`id = (select id from ${table} where status = 'pending' order by created_at limit 1 for update skip locked)`,
    )
    .returning();
  return row as T["$inferSelect"] | undefined;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function processDestination(d: typeof destinations.$inferSelect) {
  const errors: string[] = [];
  const fields: Partial<typeof destinations.$inferInsert> = {};

  try {
    const place = parseMapsUrl(await resolveMapsUrl(d.mapsUrl));
    if (!place) throw new Error("no se encontraron coordenadas");
    Object.assign(fields, { name: d.name ?? place.name, lat: place.lat, lng: place.lng });
    try {
      fields.driveMinutes = await driveMinutesFromOrigin(place.lat, place.lng);
    } catch (err) {
      errors.push(`No se pudo calcular la ruta: ${message(err)}`);
    }
  } catch (err) {
    errors.push(`No se pudo leer el enlace de Google Maps: ${message(err)}`);
  }

  try {
    const [trip] = await db.select().from(trips).where(eq(trips.id, d.tripId));
    if (!trip) throw new Error("el viaje ya no existe");
    const forfait = await extractForfait({ url: d.forfaitUrl, ...trip });
    if (forfait.pricePerPerson == null) errors.push(`No se encontró el precio del forfait: ${forfait.explanation}`);
    else Object.assign(fields, { forfaitPrice: forfait.pricePerPerson, forfaitDays: trip.skiDays });
  } catch (err) {
    errors.push(`No se pudo obtener el precio del forfait: ${message(err)}`);
  }

  await db
    .update(destinations)
    .set({ ...fields, status: errors.length ? "failed" : "done", error: errors.join(". ") || null })
    .where(eq(destinations.id, d.id));
}

async function processAccommodation(a: typeof accommodations.$inferSelect) {
  const [row] = await db
    .select({ trip: trips, destination: destinations })
    .from(destinations)
    .innerJoin(trips, eq(trips.id, destinations.tripId))
    .where(eq(destinations.id, a.destinationId));
  if (!row) return;

  let update: Partial<typeof accommodations.$inferInsert>;
  try {
    const { fields, problems } = await extractAccommodation({
      url: a.sourceUrl,
      screenshot: a.screenshot && a.screenshotMime ? { data: a.screenshot, mime: a.screenshotMime } : null,
      ...row.trip,
      destination: row.destination,
    });
    // No pisar con null lo que ya hubiera (p. ej. datos corregidos a mano antes de reintentar)
    const found = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null));
    const error = problems.length ? capitalize(problems.join(". ")) : null;
    update = { ...found, status: error ? "failed" : "done", error };
  } catch (err) {
    update = { status: "failed", error: capitalize(message(err)) };
  }
  await db.update(accommodations).set(update).where(eq(accommodations.id, a.id));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function drainTable<T extends typeof destinations | typeof accommodations>(
  table: T,
  process: (row: T["$inferSelect"]) => Promise<void>,
) {
  for (let row = await claim(table); row; row = await claim(table)) {
    const id = row.id;
    await process(row).catch(async (err) => {
      console.error("Error en la extracción", id, err);
      await db
        .update(table as PgTable)
        .set({ status: "failed", error: "Error inesperado al extraer los datos" })
        .where(sql`id = ${id}`);
    });
  }
}

async function drain() {
  if (running) return;
  running = true;
  try {
    await drainTable(destinations, processDestination);
    await drainTable(accommodations, processAccommodation);
  } finally {
    running = false;
  }
}

/** Avisa al worker de que hay trabajo nuevo (sin esperar al siguiente sondeo). */
export function kickWorker() {
  void drain().catch((err) => console.error("Worker", err));
}

export async function startWorker() {
  // Lo que se quedó a medias en un reinicio vuelve a la cola
  for (const table of [destinations, accommodations]) {
    await db.update(table as PgTable).set({ status: "pending" }).where(sql`status = 'processing'`);
  }
  timer = setInterval(kickWorker, POLL_MS);
  timer.unref();
  kickWorker();
}
