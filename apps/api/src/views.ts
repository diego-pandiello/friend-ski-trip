import {
  comboPrice,
  pricePerPerson,
  type AccommodationView,
  type DestinationSummary,
  type TripSummary,
} from "@ski/shared";
import { getTableColumns } from "drizzle-orm";
import { accommodations, destinations, trips } from "./db/schema.ts";

// Columnas sin binarios, para listados y detalles
const { photo: _photo, ...tripColumns } = getTableColumns(trips);
const { screenshot: _screenshot, ...accommodationColumns } = getTableColumns(accommodations);
export { accommodationColumns, tripColumns };

type TripRow = Omit<typeof trips.$inferSelect, "photo">;
type DestinationRow = typeof destinations.$inferSelect;
type AccommodationRow = Omit<typeof accommodations.$inferSelect, "screenshot">;

export function tripView(t: TripRow): TripSummary {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    skiDays: t.skiDays,
    travelers: t.travelers,
    photoUrl: t.photoMime ? `/api/trips/${t.id}/photo?v=${t.updatedAt.getTime()}` : null,
  };
}

export function accommodationView(a: AccommodationRow, trip: TripRow, forfaitPrice: number | null): AccommodationView {
  const pp = pricePerPerson(a.totalPrice, trip.travelers);
  return {
    id: a.id,
    sourceUrl: a.sourceUrl,
    name: a.name,
    description: a.description,
    beds: a.beds,
    bedrooms: a.bedrooms,
    bathrooms: a.bathrooms,
    distanceKm: a.distanceKm,
    totalPrice: a.totalPrice,
    pricePerPerson: pp,
    comboPrice: comboPrice(forfaitPrice, pp),
    status: a.status,
    error: a.error,
    createdBy: a.createdBy,
  };
}

export function destinationSummary(
  d: DestinationRow,
  trip: TripRow,
  accs: { totalPrice: number | null }[],
): DestinationSummary {
  const combos = accs
    .map((a) => comboPrice(d.forfaitPrice, pricePerPerson(a.totalPrice, trip.travelers)))
    .filter((p): p is number => p != null);
  return {
    id: d.id,
    name: d.name,
    mapsUrl: d.mapsUrl,
    forfaitUrl: d.forfaitUrl,
    driveMinutes: d.driveMinutes,
    forfaitPrice: d.forfaitPrice,
    forfaitStale: d.forfaitPrice != null && d.forfaitDays !== trip.skiDays,
    accommodationCount: accs.length,
    priceMin: combos.length ? Math.min(...combos) : null,
    priceMax: combos.length ? Math.max(...combos) : null,
    status: d.status,
    error: d.error,
    createdBy: d.createdBy,
  };
}
