import type { AccommodationView, DestinationDetail } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router";
import { api } from "../api.ts";
import { ExtractionBadge } from "../components/ExtractionBadge.tsx";
import { Button, ButtonLink, Card, ErrorMessage, Loading, PageTitle } from "../components/ui.tsx";
import { formatDuration, formatEuros } from "../format.ts";
import { useParticipant } from "../participant.ts";
import { isWorking } from "./TripPage.tsx";

export function useDestination(destinationId: string) {
  return useQuery({
    queryKey: ["destination", destinationId],
    queryFn: () => api<DestinationDetail>(`/destinations/${destinationId}`),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (isWorking(d) || d.accommodations.some(isWorking)) ? 2000 : false;
    },
  });
}

export function DestinationPage() {
  const { destinationId = "" } = useParams();
  const queryClient = useQueryClient();
  const destination = useDestination(destinationId);
  const [participant] = useParticipant(destination.data?.trip.id ?? "");

  const retry = useMutation({
    mutationFn: () => api<DestinationDetail>(`/destinations/${destinationId}/retry`, { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(["destination", destinationId], data),
  });

  if (destination.isPending) return <Loading />;
  if (destination.error) return <ErrorMessage error={destination.error} />;
  const d = destination.data;
  if (!participant) return <Navigate to={`/t/${d.trip.id}/join`} replace />;

  return (
    <div className="space-y-5">
      <div>
        <PageTitle back={`/t/${d.trip.id}`}>{d.name ?? "Destino"}</PageTitle>
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <ExtractionBadge item={d} />
          <Link to={`/d/${d.id}/edit`} className="text-sm text-sky-700 underline">
            Editar destino
          </Link>
        </div>
      </div>

      {d.status === "failed" && (
        <Card className="space-y-3 bg-red-50 ring-red-200">
          <p className="text-sm text-red-800">{d.error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => retry.mutate()} disabled={retry.isPending}>
              Reintentar
            </Button>
            <ButtonLink to={`/d/${d.id}/edit`} variant="secondary">
              Rellenar a mano
            </ButtonLink>
          </div>
        </Card>
      )}

      <Card className="grid grid-cols-2 gap-3">
        <Stat label="En coche desde Gijón" value={formatDuration(d.driveMinutes)} />
        <Stat label={`Forfait ${d.trip.skiDays} días`} value={d.forfaitPrice == null ? "Pendiente" : formatEuros(d.forfaitPrice)} />
        <a href={d.mapsUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-700 underline">
          Ver en Google Maps
        </a>
        <a href={d.forfaitUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-700 underline">
          Web del forfait
        </a>
      </Card>
      {d.forfaitStale && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El precio del forfait se calculó para otro número de días de esquí. Reintenta la extracción o corrígelo a mano.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Alojamientos</h2>
        {d.accommodations.length === 0 && <p className="text-slate-500">Aún no hay alojamientos.</p>}
        {d.accommodations.map((a) => (
          <AccommodationCard key={a.id} accommodation={a} />
        ))}
        <p className="text-sm text-slate-500">Pronto podrás añadir alojamientos desde Booking o Airbnb.</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function AccommodationCard({ accommodation: a }: { accommodation: AccommodationView }) {
  return (
    <Card className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold">
          {a.name ?? "Alojamiento"}
        </a>
        <ExtractionBadge item={a} />
      </div>
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-600">
        <span>🛏️ {a.beds ?? "?"} camas</span>
        <span>🚪 {a.bedrooms ?? "?"} hab.</span>
        <span>🛁 {a.bathrooms ?? "?"} baños</span>
        <span>🎿 {a.distanceKm == null ? "?" : `${a.distanceKm} km`}</span>
      </p>
      <p className="text-sm text-slate-600">Alojamiento: {formatEuros(a.pricePerPerson)} / persona</p>
      <p className="font-medium text-sky-800">Total con forfait: {formatEuros(a.comboPrice)} / persona</p>
    </Card>
  );
}
