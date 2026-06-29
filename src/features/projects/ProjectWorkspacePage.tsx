import { useEffect, useMemo, useRef, useState, type DragEventHandler, type ReactNode } from "react";
import { addDays, parseISO } from "date-fns";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  GanttChartSquare,
  GripVertical,
  ImagePlus,
  Link2,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Table2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge, priorityTone, statusTone } from "@/components/shared/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_MEMBER_ROLE_LABELS, PROJECT_MEMBER_ROLES, canCommentOnIssue, canDeleteIssue, canUpdateIssue, normalizeProjectMemberRole, normalizeTimeEntryStatus } from "@/lib/permissions/policies";
import {
  ISSUE_STATUSES,
  PROJECT_STATUS_OPTIONS,
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
import type { Issue, Project, ProjectMember, ProjectMemberRole } from "@/types/domain";
import { parseScheduleFile, type ScheduleFileResult } from "@/services/scheduleFileService.js";

type WorkspaceTab = "overview" | "items" | "stakeholders" | "delivery" | "risk" | "settings";
const EMPTY_USER = "none";
const projectRoleFields = [
  { key: "commercialOwnerId", label: "商务" },
  { key: "projectManagerId", label: "项目经理" },
  { key: "designGroupId", label: "设计组" },
  { key: "contentGroupId", label: "内容组" },
  { key: "effectsGroupId", label: "特效组" },
  { key: "qaId", label: "QA" },
] as const;

const tabLabels: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "overview", label: "概览" },
  { value: "items", label: "工作项" },
  { value: "stakeholders", label: "相关方事项" },
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
  const [issueView, setIssueView] = useState<"list" | "board" | "table" | "gantt">("list");
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const stakeholderIssues = projectIssues.filter((issue) => isStakeholderIssue(issue));
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
        eyebrow={project.code || project.id}
        title={project.name}
        description={project.description || template.summary}
        actions={
          <>
            {permissions.canManageSchedule ? <Button variant="outline" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" />导入排期</Button> : null}
            {permissions.canCreateIssue ? <Button onClick={() => setCreateIssueOpen(true)}><Plus className="h-4 w-4" />新建事项</Button> : null}
            {permissions.canUpdate ? <Button variant="outline" size="icon" aria-label="编辑项目设置" onClick={() => setSettingsOpen(true)}><Edit3 className="h-4 w-4" /></Button> : null}
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
                  <TabsTrigger className="h-8 px-2" value="gantt"><GanttChartSquare className="h-4 w-4" /></TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </section>
          <WorkItemsPanel
            issues={filteredIssues}
            users={store.state.users}
            view={issueView}
            project={project}
            onOpenIssue={openIssue}
            onStatusChange={(issueId, nextStatus) => store.updateIssue(issueId, { status: nextStatus })}
            canManageSchedule={permissions.canManageSchedule}
          />
        </TabsContent>

        <TabsContent value="stakeholders" className="m-0">
          <StakeholderIssuesTab issues={stakeholderIssues} onOpenIssue={openIssue} />
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
            members={activeMembers}
            canUpdate={permissions.canUpdate}
            canDelete={permissions.canDelete}
            canManageMembers={permissions.canManageMembers}
            canManageRoles={permissions.canManageMemberRoles}
            costs={costs.length}
            onEdit={() => setSettingsOpen(true)}
            onDelete={deleteProject}
          />
        </TabsContent>
      </Tabs>

      <IssueDialog open={createIssueOpen} onOpenChange={setCreateIssueOpen} project={project} />
      <ScheduleImportDialog open={importOpen} onOpenChange={setImportOpen} project={project} />
      <IssueDetailSheet issue={selectedIssue} issues={projectIssues} users={store.state.users} open={Boolean(selectedIssue)} onOpenChange={(open) => !open && closeIssueSheet()} />
      <ProjectSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} project={project} members={activeMembers} canDelete={permissions.canDelete} canManageMembers={permissions.canManageMembers} canManageRoles={permissions.canManageMemberRoles} costs={costs.length} onDelete={deleteProject} />
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
          <h2 className="text-sm font-semibold">相关方事项</h2>
          <div className="mt-3 space-y-3">
            {issues.filter(isStakeholderIssue).slice(0, 4).map((issue) => (
              <button key={issue.id} type="button" className="w-full rounded-md border bg-background p-3 text-left hover:bg-muted/40" onClick={() => onOpenIssue(issue.id)}>
                <div className="flex items-center justify-between gap-2">
                  <strong className="line-clamp-1 text-sm">{issue.title}</strong>
                  <StatusBadge label={issue.status} tone={statusTone(issue.status)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{issueOwner(issue, []).label} · {dueLabel(issue.dueDate)}</p>
              </button>
            ))}
            {!issues.filter(isStakeholderIssue).length ? <p className="text-sm text-muted-foreground">导入 Timeline 后，客户、品牌方或第三方配合项会显示在这里。</p> : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

function WorkItemsPanel({
  issues,
  users,
  view,
  project,
  onOpenIssue,
  onStatusChange,
  canManageSchedule,
}: {
  issues: Issue[];
  users: Array<{ id: string; name: string; preferences?: { avatarUrl?: string } }>;
  view: "list" | "board" | "table" | "gantt";
  project: Project;
  onOpenIssue: (issueId: string) => void;
  onStatusChange: (issueId: string, status: string) => void;
  canManageSchedule: boolean;
}) {
  const [draggingIssueId, setDraggingIssueId] = useState("");
  if (!issues.length) {
    return <div className="min-w-0 p-4 md:p-6"><EmptyState title="没有匹配的事项" description="调整筛选条件，或使用上方的新建事项按钮创建任务。" /></div>;
  }
  if (view === "board") {
    return (
      <div className="min-w-0 overflow-x-auto p-4 md:p-6">
        <div className="grid min-w-[64rem] grid-cols-3 gap-4 xl:min-w-0 xl:grid-cols-3 2xl:grid-cols-6">
          {ISSUE_STATUSES.map((status) => {
            const columnIssues = issues.filter((issue) => issue.status === status);
            return (
              <section
                key={status}
                className="min-w-0 rounded-md border bg-card"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const issueId = event.dataTransfer.getData("text/plain") || draggingIssueId;
                  if (issueId) onStatusChange(issueId, status);
                  setDraggingIssueId("");
                }}
              >
                <header className="flex h-11 items-center justify-between border-b px-3">
                  <strong className="text-sm">{status}</strong>
                  <StatusBadge label={`${columnIssues.length}`} />
                </header>
                <div className="space-y-2 p-3">
                  {columnIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      users={users}
                      childCount={issues.filter((item) => item.parentIssueId === issue.id).length}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", issue.id);
                        setDraggingIssueId(issue.id);
                      }}
                      onOpen={() => onOpenIssue(issue.id)}
                    />
                  ))}
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
                  <TableCell className="font-medium">{displayIssueCode(issue)}</TableCell>
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
  if (view === "gantt") {
    return <GanttTab project={project} issues={issues} canManageSchedule={canManageSchedule} onOpenIssue={onOpenIssue} />;
  }
  return (
    <div className="min-w-0 p-4 md:p-6">
      <section className="min-w-0 overflow-hidden rounded-md border bg-card">
        <div className="divide-y">
          {issues.map((issue) => <IssueRow key={issue.id} issue={issue} users={users} childCount={issues.filter((item) => item.parentIssueId === issue.id).length} onOpen={() => onOpenIssue(issue.id)} />)}
        </div>
      </section>
    </div>
  );
}

function GanttTab({ project, issues, canManageSchedule, onOpenIssue }: { project: Project; issues: Issue[]; canManageSchedule: boolean; onOpenIssue: (issueId: string) => void }) {
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
  async function resizeOneDay(issue: Issue, edge: "start" | "end", offset: number) {
    if (!issue.startDate && !issue.dueDate) return;
    await store.updateIssue(issue.id, {
      startDate: edge === "start" && issue.startDate ? formatDate(addDays(parseISO(issue.startDate), offset)) : issue.startDate,
      dueDate: edge === "end" && issue.dueDate ? formatDate(addDays(parseISO(issue.dueDate), offset)) : issue.dueDate,
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
                    <small className="block truncate text-xs text-muted-foreground">{displayIssueCode(issue)} · {issue.ownerLabel || issue.owner || issue.scheduleOwners?.[0] || "未分配"} · {issue.next || "无依赖说明"}</small>
                  </span>
                  <span className="relative h-9 rounded-md bg-muted/70">
                    <span
                      draggable={canManageSchedule}
                      className={cn("absolute top-1 flex h-7 items-center justify-between overflow-hidden rounded-md bg-primary/75 shadow-sm", canManageSchedule && "cursor-grab active:cursor-grabbing", isIssueRisky(issue) && "bg-amber-500")}
                      style={ganttStyle(issue, projectStart, projectEnd, scale)}
                      onClick={(event) => event.stopPropagation()}
                      onDragEnd={(event) => {
                        event.preventDefault();
                        if (canManageSchedule) void shiftOneDay(issue);
                      }}
                    >
                      <span
                        className="h-full w-2 cursor-ew-resize bg-white/35"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canManageSchedule) void resizeOneDay(issue, "start", -1);
                        }}
                      />
                      <span className="min-w-0 truncate px-2 text-[11px] font-medium text-primary-foreground">{issue.title}</span>
                      <span
                        className="h-full w-2 cursor-ew-resize bg-white/35"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canManageSchedule) void resizeOneDay(issue, "end", 1);
                        }}
                      />
                    </span>
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

function MembersTab({ project, members, canManage, canManageRoles }: { project: Project; members: ProjectMember[]; canManage: boolean; canManageRoles: boolean }) {
  const store = useAppStore();
  const [userId, setUserId] = useState("none");
  const [role, setRole] = useState<ProjectMemberRole>("MEMBER");
  const availableUsers = store.state.users.filter((user) => user.status === "ACTIVE" && !members.some((member) => member.userId === user.id));
  async function addMember() {
    if (userId === "none") return;
    const ok = await store.addProjectMember(project.id, userId, role);
    if (ok) setUserId("none");
  }
  async function updateRole(member: ProjectMember, nextRole: string) {
    await store.updateProjectMemberRole(project.id, member.id, nextRole as ProjectMemberRole);
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
                  <TableCell>
                    {project.ownerId === member.userId ? (
                      "项目所有人"
                    ) : canManageRoles ? (
                      <Select value={normalizeProjectMemberRole(member.role)} onValueChange={(value) => updateRole(member, value)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_MEMBER_ROLES.map((item) => <SelectItem key={item} value={item}>{PROJECT_MEMBER_ROLE_LABELS[item]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      PROJECT_MEMBER_ROLE_LABELS[normalizeProjectMemberRole(member.role)]
                    )}
                  </TableCell>
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
          <Select value={role} onValueChange={(value) => setRole(value as ProjectMemberRole)} disabled={!canManageRoles}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_MEMBER_ROLES.map((item) => <SelectItem key={item} value={item}>{PROJECT_MEMBER_ROLE_LABELS[item]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!canManage || userId === "none"} onClick={addMember}>加入项目</Button>
        </div>
      </section>
    </div>
  );
}

function StakeholderIssuesTab({ issues, onOpenIssue }: { issues: Issue[]; onOpenIssue: (issueId: string) => void }) {
  return (
    <div className="min-w-0 p-4 md:p-6">
      <section className="min-w-0 rounded-md border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">相关方事项</h2>
          <p className="text-xs text-muted-foreground">客户、品牌方、第三方或其他非 Kivisense 配合事项会集中在这里。</p>
        </header>
        <div className="grid min-w-0 gap-3 p-4 md:grid-cols-3">
          {issues.map((issue) => (
            <button key={issue.id} type="button" className="min-w-0 rounded-md border bg-background p-4 text-left hover:border-primary/40 hover:shadow-sm" onClick={() => onOpenIssue(issue.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-semibold">{issue.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{displayIssueCode(issue)} · {issueOwner(issue, []).label}</p>
                </div>
                <StatusBadge label={issue.status} tone={statusTone(issue.status)} />
              </div>
              <p className="mt-4 line-clamp-3 min-h-12 text-sm text-muted-foreground">{issue.description || "等待相关方同步进展。"}</p>
              <p className="mt-4 text-xs text-muted-foreground">{issue.startDate || "未设置开始"} - {issue.dueDate || "未设置截止"}</p>
            </button>
          ))}
          {!issues.length ? <div className="md:col-span-3"><EmptyState title="暂无相关方事项" description="导入 Excel 排期后，非 Kivisense 相关方的配合事项会自动生成在这里。" /></div> : null}
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
  members,
  canUpdate,
  canDelete,
  canManageMembers,
  canManageRoles,
  costs,
  onEdit,
  onDelete,
}: {
  project: Project;
  members: ProjectMember[];
  canUpdate: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canManageRoles: boolean;
  costs: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const store = useAppStore();
  const [userId, setUserId] = useState("none");
  const [role, setRole] = useState<ProjectMemberRole>("MEMBER");
  const availableUsers = store.state.users.filter((user) => user.status === "ACTIVE" && !members.some((member) => member.userId === user.id));
  async function addMember() {
    if (userId === "none") return;
    const ok = await store.addProjectMember(project.id, userId, role);
    if (ok) setUserId("none");
  }
  async function updateRole(member: ProjectMember, nextRole: string) {
    await store.updateProjectMemberRole(project.id, member.id, nextRole as ProjectMemberRole);
  }
  return (
    <div className="grid min-w-0 gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <section className="min-w-0 rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">项目资料</h2>
          <Button variant="outline" size="sm" disabled={!canUpdate} onClick={onEdit}><Edit3 className="h-4 w-4" />编辑</Button>
        </div>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <Info label="项目名称" value={project.name} />
          <Info label="项目代码" value={project.code || project.id} />
          <Info label="状态" value={project.status} />
          <Info label="开始日期" value={project.startDate || "-"} />
          <Info label="上线日期" value={project.releaseDate || project.dueDate || "-"} />
        </dl>
        <Separator className="my-4" />
        <p className="text-sm text-muted-foreground">{project.description || "暂无项目概述。"}</p>
      </section>
      <section className="min-w-0 rounded-md border bg-card p-4">
        <h2 className="text-sm font-semibold">项目成员</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {members.map((member) => {
            const user = store.state.users.find((item) => item.id === member.userId);
            return (
              <div key={member.id} className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3">
                <Avatar className="size-7">
                  {user?.preferences?.avatarUrl ? <AvatarImage src={user.preferences.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs">{(user?.name || member.userId).slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{user?.name || member.userId}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          <Select value={userId} onValueChange={setUserId} disabled={!canManageMembers}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">从组织成员中选择</SelectItem>
              {availableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={(value) => setRole(value as ProjectMemberRole)} disabled={!canManageRoles}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_MEMBER_ROLES.map((item) => <SelectItem key={item} value={item}>{PROJECT_MEMBER_ROLE_LABELS[item]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!canManageMembers || userId === "none"} onClick={addMember}>加入项目</Button>
        </div>
        {members.length ? (
          <div className="mt-4 space-y-2">
            {members.map((member) => {
              const user = store.state.users.find((item) => item.id === member.userId);
              return (
                <div key={member.id} className="flex items-center gap-2 rounded-md border bg-background p-2">
                  <Avatar className="size-8">
                    {user?.preferences?.avatarUrl ? <AvatarImage src={user.preferences.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs">{(user?.name || member.userId).slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user?.name || member.userId}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email || PROJECT_MEMBER_ROLE_LABELS[normalizeProjectMemberRole(member.role)]}</p>
                  </div>
                  {project.ownerId === member.userId ? <Badge variant="secondary">所有人</Badge> : canManageRoles ? (
                    <Select value={normalizeProjectMemberRole(member.role)} onValueChange={(value) => updateRole(member, value)}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROJECT_MEMBER_ROLES.map((item) => <SelectItem key={item} value={item}>{PROJECT_MEMBER_ROLE_LABELS[item]}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <Badge variant="secondary">{PROJECT_MEMBER_ROLE_LABELS[normalizeProjectMemberRole(member.role)]}</Badge>}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      <section className="min-w-0 rounded-md border bg-card p-4 xl:col-start-2">
        <h2 className="text-sm font-semibold">管理操作</h2>
        <div className="mt-4 space-y-3">
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
    ownerLabel: "",
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
      ownerLabel: form.ownerLabel || owner?.name || "",
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
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>新建事项</DialogTitle>
          <DialogDescription>事项会继承当前项目的模板工作流和权限上下文。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4 md:grid-cols-2">
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
          <Field label="执行人显示"><Input value={form.ownerLabel} onChange={(event) => setForm({ ...form, ownerLabel: event.target.value })} placeholder="可填写客户、三方、Kivisense" /></Field>
          <Field label="开始日期"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="截止日期"><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="预估工时"><Input type="number" min="0" value={form.estimatedHours} onChange={(event) => setForm({ ...form, estimatedHours: event.target.value })} /></Field>
          <Field label="描述" className="md:col-span-2"><Textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!form.title.trim()} onClick={submit}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleImportDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project: Project }) {
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ScheduleFileResult | null>(null);
  const [parsing, setParsing] = useState(false);
  async function selectFile(file?: File) {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseScheduleFile(file);
      setParsed(result);
      if (result.errors.length) return;
      setText("");
    } finally {
      setParsing(false);
    }
  }
  async function submit() {
    const source = parsed?.tasks?.length ? parsed : text;
    const count = await store.importSchedule(project.id, source);
    if (count) onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>导入 Excel 表格</DialogTitle>
          <DialogDescription>支持横向 Timeline 色块表格。系统会生成 TASK 工作项和相关方事项。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <input ref={fileInputRef} className="hidden" type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json" onChange={(event) => selectFile(event.target.files?.[0])} />
          <button type="button" className="flex w-full items-center justify-between gap-3 rounded-md border border-dashed bg-background p-4 text-left hover:bg-muted/30" onClick={() => fileInputRef.current?.click()}>
            <span>
              <span className="block text-sm font-medium">选择 Excel / CSV 文件</span>
              <span className="mt-1 block text-xs text-muted-foreground">{parsed?.fileName || "参考附件格式：Model、Description、相关方列、月份/日期和色块排期。"}</span>
            </span>
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </button>
          {parsed ? (
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{parsed.sheetName || "Timeline"}</p>
                  <p className="text-xs text-muted-foreground">识别 {parsed.tasks.length} 条排期，导入时会按相关方拆分 TASK。</p>
                </div>
                <StatusBadge label={parsed.errors.length ? "需修正" : "可导入"} tone={parsed.errors.length ? "danger" : "success"} />
              </div>
              {parsed.errors.length ? <p className="mt-2 text-sm text-destructive">{parsed.errors[0].message}</p> : null}
              {parsed.warnings.length ? <p className="mt-2 text-xs text-muted-foreground">{parsed.warnings.slice(0, 2).join("；")}</p> : null}
              <div className="mt-3 max-h-44 overflow-y-auto rounded-md border bg-background">
                {parsed.tasks.slice(0, 8).map((task, index) => (
                  <div key={`${task.name}-${index}`} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{task.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{task.model || "Timeline"} · {(task.owners || []).join("、") || "未标注"}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{task.startDate} - {task.dueDate}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <Label className="mb-2 block">或粘贴表格文本</Label>
            <Textarea rows={7} value={text} onChange={(event) => { setText(event.target.value); setParsed(null); }} placeholder="Model,事项名称,相关方,开始日期,结束日期" />
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={parsing || Boolean(parsed?.errors.length) || (!parsed?.tasks?.length && !text.trim())}>{parsing ? "解析中" : "导入 TASK"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettingsSheet({
  open,
  onOpenChange,
  project,
  members,
  canDelete,
  canManageMembers,
  canManageRoles,
  costs,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  members: ProjectMember[];
  canDelete: boolean;
  canManageMembers: boolean;
  canManageRoles: boolean;
  costs: number;
  onDelete: () => void;
}) {
  const store = useAppStore();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const activeUsers = store.state.users.filter((user) => user.status === "ACTIVE");
  const [form, setForm] = useState({
    name: project.name || "",
    code: project.code || "",
    coverUrl: project.coverUrl || "",
    ownerId: project.ownerId || store.context.userId,
    status: project.status || "规划中",
    commercialOwnerId: project.commercialOwnerId || EMPTY_USER,
    projectManagerId: project.projectManagerId || EMPTY_USER,
    designGroupId: project.designGroupId || EMPTY_USER,
    contentGroupId: project.contentGroupId || EMPTY_USER,
    effectsGroupId: project.effectsGroupId || EMPTY_USER,
    qaId: project.qaId || EMPTY_USER,
    description: project.description || "",
    startDate: project.startDate || "",
    testDate: project.testDate || "",
    acceptanceDate: project.acceptanceDate || "",
    releaseDate: project.releaseDate || "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: project.name || "",
      code: project.code || "",
      coverUrl: project.coverUrl || "",
      ownerId: project.ownerId || store.context.userId,
      status: project.status || "规划中",
      commercialOwnerId: project.commercialOwnerId || EMPTY_USER,
      projectManagerId: project.projectManagerId || EMPTY_USER,
      designGroupId: project.designGroupId || EMPTY_USER,
      contentGroupId: project.contentGroupId || EMPTY_USER,
      effectsGroupId: project.effectsGroupId || EMPTY_USER,
      qaId: project.qaId || EMPTY_USER,
      description: project.description || "",
      startDate: project.startDate || "",
      testDate: project.testDate || "",
      acceptanceDate: project.acceptanceDate || "",
      releaseDate: project.releaseDate || "",
    });
  }, [open, project, store.context.userId]);

  async function submit() {
    if (!form.name.trim()) return;
    const saved = await store.updateProject(project.id, {
      ...form,
      commercialOwnerId: normalizeOptionalUserId(form.commercialOwnerId),
      projectManagerId: normalizeOptionalUserId(form.projectManagerId),
      designGroupId: normalizeOptionalUserId(form.designGroupId),
      contentGroupId: normalizeOptionalUserId(form.contentGroupId),
      effectsGroupId: normalizeOptionalUserId(form.effectsGroupId),
      qaId: normalizeOptionalUserId(form.qaId),
    });
    if (saved) onOpenChange(false);
  }

  async function selectCover(file?: File) {
    if (!file) return;
    const coverUrl = await resizeProjectCover(file);
    setForm((current) => ({ ...current, coverUrl }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl" showCloseButton>
        <SheetHeader className="border-b">
          <SheetTitle>项目设置</SheetTitle>
          <SheetDescription>编辑项目资料、角色字段和识别封面。</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="项目名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="项目代码"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
            <Field label="项目封面" className="md:col-span-2">
              <input ref={coverInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => selectCover(event.target.files?.[0])} />
              <div className="overflow-hidden rounded-md border bg-background">
                <div className="h-40 bg-muted">{form.coverUrl ? <img src={form.coverUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted-foreground">上传品牌或项目识别图</div>}</div>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs text-muted-foreground">项目列表卡片会优先使用这张图片。</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}><ImagePlus className="h-4 w-4" />替换图片</Button>
                </div>
              </div>
            </Field>
            <Field label="项目所有人">
              <UserSelect value={form.ownerId} users={activeUsers} onChange={(ownerId) => setForm({ ...form, ownerId })} allowEmpty={false} />
            </Field>
            <Field label="状态">
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {projectRoleFields.map((field) => (
              <Field key={field.key} label={field.label}>
                <UserSelect value={form[field.key]} users={activeUsers} onChange={(value) => setForm({ ...form, [field.key]: value })} />
              </Field>
            ))}
            <Field label="开始日期"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
            <Field label="测试日期"><Input type="date" value={form.testDate} onChange={(event) => setForm({ ...form, testDate: event.target.value })} /></Field>
            <Field label="验收日期"><Input type="date" value={form.acceptanceDate} onChange={(event) => setForm({ ...form, acceptanceDate: event.target.value })} /></Field>
            <Field label="上线日期"><Input type="date" value={form.releaseDate} onChange={(event) => setForm({ ...form, releaseDate: event.target.value })} /></Field>
            <Field label="项目描述" className="md:col-span-2"><Textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>

          <Separator className="my-5" />
          <div>
            <h3 className="text-sm font-semibold">成员</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {members.map((member) => {
                const user = store.state.users.find((item) => item.id === member.userId);
                return (
                  <span key={member.id} className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3">
                    <Avatar className="size-7">
                      {user?.preferences?.avatarUrl ? <AvatarImage src={user.preferences.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-xs">{(user?.name || member.userId).slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{user?.name || member.userId}</span>
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{canManageMembers || canManageRoles ? "成员加入和角色调整也可以在项目设置页完成。" : "你当前没有成员管理权限。"}</p>
          </div>
        </div>
        <SheetFooter className="flex shrink-0 flex-col gap-2 border-t sm:flex-row sm:justify-between">
          <Button variant="destructive" disabled={!canDelete || costs > 0} onClick={onDelete}><Trash2 className="h-4 w-4" />删除项目</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={submit} disabled={!form.name.trim()}>保存设置</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function IssueDetailSheet({
  issue,
  issues,
  users,
  open,
  onOpenChange,
}: {
  issue?: Issue;
  issues: Issue[];
  users: Array<{ id: string; name: string; email?: string; preferences?: { avatarUrl?: string } }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useAppStore();
  const [comment, setComment] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [linkChildId, setLinkChildId] = useState("none");
  const [form, setForm] = useState(issueForm(issue));
  useEffect(() => {
    setForm(issueForm(issue));
    setComment("");
    setSubtaskTitle("");
    setLinkChildId("none");
  }, [issue?.id]);
  if (!issue) return null;
  const activeIssue = issue;
  const project = store.state.projects.find((item) => item.id === activeIssue.projectId);
  const canEdit = canUpdateIssue(store.context, activeIssue, project, store.state.projectMembers);
  const canRemove = canDeleteIssue(store.context, activeIssue, project, store.state.projectMembers);
  const canComment = canCommentOnIssue(store.context, activeIssue, project, store.state.projectMembers);
  const ownerOptions = store.state.users.filter((user) => user.status === "ACTIVE");
  const children = issues.filter((item) => item.parentIssueId === activeIssue.id);
  const possibleParents = issues.filter((item) => item.id !== activeIssue.id && item.parentIssueId !== activeIssue.id);
  const linkableChildren = issues.filter((item) => item.id !== activeIssue.id && item.parentIssueId !== activeIssue.id);
  async function saveIssue() {
    if (!canEdit) return;
    const owner = ownerOptions.find((user) => user.id === form.ownerId);
    await store.updateIssue(activeIssue.id, {
      ...form,
      ownerId: owner?.id || null,
      owner: owner?.name || form.ownerLabel || "未分配",
      ownerLabel: form.ownerLabel || owner?.name || "",
      estimatedHours: Number(form.estimatedHours || 0),
      actualHours: Number(form.actualHours || 0),
      parentIssueId: form.parentIssueId === "none" ? null : form.parentIssueId,
    });
  }
  async function deleteIssue() {
    if (!canRemove) return;
    const ok = window.confirm(`确认删除事项「${activeIssue.title}」？`);
    if (!ok) return;
    const deleted = await store.deleteIssue(activeIssue.id);
    if (deleted) onOpenChange(false);
  }
  async function submitComment() {
    if (!comment.trim() || !canComment) return;
    const ok = await store.addIssueComment(activeIssue.id, comment);
    if (ok) setComment("");
  }
  async function createSubtask() {
    if (!subtaskTitle.trim() || !canEdit || !project) return;
    const created = await store.createIssue(project.id, {
      title: subtaskTitle.trim(),
      type: "任务",
      status: "未开始",
      priority: activeIssue.priority,
      parentIssueId: activeIssue.id,
      ownerLabel: form.ownerLabel,
      ownerId: form.ownerId === "none" ? null : form.ownerId,
      startDate: activeIssue.startDate,
      dueDate: activeIssue.dueDate,
      estimatedHours: 4,
      description: `父任务：${activeIssue.title}`,
    });
    if (created) setSubtaskTitle("");
  }
  async function linkChild() {
    if (linkChildId === "none" || !canEdit) return;
    const linked = await store.updateIssue(linkChildId, { parentIssueId: activeIssue.id });
    if (linked) setLinkChildId("none");
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl" showCloseButton>
        <SheetHeader className="border-b">
          <SheetTitle className="pr-10">{displayIssueCode(issue)} · {issue.title}</SheetTitle>
          <SheetDescription>{project?.name || "未知项目"} · {issue.type} · 任何状态都可编辑</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
            <StatusBadge label={issue.status} tone={statusTone(issue.status)} />
            {issue.parentIssueId ? <StatusBadge label="子任务" tone="info" /> : <StatusBadge label={`${children.length} 个子任务`} />}
            {daysUntil(issue.dueDate) < 0 ? <StatusBadge label={`逾期 ${Math.abs(daysUntil(issue.dueDate))} 天`} tone="danger" /> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="任务名称" className="sm:col-span-2">
              <Input value={form.title} disabled={!canEdit} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label="类型">
              <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{getTemplateById(project?.templateId).issueTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="状态">
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{ISSUE_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="优先级">
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as Issue["priority"] })} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{["P0", "P1", "P2", "P3"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="组织成员">
              <Select value={form.ownerId || "none"} onValueChange={(value) => {
                const owner = ownerOptions.find((user) => user.id === value);
                setForm({ ...form, ownerId: value, ownerLabel: owner?.name || form.ownerLabel });
              }} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分配</SelectItem>
                  {ownerOptions.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="执行人显示">
              <Input value={form.ownerLabel} disabled={!canEdit} onChange={(event) => setForm({ ...form, ownerLabel: event.target.value })} placeholder="可填写 Kivisense、客户、三方等" />
            </Field>
            <Field label="父任务">
              <Select value={form.parentIssueId || "none"} onValueChange={(value) => setForm({ ...form, parentIssueId: value })} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无父任务</SelectItem>
                  {possibleParents.map((item) => <SelectItem key={item.id} value={item.id}>{displayIssueCode(item)} · {item.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="开始日期"><Input type="date" value={form.startDate} disabled={!canEdit} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
            <Field label="截止日期"><Input type="date" value={form.dueDate} disabled={!canEdit} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
            <Field label="预估工时"><Input type="number" min="0" value={form.estimatedHours} disabled={!canEdit} onChange={(event) => setForm({ ...form, estimatedHours: event.target.value })} /></Field>
            <Field label="实际工时"><Input type="number" min="0" value={form.actualHours} disabled={!canEdit} onChange={(event) => setForm({ ...form, actualHours: event.target.value })} /></Field>
            <Field label="简单任务描述" className="sm:col-span-2"><Textarea rows={4} value={form.description} disabled={!canEdit} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">子任务 / 关联任务</h3>
                <p className="text-xs text-muted-foreground">可以直接创建子任务，或将已有任务关联到当前任务下。</p>
              </div>
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input value={subtaskTitle} disabled={!canEdit} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="新建子任务名称" />
              <Button variant="outline" disabled={!canEdit || !subtaskTitle.trim()} onClick={createSubtask}><Plus className="h-4 w-4" />创建子任务</Button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={linkChildId} onValueChange={setLinkChildId} disabled={!canEdit}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择已有任务作为子任务</SelectItem>
                  {linkableChildren.map((item) => <SelectItem key={item.id} value={item.id}>{displayIssueCode(item)} · {item.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={!canEdit || linkChildId === "none"} onClick={linkChild}>关联</Button>
            </div>
            <div className="mt-4 space-y-2">
              {children.map((child) => (
                <button key={child.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-left hover:bg-muted/40" onClick={() => store.updateIssue(child.id, { parentIssueId: issue.id })}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{child.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{displayIssueCode(child)} · {issueOwner(child, users).label}</span>
                  </span>
                  <StatusBadge label={child.status} tone={statusTone(child.status)} />
                </button>
              ))}
              {!children.length ? <p className="text-sm text-muted-foreground">暂无子任务。</p> : null}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold">评论</h3>
            {canComment ? (
              <div className="mt-2 space-y-2">
                <Textarea rows={3} placeholder="添加评论或同步风险处理进展" value={comment} onChange={(event) => setComment(event.target.value)} />
                <Button size="sm" onClick={submitComment} disabled={!comment.trim()}>添加评论</Button>
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {(issue.comments || []).map((item) => {
                const authorName = item.actor || item.authorName || "成员";
                const author = users.find((user) => user.id === item.authorId || user.name === authorName);
                return (
                  <div key={item.id} className="flex gap-3 rounded-md border bg-card p-3 text-sm">
                    <Avatar className="size-8">
                      {author?.preferences?.avatarUrl ? <AvatarImage src={author.preferences.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-xs">{authorName.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="text-sm">{authorName}</strong>
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.at || item.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                );
              })}
              {!issue.comments?.length ? <p className="text-sm text-muted-foreground">暂无评论。</p> : null}
            </div>
          </section>
        </div>
        <SheetFooter className="flex shrink-0 items-center justify-between gap-3 border-t">
          {canRemove ? <Button variant="destructive" onClick={deleteIssue}><Trash2 className="h-4 w-4" />删除事项</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
            <Button disabled={!canEdit || !form.title.trim()} onClick={saveIssue}>保存任务</Button>
          </div>
        </SheetFooter>
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

function IssueRow({ issue, users = [], childCount = 0, onOpen }: { issue: Issue; users?: Array<{ id: string; name: string; preferences?: { avatarUrl?: string } }>; childCount?: number; onOpen?: () => void }) {
  const owner = issueOwner(issue, users);
  return (
    <button type="button" className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50", issue.parentIssueId && "bg-muted/20 pl-8")} onClick={onOpen}>
      <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          {issue.parentIssueId ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">子任务</span> : null}
          <strong className="line-clamp-1 text-sm">{issue.title}</strong>
        </span>
        <small className="mt-1 block text-xs text-muted-foreground">{displayIssueCode(issue)} · {issue.type} · {owner.label} · {dueLabel(issue.dueDate)}{childCount ? ` · ${childCount} 个子任务` : ""}</small>
        {issue.description ? <span className="mt-1 line-clamp-1 text-xs text-muted-foreground">{issue.description}</span> : null}
      </span>
      <Avatar className="size-7 shrink-0">
        {owner.avatarUrl ? <AvatarImage src={owner.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs">{owner.label.slice(0, 1) || "未"}</AvatarFallback>
      </Avatar>
      <StatusBadge label={issue.status} tone={statusTone(issue.status)} className="hidden sm:inline-flex" />
    </button>
  );
}

function IssueCard({
  issue,
  users,
  childCount = 0,
  draggable,
  onDragStart,
  onOpen,
}: {
  issue: Issue;
  users: Array<{ id: string; name: string; preferences?: { avatarUrl?: string } }>;
  childCount?: number;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLButtonElement>;
  onOpen: () => void;
}) {
  const owner = issueOwner(issue, users);
  return (
    <button
      type="button"
      draggable={draggable}
      className={cn(
        "w-full rounded-md border bg-background p-3 text-left shadow-xs transition hover:border-primary/40 hover:shadow-sm",
        draggable && "cursor-grab active:cursor-grabbing",
        issue.parentIssueId ? "border-dashed bg-muted/20" : "border-solid",
      )}
      onClick={onOpen}
      onDragStart={onDragStart}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={issue.priority} tone={priorityTone(issue.priority)} />
          <StatusBadge label={issue.type} />
          {issue.parentIssueId ? <StatusBadge label="子任务" tone="info" /> : null}
        </div>
        {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      <strong className="line-clamp-2 text-sm">{issue.title}</strong>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{issue.description || issue.next || "暂无任务描述。"}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-7">
            {owner.avatarUrl ? <AvatarImage src={owner.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{owner.label.slice(0, 1) || "未"}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{owner.label}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{dueLabel(issue.dueDate)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{displayIssueCode(issue)}</span>
        {childCount ? <span>{childCount} 个子任务</span> : null}
      </div>
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

function displayIssueCode(issue: Issue) {
  const suffix = String(issue.code || issue.id).split("-").at(-1) || "";
  if (/^(ISS|AGL|WAT)-/i.test(issue.code || "")) return `TASK-${suffix}`;
  return issue.code || `TASK-${suffix}`;
}

function issueOwner(issue: Issue, users: Array<{ id: string; name: string; preferences?: { avatarUrl?: string } }>) {
  const user = users.find((item) => item.id === issue.ownerId);
  const label = issue.ownerLabel || issue.owner || user?.name || issue.scheduleOwners?.[0] || "未分配";
  return { label, avatarUrl: user?.preferences?.avatarUrl || "" };
}

function isStakeholderIssue(issue: Issue) {
  const owners = issue.scheduleOwners || [];
  return issue.type === "相关方事项" || owners.some((owner) => owner && owner !== "Kivisense");
}

function issueForm(issue?: Issue) {
  return {
    title: issue?.title || "",
    type: issue?.type || "任务",
    status: issue?.status || ISSUE_STATUSES[0],
    priority: issue?.priority || "P2",
    ownerId: issue?.ownerId || "none",
    ownerLabel: issue?.ownerLabel || issue?.owner || issue?.scheduleOwners?.[0] || "",
    parentIssueId: issue?.parentIssueId || "none",
    startDate: issue?.startDate || "",
    dueDate: issue?.dueDate || "",
    estimatedHours: String(issue?.estimatedHours || 0),
    actualHours: String(issue?.actualHours || 0),
    description: issue?.description || "",
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (item: number) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function UserSelect({ value, users, onChange, allowEmpty = true }: { value: string; users: { id: string; name: string }[]; onChange: (value: string) => void; allowEmpty?: boolean }) {
  return (
    <Select value={value || EMPTY_USER} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={EMPTY_USER}>未设置</SelectItem> : null}
        {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function normalizeOptionalUserId(value: string) {
  return value === EMPTY_USER ? null : value;
}

function resizeProjectCover(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 360;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("无法处理项目封面。"));
          return;
        }
        const targetRatio = canvas.width / canvas.height;
        const sourceRatio = image.width / image.height;
        const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
        const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
        const sourceX = (image.width - sourceWidth) / 2;
        const sourceY = (image.height - sourceHeight) / 2;
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("无法读取项目封面。"));
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
