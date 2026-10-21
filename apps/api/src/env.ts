import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  ANTHROPIC_API_KEY: z.string().default(""),
  CLAUDE_MODEL: z.string().default("claude-haiku-5-5"),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  /** Servidor OSRM para calcular el tiempo en coche. */
  ROUTING_URL: z.string().url().default("https://router.project-osrm.org"),
  /** Carpeta con el build del frontend; si no existe solo se sirve la API. */
  WEB_DIST: z.string().default("../web/dist"),
});

export const env = schema.parse(process.env);
