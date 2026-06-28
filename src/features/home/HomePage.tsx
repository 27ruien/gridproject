import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, startOfWeek } from "date-fns";
import { ArrowRight, CalendarClock, FolderKanban, Plus, TimerReset } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectCard } from "@/components/shared/project-card";
import { StatusBadge, priorityTone } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { visibleProjectsForUser } from "@/lib/permissions/policies";
import { daysUntil, isClosedStatus, monthWorkdays, priorityWeight, round, summarizeProject } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";

export function HomePage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [dueScope, setDueScope] = useState(store.currentUser?.preferences?.homeDueRange || "all");
  const visibleProjects = useMemo(() => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers), [store.context, store.state.projects, store.state.projectMembers]);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const openIssues = store.state.issues.filter((issue) => visibleProjectIds.has(issue.projectId) && !isClosedStatus(issue.status));
  const dueIssues = openIssues
    .filter((issue) => issue.dueDate && daysUntil(issue.dueDate) <= 7)
    .filter((issue) => {
      if (dueScope === "mine") return issue.ownerId === store.context.userId || issue.owner === store.currentUser?.name;
      if (dueScope === "others") return issue.ownerId !== store.context.userId && issue.owner !== store.currentUser?.name;
      return true;
    })
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate) || priorityWeight(a.priority) - priorityWeight(b.priority));
  const prioritizedProjects = [...visibleProjects]
    .sort((a, b) => summarizeProject(b, store.state.issues.filter((issue) => issue.projectId === b.id)).riskCount - summarizeProject(a, store.state.issues.filter((issue) => issue.projectId === a.id)).riskCount)
    .slice(0, 6);
  const currentMonth = format(new Date(), "yyyy-MM");
  const targetHours = monthWorkdays(currentMonth).filter((date) => date <= format(new Date(), "yyyy-MM-dd")).length * 8;
  const myMonthHours = store.state.timeEntries
    .filter((entry) => entry.userId === store.context.userId && (entry.workDate || "").startsWith(currentMonth) && !["DRAFT", "草稿"].includes(String(entry.status)))
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MM-dd")} - ${format(addDays(weekStart, 4), "MM-dd")}`;
  const userName = store.currentUser?.name || "成员";
  const greetingText = greeting();

  return (
    <div className="min-w-0">
      <section className="border-b bg-background px-4 py-4 md:px-6">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-2xl text-primary">{timeEmoji()}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{format(new Date(), "yyyy年M月d日")} · {format(new Date(), "HH:mm")}</p>
              <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-normal">工作台</h1>
              <p className="mt-1 text-sm text-muted-foreground">{greetingText}，{userName} {greetingEmoji()} · {dailyPrompt()}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" asChild><Link to="/timesheets"><CalendarClock className="h-4 w-4" />补工时</Link></Button>
            <Button onClick={() => navigate("/projects")}><FolderKanban className="h-4 w-4" />项目列表</Button>
          </div>
        </div>
      </section>
      <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">我的项目</h2>
              <p className="text-sm text-muted-foreground">优先显示存在风险、临近上线或最近有动作的项目。</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>查看全部<ArrowRight className="h-4 w-4" /></Button>
          </div>
          {prioritizedProjects.length ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {prioritizedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  issues={store.state.issues.filter((issue) => issue.projectId === project.id)}
                  owner={store.state.users.find((user) => user.id === project.ownerId)}
                  onOpen={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="暂无可访问项目" description="加入项目后会在这里显示你的项目工作流。" />
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <Card size="sm">
            <div className="flex flex-col gap-3 px-[var(--card-spacing)] sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">即将到期</h2>
                <p className="text-xs text-muted-foreground">逾期、今天、明天和 7 天内事项</p>
              </div>
              <Tabs value={dueScope} onValueChange={(value) => setDueScope(value as typeof dueScope)}>
                <TabsList className="h-8">
                  <TabsTrigger className="h-7 px-2 text-xs" value="all">全部</TabsTrigger>
                  <TabsTrigger className="h-7 px-2 text-xs" value="mine">我的</TabsTrigger>
                  <TabsTrigger className="h-7 px-2 text-xs" value="others">他人</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="divide-y">
              {dueIssues.slice(0, 8).map((issue) => (
                <button key={issue.id} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50" type="button" onClick={() => navigate(`/projects/${issue.projectId}?issue=${issue.id}`)}>
                  <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
                  <span className="min-w-0 flex-1">
                    <strong className="line-clamp-1 text-sm">{issue.title}</strong>
                    <small className="mt-1 block text-xs text-muted-foreground">{projectName(issue.projectId, store.state.projects)} · {dueText(issue.dueDate)} · {issue.owner || "未分配"}</small>
                  </span>
                </button>
              ))}
              {!dueIssues.length ? <div className="p-4"><EmptyState title="暂无待关注事项" description="当前没有需要在 7 天内处理的可见事项。" /></div> : null}
            </div>
          </Card>

          <Card size="sm">
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">我的工时</h2>
                  <p className="text-xs text-muted-foreground">{weekLabel} · 本月目标按工作日计算</p>
                </div>
                <Button variant="outline" size="sm" asChild><Link to="/timesheets"><Plus className="h-4 w-4" />填报</Link></Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-background p-3">
                  <CalendarClock className="mb-2 h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">本月已提交</p>
                  <strong className="text-xl">{round(myMonthHours, 1)}h</strong>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <TimerReset className="mb-2 h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">待补工时</p>
                  <strong className="text-xl">{Math.max(0, targetHours - myMonthHours)}h</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function greetingEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return "☀️";
  if (hour < 18) return "🌤️";
  return "🌙";
}

function timeEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return "☀️";
  if (hour < 18) return "⚡";
  return "🌙";
}

function dailyPrompt() {
  const hour = new Date().getHours();
  if (hour < 12) return "先挑一件最重要的事，把今天开个好头。";
  if (hour < 18) return "适合收拢进度、处理协作卡点，然后稳稳推进。";
  return "把今天的项目推进和工时补齐，给自己一个清爽收尾。";
}

function dueText(value?: string) {
  const days = daysUntil(value);
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days === 1) return "明天到期";
  return `${days} 天后到期`;
}

function projectName(projectId: string, projects: Array<{ id: string; name: string }>) {
  return projects.find((project) => project.id === projectId)?.name || "未知项目";
}
