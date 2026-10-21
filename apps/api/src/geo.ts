import { ORIGIN } from "@ski/shared";
import { env } from "./env.ts";

export type Place = { name: string | null; lat: number; lng: number };

const SHORT_HOSTS = ["maps.app.goo.gl", "goo.gl"];

export function isMapsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return SHORT_HOSTS.includes(u.hostname) || (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}

/**
 * Sigue las redirecciones de un link corto (maps.app.goo.gl) hasta la URL larga de Maps.
 * Se hace a mano para no acabar en la página de consentimiento de cookies de Google.
 */
export async function resolveMapsUrl(raw: string): Promise<string> {
  let url = raw;
  for (let i = 0; i < 5 && SHORT_HOSTS.includes(new URL(url).hostname); i++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const location = res.headers.get("location");
    if (!location) break;
    url = new URL(location, url).toString();
  }
  const u = new URL(url);
  // Por si acaso: consent.google.com/?continue=<url de maps>
  return u.hostname.startsWith("consent.") ? (u.searchParams.get("continue") ?? url) : url;
}

const num = (s: string | undefined) => (s == null ? NaN : Number(s));
const isCoord = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Saca nombre y coordenadas del destino de una URL larga de Google Maps (/place/... o /dir/...). */
export function parseMapsUrl(raw: string): Place | null {
  const u = new URL(raw);
  const path = decodeURIComponent(u.pathname);
  const segments = path.split("/").filter(Boolean);

  let lat = NaN;
  let lng = NaN;
  // place: ...!3d<lat>!4d<lng>
  const place = [...path.matchAll(/!3d(-?[\d.]+)!4d(-?[\d.]+)/g)].at(-1);
  // dir: ...!1d<lng>!2d<lat>; el último par es el destino
  const dir = [...path.matchAll(/!1d(-?[\d.]+)!2d(-?[\d.]+)/g)].at(-1);
  if (place) [lat, lng] = [num(place[1]), num(place[2])];
  else if (dir) [lng, lat] = [num(dir[1]), num(dir[2])];
  else {
    // q=lat,lng o, en último caso, el centro del mapa (@lat,lng,zoom)
    const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? "";
    const m = q.match(/^(-?[\d.]+),\s*(-?[\d.]+)$/) ?? path.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (m) [lat, lng] = [num(m[1]), num(m[2])];
  }
  if (!isCoord(lat, lng)) return null;

  // Nombre: segmento tras /place/, o el último destino de /dir/ que no sean coordenadas
  let name: string | null = null;
  const at = (kw: string) => segments.indexOf(kw);
  if (at("place") >= 0) name = segments[at("place") + 1] ?? null;
  else if (at("dir") >= 0) {
    const stops = segments.slice(at("dir") + 1).filter((s) => !s.startsWith("@") && !s.startsWith("data="));
    name = stops.filter((s) => !/^-?[\d.]+,\s*-?[\d.]+$/.test(s)).at(-1) ?? null;
  }
  // "Formigal, Edificio Sextas URB, 22640 Formigal, Huesca" -> "Formigal"
  name = name?.replace(/\+/g, " ").split(",")[0]?.trim() || null;
  return { name, lat, lng };
}

/** Minutos en coche desde el origen (Gijón) usando OSRM. */
export async function driveMinutesFromOrigin(lat: number, lng: number): Promise<number> {
  const url = `${env.ROUTING_URL}/route/v1/driving/${ORIGIN.lng},${ORIGIN.lat};${lng},${lat}?overview=false`;
  const res = await fetch(url, { headers: { "User-Agent": "ski-friends" }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as { code: string; routes?: { duration: number }[] };
  const route = body.routes?.[0];
  if (!res.ok || body.code !== "Ok" || !route) throw new Error(`Ruta no disponible (${body.code})`);
  return Math.round(route.duration / 60);
}
