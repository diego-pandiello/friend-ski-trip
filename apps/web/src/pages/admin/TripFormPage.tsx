import { tripDays, type TripSummary } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../../api.ts";
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
} from "../../components/ui.tsx";
import { resizeImage } from "../../image.ts";
import { useAdminSession } from "./AdminPage.tsx";

type FormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  skiDays: string;
  travelers: string;
};

const empty: FormState = { title: "", description: "", startDate: "", endDate: "", skiDays: "", travelers: "" };

export function TripFormPage() {
  const { tripId } = useParams();
  const session = useAdminSession();
  const trip = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => api<TripSummary>(`/trips/${tripId}`),
    enabled: !!tripId,
  });

  if (session.isPending || (tripId && trip.isPending)) return <Loading />;
  if (!session.data?.admin) return <Navigate to="/admin" replace />;
  if (trip.error)
    return (
      <Container narrow className="py-8">
        <ErrorMessage error={trip.error} />
      </Container>
    );
  return <TripForm trip={trip.data} />;
}

function TripForm({ trip }: { trip?: TripSummary }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(
    trip ? { ...trip, skiDays: String(trip.skiDays), travelers: String(trip.travelers) } : empty,
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [resizing, setResizing] = useState(false);

  const days = form.startDate && form.endDate && form.endDate > form.startDate ? tripDays(form.startDate, form.endDate) : null;

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["trips"] });
    await queryClient.invalidateQueries({ queryKey: ["trip"] });
    navigate("/admin");
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.set(k, v);
      if (photo) body.set("photo", photo);
      else if (removePhoto) body.set("removePhoto", "1");
      return api<TripSummary>(trip ? `/admin/trips/${trip.id}` : "/admin/trips", {
        method: trip ? "PUT" : "POST",
        body,
      });
    },
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => api(`/admin/trips/${trip!.id}`, { method: "DELETE" }),
    onSuccess: done,
  });

  async function pickPhoto(file: File) {
    setResizing(true);
    try {
      setPhoto(await resizeImage(file));
      setRemovePhoto(false);
    } finally {
      setResizing(false);
    }
  }

  function set<K extends keyof FormState>(key: K) {
    return (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Container narrow className="py-6 md:py-10">
      <PageHeader back="/admin" title={trip ? "Editar viaje" : "Nuevo viaje"} />
      <form onSubmit={submit} className="space-y-6">
        <ImagePicker
          label="Foto de portada"
          file={photo}
          currentUrl={removePhoto ? null : trip?.photoUrl}
          onPick={pickPhoto}
          onClear={() => {
            setPhoto(null);
            setRemovePhoto(true);
          }}
          busy={resizing}
          aspect="aspect-[4/3]"
        />
        <Field label="Título">
          <Input value={form.title} onChange={set("title")} required maxLength={120} />
        </Field>
        <Field label="Descripción">
          <Textarea value={form.description} onChange={set("description")} maxLength={5000} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <Input type="date" value={form.startDate} onChange={set("startDate")} required />
          </Field>
          <Field label="Fin">
            <Input type="date" value={form.endDate} onChange={set("endDate")} min={form.startDate} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Días de esquí" hint={days ? `El viaje dura ${days} días` : undefined}>
            <Input type="number" inputMode="numeric" min={1} max={days ?? undefined} value={form.skiDays} onChange={set("skiDays")} required />
          </Field>
          <Field label="Viajeros">
            <Input type="number" inputMode="numeric" min={1} value={form.travelers} onChange={set("travelers")} required />
          </Field>
        </div>
        <ErrorMessage error={save.error ?? remove.error} />
        <Button type="submit" variant="dark" className="w-full" loading={save.isPending} disabled={resizing}>
          {trip ? "Guardar cambios" : "Crear viaje"}
        </Button>
        {trip && (
          <ConfirmButton onConfirm={() => remove.mutate()} loading={remove.isPending} confirmLabel="Sí, borrar el viaje">
            Borrar viaje
          </ConfirmButton>
        )}
      </form>
    </Container>
  );
}
