import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <Link to="/" className="text-sky-700 underline">
        Volver al inicio
      </Link>
    </section>
  );
}
