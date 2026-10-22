import { accommodationCreate, accommodationUpdate, type AccommodationView } from "@ski/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/client.ts";
import { accommodations, destinations } from "../db/schema.ts";
import { badRequest, idParam, imageField, jsonBody, notFound } from "../http.ts";
import { rateLimit } from "../rate-limit.ts";
import { accommodationColumns, accommodationView } from "../views.ts";
import { kickWorker } from "../worker.ts";
import { findTrip } from "./trips.ts";

const MAX_SCREENSHOT = 4 * 1024 * 1024;

export const accommodationsRoutes = new Hono();

const createLimit = rateLimit({ max: 30, windowMs: 60 * 60 * 1000 });

async function accommodationDetail(id: string): Promise<AccommodationView> {
  const [row] = await db
    .select({ a: accommodationColumns, destination: { tripId: destinations.tripId, forfaitPrice: destinations.forfaitPrice } })
    .from(accommodations)
    .innerJoin(destinations, eq(destinations.id, accommodations.destinationId))
    .where(eq(accommodations.id, id));
  if (!row) notFound("Alojamiento no encontrado");
  const trip = await findTrip(row.destination.tripId);
  return accommodationView(row.a, trip, row.destination.forfaitPrice);
}

/** Multipart: `url`, `participantId` opcional y `screenshot` opcional (captura del anuncio). */
accommodationsRoutes.post(
  "/destinations/:id/accommodations",
  createLimit,
  bodyLimit({ maxSize: MAX_SCREENSHOT + 64 * 1024 }),
  async (c) => {
    const destinationId = idParam(c);
    const [destination] = await db.select({ id: destinations.id }).from(destinations).where(eq(destinations.id, destinationId));
    if (!destination) notFound("Destino no encontrado");
    const form = await c.req.parseBody();
    const input = accommodationCreate.parse({ url: form.url, participantId: form.participantId || undefined });
    const screenshot = await imageField(form.screenshot, MAX_SCREENSHOT);
    const [row] = await db
      .insert(accommodations)
      .values({
        destinationId,
        sourceUrl: input.url,
        createdBy: input.participantId,
        screenshot: screenshot?.data,
        screenshotMime: screenshot?.mime,
      })
      .returning({ id: accommodations.id });
    kickWorker();
    return c.json(await accommodationDetail(row!.id), 201);
  },
);

accommodationsRoutes.get("/accommodations/:id", async (c) => c.json(await accommodationDetail(idParam(c))));

/** Corrección manual: deja el alojamiento como `done`. */
accommodationsRoutes.patch("/accommodations/:id", async (c) => {
  const id = idParam(c);
  const input = await jsonBody(c, accommodationUpdate);
  const [row] = await db
    .update(accommodations)
    .set({ ...input, status: "done", error: null })
    .where(eq(accommodations.id, id))
    .returning({ id: accommodations.id });
  return row ? c.json(await accommodationDetail(id)) : notFound();
});

accommodationsRoutes.delete("/accommodations/:id", async (c) => {
  const [row] = await db
    .delete(accommodations)
    .where(eq(accommodations.id, idParam(c)))
    .returning({ id: accommodations.id });
  return row ? c.json({ ok: true }) : notFound();
});

/** Sube (o sustituye) la captura del anuncio y vuelve a extraer los datos. */
accommodationsRoutes.post(
  "/accommodations/:id/screenshot",
  createLimit,
  bodyLimit({ maxSize: MAX_SCREENSHOT + 64 * 1024 }),
  async (c) => {
    const id = idParam(c);
    const screenshot = await imageField((await c.req.parseBody()).screenshot, MAX_SCREENSHOT);
    if (!screenshot) badRequest("Falta la captura");
    const [row] = await db
      .update(accommodations)
      .set({ screenshot: screenshot.data, screenshotMime: screenshot.mime, status: "pending", error: null })
      .where(eq(accommodations.id, id))
      .returning({ id: accommodations.id });
    if (!row) notFound();
    kickWorker();
    return c.json(await accommodationDetail(id));
  },
);

accommodationsRoutes.post("/accommodations/:id/retry", createLimit, async (c) => {
  const id = idParam(c);
  const [row] = await db
    .update(accommodations)
    .set({ status: "pending", error: null })
    .where(eq(accommodations.id, id))
    .returning({ id: accommodations.id });
  if (!row) notFound();
  kickWorker();
  return c.json(await accommodationDetail(id));
});
