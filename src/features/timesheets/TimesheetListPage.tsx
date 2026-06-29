import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { RichTextEditor, RichTextView } from "@/components/shared/rich-text-editor";
import { StatusBadge, statusTone } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canApproveTimeEntry, normalizeTimeEntryStatus, permissionsForProject, visibleProjectsForUser } from "@/lib/permissions/policies";
import { round } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { TimeEntry } from "@/types/domain";
import { plainTimeDescription } from "./TimeEntryDialog";

const statusOptions = [
  { value: "all", label: "全部状态" },
  { value: "DRAFT", label: "草稿" },
  { value: "SUBMITTED", label: "已提交" },
  { value: "APPROVED", label: "已审批" },
  { value: "REJECTED", label: "已驳回" },
];

export function TimesheetListPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const [userId, setUserId] = useState(store.context.isAdmin ? "all" : store.context.userId);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const visibleProjects = useMemo(
    () => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers),
    [store.context, store.state.projectMembers, store.state.projects],
  );
  const approvableProjectIds = new Set(visibleProjects.filter((project) => permissionsForProject(store.context, project, store.state.projectMembers).canApproveTimeEntries).map((project) => project.id));
  const rows = store.state.timeEntries
    .filter((entry) => !entry.deletedAt)
    .filter((entry) => {
      if (normalizeTimeEntryStatus(entry.status) === "DRAFT") return entry.userId === store.context.userId;
      return store.context.isAdmin || entry.userId === store.context.userId || approvableProjectIds.has(entry.projectId);
    })
    .filter((entry) => projectId === "all" || entry.projectId === projectId)
    .filter((entry) => status === "all" || normalizeTimeEntryStatus(entry.status) === status)
    .filter((entry) => userId === "all" || entry.userId === userId)
    .filter((entry) => !dateFrom || String(entry.workDate) >= dateFrom)
    .filter((entry) => !dateTo || String(entry.workDate) <= dateTo)
    .filter((entry) => {
      if (!query.trim()) return true;
      const project = store.state.projects.find((item) => item.id === entry.projectId);
      const issue = store.state.issues.find((item) => item.id === entry.issueId);
      const user = store.state.users.find((item) => item.id === entry.userId);
      return `${project?.name} ${issue?.title} ${user?.name} ${entry.note} ${entry.description}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)));
  const submitted = rows.filter((entry) => normalizeTimeEntryStatus(entry.status) === "SUBMITTED").length;
  const approvedHours = rows.filter((entry) => normalizeTimeEntryStatus(entry.status) === "APPROVED").reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

  return (
    <div>
      <PageHeading
        eyebrow="Timesheet Review"
        title="工时列表"
        description="查看团队工时、筛选项目和人员，并完成提交工时的审批或驳回。"
      />
      <section className="border-b bg-card px-4 py-3 md:px-6">
        <div className="grid min-w-0 items-center gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(5,minmax(140px,160px))]">
          <label className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索项目、事项、人员或说明" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {visibleProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>{statusOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {store.context.isAdmin ? <SelectItem value="all">全部人员</SelectItem> : null}
              {store.state.users.filter((user) => user.status === "ACTIVE").map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label="开始日期" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input aria-label="结束日期" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </section>
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>人员</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>事项</TableHead>
                <TableHead className="text-right">小时</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => {
                const project = store.state.projects.find((item) => item.id === entry.projectId);
                const issue = store.state.issues.find((item) => item.id === entry.issueId);
                const user = store.state.users.find((item) => item.id === entry.userId);
                return (
                  <TableRow key={entry.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setSelectedEntry(entry)} onKeyDown={(event) => event.key === "Enter" && setSelectedEntry(entry)}>
                    <TableCell>{entry.workDate}</TableCell>
                    <TableCell>{user?.name || entry.reporter || "-"}</TableCell>
                    <TableCell>{project?.name || "-"}</TableCell>
                    <TableCell>
                      <span className="block max-w-72 truncate">{issue ? `${issue.code} · ${issue.title}` : "未关联事项"}</span>
                      <span className="block max-w-72 truncate text-xs text-muted-foreground">{plainTimeDescription(entry.note || entry.description)}</span>
                    </TableCell>
                    <TableCell className="text-right">{entry.hours}</TableCell>
                    <TableCell><StatusBadge label={statusLabel(entry.status)} tone={statusTone(normalizeTimeEntryStatus(entry.status))} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length ? <div className="p-4"><EmptyState title="没有工时记录" description="调整筛选条件，或等待成员提交工时。" /></div> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">审批概览</h2>
            <div className="mt-4 grid gap-3">
              <Metric label="待审批记录" value={`${submitted}`} />
              <Metric label="已审批小时" value={`${round(approvedHours, 1)}h`} />
              <Metric label="当前列表记录" value={`${rows.length}`} />
            </div>
          </section>
        </aside>
      </div>
      <TimeEntryDetailDialog entry={selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)} />
    </div>
  );
}

function TimeEntryDetailDialog({ entry, onOpenChange }: { entry: TimeEntry | null; onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const [comment, setComment] = useState("");
  const project = entry ? store.state.projects.find((item) => item.id === entry.projectId) : null;
  const issue = entry ? store.state.issues.find((item) => item.id === entry.issueId) : null;
  const user = entry ? store.state.users.find((item) => item.id === entry.userId) : null;
  const canApprove = entry ? canApproveTimeEntry(store.context, entry, project, store.state.projectMembers) : false;

  useEffect(() => {
    setComment("");
  }, [entry?.id]);

  async function approve() {
    if (!entry) return;
    const ok = await store.approveTimeEntry(entry.id, comment);
    if (ok) {
      setComment("");
      onOpenChange(false);
    }
  }

  async function reject() {
    if (!entry) return;
    const ok = await store.rejectTimeEntry(entry.id, comment);
    if (ok) {
      setComment("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>工时详情</DialogTitle>
          <DialogDescription>查看工时内容、提交状态和审批意见。</DialogDescription>
        </DialogHeader>
        {entry ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-2">
              <Detail label="日期" value={entry.workDate} />
              <Detail label="人员" value={user?.name || entry.reporter || "-"} />
              <Detail label="项目" value={project?.name || "-"} />
              <Detail label="事项" value={issue ? `${issue.code} · ${issue.title}` : "未关联事项"} />
              <Detail label="工时" value={`${entry.hours}h`} />
              <div>
                <p className="text-xs text-muted-foreground">状态</p>
                <StatusBadge label={statusLabel(entry.status)} tone={statusTone(normalizeTimeEntryStatus(entry.status))} />
              </div>
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold">描述</h3>
              <RichTextView value={entry.description || entry.note} className="rounded-md border bg-background p-3" />
            </section>
            {entry.correctionReason ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">审批评论</h3>
                <RichTextView value={entry.correctionReason} className="rounded-md border bg-muted/30 p-3" />
              </section>
            ) : null}
            {canApprove ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">审批评论（可选）</h3>
                <RichTextEditor value={comment} onChange={setComment} placeholder="补充审批意见，可留空" minHeight="min-h-24" />
              </section>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          {canApprove ? (
            <>
              <Button variant="outline" onClick={reject}><XCircle className="h-4 w-4" />驳回</Button>
              <Button onClick={approve}><CheckCircle2 className="h-4 w-4" />审批通过</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-xl">{value}</strong>
    </div>
  );
}

function statusLabel(status: TimeEntry["status"]) {
  const normalized = normalizeTimeEntryStatus(status);
  return ({ DRAFT: "草稿", SUBMITTED: "已提交", APPROVED: "已审批", REJECTED: "已驳回" } as Record<string, string>)[normalized] || String(status);
}
