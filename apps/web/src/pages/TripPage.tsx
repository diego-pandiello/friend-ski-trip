import type { DestinationSummary, TripDetail } from "@ski/shared";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Car, House, Plus, Snowflake, Users } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Photo } from "../components/Photo.tsx";
import { isWorking, StatusPill } from "../components/StatusPill.tsx";
import { ActionBar, Avatar, ButtonLink, Container, ErrorMessage, Loading, Pill, stagger } from "../components/ui.tsx";
import { formatDateRange, formatDuration, formatPriceRange } from "../format.ts";
import { useParticipant } from "../participant.ts";

/** Más baratos primero; los que aún no tienen precio, al final. */
const byPrice = (a: DestinationSummary, b: DestinationSummary) => (a.priceMin ?? Infinity) - (b.priceMin ?? Infinity);

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
  if (trip.error)
    return (
      <Container className="py-8">
        <ErrorMessage error={trip.error} />
      </Container>
    );
  const t = trip.data;
  const destinations = [...t.destinations].sort(byPrice);
  const cheapestId = destinations[0]?.priceMin != null ? destinations[0].id : null;

  return (
    <>
      <Container className="pb-10 md:pt-8">
        {/* Escritorio: título encima de la foto, como una ficha de Airbnb */}
        <h1 className="hidden text-[32px] font-bold tracking-tight md:block">{t.title}</h1>
        <div className="-mx-5 md:mx-0 md:mt-5">
          <Photo src={t.photoUrl} aspect="aspect-[4/3] md:aspect-[21/8]" className="rounded-none md:rounded-2xl" />
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
          <div className="animate-rise space-y-4">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight md:hidden">{t.title}</h1>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
              <li className="flex items-center gap-1.5">
                <CalendarDays className="size-4.5" aria-hidden /> {formatDateRange(t.startDate, t.endDate)}
              </li>
              <li className="flex items-center gap-1.5">
                <Snowflake className="size-4.5" aria-hidden /> {t.skiDays} días de esquí
              </li>
              <li className="flex items-center gap-1.5">
                <Users className="size-4.5" aria-hidden /> {t.travelers} viajeros
              </li>
            </ul>
            {t.description && <p className="max-w-2xl leading-relaxed whitespace-pre-line text-[#3f3f3f]">{t.description}</p>}
          </div>
          <div className="flex items-center gap-3 border-y border-line py-4 md:border-0 md:py-0">
            <Avatar name={participant.name} />
            <div className="text-[15px]">
              <p className="font-semibold">Eres {participant.name}</p>
              <button type="button" className="text-muted underline underline-offset-2" onClick={() => setParticipant(null)}>
                No soy yo
              </button>
            </div>
          </div>
        </div>

        <section className="mt-10 border-t border-line pt-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight">Destinos</h2>
              <p className="text-muted">
                {destinations.length
                  ? `${destinations.length} ${destinations.length === 1 ? "opción" : "opciones"} · precio por persona con forfait`
                  : "Añade la primera estación que os interese."}
              </p>
            </div>
            <ButtonLink to={`/t/${tripId}/new-destination`} variant="dark" className="hidden md:inline-flex">
              <Plus className="size-4" /> Añadir destino
            </ButtonLink>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d, i) => (
              <DestinationCard key={d.id} destination={d} cheapest={d.id === cheapestId && destinations.length > 1} index={i} />
            ))}
          </div>
        </section>
      </Container>

      <ActionBar>
        <ButtonLink to={`/t/${tripId}/new-destination`} className="flex-1">
          <Plus className="size-4" /> Añadir destino
        </ButtonLink>
      </ActionBar>
    </>
  );
}

function DestinationCard({ destination: d, cheapest, index }: { destination: DestinationSummary; cheapest: boolean; index: number }) {
  const range = formatPriceRange(d.priceMin, d.priceMax);
  const needsAttention = isWorking(d) || d.status === "failed" || d.forfaitStale;
  const badge = needsAttention ? <StatusPill item={d} /> : cheapest ? <Pill>Más económico</Pill> : null;
  return (
    <Link to={`/d/${d.id}`} className="group block animate-rise" style={stagger(index)}>
      <Photo src={d.coverImageUrl} busy={isWorking(d) && !d.coverImageUrl}>
        {badge && <div className="absolute top-3 left-3">{badge}</div>}
      </Photo>
      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-[17px] font-semibold">{d.name ?? "Nuevo destino"}</p>
        <p className="flex shrink-0 items-center gap-1 text-[15px]">
          <Car className="size-4" aria-hidden /> {formatDuration(d.driveMinutes)}
        </p>
      </div>
      <p className="flex items-center gap-1 text-muted">
        <House className="size-4" aria-hidden /> {d.accommodationCount}{" "}
        {d.accommodationCount === 1 ? "alojamiento" : "alojamientos"}
      </p>
      <p className="mt-1.5 text-[15px]">
        {range ? (
          <>
            <span className="font-semibold">{range}</span> <span className="text-muted">por persona</span>
          </>
        ) : (
          <span className="text-muted">Sin precios todavía</span>
        )}
      </p>
    </Link>
  );
}
