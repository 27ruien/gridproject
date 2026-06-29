import { CalendarDays, MoreHorizontal, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, statusTone } from "@/components/shared/status";
import { summarizeProject } from "@/lib/state/calculations";
import type { Issue, Project, User } from "@/types/domain";

export function ProjectCard({
  project,
  issues,
  owner,
  onOpen,
  onEdit,
}: {
  project: Project;
  issues: Issue[];
  owner?: User;
  onOpen: () => void;
  onEdit?: () => void;
}) {
  const summary = summarizeProject(project, issues);
  return (
    <Card className="group relative min-w-0 transition-colors hover:ring-foreground/10" size="sm">
      <button type="button" className="absolute inset-0 z-10 rounded-[inherit]" aria-label={`打开项目 ${project.name}`} onClick={onOpen} />
      <div className="pointer-events-none relative z-20 h-28 overflow-hidden rounded-t-[inherit] border-b bg-muted">
        {project.coverUrl ? (
          <img src={project.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-end justify-between bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--accent)),hsl(var(--muted)))] p-4">
            <div className="min-w-0">
              <span className="text-3xl font-semibold text-primary/85">{project.name.slice(0, 2).toUpperCase()}</span>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{project.code || project.id}</p>
            </div>
            <Avatar className="size-10 border bg-background shadow-sm">
              <AvatarFallback className="bg-background text-xs text-muted-foreground">{owner?.name?.slice(0, 1) || project.owner?.slice(0, 1) || "项"}</AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
      <CardContent className="pointer-events-none relative z-20 flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge label={project.status} tone={summary.overdueCount ? "warn" : statusTone(project.status)} />
              {summary.riskCount ? <StatusBadge label={`风险 ${summary.riskCount}`} tone="danger" /> : null}
            </div>
            <h3 className="truncate text-base font-semibold">{project.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description || "暂无项目概述。"}</p>
          </div>
          {onEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="pointer-events-auto relative z-30" size="icon" variant="ghost" aria-label="项目操作"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}>打开项目</DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>编辑项目</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{project.code || project.id}</span>
            <span className="shrink-0">{summary.doneCount}/{summary.totalCount} 完成</span>
          </div>
          <Progress value={summary.progress} className="h-1.5" />
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1 truncate"><UsersRound className="h-3.5 w-3.5 shrink-0" />{owner?.name || project.owner || "未设置所有人"}</span>
            <span className="flex min-w-0 items-center gap-1 truncate"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{project.releaseDate || project.dueDate || "未设置上线"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
