import { z } from "zod";
import { extractStructured } from "./claude.ts";
import { fetchPageText } from "./page-text.ts";

// El orden importa: el modelo genera los campos en este orden, así que primero localiza
// la fila y después da el precio (con el precio primero, Haiku mezclaba tablas).
const forfaitSchema = z.object({
  evidence: z
    .string()
    .describe("Copia literal de la tabla y la fila de la que sale el precio, o cadena vacía si no hay ninguna adecuada."),
  audience: z.enum(["adulto", "otro", "ninguno"]).describe("Para quién es esa tarifa."),
  publicFare: z.boolean().describe("true si es la tarifa pública/general (sin tarjeta de fidelidad, abono ni promoción)."),
  days: z.number().int().nullable().describe("Número de días de esquí de esa fila, tal como aparece."),
  price: z.number().nullable().describe("Precio en euros de esa fila. null si no hay fila adecuada."),
  explanation: z.string().describe("Una frase en español para el usuario: de dónde sale el precio o por qué no se encontró."),
});

export type ForfaitResult = { pricePerPerson: number | null; explanation: string };

const SYSTEM = `Extraes precios de forfaits de esquí del texto de una página web de una estación.
Buscas el precio de UN forfait de ADULTO, con la tarifa PÚBLICA/general, para EXACTAMENTE el número de días de esquí indicado.
- Ignora tarifas de niño, estudiante, senior, tarjetas de fidelidad o abono (p. ej. "No Souci"), promociones y paquetes con alojamiento.
- Si hay precios por temporada o fecha, elige el que aplica a las fechas del viaje.
- Si no hay una fila para ese número exacto de días, no elijas otra: deja days y price en null.
- No calcules ni inventes precios: solo valores que aparezcan en el texto.`;

export async function extractForfait(opts: {
  url: string;
  skiDays: number;
  startDate: string;
  endDate: string;
}): Promise<ForfaitResult> {
  const text = await fetchPageText(opts.url);
  const r = await extractStructured({
    schema: forfaitSchema,
    system: SYSTEM,
    content: [
      {
        type: "text",
        text: `Días de esquí: ${opts.skiDays}\nFechas del viaje: del ${opts.startDate} al ${opts.endDate}\nURL: ${opts.url}\n\n<pagina>\n${text}\n</pagina>`,
      },
    ],
  });

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
