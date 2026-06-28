import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge, statusTone } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { calculateCostSummary, round } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";
import type { CostRecord, Project } from "@/types/domain";

const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
const ALL_PEOPLE = "all";

export function CostManagementPage() {
  const store = useAppStore();
  const activeRecords = useMemo(() => store.state.costRecords.filter((record) => record.status === "ACTIVE"), [store.state.costRecords]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<CostRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const rows = useMemo(() => activeRecords.filter((record) => {
    const project = store.state.projects.find((item) => item.id === record.projectId);
    if (!query.trim()) return true;
    return `${project?.name} ${project?.code} ${record.notes}`.toLowerCase().includes(query.toLowerCase());
  }), [activeRecords, query, store.state.projects]);

  useEffect(() => {
    if (!activeRecords.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!activeRecords.some((record) => record.id === selectedId)) setSelectedId(activeRecords[0].id);
  }, [activeRecords, selectedId]);

  const selected = rows.find((record) => record.id === selectedId) || rows[0] || activeRecords[0];
  const selectedProject = selected ? store.state.projects.find((project) => project.id === selected.projectId) : undefined;
  const summary = useMemo(() => {
    if (!selected || !selectedProject) return null;
    return calculateCostSummary(selected, selectedProject, store.state.timeEntries, store.state.issues, store.state.users);
  }, [selected, selectedProject, store.state.issues, store.state.timeEntries, store.state.users]);

  useEffect(() => {
    setPersonFilter(ALL_PEOPLE);
    setDateFrom("");
    setDateTo("");
  }, [selected?.id]);

  const plannedHours = summary ? plannedHoursFor(summary) : 0;
  const remainingHours = summary ? round(plannedHours - summary.actualHours, 1) : 0;
  const filteredRawData = useMemo(() => {
    if (!summary) return [];
    return summary.rawData
      .filter((entry) => personFilter === ALL_PEOPLE || entry.userId === personFilter)
      .filter((entry) => !dateFrom || entry.workDate >= dateFrom)
      .filter((entry) => !dateTo || entry.workDate <= dateTo);
  }, [dateFrom, dateTo, personFilter, summary]);

  return (
    <div>
      <PageHeading
        eyebrow="Cost"
        title="成本管理"
        description="按项目维护计划工时，并基于已提交/已审批工时计算实际投入。"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建成本记录</Button>}
      />
      <section className="border-b bg-card px-4 py-3 md:px-6">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索项目、代码或备注" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-0">
        <section className="overflow-hidden rounded-md border bg-card xl:rounded-r-none">
          <header className="border-b bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold">成本记录</h2>
            <p className="text-xs text-muted-foreground">归档后不会继续作为当前成本口径。</p>
          </header>
          <div className="divide-y">
            {rows.map((record) => {
              const project = store.state.projects.find((item) => item.id === record.projectId);
              const itemSummary = project ? calculateCostSummary(record, project, store.state.timeEntries, store.state.issues, store.state.users) : null;
              const active = record.id === selected?.id;
              return (
                <button
                  key={record.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full border-l-2 border-l-transparent px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    active && "border-l-primary bg-accent text-accent-foreground hover:bg-accent"
                  )}
                  onClick={() => setSelectedId(record.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{project?.name || record.projectId}</strong>
                      <small className="text-xs text-muted-foreground">{project?.code || record.projectId} · 计划 {plannedHoursFor(record)}h</small>
                    </span>
                    <StatusBadge label={`${itemSummary?.personDayBurnRate || 0}%`} tone={(itemSummary?.personDayBurnRate || 0) > 100 ? "danger" : "info"} />
                  </div>
                </button>
              );
            })}
            {!rows.length ? <div className="p-4"><EmptyState title="暂无成本记录" description="为项目创建成本记录后可查看工时消耗。" action="新建记录" onAction={() => setCreateOpen(true)} /></div> : null}
          </div>
        </section>

        {selected && selectedProject && summary ? (
          <section className="min-w-0 overflow-hidden rounded-md border bg-card xl:rounded-l-none xl:border-l-0">
            <header className="border-b bg-muted/30 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">成本详情</span>
                    <StatusBadge label={selectedProject.status} tone={statusTone(selectedProject.status)} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedProject.code || selectedProject.id}</span>
                    {" · "}负责人 {summary.ownerName}
                  </p>
                  <p className="text-sm text-muted-foreground">{selected.notes || "暂无成本备注。"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => store.exportCostRecord(selected.id)}><Download className="h-4 w-4" />导出</Button>
                  <Button variant="outline" onClick={() => setEditing(selected)}>编辑</Button>
                  <Button variant="destructive" onClick={() => store.deleteCostRecord(selected.id)}><Trash2 className="h-4 w-4" />归档</Button>
                </div>
              </div>
            </header>

            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="计划工时" value={`${plannedHours}h`} detail={`基准 ${summary.standardHoursPerDay}h/工作日`} />
              <Metric label="实际工时" value={`${summary.actualHours}h`} detail={`${summary.participantCount} 人参与`} />
              <Metric label="剩余工时" value={`${remainingHours}h`} detail={remainingHours < 0 ? "已超出计划" : "可继续消耗"} danger={remainingHours < 0} />
              <Metric label="燃烧率" value={`${summary.personDayBurnRate}%`} detail="按计划工时计算" danger={summary.personDayBurnRate > 100} />
            </div>

            <section className="border-t bg-background">
              <header className="border-b bg-muted/30 px-4 py-3">
                <h2 className="text-sm font-semibold">人员投入</h2>
                <p className="text-xs text-muted-foreground">按已提交和已审批工时汇总。</p>
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>人员</TableHead>
                      <TableHead className="text-right">工时</TableHead>
                      <TableHead className="text-right">记录</TableHead>
                      <TableHead>最近日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.people.map((person) => (
                      <TableRow key={person.userId}>
                        <TableCell>{person.name}</TableCell>
                        <TableCell className="text-right">{person.hours}</TableCell>
                        <TableCell className="text-right">{person.entryCount}</TableCell>
                        <TableCell>{person.lastWorkDate || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!summary.people.length ? <div className="p-4"><EmptyState title="暂无人员投入" description="提交或审批工时后会在这里汇总。" /></div> : null}
            </section>

            <section className="border-t bg-muted/20">
              <header className="border-b bg-muted/40 px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">工时明细</h2>
                    <p className="text-xs text-muted-foreground">可按人员和日期范围查询。</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(140px,180px)_140px_140px_auto]">
                    <Select value={personFilter} onValueChange={setPersonFilter}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PEOPLE}>全部人员</SelectItem>
                        {summary.people.map((person) => <SelectItem key={person.userId} value={person.userId}>{person.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input aria-label="开始日期" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                    <Input aria-label="结束日期" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    <Button variant="outline" onClick={() => { setPersonFilter(ALL_PEOPLE); setDateFrom(""); setDateTo(""); }}>重置</Button>
                  </div>
                </div>
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>人员</TableHead>
                      <TableHead>事项</TableHead>
                      <TableHead className="text-right">工时</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRawData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.workDate}</TableCell>
                        <TableCell>{entry.personName}</TableCell>
                        <TableCell>{entry.issueCode ? `${entry.issueCode} · ${entry.issueTitle}` : entry.issueTitle}</TableCell>
                        <TableCell className="text-right">{entry.hours}</TableCell>
                        <TableCell><StatusBadge label={timeStatusLabel(entry.status)} tone={statusTone(entry.status)} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!filteredRawData.length ? (
                <div className="p-4">
                  <EmptyState
                    title={summary.rawData.length ? "没有匹配工时" : "暂无可计入工时"}
                    description={summary.rawData.length ? "调整人员或日期筛选后再试。" : "草稿不会计入成本，请提交或审批工时后再查看。"}
                  />
                </div>
              ) : null}
            </section>
          </section>
        ) : (
          <div className="rounded-md border bg-card p-4 xl:rounded-l-none xl:border-l-0">
            <EmptyState title="暂无成本详情" description="创建成本记录后可查看实际投入与燃烧率。" />
          </div>
        )}
      </div>
      <CostDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CostDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} record={editing} />
    </div>
  );
}

