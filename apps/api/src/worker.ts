import { eq, sql } from "drizzle-orm";
import { db } from "./db/client.ts";
import { destinations, trips } from "./db/schema.ts";
import { extractForfait } from "./extract/forfait.ts";
import { driveMinutesFromOrigin, parseMapsUrl, resolveMapsUrl } from "./geo.ts";

/**
 * Worker de extracción en el propio proceso. El estado vive en la base de datos:
 * se reclama un registro `pending`, se procesa y queda `done` o `failed`.
 */

const POLL_MS = 5_000;
let running = false;
let timer: NodeJS.Timeout | undefined;

/** Reclama el siguiente destino pendiente (SKIP LOCKED por si algún día hay varias instancias). */
async function claimDestination() {
  const [row] = await db
    .update(destinations)
    .set({ status: "processing", error: null })
    .where(
      eq(
        destinations.id,
        sql`(select id from ${destinations} where status = 'pending' order by created_at limit 1 for update skip locked)`,
      ),
    )
    .returning();
  return row;
}

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
      errors.push(`No se pudo calcular la ruta: ${(err as Error).message}`);
    }
  } catch (err) {
    errors.push(`No se pudo leer el enlace de Google Maps: ${(err as Error).message}`);
  }

  try {
    const [trip] = await db.select().from(trips).where(eq(trips.id, d.tripId));
    if (!trip) throw new Error("el viaje ya no existe");
    const forfait = await extractForfait({ url: d.forfaitUrl, ...trip });
    if (forfait.pricePerPerson == null) errors.push(`No se encontró el precio del forfait: ${forfait.explanation}`);
    else Object.assign(fields, { forfaitPrice: forfait.pricePerPerson, forfaitDays: trip.skiDays });
  } catch (err) {
    errors.push(`No se pudo obtener el precio del forfait: ${(err as Error).message}`);
  }

  await db
    .update(destinations)
    .set({ ...fields, status: errors.length ? "failed" : "done", error: errors.join(". ") || null })
    .where(eq(destinations.id, d.id));
}

async function drain() {
  if (running) return;
  running = true;
  try {
    for (let d = await claimDestination(); d; d = await claimDestination()) {
      await processDestination(d).catch(async (err) => {
        console.error("Error procesando destino", d.id, err);
        await db
          .update(destinations)
          .set({ status: "failed", error: "Error inesperado al extraer los datos" })
          .where(eq(destinations.id, d.id));
      });
    }
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
  await db.update(destinations).set({ status: "pending" }).where(eq(destinations.status, "processing"));
  timer = setInterval(kickWorker, POLL_MS);
  timer.unref();
  kickWorker();
}
