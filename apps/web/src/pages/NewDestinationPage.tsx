import type { DestinationDetail } from "@ski/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, Container, ErrorMessage, Field, Input, PageHeader } from "../components/ui.tsx";
import { useParticipant } from "../participant.ts";

export function NewDestinationPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [participant] = useParticipant(tripId);
  const [mapsUrl, setMapsUrl] = useState("");
  const [forfaitUrl, setForfaitUrl] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<DestinationDetail>(`/trips/${tripId}/destinations`, {
        method: "POST",
        body: JSON.stringify({ mapsUrl: mapsUrl.trim(), forfaitUrl: forfaitUrl.trim(), participantId: participant?.id }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate(`/t/${tripId}`);
    },
  });

  if (!participant) return <Navigate to={`/t/${tripId}/join`} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Container narrow className="py-6 md:py-10">
      <PageHeader back={`/t/${tripId}`} title="Nuevo destino" subtitle="Dos enlaces y nosotros hacemos el resto." />
      <form onSubmit={submit} className="space-y-6">
        <Field label="Enlace de Google Maps" hint="Abre la estación en Google Maps, pulsa Compartir y pega aquí el enlace.">
          <Input type="url" inputMode="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" required />
        </Field>
        <Field label="Web con el precio del forfait">
          <Input type="url" inputMode="url" value={forfaitUrl} onChange={(e) => setForfaitUrl(e.target.value)} placeholder="https://…" required />
        </Field>
        <p className="flex gap-2 rounded-2xl bg-soft p-4 text-[15px] text-muted">
          <Sparkles className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
          El nombre, el tiempo en coche desde Gijón y el precio del forfait se rellenan solos. Podrás corregirlos después.
        </p>
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" loading={create.isPending}>
          Añadir destino
        </Button>
      </form>
    </Container>
  );
}