function CostDialog({ open, onOpenChange, record }: { open: boolean; onOpenChange: (open: boolean) => void; record?: CostRecord | null }) {
  const store = useAppStore();
  const availableProjects = useMemo(() => store.state.projects.filter((project) => !project.deletedAt), [store.state.projects]);
  const [form, setForm] = useState({
    projectId: record?.projectId || availableProjects[0]?.id || "none",
    plannedHours: String(record ? plannedHoursFor(record) : 80),
    standardHoursPerDay: String(record?.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY),
    notes: record?.notes || "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      projectId: record?.projectId || availableProjects[0]?.id || "none",
      plannedHours: String(record ? plannedHoursFor(record) : 80),
      standardHoursPerDay: String(record?.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY),
      notes: record?.notes || "",
    });
  }, [availableProjects, open, record]);

  const selectedProject = store.state.projects.find((project) => project.id === form.projectId);
  const plannedHourValue = Number(form.plannedHours || 0);

  async function submit() {
    if (form.projectId === "none") return;
    const standardHoursPerDay = Number(form.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY) || DEFAULT_STANDARD_HOURS_PER_DAY;
    const payload = {
      projectId: form.projectId,
      plannedPersonDays: standardHoursPerDay ? Number(form.plannedHours || 0) / standardHoursPerDay : 0,
      standardHoursPerDay,
      notes: form.notes,
    };
    const ok = record ? await store.updateCostRecord(record.id, payload) : await store.createCostRecord(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? "编辑成本记录" : "新建成本记录"}</DialogTitle>
          <DialogDescription>成本统计以项目和计划工时为基础，保存时按基准小时折算。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="项目">
            {record ? (
              <ProjectReadout project={selectedProject} />
            ) : (
              <Select value={form.projectId} onValueChange={(value) => setForm({ ...form, projectId: value })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id} textValue={projectLabel(project)}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{project.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{project.code || project.id}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="计划工时"><Input type="number" min="0" step="0.5" value={form.plannedHours} onChange={(event) => setForm({ ...form, plannedHours: event.target.value })} /></Field>
            <Field label="折算基准小时"><Input type="number" min="1" max="24" value={form.standardHoursPerDay} onChange={(event) => setForm({ ...form, standardHoursPerDay: event.target.value })} /></Field>
          </div>
          <Field label="备注"><Textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={form.projectId === "none" || plannedHourValue <= 0}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectReadout({ project }: { project?: Project }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-muted/40 px-3 py-2">
      <p className="truncate text-sm font-medium">{project?.name || "未关联项目"}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{project?.code || project?.id || "-"}</p>
    </div>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-md border bg-background p-3", danger && "border-destructive/30 bg-destructive/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className={danger ? "mt-1 block text-2xl text-destructive" : "mt-1 block text-2xl"}>{value}</strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function plannedHoursFor(record: Pick<CostRecord, "plannedPersonDays" | "standardHoursPerDay">) {
  return round(Number(record.plannedPersonDays || 0) * Number(record.standardHoursPerDay || DEFAULT_STANDARD_HOURS_PER_DAY), 1);
}

function projectLabel(project: Project) {
  return `${project.name} · ${project.code || project.id}`;
}

function timeStatusLabel(status?: string) {
  if (status === "APPROVED" || status === "已审批") return "已审批";
  if (status === "SUBMITTED" || status === "已提交") return "已提交";
  if (status === "REJECTED" || status === "已驳回") return "已驳回";
  if (status === "DRAFT" || status === "草稿") return "草稿";
  return status || "-";
}
