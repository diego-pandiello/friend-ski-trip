import type { ExtractionStatus } from "@ski/shared";

export function ExtractionBadge({ item }: { item: { status: ExtractionStatus; forfaitStale?: boolean } }) {
  if (item.status === "pending" || item.status === "processing")
    return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Extrayendo datos…</span>;
  if (item.status === "failed")
    return <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Error al extraer</span>;
  if (item.forfaitStale)
    return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Forfait desactualizado</span>;
  return null;
}
