import { CalendarDays, MoreHorizontal, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/status";
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
      <CardContent className="pointer-events-none relative z-20 flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge label={project.status} tone={summary.overdueCount ? "warn" : "neutral"} />
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
            <span className="flex min-w-0 items-center gap-1 truncate"><UsersRound className="h-3.5 w-3.5 shrink-0" />{owner?.name || project.owner || "未设置负责人"}</span>
            <span className="flex min-w-0 items-center gap-1 truncate"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{project.releaseDate || project.dueDate || "未设置上线"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
