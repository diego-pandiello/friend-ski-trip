import { z } from "zod";

z.config(z.locales.es());

export const ORIGIN = { name: "Gijón, Asturias", lat: 43.5322, lng: -5.6611 };

export const extractionStatus = ["pending", "processing", "done", "failed"] as const;
export type ExtractionStatus = (typeof extractionStatus)[number];

const isoDate = z.iso.date();

export const tripInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000).default(""),
    startDate: isoDate,
    endDate: isoDate,
    skiDays: z.coerce.number().int().min(1),
    travelers: z.coerce.number().int().min(1),
  })
  .refine((t) => t.endDate > t.startDate, {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["endDate"],
  })
  .refine((t) => t.skiDays <= tripDays(t.startDate, t.endDate), {
    message: "Los días de esquí no pueden superar los días del viaje",
    path: ["skiDays"],
  });
export type TripInput = z.infer<typeof tripInput>;

export const participantInput = z.object({
  name: z.string().trim().min(1, "Escribe tu nombre").max(60),
});

export const destinationCreate = z.object({
  mapsUrl: z.url("Pega el enlace de Google Maps"),
  forfaitUrl: z.url("Pega el enlace de la web del forfait"),
  participantId: z.uuid().optional(),
});

export const destinationUpdate = z
  .object({
    name: z.string().trim().min(1).max(120),
    driveMinutes: z.number().int().min(0),
    forfaitPrice: z.number().min(0),
  })
  .partial();

export const accommodationCreate = z.object({
  url: z.url("Pega el enlace de Booking o Airbnb"),
  participantId: z.uuid().optional(),
});


export const accommodationUpdate = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000),
    beds: z.number().int().min(0),
    bedrooms: z.number().int().min(0),
    bathrooms: z.number().int().min(0),
    distanceKm: z.number().min(0),
    totalPrice: z.number().min(0),
  })
  .partial();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días naturales del viaje, ambos extremos incluidos. */
export function tripDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1;
}

/** Noches de alojamiento. */
export function tripNights(startDate: string, endDate: string): number {
  return tripDays(startDate, endDate) - 1;
}

export function pricePerPerson(totalPrice: number | null, travelers: number): number | null {
  return totalPrice == null ? null : totalPrice / travelers;
}

/** Precio total por persona: forfait + alojamiento. */
export function comboPrice(forfaitPrice: number | null, accommodationPerPerson: number | null): number | null {
  return forfaitPrice == null || accommodationPerPerson == null ? null : forfaitPrice + accommodationPerPerson;
}

// ---- Respuestas de la API ----

export type Participant = { id: string; name: string };

export type TripSummary = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  skiDays: number;
  travelers: number;
  photoUrl: string | null;
};

type Extraction = {
  status: ExtractionStatus;
  error: string | null;
  createdBy: string | null;
};

export type DestinationSummary = Extraction & {
  id: string;
  name: string | null;
  mapsUrl: string;
  forfaitUrl: string;
  driveMinutes: number | null;
  forfaitPrice: number | null;
  /** El forfait se extrajo con otro nº de días de esquí del que tiene ahora el viaje. */
  forfaitStale: boolean;
  accommodationCount: number;
  priceMin: number | null;
  priceMax: number | null;
};

export type TripDetail = TripSummary & { destinations: DestinationSummary[] };

export type AccommodationView = Extraction & {
  id: string;
  destinationId: string;
  sourceUrl: string;
  name: string | null;
  imageUrl: string | null;
  hasScreenshot: boolean;
  description: string | null;
  beds: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  distanceKm: number | null;
  totalPrice: number | null;
  pricePerPerson: number | null;
  comboPrice: number | null;
};

export type DestinationDetail = DestinationSummary & {
  lat: number | null;
  lng: number | null;
  trip: TripSummary;
  accommodations: AccommodationView[];
};
