import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

export function notFound(message = "No encontrado"): never {
  throw new HTTPException(404, { message });
}

export function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

/** Parámetro de ruta con formato UUID; si no lo es, el recurso no existe. */
export function idParam(c: Context, name = "id"): string {
  const parsed = z.uuid().safeParse(c.req.param(name));
  return parsed.success ? parsed.data : notFound();
}

export async function jsonBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const body: unknown = await c.req.json().catch(() => badRequest("JSON inválido"));
  return schema.parse(body);
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Lee un campo de imagen de un multipart; null si no viene. */
export async function imageField(value: unknown, maxBytes: number): Promise<{ data: Buffer; mime: string } | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!IMAGE_TYPES.includes(value.type)) badRequest("La imagen debe ser JPEG, PNG o WebP");
  if (value.size > maxBytes) badRequest(`La imagen no puede superar ${Math.round(maxBytes / 1024 / 1024)} MB`);
  return { data: Buffer.from(await value.arrayBuffer()), mime: value.type };
}
