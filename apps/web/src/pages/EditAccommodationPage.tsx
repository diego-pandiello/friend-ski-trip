import type { AccommodationView } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import {
  Button,
  ConfirmButton,
  Container,
  ErrorMessage,
  Field,
  ImagePicker,
  Input,
  Loading,
  PageHeader,
  Textarea,
} from "../components/ui.tsx";
import { resizeScreenshot } from "./NewAccommodationPage.tsx";

export function EditAccommodationPage() {
  const { accommodationId = "" } = useParams();
  const accommodation = useQuery({
    queryKey: ["accommodation", accommodationId],
    queryFn: () => api<AccommodationView>(`/accommodations/${accommodationId}`),
  });
  if (accommodation.isPending) return <Loading />;
  if (accommodation.error)
    return (
      <Container narrow className="py-8">
        <ErrorMessage error={accommodation.error} />
      </Container>
    );
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
    await queryClient.invalidateQueries({ queryKey: ["accommodation", a.id] });
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
      body.set("screenshot", await resizeScreenshot(file));
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
    <Container narrow className="py-6 md:py-10">
      <PageHeader back={back} title="Editar alojamiento" subtitle={a.name} />

      <div className="mb-10 space-y-3 rounded-2xl bg-soft p-5">
        <ImagePicker
          label={a.hasScreenshot ? "Sustituir la captura del anuncio" : "Añadir una captura del anuncio"}
          hint="Al subirla se vuelven a extraer los datos, sobre todo el precio total."
          file={null}
          onPick={(file) => upload.mutate(file)}
          busy={upload.isPending}
        />
        <ErrorMessage error={upload.error} />
      </div>

      <form onSubmit={submit} className="space-y-6">
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
          {numberInput("distanceKm", "A pistas (km)", true)}
          {numberInput("totalPrice", "Precio total (€)", true)}
        </div>
        <ErrorMessage error={save.error ?? remove.error} />
        <Button type="submit" variant="dark" className="w-full" loading={save.isPending}>
          Guardar
        </Button>
        <ConfirmButton onConfirm={() => remove.mutate()} loading={remove.isPending} confirmLabel="Sí, borrar el alojamiento">
          Borrar alojamiento
        </ConfirmButton>
      </form>
    </Container>
  );
}
