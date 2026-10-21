import type { Participant, TripSummary } from "@ski/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Photo } from "../components/Photo.tsx";
import { Avatar, Button, Container, ErrorMessage, Field, Input, Loading, stagger } from "../components/ui.tsx";
import { formatDateRange } from "../format.ts";
import { useParticipant } from "../participant.ts";

export function JoinPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const [, setParticipant] = useParticipant(tripId);
  const [name, setName] = useState("");

  const trip = useQuery({ queryKey: ["trip", tripId], queryFn: () => api<TripSummary>(`/trips/${tripId}`) });
  const people = useQuery({
    queryKey: ["participants", tripId],
    queryFn: () => api<Participant[]>(`/trips/${tripId}/participants`),
  });

  function choose(p: Participant) {
    setParticipant(p);
    navigate(`/t/${tripId}`, { replace: true });
  }

  const create = useMutation({
    mutationFn: () =>
      api<Participant>(`/trips/${tripId}/participants`, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: choose,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  if (trip.isPending || people.isPending) return <Loading />;
  if (trip.error || people.error)
    return (
      <Container narrow className="py-8">
        <ErrorMessage error={trip.error ?? people.error} />
      </Container>
    );

  return (
    <Container narrow className="py-8 md:py-14">
      <div className="flex animate-rise items-center gap-4">
        <Photo src={trip.data.photoUrl} aspect="aspect-square" className="w-20 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{trip.data.title}</p>
          <p className="text-muted">{formatDateRange(trip.data.startDate, trip.data.endDate)}</p>
        </div>
      </div>

      <h1 className="mt-8 text-[26px] font-bold tracking-tight md:text-[32px]">¿Quién eres?</h1>
      <p className="mt-1 text-muted">Así sabremos quién añade cada destino y alojamiento.</p>

      {people.data.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {people.data.map((p, i) => (
            <li key={p.id} className="animate-rise" style={stagger(i)}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="flex w-full items-center gap-4 py-3.5 text-left transition hover:bg-soft/70 active:bg-soft"
              >
                <Avatar name={p.name} />
                <span className="flex-1 text-[17px] font-medium">{p.name}</span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label={people.data.length ? "¿No apareces? Escribe tu nombre" : "Tu nombre"}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" required />
        </Field>
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" loading={create.isPending}>
          Entrar al viaje
        </Button>
      </form>
    </Container>
  );
}
