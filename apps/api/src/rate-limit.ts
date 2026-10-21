import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

/** IP del cliente; detrás del proxy de Coolify (Traefik) viene en X-Forwarded-For. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || getConnInfo(c).remote.address || "unknown";
}

/** Límite en memoria por IP: `max` peticiones por ventana. Suficiente para una sola instancia. */
export function rateLimit({ max, windowMs }: { max: number; windowMs: number }): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return async (c, next) => {
    const now = Date.now();
    const ip = clientIp(c);
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count++;
    if (entry.count > max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: "Demasiadas peticiones, espera un poco" }, 429);
    }
    await next();
  };
}
