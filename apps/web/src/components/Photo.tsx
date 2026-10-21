import type { LucideIcon } from "lucide-react";
import { MountainSnow } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./ui.tsx";

/** Foto con esquinas redondeadas, zoom suave al pasar el ratón y hueco neutro si no hay imagen. */
export function Photo({
  src,
  aspect = "aspect-[20/19]",
  className,
  icon: Icon = MountainSnow,
  busy,
  children,
}: {
  src: string | null;
  aspect?: string;
  className?: string;
  icon?: LucideIcon;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-2xl bg-soft", aspect, className)}>
      {busy ? (
        <div className="skeleton absolute inset-0" />
      ) : src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="grid size-full place-items-center">
          <Icon className="size-10 text-[#c4c4c4]" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      {children}
    </div>
  );
}
