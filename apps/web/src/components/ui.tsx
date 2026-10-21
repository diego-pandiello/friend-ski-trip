import { ArrowLeft, Camera, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Container({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cx("mx-auto w-full px-5 md:px-10", narrow ? "max-w-xl" : "max-w-6xl", className)}>{children}</div>;
}

// ---- Botones ----

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/40",
  dark: "bg-ink text-white hover:bg-black disabled:bg-ink/40",
  secondary: "bg-white text-ink ring-1 ring-ink/80 ring-inset hover:bg-soft disabled:text-muted disabled:ring-line",
  ghost: "text-ink underline underline-offset-4 hover:bg-soft disabled:text-muted",
  danger: "bg-white text-accent-strong ring-1 ring-accent/50 ring-inset hover:bg-accent-soft",
};

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={cx(buttonBase, variants[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link to={to} className={cx(buttonBase, variants[variant], className)}>
      {children}
    </Link>
  );
}

/** Botón redondo blanco que flota sobre fotos (volver, editar…), como en Airbnb. */
export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid size-9 place-items-center rounded-full bg-white/95 text-ink shadow-chip transition hover:scale-105 active:scale-95",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Borrado en dos pasos, sin diálogos del navegador. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Sí, borrar",
  loading,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button type="button" variant="danger" className="w-full" onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  return (
    <div className="flex animate-rise gap-2">
      <Button type="button" className="flex-1" onClick={onConfirm} loading={loading}>
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setAsking(false)}>
        Cancelar
      </Button>
    </div>
  );
}

// ---- Formularios ----

const inputClass =
  "w-full rounded-xl border border-[#b0b0b0] bg-white px-4 py-3 text-base text-ink placeholder:text-[#9a9a9a] outline-none transition focus:border-ink focus:ring-1 focus:ring-ink";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={inputClass} rows={4} {...props} />;
}

/** Selector de imagen con vista previa (fotos y capturas). */
export function ImagePicker({
  label,
  hint,
  file,
  currentUrl,
  onPick,
  onClear,
  busy,
  aspect = "aspect-video",
}: {
  label: string;
  hint?: string;
  file: File | null;
  currentUrl?: string | null;
  onPick: (file: File) => void;
  onClear?: () => void;
  busy?: boolean;
  aspect?: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shown = preview ?? currentUrl ?? null;

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold">{label}</span>
      {shown ? (
        <div className={cx("relative overflow-hidden rounded-2xl bg-soft", aspect)}>
          <img src={shown} alt="" className="size-full object-cover object-top" />
          <div className="absolute top-3 right-3 flex gap-2">
            <label htmlFor={id} className="cursor-pointer rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold shadow-chip">
              Cambiar
            </label>
            {onClear && (
              <IconButton label="Quitar imagen" onClick={onClear}>
                <X className="size-4" />
              </IconButton>
            )}
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-soft/60 px-4 py-8 text-center transition hover:border-ink/40",
          )}
        >
          {busy ? <LoaderCircle className="size-7 animate-spin text-muted" /> : <Camera className="size-7 text-muted" strokeWidth={1.75} />}
          <span className="text-[15px] font-semibold">{busy ? "Procesando…" : "Elegir imagen"}</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {hint && <span className="block text-[13px] leading-snug text-muted">{hint}</span>}
    </div>
  );
}

// ---- Estructura ----

/** Cabecera de página con botón de volver redondo. */
export function PageHeader({ title, back, subtitle }: { title: ReactNode; back?: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-6 animate-rise md:mb-8">
      {back && (
        <Link
          to={back}
          aria-label="Volver"
          className="-ml-1 mb-4 grid size-9 place-items-center rounded-full transition hover:bg-soft"
        >
          <ArrowLeft className="size-5" />
        </Link>
      )}
      <h1 className="text-[26px] leading-tight font-bold tracking-tight md:text-[32px]">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}

/** Barra de acción fija abajo en móvil (como el "Reservar" de Airbnb). En escritorio no se muestra. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </>
  );
}

export function Pill({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "warn" | "busy" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold shadow-chip",
        tone === "light" && "bg-white/95 text-ink",
        tone === "warn" && "bg-accent text-white",
        tone === "busy" && "bg-white/95 text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "warn" }) {
  return (
    <div
      role="alert"
      className={cx(
        "flex gap-3 rounded-2xl p-4 text-[15px]",
        tone === "error" ? "bg-accent-soft text-accent-strong" : "bg-amber-50 text-amber-900",
      )}
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return <Alert>{error instanceof Error ? error.message : String(error)}</Alert>;
}

const AVATAR_COLORS = ["#d72c3a", "#0e7490", "#7c3aed", "#b45309", "#15803d", "#be185d", "#1d4ed8"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden
      style={{ backgroundColor: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-bold text-white uppercase",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
      )}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

/** Esqueleto de carga para listas de tarjetas. */
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <div className="skeleton aspect-[20/19] rounded-2xl" />
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

export function Loading() {
  return (
    <Container className="py-8">
      <div className="skeleton mb-6 h-8 w-1/2 rounded-lg" />
      <CardsSkeleton />
    </Container>
  );
}

/** Retardo escalonado para animar la entrada de listas. */
export const stagger = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 60}ms` });
