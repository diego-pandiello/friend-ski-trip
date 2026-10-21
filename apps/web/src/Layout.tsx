import { MountainSnow } from "lucide-react";
import { Link, Outlet, ScrollRestoration } from "react-router";
import { Container } from "./components/ui.tsx";

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Container className="flex h-16 items-center">
          <Link to="/" className="flex items-center gap-1.5 text-accent">
            <MountainSnow className="size-7" strokeWidth={2.25} aria-hidden />
            <span className="text-[22px] font-extrabold tracking-tight">skifriends</span>
          </Link>
        </Container>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
