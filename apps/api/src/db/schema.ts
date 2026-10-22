import { sql } from "drizzle-orm";
import {
  customType,
  date,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

// numeric -> number en JS (precios pequeños, sin riesgo de precisión)
const money = customType<{ data: number; driverData: string }>({
  dataType: () => "numeric(10, 2)",
  fromDriver: (value) => Number(value),
});

export const extractionStatus = pgEnum("extraction_status", ["pending", "processing", "done", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const trips = pgTable("trips", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  skiDays: integer("ski_days").notNull(),
  travelers: integer().notNull(),
  photo: bytea(),
  photoMime: text("photo_mime"),
  ...timestamps,
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const participants = pgTable(
  "participants",
  {
    id: uuid().primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("participants_trip_name_idx").on(t.tripId, sql`lower(${t.name})`)],
);

const extraction = {
  status: extractionStatus().notNull().default("pending"),
  error: text(),
  createdBy: uuid("created_by").references(() => participants.id, { onDelete: "set null" }),
};

export const destinations = pgTable("destinations", {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  mapsUrl: text("maps_url").notNull(),
  /** Opcionales: web y/o captura con el precio del forfait. */
  forfaitUrl: text("forfait_url"),
  forfaitScreenshot: bytea("forfait_screenshot"),
  forfaitScreenshotMime: text("forfait_screenshot_mime"),
  name: text(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  driveMinutes: integer("drive_minutes"),
  forfaitPrice: money("forfait_price"),
  /** ski_days del viaje con el que se extrajo el precio, para detectar desfases. */
  forfaitDays: integer("forfait_days"),
  ...extraction,
  ...timestamps,
});

export const accommodations = pgTable("accommodations", {
  id: uuid().primaryKey().defaultRandom(),
  destinationId: uuid("destination_id")
    .notNull()
    .references(() => destinations.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  name: text(),
  /** Primera foto del anuncio (enlazada, no se descarga). */
  imageUrl: text("image_url"),
  description: text(),
  beds: integer(),
  bedrooms: integer(),
  bathrooms: integer(),
  distanceKm: numeric("distance_km", { precision: 6, scale: 1, mode: "number" }),
  totalPrice: money("total_price"),
  /** Captura opcional del anuncio; se conserva para poder reintentar la extracción. */
  screenshot: bytea(),
  screenshotMime: text("screenshot_mime"),
  ...extraction,
  ...timestamps,
});
