import type { DestinationDetail } from "@ski/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.ts";
import { Button, ConfirmButton, ErrorMessage, Field, Input, Loading, PageTitle } from "../components/ui.tsx";
import { useDestination } from "./DestinationPage.tsx";

export function EditDestinationPage() {
  const { destinationId = "" } = useParams();
  const destination = useDestination(destinationId);
  if (destination.isPending) return <Loading />;
  if (destination.error) return <ErrorMessage error={destination.error} />;
  return <EditDestinationForm destination={destination.data} />;
}

const toInput = (n: number | null) => (n == null ? "" : String(n));
/** "" -> no se envía; número -> se envía */
const toNumber = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

function EditDestinationForm({ destination: d }: { destination: DestinationDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(d.name ?? "");
  const [hours, setHours] = useState(d.driveMinutes == null ? "" : String(Math.floor(d.driveMinutes / 60)));
  const [minutes, setMinutes] = useState(d.driveMinutes == null ? "" : String(d.driveMinutes % 60));
  const [forfait, setForfait] = useState(toInput(d.forfaitPrice));

  const save = useMutation({
    mutationFn: () => {
      const h = toNumber(hours);
      const m = toNumber(minutes);
      const body = {
        name: name.trim() || undefined,
        driveMinutes: h == null && m == null ? undefined : (h ?? 0) * 60 + (m ?? 0),
        forfaitPrice: toNumber(forfait),
      };
      return api<DestinationDetail>(`/destinations/${d.id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["destination", d.id], data);
      await queryClient.invalidateQueries({ queryKey: ["trip", d.trip.id] });
      navigate(`/d/${d.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/destinations/${d.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip", d.trip.id] });
      navigate(`/t/${d.trip.id}`, { replace: true });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <>
      <PageTitle back={`/d/${d.id}`}>Editar destino</PageTitle>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Tiempo en coche desde Gijón">
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" inputMode="numeric" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="horas" aria-label="Horas" />
            <Input type="number" inputMode="numeric" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="minutos" aria-label="Minutos" />
          </div>
        </Field>
        <Field label={`Precio del forfait por persona (${d.trip.skiDays} días), en €`}>
          <Input inputMode="decimal" value={forfait} onChange={(e) => setForfait(e.target.value)} placeholder="Ej. 245" />
        </Field>
        <ErrorMessage error={save.error ?? remove.error} />
        <Button type="submit" className="w-full" disabled={save.isPending}>
          Guardar
        </Button>
        <ConfirmButton onConfirm={() => remove.mutate()} disabled={remove.isPending} confirmLabel="Sí, borrar el destino">
          Borrar destino
        </ConfirmButton>
      </form>
    </>
  );
}
