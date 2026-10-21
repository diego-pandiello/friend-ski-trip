const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const km = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatEuros(value: number | null): string {
  return value == null ? "—" : euros.format(value);
}

export function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  return Math.round(min) === Math.round(max) ? formatEuros(min) : `${formatEuros(min)} – ${formatEuros(max)}`;
}

export function formatDateRange(start: string, end: string): string {
  return `${day.format(new Date(start))} – ${dayYear.format(new Date(end))}`;
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function formatKm(value: number | null): string | null {
  return value == null ? null : `${km.format(value)} km`;
}

/** "5 hab. · 7 camas · 1 baño", omitiendo lo que falte. */
export function formatRooms(a: { bedrooms: number | null; beds: number | null; bathrooms: number | null }): string {
  const parts = [
    a.bedrooms != null && `${a.bedrooms} hab.`,
    a.beds != null && `${a.beds} ${a.beds === 1 ? "cama" : "camas"}`,
    a.bathrooms != null && `${a.bathrooms} ${a.bathrooms === 1 ? "baño" : "baños"}`,
  ].filter(Boolean);
  return parts.join(" · ");
}
