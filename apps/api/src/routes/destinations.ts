import { destinationCreate, destinationUpdate, type DestinationDetail } from "@ski/shared";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/client.ts";
import { accommodations, destinations } from "../db/schema.ts";
import { isMapsUrl } from "../geo.ts";
import { badRequest, idParam, imageField, jsonBody, notFound } from "../http.ts";
import { rateLimit } from "../rate-limit.ts";
import { accommodationColumns, accommodationView, destinationColumns, destinationSummary, tripView } from "../views.ts";
import { kickWorker } from "../worker.ts";
import { findTrip } from "./trips.ts";

export const destinationsRoutes = new Hono();

const createLimit = rateLimit({ max: 30, windowMs: 60 * 60 * 1000 });
const MAX_SCREENSHOT = 4 * 1024 * 1024;
const screenshotLimit = bodyLimit({ maxSize: MAX_SCREENSHOT + 64 * 1024 });

async function findDestination(id: string) {
  const [d] = await db.select(destinationColumns).from(destinations).where(eq(destinations.id, id));
  return d ?? notFound("Destino no encontrado");
}

async function destinationDetail(id: string): Promise<DestinationDetail> {
  const d = await findDestination(id);
  const trip = await findTrip(d.tripId);
  const accs = await db
    .select(accommodationColumns)
    .from(accommodations)
    .where(eq(accommodations.destinationId, d.id))
    .orderBy(asc(accommodations.createdAt));
  const views = accs
    .map((a) => accommodationView(a, trip, d.forfaitPrice))
    // Más baratos primero; sin precio al final
    .sort((a, b) => (a.comboPrice ?? a.pricePerPerson ?? Infinity) - (b.comboPrice ?? b.pricePerPerson ?? Infinity));
  return {
    ...destinationSummary(d, trip, accs),
    lat: d.lat,
    lng: d.lng,
    trip: tripView(trip),
    accommodations: views,
  };
}

/** Multipart: `mapsUrl`, y opcionales `forfaitUrl`, `forfaitScreenshot` (captura con el precio) y `participantId`. */
destinationsRoutes.post("/trips/:id/destinations", createLimit, screenshotLimit, async (c) => {
  const trip = await findTrip(idParam(c));
  const form = await c.req.parseBody();
  const input = destinationCreate.parse({
    mapsUrl: form.mapsUrl,
    forfaitUrl: form.forfaitUrl || undefined,
    participantId: form.participantId || undefined,
  });
  if (!isMapsUrl(input.mapsUrl)) badRequest("El primer enlace debe ser de Google Maps");
  const screenshot = await imageField(form.forfaitScreenshot, MAX_SCREENSHOT);
  const [row] = await db
    .insert(destinations)
    .values({
      tripId: trip.id,
      mapsUrl: input.mapsUrl,
      forfaitUrl: input.forfaitUrl,
      forfaitScreenshot: screenshot?.data,
      forfaitScreenshotMime: screenshot?.mime,
      createdBy: input.participantId,
    })
    .returning({ id: destinations.id });
  kickWorker();
  return c.json(await destinationDetail(row!.id), 201);
});

destinationsRoutes.get("/destinations/:id", async (c) => c.json(await destinationDetail(idParam(c))));

/** Corrección manual: deja el destino como `done`. */
destinationsRoutes.patch("/destinations/:id", async (c) => {
  const d = await findDestination(idParam(c));
  const input = await jsonBody(c, destinationUpdate);
  const trip = await findTrip(d.tripId);
  await db
    .update(destinations)
    .set({
      ...input,
      // Un precio puesto a mano se da por bueno para los días de esquí actuales
      ...(input.forfaitPrice !== undefined && { forfaitDays: trip.skiDays }),
      status: "done",
      error: null,
    })
    .where(eq(destinations.id, d.id));
  return c.json(await destinationDetail(d.id));
});

destinationsRoutes.delete("/destinations/:id", async (c) => {
  const [row] = await db.delete(destinations).where(eq(destinations.id, idParam(c))).returning({ id: destinations.id });
  return row ? c.json({ ok: true }) : notFound();
});

/** Sube (o sustituye) la captura con el precio del forfait y vuelve a extraer los datos. */
destinationsRoutes.post("/destinations/:id/forfait-screenshot", createLimit, screenshotLimit, async (c) => {
  const d = await findDestination(idParam(c));
  const screenshot = await imageField((await c.req.parseBody()).forfaitScreenshot, MAX_SCREENSHOT);
  if (!screenshot) badRequest("Falta la captura");
  await db
    .update(destinations)
    .set({ forfaitScreenshot: screenshot.data, forfaitScreenshotMime: screenshot.mime, status: "pending", error: null })
    .where(eq(destinations.id, d.id));
  kickWorker();
  return c.json(await destinationDetail(d.id));
});

destinationsRoutes.post("/destinations/:id/retry", createLimit, async (c) => {
  const d = await findDestination(idParam(c));
  await db.update(destinations).set({ status: "pending", error: null }).where(eq(destinations.id, d.id));
  kickWorker();
  return c.json(await destinationDetail(d.id));
});
