import type { DestinationSummary, TripDetail } from "@ski/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router";
import { api } from "../api.ts";
import { ExtractionBadge } from "../components/ExtractionBadge.tsx";
import { ButtonLink, Card, ErrorMessage, Loading } from "../components/ui.tsx";
import { formatDateRange, formatDuration, formatPriceRange } from "../format.ts";
import { useParticipant } from "../participant.ts";
import { TripCover } from "./LandingPage.tsx";

export const isWorking = (s: { status: string }) => s.status === "pending" || s.status === "processing";

export function TripPage() {
  const { tripId = "" } = useParams();
  const [participant, setParticipant] = useParticipant(tripId);
  const trip = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => api<TripDetail>(`/trips/${tripId}`),
    // Mientras haya extracciones en marcha, refrescar
    refetchInterval: (q) => (q.state.data?.destinations.some(isWorking) ? 2000 : false),
  });

  if (!participant) return <Navigate to={`/t/${tripId}/join`} replace />;
  if (trip.isPending) return <Loading />;
  if (trip.error) return <ErrorMessage error={trip.error} />;
  const t = trip.data;

  return (
    <div className="space-y-5">
      <div className="-mx-4 -mt-4">
        <TripCover trip={t} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>📅 {formatDateRange(t.startDate, t.endDate)}</span>
          <span>⛷️ {t.skiDays} días de esquí</span>
          <span>👥 {t.travelers} viajeros</span>
        </p>
        {t.description && <p className="whitespace-pre-line text-slate-700">{t.description}</p>}
        <p className="text-sm text-slate-500">
          Eres <strong>{participant.name}</strong> ·{" "}
          <button type="button" className="text-sky-700 underline" onClick={() => setParticipant(null)}>
            cambiar
          </button>
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Destinos</h2>
          <ButtonLink to={`/t/${tripId}/new-destination`}>+ Destino</ButtonLink>
        </div>
        {t.destinations.length === 0 && <p className="text-slate-500">Aún no hay destinos. ¡Añade el primero!</p>}
        {t.destinations.map((d) => (
          <DestinationCard key={d.id} destination={d} />
        ))}
      </section>
    </div>
  );
}

function DestinationCard({ destination: d }: { destination: DestinationSummary }) {
  return (
    <Link to={`/d/${d.id}`} className="block">
      <Card className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{d.name ?? "Destino sin nombre"}</p>
          <ExtractionBadge item={d} />
        </div>
        <p className="flex flex-wrap gap-x-3 text-sm text-slate-600">
          <span>🚗 {formatDuration(d.driveMinutes)}</span>
          <span>🏠 {d.accommodationCount} alojamientos</span>
        </p>
        <p className="font-medium text-sky-800">
          {formatPriceRange(d.priceMin, d.priceMax)}
          {d.priceMin != null && <span className="text-sm font-normal text-slate-500"> / persona</span>}
        </p>
      </Card>
    </Link>
  );
}
