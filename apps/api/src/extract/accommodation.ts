import { tripNights } from "@ski/shared";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractStructured } from "./claude.ts";
import { fetchPage, jsonLd } from "./page-text.ts";

// Igual que con el forfait, la evidencia va antes que los valores
const accommodationSchema = z.object({
  name: z.string().nullable().describe("Nombre del anuncio."),
  summary: z.string().nullable().describe("Resumen en español de 1-2 frases: tipo de alojamiento, ubicación y lo más destacable."),
  bedrooms: z.number().int().nullable().describe("Número de dormitorios/habitaciones."),
  beds: z.number().int().nullable().describe("Número de camas."),
  bathrooms: z.number().int().nullable().describe("Número de baños."),
  distanceEvidence: z.string().describe("Texto literal que indica la distancia a las pistas o remontes, o cadena vacía."),
  distanceKm: z.number().nullable().describe("Distancia a pistas/remontes en km según ese texto (200 m = 0.2). null si no se menciona."),
  priceEvidence: z.string().describe("Texto literal del precio tal como aparece (en la captura o la página), o cadena vacía."),
  priceType: z
    .enum(["total_estancia", "por_noche", "ninguno"])
    .describe("total_estancia si es el precio total de todas las noches; por_noche si es por noche; ninguno si no hay precio."),
  priceAmount: z.number().nullable().describe("Importe en euros tal como aparece, sin hacer cálculos."),
  priceNights: z.number().int().nullable().describe("Noches que cubre el precio total, si se indica (p. ej. '5 noches')."),
  explanation: z.string().describe("Una frase en español: qué datos se encontraron y cuáles faltan."),
});

export type AccommodationFields = {
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  beds: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  distanceKm: number | null;
  totalPrice: number | null;
};

const SYSTEM = `Extraes los datos de un anuncio de alojamiento (Booking, Airbnb u otra web) para un viaje de esquí en grupo.
Recibes el texto de la página, una captura de pantalla del anuncio, o ambos.
- Usa solo datos que aparezcan; no inventes. Si un dato no aparece, null.
- La captura suele ser la fuente más fiable del precio. Copia el precio tal como aparece y di si es el total de la estancia o por noche.
- La distancia a las pistas solo si el anuncio la menciona (p. ej. "a 300 m de los remontes", "pie de pistas" = 0).`;

const R_EARTH_KM = 6371;
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Coordenadas y primera foto del JSON-LD, sin IA. */
function listingMetadata(html: string) {
  for (const b of jsonLd(html)) {
    const lat = Number(b.latitude);
    const lng = Number(b.longitude);
    const image = Array.isArray(b.image) ? b.image[0] : b.image;
    if (Number.isFinite(lat) || typeof image === "string")
      return {
        coords: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
        imageUrl: typeof image === "string" && image.startsWith("https://") ? image : null,
      };
  }
  return { coords: null, imageUrl: null };
}

/** Nombre aproximado desde la URL de Booking (/hotel/fr/la-pergola-saint-lary.es.html), por si no hay otro. */
export function nameFromUrl(raw: string): string | null {
  const slug = new URL(raw).pathname.match(/\/hotel\/[a-z]{2}\/([^/.]+)/)?.[1];
  if (!slug) return null;
  const words = slug.split("-").filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || null;
}

export async function extractAccommodation(opts: {
  url: string;
  screenshot: { data: Buffer; mime: string } | null;
  startDate: string;
  endDate: string;
  travelers: number;
  destination: { name: string | null; lat: number | null; lng: number | null };
}): Promise<{ fields: AccommodationFields; problems: string[] }> {
  const problems: string[] = [];
  const nights = tripNights(opts.startDate, opts.endDate);

  let page: Awaited<ReturnType<typeof fetchPage>> | null = null;
  try {
    page = await fetchPage(opts.url);
  } catch (err) {
    if (!opts.screenshot) throw new Error(`no se pudo leer el anuncio (${(err as Error).message}); añade una captura`);
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
      `Viaje: del ${opts.startDate} al ${opts.endDate} (${nights} noches), ${opts.travelers} personas.`,
      `Estación de esquí: ${opts.destination.name ?? "desconocida"}.`,
      `URL del anuncio: ${opts.url}`,
      opts.screenshot ? "Se adjunta una captura de pantalla del anuncio." : "No hay captura de pantalla.",
      page ? `<pagina>\n${page.text}\n</pagina>` : "No se pudo descargar la página.",
    ].join("\n"),
  });

  const r = await extractStructured({ schema: accommodationSchema, system: SYSTEM, content });

  // Precio total de la estancia, calculado y comprobado en código
  let totalPrice: number | null = null;
  if (r.priceAmount != null && r.priceAmount > 0) {
    if (r.priceType === "por_noche") totalPrice = r.priceAmount * nights;
    else if (r.priceType === "total_estancia") {
      if (r.priceNights != null && r.priceNights !== nights)
        problems.push(`el precio encontrado es para ${r.priceNights} noches y el viaje tiene ${nights}`);
      else totalPrice = r.priceAmount;
    }
  }
  if (totalPrice == null && problems.length === 0)
    problems.push(opts.screenshot ? "no se encontró el precio en la captura" : "falta el precio: añade una captura del anuncio con el precio");

  // Distancia: la del anuncio; si no, en línea recta hasta el punto del destino en Maps
  const meta = page ? listingMetadata(page.html) : { coords: null, imageUrl: null };
  let distanceKm = r.distanceKm;
  if (distanceKm == null && meta.coords && opts.destination.lat != null && opts.destination.lng != null) {
    distanceKm = Math.round(haversineKm(meta.coords, { lat: opts.destination.lat, lng: opts.destination.lng }) * 10) / 10;
  }

  return {
    fields: {
      name: r.name ?? nameFromUrl(opts.url),
      description: r.summary,
      imageUrl: meta.imageUrl,
      beds: r.beds,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      distanceKm,
      totalPrice,
    },
    problems,
  };
}
