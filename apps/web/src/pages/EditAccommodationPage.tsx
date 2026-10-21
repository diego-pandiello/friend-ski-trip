import type { AccommodationView } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, Card, ConfirmButton, ErrorMessage, Field, Input, Loading, PageTitle, Textarea } from "../components/ui.tsx";
import { resizeImage } from "../image.ts";

export function EditAccommodationPage() {
  const { accommodationId = "" } = useParams();
  const accommodation = useQuery({
    queryKey: ["accommodation", accommodationId],
    queryFn: () => api<AccommodationView>(`/accommodations/${accommodationId}`),
  });
  if (accommodation.isPending) return <Loading />;
  if (accommodation.error) return <ErrorMessage error={accommodation.error} />;
  return <EditAccommodationForm accommodation={accommodation.data} />;
}

type NumberField = "beds" | "bedrooms" | "bathrooms" | "distanceKm" | "totalPrice";

const toInput = (n: number | null) => (n == null ? "" : String(n));
const toNumber = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

function EditAccommodationForm({ accommodation: a }: { accommodation: AccommodationView }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const back = `/d/${a.destinationId}`;
  const [name, setName] = useState(a.name ?? "");
  const [description, setDescription] = useState(a.description ?? "");
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({
    beds: toInput(a.beds),
    bedrooms: toInput(a.bedrooms),
    bathrooms: toInput(a.bathrooms),
    distanceKm: toInput(a.distanceKm),
    totalPrice: toInput(a.totalPrice),
  });

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["destination", a.destinationId] });
    await queryClient.invalidateQueries({ queryKey: ["trip"] });
    navigate(back, { replace: true });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        ...Object.fromEntries(Object.entries(numbers).map(([k, v]) => [k, toNumber(v)])),
      };
      return api(`/accommodations/${a.id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api(`/accommodations/${a.id}`, { method: "DELETE" }), onSuccess: done });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("screenshot", await resizeImage(file, 1568, 0.85));
      return api(`/accommodations/${a.id}/screenshot`, { method: "POST", body });
    },
    onSuccess: done,
  });

  const numberInput = (field: NumberField, label: string, decimal = false) => (
    <Field label={label}>
      <Input
        inputMode={decimal ? "decimal" : "numeric"}
        value={numbers[field]}
        onChange={(e) => setNumbers((n) => ({ ...n, [field]: e.target.value }))}
      />
    </Field>
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <>
      <PageTitle back={back}>Editar alojamiento</PageTitle>
      <Card className="mb-6 space-y-2">
        <p className="text-sm text-slate-600">
          {a.hasScreenshot
            ? "Este alojamiento ya tiene una captura. Si subes otra, se volverán a extraer los datos."
            : "Sube una captura del anuncio donde se vea el precio total y se volverán a extraer los datos."}
        </p>
        <Input type="file" accept="image/*" aria-label="Subir captura del anuncio" disabled={upload.isPending} onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        <ErrorMessage error={upload.error} />
      </Card>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {numberInput("bedrooms", "Habitaciones")}
          {numberInput("beds", "Camas")}
          {numberInput("bathrooms", "Baños")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {numberInput("distanceKm", "Distancia a pistas (km)", true)}
          {numberInput("totalPrice", "Precio total estancia (€)", true)}
        </div>
        <ErrorMessage error={save.error ?? remove.error} />
        <Button type="submit" className="w-full" disabled={save.isPending}>
          Guardar
        </Button>
        <ConfirmButton onConfirm={() => remove.mutate()} disabled={remove.isPending} confirmLabel="Sí, borrar el alojamiento">
          Borrar alojamiento
        </ConfirmButton>
      </form>
    </>
  );
}
