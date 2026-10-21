import { Link, Outlet } from "react-router";

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-10 bg-slate-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <Link to="/" className="text-lg font-semibold">
          ⛷️ Ski Friends
        </Link>
      </header>
      <main className="flex-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  );
}
