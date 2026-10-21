import { tripDays, type TripSummary } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../../api.ts";
import { Button, ConfirmButton, ErrorMessage, Field, Input, Loading, PageTitle, Textarea } from "../../components/ui.tsx";
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
  if (trip.error) return <ErrorMessage error={trip.error} />;
  return <TripForm trip={trip.data} />;
}

function TripForm({ trip }: { trip?: TripSummary }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(
    trip
      ? { ...trip, skiDays: String(trip.skiDays), travelers: String(trip.travelers) }
      : empty,
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(trip?.photoUrl ?? null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

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

  const [resizing, setResizing] = useState(false);
  async function pickPhoto(file: File | undefined) {
    if (!file) return;
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
    <>
      <PageTitle back="/admin">{trip ? "Editar viaje" : "Nuevo viaje"}</PageTitle>
      <form onSubmit={submit} className="space-y-4">
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
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={days ?? undefined}
              value={form.skiDays}
              onChange={set("skiDays")}
              required
            />
          </Field>
          <Field label="Viajeros">
            <Input type="number" inputMode="numeric" min={1} value={form.travelers} onChange={set("travelers")} required />
          </Field>
        </div>
        <Field label="Foto">
          {preview && !removePhoto && <img src={preview} alt="" className="mb-2 aspect-video w-full rounded-xl object-cover" />}
          <Input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </Field>
        {preview && !removePhoto && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPhoto(null);
              setPreview(null);
              setRemovePhoto(true);
            }}
          >
            Quitar foto
          </Button>
        )}
        <ErrorMessage error={save.error ?? remove.error} />
        <Button type="submit" className="w-full" disabled={save.isPending || resizing}>
          {trip ? "Guardar cambios" : "Crear viaje"}
        </Button>
        {trip && (
          <ConfirmButton onConfirm={() => remove.mutate()} disabled={remove.isPending} confirmLabel="Sí, borrar el viaje">
            Borrar viaje
          </ConfirmButton>
        )}
      </form>
    </>
  );
}
