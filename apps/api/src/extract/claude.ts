import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "../env.ts";

let client: Anthropic | undefined;

export function claudeEnabled(): boolean {
  return env.ANTHROPIC_API_KEY !== "";
}

/** Una llamada a Claude con salida estructurada validada por zod. */
export async function extractStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: Anthropic.ContentBlockParam[];
}): Promise<z.infer<T>> {
  if (!claudeEnabled()) throw new Error("falta ANTHROPIC_API_KEY");
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages
    .parse({
      model: env.CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    })
    .catch((err: unknown) => {
      // Saldo, cuota, key inválida, caída… Mensaje corto para la UI y detalle en el log
      if (err instanceof Anthropic.APIError) {
        console.error("Claude API", err.status, err.requestID, err.message);
        throw new Error(`la IA no está disponible ahora mismo (error ${err.status ?? "de conexión"})`);
      }
      throw err;
    });
  if (response.stop_reason === "refusal") throw new Error("la IA rechazó la petición");
  if (response.parsed_output == null) throw new Error(`respuesta de la IA no válida (${response.stop_reason})`);
  console.info("Claude", env.CLAUDE_MODEL, "tokens in/out", response.usage.input_tokens, response.usage.output_tokens);
  return response.parsed_output;
}
