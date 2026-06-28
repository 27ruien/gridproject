import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 border-b bg-background px-4 py-4 md:flex-row md:items-end md:justify-between md:px-6", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-[24px] font-semibold leading-tight tracking-normal">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
