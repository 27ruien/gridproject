import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

export function StatusBadge({ label, tone = "neutral", className }: { label: string; tone?: keyof typeof toneClass; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md px-2 text-[12px] font-medium", toneClass[tone], className)}>
      {label}
    </Badge>
  );
}

export function priorityTone(priority?: string): keyof typeof toneClass {
  if (priority === "P0") return "danger";
  if (priority === "P1") return "warn";
  if (priority === "P2") return "info";
  return "neutral";
}

export function statusTone(status?: string): keyof typeof toneClass {
  if (["已完成", "已验收", "APPROVED"].includes(status || "")) return "success";
  if (["进行中", "联调中", "SUBMITTED"].includes(status || "")) return "info";
  if (["已暂停", "REJECTED"].includes(status || "")) return "warn";
  return "neutral";
}
