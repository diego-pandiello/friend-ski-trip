import type { TripSummary } from "@ski/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router";
import { api } from "../api.ts";
import { Photo } from "../components/Photo.tsx";
import { CardsSkeleton, Container, ErrorMessage, PageHeader, stagger } from "../components/ui.tsx";
import { formatDateRange } from "../format.ts";

export function LandingPage() {
  const trips = useQuery({ queryKey: ["trips"], queryFn: () => api<TripSummary[]>("/trips") });

  if (trips.data?.length === 1) return <Navigate to={`/t/${trips.data[0]!.id}`} replace />;

  return (
    <Container className="py-8 md:py-12">
      <PageHeader title="Elige tu viaje" />
      {trips.isPending && <CardsSkeleton />}
      <ErrorMessage error={trips.error} />
      {trips.data?.length === 0 && (
        <p className="text-muted">Todavía no hay ningún viaje. El organizador lo creará pronto.</p>
      )}
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {trips.data?.map((t, i) => (
          <Link key={t.id} to={`/t/${t.id}`} className="group block animate-rise" style={stagger(i)}>
            <Photo src={t.photoUrl} aspect="aspect-[4/3]" />
            <p className="mt-3 text-[17px] font-semibold">{t.title}</p>
            <p className="text-muted">
              {formatDateRange(t.startDate, t.endDate)} · {t.travelers} viajeros
            </p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
