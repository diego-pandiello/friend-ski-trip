import { timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { env } from "./env.ts";

const COOKIE = "ski_admin";
const SESSION_DAYS = 30;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkCredentials(user: string, password: string): boolean {
  // Evaluar ambos para no filtrar por tiempo cuál falló
  const userOk = safeEqual(user, env.ADMIN_USER);
  const passwordOk = safeEqual(password, env.ADMIN_PASSWORD);
  return userOk && passwordOk;
}

export async function startSession(c: Context) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await setSignedCookie(c, COOKIE, String(expires), env.SESSION_SECRET, {
    httpOnly: true,
    secure: c.req.url.startsWith("https://"),
    sameSite: "Lax",
    path: "/api",
    expires: new Date(expires),
  });
}

export function endSession(c: Context) {
  deleteCookie(c, COOKIE, { path: "/api" });
}

export async function isAdmin(c: Context): Promise<boolean> {
  const value = await getSignedCookie(c, env.SESSION_SECRET, COOKIE);
  return typeof value === "string" && Number(value) > Date.now();
}

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (!(await isAdmin(c))) throw new HTTPException(401, { message: "No autorizado" });
  await next();
};
