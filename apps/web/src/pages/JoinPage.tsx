import type { Participant, TripSummary } from "@ski/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, Card, ErrorMessage, Field, Input, Loading, PageTitle } from "../components/ui.tsx";
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
  if (trip.error || people.error) return <ErrorMessage error={trip.error ?? people.error} />;

  return (
    <>
      <PageTitle>¿Quién eres?</PageTitle>
      <p className="-mt-2 mb-4 text-slate-500">{trip.data.title}</p>
      {people.data.length > 0 && (
        <Card className="mb-6 p-2">
          <ul className="divide-y divide-slate-100">
            {people.data.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => choose(p)} className="flex min-h-12 w-full items-center rounded-lg px-3 text-left active:bg-slate-100">
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <form onSubmit={submit} className="space-y-3">
        <Field label={people.data.length ? "¿No apareces? Escribe tu nombre" : "Escribe tu nombre"}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" required />
        </Field>
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" disabled={create.isPending}>
          Entrar al viaje
        </Button>
      </form>
    </>
  );
}
