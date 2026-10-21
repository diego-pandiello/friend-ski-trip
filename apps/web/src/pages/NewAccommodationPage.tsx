import type { AccommodationView } from "@ski/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, Container, ErrorMessage, Field, ImagePicker, Input, Loading, PageHeader } from "../components/ui.tsx";
import { resizeImage } from "../image.ts";
import { useParticipant } from "../participant.ts";
import { useDestination } from "./DestinationPage.tsx";

/** 1568 px es el tamaño máximo que Claude usa; más grande no mejora la lectura. */
export const resizeScreenshot = (file: File) => resizeImage(file, 1568, 0.85);

export function NewAccommodationPage() {
  const { destinationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const destination = useDestination(destinationId);
  const [participant] = useParticipant(destination.data?.trip.id ?? "");
  const [url, setUrl] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [resizing, setResizing] = useState(false);

  const create = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.set("url", url.trim());
      if (participant) body.set("participantId", participant.id);
      if (screenshot) body.set("screenshot", screenshot);
      return api<AccommodationView>(`/destinations/${destinationId}/accommodations`, { method: "POST", body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["destination", destinationId] });
      navigate(`/d/${destinationId}`);
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

  if (destination.isPending) return <Loading />;
  if (destination.error)
    return (
      <Container narrow className="py-8">
        <ErrorMessage error={destination.error} />
      </Container>
    );
  if (!participant) return <Navigate to={`/t/${destination.data.trip.id}/join`} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Container narrow className="py-6 md:py-10">
      <PageHeader back={`/d/${destinationId}`} title="Nuevo alojamiento" subtitle={destination.data.name} />
      <form onSubmit={submit} className="space-y-6">
        <Field label="Enlace de Booking o Airbnb" hint="Búscalo con las fechas del viaje y el número de personas, y comparte el enlace.">
          <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.es/rooms/…" required />
        </Field>
        <ImagePicker
          label="Captura del anuncio (opcional)"
          hint="Una captura de pantalla donde se vea el precio total. En Booking es necesaria para obtener los datos."
          file={screenshot}
          onPick={pickScreenshot}
          onClear={() => setScreenshot(null)}
          busy={resizing}
          aspect="aspect-[3/4] max-h-96"
        />
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" loading={create.isPending} disabled={resizing}>
          Añadir alojamiento
        </Button>
      </form>
    </Container>
  );
}
