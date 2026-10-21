const MAX_HTML_BYTES = 5 * 1024 * 1024;
/** Suficiente para tablas de precios y anuncios; evita mandar páginas enormes a Claude. */
const MAX_TEXT_CHARS = 60_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>|<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Bloques JSON-LD (schema.org) de la página; Airbnb pone ahí nombre, descripción y coordenadas. */
export function jsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(m[1]!);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item === "object") blocks.push(item as Record<string, unknown>);
      }
    } catch {
      // JSON-LD mal formado: se ignora
    }
  }
  return blocks;
}

/** Título y etiquetas meta de descripción (og:title, description…). */
function metaTags(html: string): string[] {
  const out: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) out.push(`Título: ${decodeEntities(title.trim())}`);
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = m[0];
    const key = tag.match(/(?:name|property)=["']([^"']+)["']/i)?.[1];
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (key && content && /description|title/i.test(key)) out.push(`${key}: ${decodeEntities(content)}`);
  }
  return [...new Set(out)];
}

export type Page = { html: string; text: string };

/**
 * Descarga una página y la reduce a texto para Claude: metadatos + JSON-LD + texto visible.
 * Lanza si la web bloquea (p. ej. el anti-bot de Booking) o no hay contenido.
 */
export async function fetchPage(url: string): Promise<Page> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,fr;q=0.8,en;q=0.7",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status !== 200) throw new Error(`la web respondió ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_HTML_BYTES) throw new Error("la página es demasiado grande");
  const html = new TextDecoder().decode(buf);

  const ld = jsonLd(html).map((b) => {
    const { image: _image, ...rest } = b; // las listas de fotos no aportan nada al texto
    return JSON.stringify(rest);
  });
  const text = [...metaTags(html), ...ld, htmlToText(html)].join("\n").slice(0, MAX_TEXT_CHARS);
  if (text.length < 200) throw new Error("la página no tiene contenido legible");
  return { html, text };
}
