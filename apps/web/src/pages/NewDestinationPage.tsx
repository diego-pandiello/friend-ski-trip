import type { DestinationDetail } from "@ski/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, Container, ErrorMessage, Field, ImagePicker, Input, PageHeader } from "../components/ui.tsx";
import { useParticipant } from "../participant.ts";
import { resizeScreenshot } from "./NewAccommodationPage.tsx";

export function NewDestinationPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [participant] = useParticipant(tripId);
  const [mapsUrl, setMapsUrl] = useState("");
  const [forfaitUrl, setForfaitUrl] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [resizing, setResizing] = useState(false);

  const create = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set("mapsUrl", mapsUrl.trim());
      if (forfaitUrl.trim()) body.set("forfaitUrl", forfaitUrl.trim());
      if (screenshot) body.set("forfaitScreenshot", screenshot);
      if (participant) body.set("participantId", participant.id);
      return api<DestinationDetail>(`/trips/${tripId}/destinations`, { method: "POST", body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate(`/t/${tripId}`);
    },
  });

  async function pickScreenshot(file: File) {
    setResizing(true);
    try {
      setScreenshot(await resizeScreenshot(file));
    } finally {
      setResizing(false);
    }
  }

  if (!participant) return <Navigate to={`/t/${tripId}/join`} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Container narrow className="py-6 md:py-10">
      <PageHeader back={`/t/${tripId}`} title="Nuevo destino" subtitle="Pega el enlace y nosotros hacemos el resto." />
      <form onSubmit={submit} className="space-y-6">
        <Field label="Enlace de Google Maps" hint="Abre la estación en Google Maps, pulsa Compartir y pega aquí el enlace.">
          <Input type="url" inputMode="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" required />
        </Field>
        <Field label="Web con el precio del forfait (opcional)">
          <Input type="url" inputMode="url" value={forfaitUrl} onChange={(e) => setForfaitUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <ImagePicker
          label="Captura del precio del forfait (opcional)"
          hint="Útil si la web no deja leer los precios. Que se vea la tarifa de adulto para los días de esquí del viaje."
          file={screenshot}
          onPick={pickScreenshot}
          onClear={() => setScreenshot(null)}
          busy={resizing}
          aspect="aspect-[3/4] max-h-96"
        />
        <p className="flex gap-2 rounded-2xl bg-soft p-4 text-[15px] text-muted">
          <Sparkles className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
          El nombre, el tiempo en coche desde Gijón y el precio del forfait (si das la web o una captura) se rellenan solos. Podrás corregirlos después.
        </p>
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" loading={create.isPending} disabled={resizing}>
          Añadir destino
        </Button>
      </form>
    </Container>
  );
}
