import type { TripSummary } from "@ski/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api } from "../../api.ts";
import { Photo } from "../../components/Photo.tsx";
import { Button, ButtonLink, Container, ErrorMessage, Field, Input, Loading, PageHeader, stagger } from "../../components/ui.tsx";
import { formatDateRange } from "../../format.ts";

export function useAdminSession() {
  return useQuery({ queryKey: ["admin-session"], queryFn: () => api<{ admin: boolean }>("/admin/session") });
}

export function AdminPage() {
  const session = useAdminSession();
  if (session.isPending) return <Loading />;
  if (session.error)
    return (
      <Container narrow className="py-8">
        <ErrorMessage error={session.error} />
      </Container>
    );
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
    <Container narrow className="py-8 md:py-14">
      <PageHeader title="Administración" subtitle="Acceso solo para el organizador." />
      <form onSubmit={submit} className="space-y-5">
        <Field label="Usuario">
          <Input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorMessage error={login.error} />
        <Button type="submit" variant="dark" className="w-full" loading={login.isPending}>
          Entrar
        </Button>
      </form>
    </Container>
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
    <Container narrow className="py-8 md:py-14">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Viajes" subtitle="Crea y gestiona los viajes del grupo." />
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-ink"
        >
          <LogOut className="size-4" aria-hidden /> Salir
        </button>
      </div>
      <ButtonLink to="/admin/trips/new" variant="dark" className="w-full">
        <Plus className="size-4" /> Nuevo viaje
      </ButtonLink>
      <ErrorMessage error={trips.error} />
      {trips.data?.length === 0 && <p className="mt-6 text-muted">Todavía no hay viajes.</p>}
      <ul className="mt-6 divide-y divide-line border-y border-line empty:hidden">
        {trips.data?.map((t, i) => (
          <li key={t.id} className="animate-rise" style={stagger(i)}>
            <Link to={`/admin/trips/${t.id}`} className="flex items-center gap-4 py-4 transition hover:bg-soft/70">
              <Photo src={t.photoUrl} aspect="aspect-square" className="w-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="text-[15px] text-muted">
                  {formatDateRange(t.startDate, t.endDate)} · {t.travelers} viajeros
                </p>
              </div>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
