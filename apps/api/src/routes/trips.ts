import { participantInput, type Participant, type TripDetail } from "@ski/shared";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.ts";
import { accommodations, destinations, participants, trips } from "../db/schema.ts";
import { idParam, jsonBody, notFound } from "../http.ts";
import { destinationSummary, tripColumns, tripView } from "../views.ts";

export const tripsRoutes = new Hono();

export async function findTrip(id: string) {
  const [trip] = await db.select(tripColumns).from(trips).where(eq(trips.id, id));
  return trip ?? notFound("Viaje no encontrado");
}

tripsRoutes.get("/", async (c) => {
  const rows = await db.select(tripColumns).from(trips).orderBy(asc(trips.startDate));
  return c.json(rows.map(tripView));
});

tripsRoutes.get("/:id", async (c) => {
  const trip = await findTrip(idParam(c));
  const dests = await db
    .select()
    .from(destinations)
    .where(eq(destinations.tripId, trip.id))
    .orderBy(asc(destinations.createdAt));
  const accs = dests.length
    ? await db
        .select({ destinationId: accommodations.destinationId, totalPrice: accommodations.totalPrice })
        .from(accommodations)
        .where(inArray(accommodations.destinationId, dests.map((d) => d.id)))
    : [];
  const body: TripDetail = {
    ...tripView(trip),
    destinations: dests.map((d) =>
      destinationSummary(
        d,
        trip,
        accs.filter((a) => a.destinationId === d.id),
      ),
    ),
  };
  return c.json(body);
});

tripsRoutes.get("/:id/photo", async (c) => {
  const [row] = await db
    .select({ photo: trips.photo, mime: trips.photoMime })
    .from(trips)
    .where(eq(trips.id, idParam(c)));
  if (!row?.photo || !row.mime) notFound();
  c.header("Content-Type", row.mime);
  // La URL lleva ?v=<updatedAt>, así que se puede cachear sin miedo
  c.header("Cache-Control", "public, max-age=31536000, immutable");
  return c.body(new Uint8Array(row.photo));
});

tripsRoutes.get("/:id/participants", async (c) => {
  const trip = await findTrip(idParam(c));
  const rows: Participant[] = await db
    .select({ id: participants.id, name: participants.name })
    .from(participants)
    .where(eq(participants.tripId, trip.id))
    .orderBy(asc(sql`lower(${participants.name})`));
  return c.json(rows);
});

/** Alta de participante; si el nombre ya existe (sin distinguir mayúsculas) devuelve el existente. */
tripsRoutes.post("/:id/participants", async (c) => {
  const trip = await findTrip(idParam(c));
  const { name } = await jsonBody(c, participantInput);
  const select = { id: participants.id, name: participants.name };
  const [created] = await db
    .insert(participants)
    .values({ tripId: trip.id, name })
    .onConflictDoNothing()
    .returning(select);
  if (created) return c.json(created, 201);
  const [existing] = await db
    .select(select)
    .from(participants)
    .where(sql`${participants.tripId} = ${trip.id} and lower(${participants.name}) = lower(${name})`);
  return c.json(existing ?? notFound());
});
