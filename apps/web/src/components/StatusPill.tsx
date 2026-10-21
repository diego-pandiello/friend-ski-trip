import type { ExtractionStatus } from "@ski/shared";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Pill } from "./ui.tsx";

export const isWorking = (s: { status: ExtractionStatus }) => s.status === "pending" || s.status === "processing";

/** Estado de la extracción en background; null cuando no hay nada que contar. */
export function StatusPill({ item }: { item: { status: ExtractionStatus; forfaitStale?: boolean } }) {
  if (isWorking(item))
    return (
      <Pill tone="busy">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Extrayendo datos…
      </Pill>
    );
  if (item.status === "failed")
    return (
      <Pill tone="warn">
        <TriangleAlert className="size-3.5" aria-hidden /> Revisar datos
      </Pill>
    );
  if (item.forfaitStale)
    return (
      <Pill tone="warn">
        <TriangleAlert className="size-3.5" aria-hidden /> Forfait desactualizado
      </Pill>
    );
  return null;
}
