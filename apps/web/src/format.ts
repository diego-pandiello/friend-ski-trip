const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const dayYear = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatEuros(value: number | null): string {
  return value == null ? "—" : euros.format(value);
}

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null || max == null) return "Sin precios";
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
