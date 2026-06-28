import { useMemo, useState, type ReactNode } from "react";
import { addDays, parseISO } from "date-fns";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GanttChartSquare,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Settings,
  Table2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge, priorityTone, statusTone } from "@/components/shared/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { normalizeTimeEntryStatus } from "@/lib/permissions/policies";
import {
  ISSUE_STATUSES,
  daysUntil,
  formatDate,
  getTemplateById,
  isClosedStatus,
  isIssueRisky,
  priorityWeight,
  round,
  summarizeProject,
} from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";
import type { Issue, Project, ProjectMember } from "@/types/domain";
import { ProjectDialog } from "./ProjectLibraryPage";

type WorkspaceTab = "overview" | "items" | "gantt" | "members" | "milestones" | "delivery" | "risk" | "settings";

const tabLabels: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "overview", label: "概览" },
  { value: "items", label: "工作项" },
  { value: "gantt", label: "甘特图" },
  { value: "members", label: "成员" },
  { value: "milestones", label: "里程碑" },
  { value: "delivery", label: "交付与验收" },
  { value: "risk", label: "风险" },
  { value: "settings", label: "项目设置" },
];

export function ProjectWorkspacePage() {
  const store = useAppStore();
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [issueView, setIssueView] = useState<"list" | "board" | "table">("list");
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const project = store.state.projects.find((item) => item.id === projectId);
  const permissions = store.getProjectPermissions(projectId);
  const template = getTemplateById(project?.templateId);
  const selectedIssue = store.state.issues.find((issue) => issue.id === searchParams.get("issue"));

  const projectIssues = useMemo(
    () => store.state.issues.filter((issue) => issue.projectId === projectId && !issue.deletedAt),
    [projectId, store.state.issues],
  );
  const filteredIssues = projectIssues
    .filter((issue) => status === "all" || issue.status === status)
    .filter((issue) => !query.trim() || `${issue.code} ${issue.title} ${issue.owner} ${issue.type}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || daysUntil(a.dueDate) - daysUntil(b.dueDate));

  if (!project) return <Navigate to="/404" replace />;
  if (!permissions.canView) return <Navigate to="/forbidden" replace />;

  const activeMembers = store.state.projectMembers.filter((member) => member.projectId === project.id && member.status === "ACTIVE");
  const summary = summarizeProject(project, projectIssues);
  const costs = store.state.costRecords.filter((record) => record.projectId === project.id && record.status === "ACTIVE");
  const projectEntries = store.state.timeEntries.filter((entry) => entry.projectId === project.id && !entry.deletedAt);
  const totalApprovedHours = projectEntries
    .filter((entry) => ["SUBMITTED", "APPROVED"].includes(normalizeTimeEntryStatus(entry.status)))
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

  function closeIssueSheet() {
    const next = new URLSearchParams(searchParams);
    next.delete("issue");
    setSearchParams(next, { replace: true });
  }

  function openIssue(issueId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("issue", issueId);
    setSearchParams(next);
  }

  async function deleteProject() {
    if (!project) return;
    const ok = window.confirm(`确认删除项目「${project.name}」？请先确保任务已迁移或删除。`);
    if (!ok) return;
    const deleted = await store.deleteProject(project.id);
    if (deleted) navigate("/projects");
  }

  return (
    <div className="min-w-0">
      <PageHeading
        eyebrow={`${template.badge} · ${project.code || project.id}`}
        title={project.name}
        description={project.description || template.summary}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" />导入排期</Button>
            <Button onClick={() => setCreateIssueOpen(true)}><Plus className="h-4 w-4" />新建事项</Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)} className="min-w-0">
        <div className="min-w-0 border-b bg-background px-4 py-2 md:px-6">
          <TabsList className="h-auto min-h-9 w-full max-w-full justify-start overflow-x-auto bg-muted/70 p-1">
            {tabLabels.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="h-8 shrink-0 px-3 text-xs sm:text-sm">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0">
          <OverviewTab
            project={project}
            summary={summary}
            issues={projectIssues}
            memberCount={activeMembers.length}
            approvedHours={totalApprovedHours}
            onOpenIssue={openIssue}
          />
        </TabsContent>

        <TabsContent value="items" className="m-0">
          <section className="min-w-0 border-b bg-card px-4 py-3 md:px-6">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_auto_auto]">
              <label className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="min-w-0 pl-9" placeholder="搜索事项、负责人、类型" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {ISSUE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Tabs value={issueView} onValueChange={(value) => setIssueView(value as typeof issueView)}>
                <TabsList className="h-9">
                  <TabsTrigger className="h-8 px-2" value="list"><ListFilter className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger className="h-8 px-2" value="board"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                  <TabsTrigger className="h-8 px-2" value="table"><Table2 className="h-4 w-4" /></TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={() => setCreateIssueOpen(true)}><Plus className="h-4 w-4" />新建事项</Button>
            </div>
          </section>
          <WorkItemsPanel
            issues={filteredIssues}
            view={issueView}
            onOpenIssue={openIssue}
            onCreate={() => setCreateIssueOpen(true)}
          />
        </TabsContent>

        <TabsContent value="gantt" className="m-0">
          <GanttTab project={project} issues={projectIssues} onOpenIssue={openIssue} />
        </TabsContent>

        <TabsContent value="members" className="m-0">
          <MembersTab project={project} members={activeMembers} canManage={permissions.canManageMembers} />
        </TabsContent>

        <TabsContent value="milestones" className="m-0">
          <MilestonesTab project={project} canUpdate={permissions.canUpdate} />
        </TabsContent>

        <TabsContent value="delivery" className="m-0">
          <DeliveryTab project={project} issues={projectIssues} />
        </TabsContent>

        <TabsContent value="risk" className="m-0">
          <RiskTab project={project} issues={projectIssues} onOpenIssue={openIssue} />
        </TabsContent>

        <TabsContent value="settings" className="m-0">
          <SettingsTab
            project={project}
            canUpdate={permissions.canUpdate}
            canDelete={permissions.canDelete}
            costs={costs.length}
            onEdit={() => setProjectDialogOpen(true)}
            onDelete={deleteProject}
          />
        </TabsContent>
      </Tabs>

      <IssueDialog open={createIssueOpen} onOpenChange={setCreateIssueOpen} project={project} />
      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} project={project} />
      <IssueDetailSheet issue={selectedIssue} open={Boolean(selectedIssue)} onOpenChange={(open) => !open && closeIssueSheet()} />
      <ProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} project={project} />
    </div>
  );
}

function OverviewTab({
  project,
  summary,
  issues,
  memberCount,
  approvedHours,
  onOpenIssue,
}: {
  project: Project;
  summary: ReturnType<typeof summarizeProject>;
  issues: Issue[];
  memberCount: number;
  approvedHours: number;
  onOpenIssue: (issueId: string) => void;
}) {
  const risks = issues.filter(isIssueRisky);
  return (
    <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <section className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="项目进度" value={`${summary.progress}%`} detail={`${summary.doneCount}/${summary.totalCount} 完成`} icon={<CheckCircle2 className="h-4 w-4" />} />
          <Metric label="健康度" value={`${summary.health}`} detail={summary.riskCount ? `${summary.riskCount} 个风险` : "状态稳定"} icon={<AlertTriangle className="h-4 w-4" />} tone={summary.riskCount ? "warn" : "success"} />
          <Metric label="投入工时" value={`${round(approvedHours, 1)}h`} detail={`预估 ${summary.estimatedHours}h`} icon={<CalendarDays className="h-4 w-4" />} />
          <Metric label="成员" value={`${memberCount}`} detail={project.executionTeams.join(" / ") || "未设置团队"} icon={<UsersRound className="h-4 w-4" />} />
        </div>

        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">项目节奏</h2>
              <p className="text-xs text-muted-foreground">开始、测试、验收和上线节点</p>
            </div>
            <StatusBadge label={project.status} tone={statusTone(project.status)} />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <DateTile label="开始" value={project.startDate} />
            <DateTile label="测试" value={project.testDate} />
            <DateTile label="验收" value={project.acceptanceDate} />
            <DateTile label="上线" value={project.releaseDate || project.dueDate} />
          </div>
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">优先处理</h2>
              <p className="text-xs text-muted-foreground">按优先级和到期时间排序的未关闭事项</p>
            </div>
            <Progress value={summary.progress} className="h-2 w-28" />
          </div>
          <div className="divide-y">
            {summary.nextIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} onOpen={() => onOpenIssue(issue.id)} />
            ))}
            {!summary.nextIssues.length ? <EmptyState title="没有待处理事项" description="当前项目的工作项都已关闭或尚未创建。" /> : null}
          </div>
        </section>
      </section>

      <aside className="min-w-0 space-y-4">
        <section className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">风险摘要</h2>
          <div className="mt-4 space-y-3">
            <RiskLine label="逾期事项" value={summary.overdueCount} danger={summary.overdueCount > 0} />
            <RiskLine label="P0/风险类型" value={risks.length} danger={risks.length > 0} />
            <RiskLine label="排期临近" value={summary.scheduleRiskCount} danger={summary.scheduleRiskCount > 0} />
          </div>
        </section>
        <section className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">里程碑</h2>
          <div className="mt-3 space-y-3">
            {project.milestones.map((milestone) => (
              <div key={milestone.id || milestone.name} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{milestone.title || milestone.name}</strong>
                  <StatusBadge label={milestone.status} tone={statusTone(milestone.status)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{milestone.window || milestone.dueDate || "未设定时间"} · {milestone.focus || "等待补充目标"}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function WorkItemsPanel({
  issues,
  view,
  onOpenIssue,
  onCreate,
}: {
  issues: Issue[];
  view: "list" | "board" | "table";
  onOpenIssue: (issueId: string) => void;
  onCreate: () => void;
}) {
  if (!issues.length) {
    return <div className="min-w-0 p-4 md:p-6"><EmptyState title="没有匹配的事项" description="调整筛选条件，或新建一个任务、需求、风险或交付物。" action="新建事项" onAction={onCreate} /></div>;
  }
  if (view === "board") {
    return (
      <div className="min-w-0 overflow-x-auto p-4 md:p-6">
        <div className="grid min-w-[64rem] grid-cols-3 gap-4 xl:min-w-0 xl:grid-cols-3 2xl:grid-cols-6">
          {ISSUE_STATUSES.map((status) => {
            const columnIssues = issues.filter((issue) => issue.status === status);
            return (
              <section key={status} className="min-w-0 rounded-md border bg-card">
                <header className="flex h-11 items-center justify-between border-b px-3">
                  <strong className="text-sm">{status}</strong>
                  <StatusBadge label={`${columnIssues.length}`} />
                </header>
                <div className="space-y-2 p-3">
                  {columnIssues.map((issue) => <IssueCard key={issue.id} issue={issue} onOpen={() => onOpenIssue(issue.id)} />)}
                  {!columnIssues.length ? <p className="py-6 text-center text-xs text-muted-foreground">暂无事项</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }
  if (view === "table") {
    return (
      <div className="min-w-0 p-4 md:p-6">
        <div className="min-w-0 overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>截止</TableHead>
                <TableHead className="text-right">工时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.id} className="cursor-pointer" onClick={() => onOpenIssue(issue.id)}>
                  <TableCell className="font-medium">{issue.code}</TableCell>
                  <TableCell>{issue.title}</TableCell>
                  <TableCell>{issue.type}</TableCell>
                  <TableCell><StatusBadge label={issue.status} tone={statusTone(issue.status)} /></TableCell>
                  <TableCell>{issue.owner || "未分配"}</TableCell>
                  <TableCell>{dueLabel(issue.dueDate)}</TableCell>
                  <TableCell className="text-right">{Number(issue.actualHours || 0)}/{Number(issue.estimatedHours || 0)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0 p-4 md:p-6">
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <div className="divide-y">
          {issues.map((issue) => <IssueRow key={issue.id} issue={issue} onOpen={() => onOpenIssue(issue.id)} />)}
        </div>
      </section>
    </div>
  );
}

function GanttTab({ project, issues, onOpenIssue }: { project: Project; issues: Issue[]; onOpenIssue: (issueId: string) => void }) {
  const store = useAppStore();
  const [scale, setScale] = useState("week");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const datedIssues = issues
    .filter((issue) => issue.startDate || issue.dueDate)
    .filter((issue) => !query.trim() || `${issue.code} ${issue.title} ${issue.owner} ${issue.type}`.toLowerCase().includes(query.toLowerCase()));
  const visibleIssues = collapsed ? datedIssues.slice(0, 8) : datedIssues;
  const projectStart = project.startDate || datedIssues.map((issue) => issue.startDate || issue.dueDate || "").sort()[0] || "";
  const projectEnd = project.releaseDate || project.dueDate || datedIssues.map((issue) => issue.dueDate || issue.startDate || "").sort().at(-1) || projectStart;
  async function shiftOneDay(issue: Issue) {
    if (!issue.startDate && !issue.dueDate) return;
    await store.updateIssue(issue.id, {
      startDate: issue.startDate ? formatDate(addDays(parseISO(issue.startDate), 1)) : issue.startDate,
      dueDate: issue.dueDate ? formatDate(addDays(parseISO(issue.dueDate), 1)) : issue.dueDate,
    });
  }
  return (
    <div className="min-w-0 p-4 md:p-6">
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <header className="grid min-w-0 gap-3 border-b px-4 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)] xl:items-center">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">项目甘特图</h2>
            <p className="text-xs text-muted-foreground">{projectStart || "未设置开始"} 至 {projectEnd || "未设置结束"} · {scaleLabel(scale)} 视图</p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_140px_auto_auto]">
            <Input className="min-w-0" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选任务或负责人" />
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">按天</SelectItem>
                <SelectItem value="week">按周</SelectItem>
                <SelectItem value="month">按月</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "展开全部" : "折叠长列表"}</Button>
            <Button variant="outline" onClick={() => setQuery("")}>今天</Button>
          </div>
        </header>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[760px] p-4">
            <div className="grid grid-cols-[220px_minmax(420px,1fr)_120px] gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>事项</span>
              <span className="flex items-center gap-2"><GanttChartSquare className="h-4 w-4" />排期 · 条形可拖拽顺延 1 天</span>
              <span>状态</span>
            </div>
            <div className="divide-y">
              {visibleIssues.map((issue) => (
                <button key={issue.id} type="button" className="grid w-full min-w-0 grid-cols-[220px_minmax(420px,1fr)_120px] gap-3 py-3 text-left hover:bg-muted/40" onClick={() => onOpenIssue(issue.id)}>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{issue.title}</strong>
                    <small className="block truncate text-xs text-muted-foreground">{issue.code} · {issue.owner || "未分配"} · {issue.next || "无依赖说明"}</small>
                  </span>
                  <span className="relative h-8 rounded bg-muted">
                    <span
                      draggable
                      className={cn("absolute top-1 h-6 cursor-grab rounded bg-primary/75 active:cursor-grabbing", isIssueRisky(issue) && "bg-amber-500")}
                      style={ganttStyle(issue, projectStart, projectEnd, scale)}
                      onClick={(event) => event.stopPropagation()}
                      onDragEnd={(event) => {
                        event.preventDefault();
                        void shiftOneDay(issue);
                      }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-muted-foreground">{issue.startDate || "?"} - {issue.dueDate || "?"}</span>
                  </span>
                  <span><StatusBadge label={issue.status} tone={statusTone(issue.status)} /></span>
                </button>
              ))}
            </div>
            {!datedIssues.length ? <EmptyState title="暂无可排期事项" description="为事项补充开始日期和截止日期后，甘特图会自动展示。" /> : null}
            {collapsed && datedIssues.length > visibleIssues.length ? <p className="pt-3 text-center text-xs text-muted-foreground">已折叠 {datedIssues.length - visibleIssues.length} 个事项。</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function MembersTab({ project, members, canManage }: { project: Project; members: ProjectMember[]; canManage: boolean }) {
  const store = useAppStore();
  const [userId, setUserId] = useState("none");
  const availableUsers = store.state.users.filter((user) => user.status === "ACTIVE" && !members.some((member) => member.userId === user.id));
  async function addMember() {
    if (userId === "none") return;
    const ok = await store.addProjectMember(project.id, userId);
    if (ok) setUserId("none");
  }
  return (
    <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">项目成员</h2>
          <p className="text-xs text-muted-foreground">成员可访问项目并填报自己的工时。</p>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>加入时间</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const user = store.state.users.find((item) => item.id === member.userId);
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{user?.name || member.userId}</TableCell>
                  <TableCell>{user?.email || "-"}</TableCell>
                  <TableCell>{project.ownerId === member.userId ? "项目所有人" : user?.role === "ADMIN" ? "管理员" : "成员"}</TableCell>
                  <TableCell>{member.createdAt?.slice(0, 10) || "-"}</TableCell>
                  <TableCell>
                    {canManage && project.ownerId !== member.userId ? (
                      <Button size="icon" variant="ghost" aria-label="移除成员" onClick={() => store.removeProjectMember(project.id, member.id)}><Trash2 className="h-4 w-4" /></Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="min-w-0 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">添加成员</h2>
        <p className="mt-1 text-xs text-muted-foreground">仅项目所有人或管理员可以管理成员。</p>
        <div className="mt-4 space-y-3">
          <Select value={userId} onValueChange={setUserId} disabled={!canManage}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">选择成员</SelectItem>
              {availableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!canManage || userId === "none"} onClick={addMember}>加入项目</Button>
        </div>
      </section>
    </div>
  );
}

function MilestonesTab({ project, canUpdate }: { project: Project; canUpdate: boolean }) {
  const store = useAppStore();
  async function updateMilestone(index: number, status: string) {
    const milestones = project.milestones.map((milestone, itemIndex) => itemIndex === index ? { ...milestone, status, completedAt: status === "已完成" ? new Date().toISOString() : milestone.completedAt } : milestone);
    await store.updateProject(project.id, { milestones });
  }
  return (
    <div className="min-w-0 p-4 md:p-6">
      <section className="min-w-0 rounded-md border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">里程碑推进</h2>
          <p className="text-xs text-muted-foreground">根据项目模板生成，可随项目阶段更新状态。</p>
        </header>
        <div className="grid min-w-0 gap-3 p-4 md:grid-cols-3">
          {project.milestones.map((milestone, index) => (
            <article key={milestone.id || milestone.name} className="min-w-0 rounded-md border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{milestone.title || milestone.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{milestone.window || milestone.dueDate || "未设置窗口"}</p>
                </div>
                <StatusBadge label={milestone.status} tone={statusTone(milestone.status)} />
              </div>
              <p className="mt-4 min-h-10 text-sm text-muted-foreground">{milestone.focus || "等待补充重点。"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!canUpdate} onClick={() => updateMilestone(index, "进行中")}>进行中</Button>
                <Button size="sm" disabled={!canUpdate} onClick={() => updateMilestone(index, "已完成")}>完成</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DeliveryTab({ project, issues }: { project: Project; issues: Issue[] }) {
  const deliverables = issues.filter((issue) => /交付|验收|发布|上线|需求确认/.test(`${issue.type} ${issue.title}`));
  return (
    <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">交付节点</h2>
        <div className="mt-4 space-y-3">
          <DateTile label="测试" value={project.testDate} />
          <DateTile label="验收" value={project.acceptanceDate} />
          <DateTile label="上线" value={project.releaseDate || project.dueDate} />
        </div>
      </section>
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">交付与验收事项</h2>
          <p className="text-xs text-muted-foreground">从事项类型和标题中识别交付、验收、上线相关工作。</p>
        </header>
        <div className="divide-y">
          {deliverables.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
          {!deliverables.length ? <div className="p-4"><EmptyState title="暂无交付事项" description="新建交付物、验收项或上线任务后会显示在这里。" /></div> : null}
        </div>
      </section>
    </div>
  );
}

function RiskTab({ project, issues, onOpenIssue }: { project: Project; issues: Issue[]; onOpenIssue: (issueId: string) => void }) {
  const risky = issues.filter(isIssueRisky);
  const overdue = issues.filter((issue) => !isClosedStatus(issue.status) && daysUntil(issue.dueDate) < 0);
  return (
    <div className="min-w-0 p-4 md:p-6">
      {risky.length || overdue.length ? (
        <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{project.name} 当前有需要关注的风险</AlertTitle>
          <AlertDescription>优先处理逾期、P0 和风险类型事项，避免影响验收与上线窗口。</AlertDescription>
        </Alert>
      ) : null}
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">风险列表</h2>
          <p className="text-xs text-muted-foreground">包含 P0、风险类型、逾期和排期临近事项。</p>
        </header>
        <div className="divide-y">
          {[...new Map([...risky, ...overdue].map((issue) => [issue.id, issue])).values()].map((issue) => (
            <IssueRow key={issue.id} issue={issue} onOpen={() => onOpenIssue(issue.id)} />
          ))}
          {!risky.length && !overdue.length ? <div className="p-4"><EmptyState title="暂无明显风险" description="当前未发现 P0、逾期或风险类型事项。" /></div> : null}
        </div>
      </section>
    </div>
  );
}

function SettingsTab({
  project,
  canUpdate,
  canDelete,
  costs,
  onEdit,
  onDelete,
}: {
  project: Project;
  canUpdate: boolean;
  canDelete: boolean;
  costs: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <section className="min-w-0 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">项目资料</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <Info label="项目名称" value={project.name} />
          <Info label="项目代码" value={project.code || project.id} />
          <Info label="模板" value={getTemplateById(project.templateId).name} />
          <Info label="状态" value={project.status} />
          <Info label="开始日期" value={project.startDate || "-"} />
          <Info label="上线日期" value={project.releaseDate || project.dueDate || "-"} />
        </dl>
        <Separator className="my-4" />
        <p className="text-sm text-muted-foreground">{project.description || "暂无项目概述。"}</p>
      </section>
      <section className="min-w-0 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">管理操作</h2>
        <div className="mt-4 space-y-3">
          <Button className="w-full" disabled={!canUpdate} onClick={onEdit}><Settings className="h-4 w-4" />编辑项目</Button>
          <Button className="w-full" variant="outline" disabled><Download className="h-4 w-4" />导出项目快照</Button>
          <Button className="w-full" variant="destructive" disabled={!canDelete || costs > 0} onClick={onDelete}><Trash2 className="h-4 w-4" />删除项目</Button>
          {costs > 0 ? <p className="text-xs text-muted-foreground">项目存在成本记录，需先归档成本记录后再删除。</p> : null}
        </div>
      </section>
    </div>
  );
}

function IssueDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project: Project }) {
  const store = useAppStore();
  const template = getTemplateById(project.templateId);
  const [form, setForm] = useState({
    title: "",
    type: template.defaultIssueType,
    status: ISSUE_STATUSES[0],
    priority: "P2",
    ownerId: "none",
    startDate: project.startDate || "",
    dueDate: project.releaseDate || project.dueDate || "",
    estimatedHours: "8",
    description: "",
  });

  async function submit() {
    if (!form.title.trim()) return;
    const owner = store.state.users.find((user) => user.id === form.ownerId);
    const created = await store.createIssue(project.id, {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      priority: form.priority as Issue["priority"],
      ownerId: owner?.id || null,
      owner: owner?.name || "未分配",
      startDate: form.startDate,
      dueDate: form.dueDate,
      estimatedHours: Number(form.estimatedHours || 0),
      description: form.description,
    });
    if (created) {
      onOpenChange(false);
      setForm({ ...form, title: "", description: "" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建事项</DialogTitle>
          <DialogDescription>事项会继承当前项目的模板工作流和权限上下文。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="标题" className="md:col-span-2"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="类型">
            <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{template.issueTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="状态">
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ISSUE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="优先级">
            <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{["P0", "P1", "P2", "P3"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="负责人">
            <Select value={form.ownerId} onValueChange={(value) => setForm({ ...form, ownerId: value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分配</SelectItem>
                {store.state.users.filter((user) => user.status === "ACTIVE").map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="开始日期"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="截止日期"><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="预估工时"><Input type="number" min="0" value={form.estimatedHours} onChange={(event) => setForm({ ...form, estimatedHours: event.target.value })} /></Field>
          <Field label="描述" className="md:col-span-2"><Textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!form.title.trim()} onClick={submit}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleImportDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project: Project }) {
  const store = useAppStore();
  const [text, setText] = useState("需求模型\t客户需求确认书\t林夏\t2026-06-01\t2026-06-05\n开发模型\t联调与回归测试\t周程\t2026-06-06\t2026-06-10");
  async function submit() {
    const count = await store.importSchedule(project.id, text);
    if (count) onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入 Timeline 排期</DialogTitle>
          <DialogDescription>支持粘贴 TSV 或 CSV：模型、标题、负责人、开始日期、截止日期。</DialogDescription>
        </DialogHeader>
        <Textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>导入事项</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDetailSheet({ issue, open, onOpenChange }: { issue?: Issue; open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const [comment, setComment] = useState("");
  if (!issue) return null;
  const project = store.state.projects.find((item) => item.id === issue.projectId);
  const ownerOptions = store.state.users.filter((user) => user.status === "ACTIVE");
  async function update(patch: Partial<Issue>) {
    if (!issue) return;
    await store.updateIssue(issue.id, patch);
  }
  async function deleteIssue() {
    if (!issue) return;
    const ok = window.confirm(`确认删除事项「${issue.title}」？`);
    if (!ok) return;
    const deleted = await store.deleteIssue(issue.id);
    if (deleted) onOpenChange(false);
  }
  async function submitComment() {
    if (!issue || !comment.trim()) return;
    const ok = await store.addIssueComment(issue.id, comment);
    if (ok) setComment("");
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{issue.code} · {issue.title}</SheetTitle>
          <SheetDescription>{project?.name || "未知项目"} · {issue.type}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
            <StatusBadge label={issue.status} tone={statusTone(issue.status)} />
            {daysUntil(issue.dueDate) < 0 ? <StatusBadge label={`逾期 ${Math.abs(daysUntil(issue.dueDate))} 天`} tone="danger" /> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="状态">
              <Select value={issue.status} onValueChange={(value) => update({ status: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ISSUE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="优先级">
              <Select value={issue.priority} onValueChange={(value) => update({ priority: value as Issue["priority"] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{["P0", "P1", "P2", "P3"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="负责人">
              <Select value={issue.ownerId || "none"} onValueChange={(value) => {
                const owner = ownerOptions.find((user) => user.id === value);
                update({ ownerId: owner?.id || null, owner: owner?.name || "未分配" });
              }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分配</SelectItem>
                  {ownerOptions.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="截止日期"><Input type="date" value={issue.dueDate || ""} onChange={(event) => update({ dueDate: event.target.value })} /></Field>
          </div>
          <section>
            <h3 className="text-sm font-semibold">描述</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{issue.description || "暂无描述。"}</p>
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <Info label="预估工时" value={`${Number(issue.estimatedHours || 0)}h`} />
            <Info label="实际工时" value={`${Number(issue.actualHours || 0)}h`} />
            <Info label="开始日期" value={issue.startDate || "-"} />
            <Info label="截止日期" value={issue.dueDate || "-"} />
          </section>
          <section>
            <h3 className="text-sm font-semibold">评论</h3>
            <div className="mt-2 space-y-2">
              <Textarea rows={3} placeholder="添加评论或同步风险处理进展" value={comment} onChange={(event) => setComment(event.target.value)} />
              <Button size="sm" onClick={submitComment} disabled={!comment.trim()}>添加评论</Button>
            </div>
            <div className="mt-3 space-y-2">
              {(issue.comments || []).map((item) => (
                <div key={item.id} className="rounded-md border bg-card p-3 text-sm">
                  <p>{item.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.actor || "成员"} · {(item.at || item.createdAt || "").slice(0, 10)}</p>
                </div>
              ))}
            </div>
          </section>
          <Separator />
          <Button variant="destructive" onClick={deleteIssue}><Trash2 className="h-4 w-4" />删除事项</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, detail, icon, tone = "info" }: { label: string; value: string; detail: string; icon: ReactNode; tone?: "info" | "warn" | "success" }) {
  const toneClass = tone === "warn" ? "text-amber-700 bg-amber-50" : tone === "success" ? "text-emerald-700 bg-emerald-50" : "text-sky-700 bg-sky-50";
  return (
    <div className="rounded-md border bg-card p-4">
      <div className={cn("mb-3 grid h-8 w-8 place-items-center rounded-md", toneClass)}>{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-2xl">{value}</strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function IssueRow({ issue, onOpen }: { issue: Issue; onOpen?: () => void }) {
  return (
    <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={onOpen}>
      <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
      <span className="min-w-0 flex-1">
        <strong className="line-clamp-1 text-sm">{issue.title}</strong>
        <small className="mt-1 block text-xs text-muted-foreground">{issue.code} · {issue.type} · {issue.owner || "未分配"} · {dueLabel(issue.dueDate)}</small>
      </span>
      <StatusBadge label={issue.status} tone={statusTone(issue.status)} className="hidden sm:inline-flex" />
    </button>
  );
}

function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  return (
    <button type="button" className="w-full rounded-md border bg-background p-3 text-left transition hover:border-primary/40" onClick={onOpen}>
      <div className="mb-2 flex flex-wrap gap-2">
        <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
        <StatusBadge label={issue.type} />
      </div>
      <strong className="line-clamp-2 text-sm">{issue.title}</strong>
      <p className="mt-2 text-xs text-muted-foreground">{issue.code} · {issue.owner || "未分配"} · {dueLabel(issue.dueDate)}</p>
    </button>
  );
}

function DateTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-sm">{value || "未设置"}</strong>
      {value ? <p className="mt-1 text-xs text-muted-foreground">{dueLabel(value)}</p> : null}
    </div>
  );
}

function RiskLine({ label, value, danger }: { label: string; value: number; danger: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <StatusBadge label={String(value)} tone={danger ? "danger" : "success"} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function dueLabel(value?: string | null) {
  const days = daysUntil(value);
  if (!value) return "未设置截止";
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days === 1) return "明天到期";
  if (days < 9999) return `${days} 天后`;
  return value;
}

function ganttStyle(issue: Issue, projectStart: string, projectEnd: string, scale = "week") {
  const start = new Date(projectStart || issue.startDate || issue.dueDate || Date.now()).getTime();
  const end = new Date(projectEnd || issue.dueDate || issue.startDate || Date.now()).getTime();
  const itemStart = new Date(issue.startDate || issue.dueDate || projectStart || Date.now()).getTime();
  const itemEnd = new Date(issue.dueDate || issue.startDate || projectEnd || Date.now()).getTime();
  const span = Math.max(1, end - start);
  const left = Math.max(0, Math.min(96, ((itemStart - start) / span) * 100));
  const minimumWidth = scale === "day" ? 3 : scale === "month" ? 8 : 5;
  const width = Math.max(minimumWidth, Math.min(100 - left, ((Math.max(itemStart, itemEnd) - itemStart) / span) * 100 || 6));
  return { left: `${left}%`, width: `${width}%` };
}

function scaleLabel(scale: string) {
  return ({ day: "天", week: "周", month: "月" } as Record<string, string>)[scale] || "周";
}
