import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  onAction,
  className,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-44 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 p-8 text-center", className)}>
      <Inbox className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <Button size="sm" onClick={onAction}>{action}</Button> : null}
    </div>
  );
}
