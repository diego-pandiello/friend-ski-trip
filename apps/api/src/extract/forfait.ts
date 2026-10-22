import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractStructured } from "./claude.ts";
import { fetchPage } from "./page-text.ts";

// El orden importa: el modelo genera los campos en este orden, así que primero localiza
// la fila y después da el precio (con el precio primero, Haiku mezclaba tablas).
const forfaitSchema = z.object({
  evidence: z
    .string()
    .describe("Copia literal de la tabla y la fila (de la página o la captura) de la que sale el precio, o cadena vacía si no hay ninguna adecuada."),
  audience: z.enum(["adulto", "otro", "ninguno"]).describe("Para quién es esa tarifa."),
  publicFare: z.boolean().describe("true si es la tarifa pública/general (sin tarjeta de fidelidad, abono ni promoción)."),
  days: z.number().int().nullable().describe("Número de días de esquí de esa fila, tal como aparece."),
  price: z.number().nullable().describe("Precio en euros de esa fila. null si no hay fila adecuada."),
  explanation: z.string().describe("Una frase en español para el usuario: de dónde sale el precio o por qué no se encontró."),
});

export type ForfaitResult = { pricePerPerson: number | null; explanation: string };

const SYSTEM = `Extraes precios de forfaits de esquí del texto de la web de una estación, de una captura de pantalla de esa web, o de ambos.
Buscas el precio de UN forfait de ADULTO, con la tarifa PÚBLICA/general, para EXACTAMENTE el número de días de esquí indicado.
- Ignora tarifas de niño, estudiante, senior, tarjetas de fidelidad o abono (p. ej. "No Souci"), promociones y paquetes con alojamiento.
- Si hay precios por temporada o fecha, elige el que aplica a las fechas del viaje.
- Si no hay una fila para ese número exacto de días, no elijas otra: deja days y price en null.
- No calcules ni inventes precios: solo valores que aparezcan en el texto o la captura.
- Si hay captura, suele ser la fuente más fiable: es lo que el usuario ha visto con sus fechas.`;

export async function extractForfait(opts: {
  url: string | null;
  screenshot: { data: Buffer; mime: string } | null;
  skiDays: number;
  startDate: string;
  endDate: string;
}): Promise<ForfaitResult> {
  let text: string | null = null;
  if (opts.url) {
    try {
      text = (await fetchPage(opts.url)).text;
    } catch (err) {
      // Con captura se sigue adelante solo con ella
      if (!opts.screenshot) throw err;
    }
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (opts.screenshot) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.screenshot.mime as "image/jpeg" | "image/png" | "image/webp",
        data: opts.screenshot.data.toString("base64"),
      },
    });
  }
  content.push({
    type: "text",
    text: [
      `Días de esquí: ${opts.skiDays}`,
      `Fechas del viaje: del ${opts.startDate} al ${opts.endDate}`,
      opts.url ? `URL: ${opts.url}` : null,
      opts.screenshot ? "Se adjunta una captura de pantalla con los precios." : null,
      text ? `\n<pagina>\n${text}\n</pagina>` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const r = await extractStructured({ schema: forfaitSchema, system: SYSTEM, content });

  // Comprobación en código: solo se acepta una fila de adulto, pública y con los días pedidos
  const valid = r.price != null && r.price > 0 && r.audience === "adulto" && r.publicFare && r.days === opts.skiDays;
  if (valid) return { pricePerPerson: r.price, explanation: r.explanation };
  return {
    pricePerPerson: null,
    explanation:
      r.days != null && r.days !== opts.skiDays
        ? `no hay precio para ${opts.skiDays} días (la tabla más cercana es de ${r.days} días)`
        : r.explanation,
  };
}
