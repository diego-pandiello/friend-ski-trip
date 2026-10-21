import { tripInput } from "@ski/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { checkCredentials, endSession, isAdmin, requireAdmin, startSession } from "../auth.ts";
import { db } from "../db/client.ts";
import { trips } from "../db/schema.ts";
import { idParam, imageField, jsonBody, notFound } from "../http.ts";
import { rateLimit } from "../rate-limit.ts";
import { tripColumns, tripView } from "../views.ts";

const MAX_PHOTO = 3 * 1024 * 1024;

export const admin = new Hono();

admin.get("/session", async (c) => c.json({ admin: await isAdmin(c) }));

admin.post("/login", rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), async (c) => {
  const { user, password } = await jsonBody(c, z.object({ user: z.string(), password: z.string() }));
  if (!checkCredentials(user, password)) return c.json({ error: "Usuario o contraseña incorrectos" }, 401);
  await startSession(c);
  return c.json({ admin: true });
});

admin.post("/logout", (c) => {
  endSession(c);
  return c.json({ admin: false });
});

admin.use("/trips/*", requireAdmin, bodyLimit({ maxSize: MAX_PHOTO + 64 * 1024 }));

/** Formulario multipart: campos de tripInput + `photo` (archivo) + `removePhoto` ("1"). */
async function parseTripForm(form: Record<string, string | File>) {
  const data = tripInput.parse(form);
  const photo = await imageField(form.photo, MAX_PHOTO);
  return { data, photo, removePhoto: form.removePhoto === "1" };
}

admin.post("/trips", async (c) => {
  const { data, photo } = await parseTripForm(await c.req.parseBody());
  const [row] = await db
    .insert(trips)
    .values({ ...data, photo: photo?.data, photoMime: photo?.mime })
    .returning(tripColumns);
  return c.json(tripView(row!), 201);
});

admin.put("/trips/:id", async (c) => {
  const id = idParam(c);
  const { data, photo, removePhoto } = await parseTripForm(await c.req.parseBody());
  const photoFields = photo
    ? { photo: photo.data, photoMime: photo.mime }
    : removePhoto
      ? { photo: null, photoMime: null }
      : {};
  const [row] = await db
    .update(trips)
    .set({ ...data, ...photoFields })
    .where(eq(trips.id, id))
    .returning(tripColumns);
  return row ? c.json(tripView(row)) : notFound();
});

admin.delete("/trips/:id", async (c) => {
  const [row] = await db.delete(trips).where(eq(trips.id, idParam(c))).returning({ id: trips.id });
  return row ? c.json({ ok: true }) : notFound();
});
