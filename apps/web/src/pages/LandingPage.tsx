import type { TripSummary } from "@ski/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router";
import { api } from "../api.ts";
import { ErrorMessage, Loading, PageTitle } from "../components/ui.tsx";
import { formatDateRange } from "../format.ts";

export function LandingPage() {
  const trips = useQuery({ queryKey: ["trips"], queryFn: () => api<TripSummary[]>("/trips") });

  if (trips.isPending) return <Loading />;
  if (trips.error) return <ErrorMessage error={trips.error} />;
  if (trips.data.length === 1) return <Navigate to={`/t/${trips.data[0]!.id}`} replace />;

  return (
    <>
      <PageTitle>Elige el viaje</PageTitle>
      {trips.data.length === 0 && <p className="text-slate-500">Todavía no hay ningún viaje.</p>}
      <div className="space-y-4">
        {trips.data.map((t) => (
          <Link key={t.id} to={`/t/${t.id}`} className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <TripCover trip={t} />
            <div className="p-4">
              <p className="text-lg font-semibold">{t.title}</p>
              <p className="text-sm text-slate-500">{formatDateRange(t.startDate, t.endDate)}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function TripCover({ trip, className = "" }: { trip: TripSummary; className?: string }) {
  return trip.photoUrl ? (
    <img src={trip.photoUrl} alt="" className={`aspect-[16/9] w-full object-cover ${className}`} />
  ) : (
    <div className={`grid aspect-[16/9] w-full place-items-center bg-gradient-to-br from-sky-200 to-slate-300 text-5xl ${className}`}>
      🏔️
    </div>
  );
}
