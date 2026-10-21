import { MountainSnow } from "lucide-react";
import { ButtonLink, Container } from "../components/ui.tsx";

export function NotFoundPage() {
  return (
    <Container narrow className="py-16 text-center">
      <MountainSnow className="mx-auto size-12 text-[#c4c4c4]" strokeWidth={1.5} aria-hidden />
      <h1 className="mt-4 text-[26px] font-bold tracking-tight">Fuera de pista</h1>
      <p className="mt-1 text-muted">Esta página no existe.</p>
      <ButtonLink to="/" variant="dark" className="mt-6">
        Volver al inicio
      </ButtonLink>
    </Container>
  );
}
