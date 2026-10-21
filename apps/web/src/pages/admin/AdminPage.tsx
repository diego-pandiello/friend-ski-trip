import type { TripSummary } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../../api.ts";
import { Button, ButtonLink, Card, ErrorMessage, Field, Input, Loading, PageTitle } from "../../components/ui.tsx";
import { formatDateRange } from "../../format.ts";

export function useAdminSession() {
  return useQuery({ queryKey: ["admin-session"], queryFn: () => api<{ admin: boolean }>("/admin/session") });
}

export function AdminPage() {
  const session = useAdminSession();
  if (session.isPending) return <Loading />;
  if (session.error) return <ErrorMessage error={session.error} />;
  return session.data.admin ? <TripList /> : <LoginForm />;
}

function LoginForm() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api("/admin/login", { method: "POST", body: JSON.stringify({ user, password }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-session"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate();
  }

  return (
    <>
      <PageTitle>Administración</PageTitle>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Usuario">
          <Input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
        </Field>
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorMessage error={login.error} />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          Entrar
        </Button>
      </form>
    </>
  );
}

function TripList() {
  const queryClient = useQueryClient();
  const trips = useQuery({ queryKey: ["trips"], queryFn: () => api<TripSummary[]>("/trips") });
  const logout = useMutation({
    mutationFn: () => api("/admin/logout", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-session"] }),
  });

  return (
    <>
      <PageTitle>Viajes</PageTitle>
      <div className="space-y-3">
        <ButtonLink to="/admin/trips/new">+ Nuevo viaje</ButtonLink>
        {trips.isPending && <Loading />}
        <ErrorMessage error={trips.error} />
        {trips.data?.length === 0 && <p className="text-slate-500">Todavía no hay viajes.</p>}
        {trips.data?.map((t) => (
          <Link key={t.id} to={`/admin/trips/${t.id}`} className="block">
            <Card className="flex items-center gap-3">
              {t.photoUrl ? (
                <img src={t.photoUrl} alt="" className="size-14 rounded-xl object-cover" />
              ) : (
                <div className="grid size-14 place-items-center rounded-xl bg-slate-100 text-2xl">🏔️</div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="text-sm text-slate-500">
                  {formatDateRange(t.startDate, t.endDate)} · {t.travelers} viajeros
                </p>
              </div>
            </Card>
          </Link>
        ))}
        <Button variant="secondary" className="w-full" onClick={() => logout.mutate()}>
          Cerrar sesión
        </Button>
      </div>
    </>
  );
}
