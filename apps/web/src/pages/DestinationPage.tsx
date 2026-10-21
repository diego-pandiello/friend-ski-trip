import type { AccommodationView, DestinationDetail } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, ExternalLink, House, MapPin, Pencil, Plus, Ticket } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Photo } from "../components/Photo.tsx";
import { isWorking, StatusPill } from "../components/StatusPill.tsx";
import {
  ActionBar,
  Alert,
  Button,
  ButtonLink,
  Container,
  ErrorMessage,
  IconButton,
  Loading,
  Pill,
  stagger,
} from "../components/ui.tsx";
import { formatDuration, formatEuros, formatKm, formatPriceRange, formatRooms } from "../format.ts";
import { useParticipant } from "../participant.ts";

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
  if (destination.error)
    return (
      <Container className="py-8">
        <ErrorMessage error={destination.error} />
      </Container>
    );
  const d = destination.data;
  if (!participant) return <Navigate to={`/t/${d.trip.id}/join`} replace />;

  const range = formatPriceRange(d.priceMin, d.priceMax);
  const cheapestId = d.accommodations.find((a) => a.comboPrice != null)?.id;
  const addUrl = `/d/${d.id}/new-accommodation`;

  return (
    <>
      <Container className="py-6 md:py-10">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <Link to={`/t/${d.trip.id}`} className="flex items-center gap-2 text-[15px] font-semibold hover:underline">
            <ArrowLeft className="size-5" aria-hidden /> {d.trip.title}
          </Link>
          <Link to={`/d/${d.id}/edit`} className="flex items-center gap-1.5 text-[15px] font-semibold underline underline-offset-4">
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        </div>

        <div className="grid gap-10 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px] lg:gap-16">
          <div className="min-w-0">
            <div className="animate-rise">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-[34px]">{d.name ?? "Nuevo destino"}</h1>
                <StatusPill item={d} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-muted">
                <a href={d.mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline underline-offset-2">
                  <MapPin className="size-4" aria-hidden /> Google Maps
                </a>
                <a href={d.forfaitUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline underline-offset-2">
                  <ExternalLink className="size-4" aria-hidden /> Web del forfait
                </a>
              </div>
            </div>

            <div className="mt-6 space-y-3 empty:hidden">
              {d.status === "failed" && (
                <Alert>
                  <p>{d.error}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="min-h-10" onClick={() => retry.mutate()} loading={retry.isPending}>
                      Reintentar
                    </Button>
                    <ButtonLink to={`/d/${d.id}/edit`} variant="secondary" className="min-h-10">
                      Rellenar a mano
                    </ButtonLink>
                  </div>
                </Alert>
              )}
              {d.forfaitStale && (
                <Alert tone="warn">
                  <p>El forfait se calculó para otro número de días de esquí. Reintenta la extracción o corrígelo a mano.</p>
                </Alert>
              )}
            </div>

            {/* Resumen en móvil (en escritorio va en la columna lateral) */}
            <div className="mt-6 md:hidden">
              <Summary destination={d} range={range} />
            </div>

            <section className="mt-10 border-t border-line pt-8">
              <div className="mb-6">
                <h2 className="text-[22px] font-bold tracking-tight">Alojamientos</h2>
                <p className="text-muted">
                  {d.accommodations.length
                    ? "Ordenados por precio total por persona"
                    : "Pega un enlace de Booking o Airbnb para empezar a comparar."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
                {d.accommodations.map((a, i) => (
                  <AccommodationCard
                    key={a.id}
                    accommodation={a}
                    cheapest={a.id === cheapestId && d.accommodations.length > 1}
                    index={i}
                  />
                ))}
              </div>
              {d.accommodations.length === 0 && (
                <ButtonLink to={addUrl} variant="secondary" className="hidden md:inline-flex">
                  <Plus className="size-4" /> Añadir alojamiento
                </ButtonLink>
              )}
            </section>
          </div>

          {/* Escritorio: tarjeta fija como la de reserva de Airbnb */}
          <aside className="hidden md:block">
            <div className="sticky top-24 animate-rise rounded-2xl border border-line p-6 shadow-float">
              <Summary destination={d} range={range} />
              <ButtonLink to={addUrl} className="mt-6 w-full">
                <Plus className="size-4" /> Añadir alojamiento
              </ButtonLink>
            </div>
          </aside>
        </div>
      </Container>

      <ActionBar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{range ?? "Sin precios"}</p>
          <p className="text-[13px] text-muted">por persona</p>
        </div>
        <ButtonLink to={addUrl}>
          <Plus className="size-4" /> Alojamiento
        </ButtonLink>
      </ActionBar>
    </>
  );
}

function Summary({ destination: d, range }: { destination: DestinationDetail; range: string | null }) {
  return (
    <div>
      <p className="text-[22px] font-bold tracking-tight">{range ?? "Sin precios"}</p>
      <p className="text-muted">por persona, forfait incluido</p>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-[15px]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="flex items-center gap-2 text-muted">
            <Car className="size-4" aria-hidden /> Desde Gijón
          </dt>
          <dd className="font-semibold">{formatDuration(d.driveMinutes)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="flex items-center gap-2 text-muted">
            <Ticket className="size-4" aria-hidden /> Forfait {d.trip.skiDays} días
          </dt>
          <dd className="font-semibold">{d.forfaitPrice == null ? "Pendiente" : formatEuros(d.forfaitPrice)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="flex items-center gap-2 text-muted">
            <House className="size-4" aria-hidden /> Alojamientos
          </dt>
          <dd className="font-semibold">{d.accommodationCount}</dd>
        </div>
      </dl>
    </div>
  );
}

function AccommodationCard({
  accommodation: a,
  cheapest,
  index,
}: {
  accommodation: AccommodationView;
  cheapest: boolean;
  index: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api(`/accommodations/${a.id}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["destination", a.destinationId] }),
  });
  const working = isWorking(a);
  const badge = working || a.status === "failed" ? <StatusPill item={a} /> : cheapest ? <Pill>Mejor precio</Pill> : null;
  const rooms = formatRooms(a);
  const distance = formatKm(a.distanceKm);

  return (
    <article className="group animate-rise" style={stagger(index)}>
      <div className="relative">
        <a href={a.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ver anuncio: ${a.name ?? "alojamiento"}`}>
          <Photo src={a.imageUrl} busy={working && !a.imageUrl} icon={House} />
        </a>
        {badge && <div className="pointer-events-none absolute top-3 left-3">{badge}</div>}
        <IconButton label="Editar alojamiento" className="absolute top-3 right-3" onClick={() => navigate(`/a/${a.id}/edit`)}>
          <Pencil className="size-4" />
        </IconButton>
      </div>

      <div className="mt-3 space-y-0.5">
        <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="line-clamp-1 text-[17px] font-semibold hover:underline">
          {a.name ?? (working ? "Leyendo el anuncio…" : "Alojamiento")}
        </a>
        {(rooms || distance) && (
          <p className="text-muted">{[rooms, distance && `${distance} a pistas`].filter(Boolean).join(" · ")}</p>
        )}
        {a.description && <p className="line-clamp-2 text-[15px] text-muted">{a.description}</p>}
        <p className="pt-1.5 text-[15px]">
          {a.comboPrice != null ? (
            <>
              <span className="font-semibold">{formatEuros(a.comboPrice)}</span> <span className="text-muted">por persona</span>
            </>
          ) : a.pricePerPerson != null ? (
            <>
              <span className="font-semibold">{formatEuros(a.pricePerPerson)}</span>{" "}
              <span className="text-muted">por persona, sin forfait</span>
            </>
          ) : (
            <span className="text-muted">Sin precio</span>
          )}
        </p>
        {a.comboPrice != null && (
          <p className="text-[13px] text-muted">
            Alojamiento {formatEuros(a.pricePerPerson)} + forfait {formatEuros(a.comboPrice - (a.pricePerPerson ?? 0))}
          </p>
        )}
        {a.status === "failed" && a.error && (
          <div className="pt-2 text-[14px]">
            <p className="text-accent-strong">{a.error}</p>
            <div className="mt-1 flex gap-4 font-semibold">
              <Link to={`/a/${a.id}/edit`} className="underline underline-offset-2">
                Completar datos
              </Link>
              <button type="button" className="underline underline-offset-2" onClick={() => retry.mutate()} disabled={retry.isPending}>
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
