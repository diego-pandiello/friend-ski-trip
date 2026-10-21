import type { AccommodationView } from "@ski/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, ErrorMessage, Field, Input, Loading, PageTitle } from "../components/ui.tsx";
import { resizeImage } from "../image.ts";
import { useParticipant } from "../participant.ts";
import { useDestination } from "./DestinationPage.tsx";

export function NewAccommodationPage() {
  const { destinationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const destination = useDestination(destinationId);
  const [participant] = useParticipant(destination.data?.trip.id ?? "");
  const [url, setUrl] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (!screenshot) return setPreview(null);
    const objectUrl = URL.createObjectURL(screenshot);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [screenshot]);

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

  async function pickScreenshot(file: File | undefined) {
    if (!file) return;
    setResizing(true);
    try {
      // 1568 px es el tamaño máximo que Claude usa; más grande no mejora la lectura
      setScreenshot(await resizeImage(file, 1568, 0.85));
    } finally {
      setResizing(false);
    }
  }

  if (destination.isPending) return <Loading />;
  if (destination.error) return <ErrorMessage error={destination.error} />;
  if (!participant) return <Navigate to={`/t/${destination.data.trip.id}/join`} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <>
      <PageTitle back={`/d/${destinationId}`}>Nuevo alojamiento</PageTitle>
      <p className="-mt-2 mb-4 text-slate-500">{destination.data.name}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Enlace de Booking o Airbnb" hint="Búscalo con las fechas del viaje y el nº de personas, y comparte el enlace.">
          <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.es/rooms/…" required />
        </Field>
        <Field
          label="Captura del anuncio (opcional)"
          hint="Haz una captura de pantalla donde se vea el precio total. En Booking es necesaria para obtener los datos."
        >
          {preview && <img src={preview} alt="Captura del anuncio" className="mb-2 max-h-80 rounded-xl ring-1 ring-slate-200" />}
          <Input type="file" accept="image/*" onChange={(e) => pickScreenshot(e.target.files?.[0])} />
        </Field>
        {screenshot && (
          <Button type="button" variant="secondary" onClick={() => setScreenshot(null)}>
            Quitar captura
          </Button>
        )}
        <ErrorMessage error={create.error} />
        <Button type="submit" className="w-full" disabled={create.isPending || resizing}>
          Añadir alojamiento
        </Button>
      </form>
    </>
  );
}
