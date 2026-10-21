import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useState } from "react";
import { Link } from "react-router";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-sky-700 text-white active:bg-sky-800 disabled:bg-sky-300",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 active:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-600 text-white active:bg-red-700 disabled:bg-red-300",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({ to, children, variant = "primary" }: { to: string; children: ReactNode; variant?: Variant }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium ${variants[variant]}`}
    >
      {children}
    </Link>
  );
}

/** Botón de borrado en dos pasos, sin diálogos del navegador. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Sí, borrar",
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button type="button" variant="secondary" className="text-red-700" onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </Button>
    );
  return (
    <div className="flex gap-2">
      <Button type="button" variant="danger" className="flex-1" onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setAsking(false)}>
        Cancelar
      </Button>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={inputClass} rows={4} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function Loading() {
  return <p className="py-8 text-center text-slate-500">Cargando…</p>;
}

export function PageTitle({ children, back }: { children: ReactNode; back?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link to={back} aria-label="Volver" className="-ml-2 rounded-lg px-2 py-1 text-2xl text-slate-500">
          ‹
        </Link>
      )}
      <h1 className="text-2xl font-bold">{children}</h1>
    </div>
  );
}
