import { useMemo, useState, type ReactNode } from "react";
import { Download, Plus, Search, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { calculateCostSummary } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { CostRecord } from "@/types/domain";

export function CostManagementPage() {
  const store = useAppStore();
  const activeRecords = store.state.costRecords.filter((record) => record.status === "ACTIVE");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(activeRecords[0]?.id || "");
  const [editing, setEditing] = useState<CostRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const rows = activeRecords
    .filter((record) => {
      const project = store.state.projects.find((item) => item.id === record.projectId);
      if (!query.trim()) return true;
      return `${project?.name} ${project?.code} ${record.notes}`.toLowerCase().includes(query.toLowerCase());
    });
  const selected = activeRecords.find((record) => record.id === selectedId) || rows[0] || activeRecords[0];
  const selectedProject = selected ? store.state.projects.find((project) => project.id === selected.projectId) : undefined;
  const summary = useMemo(() => {
    if (!selected || !selectedProject) return null;
    return calculateCostSummary(selected, selectedProject, store.state.timeEntries, store.state.issues, store.state.users);
  }, [selected, selectedProject, store.state.issues, store.state.timeEntries, store.state.users]);

  return (
    <div>
      <PageHeading
        eyebrow="Cost"
        title="成本管理"
        description="按项目维护计划人天、标准工时，并基于已提交/已审批工时计算实际投入。"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建成本记录</Button>}
      />
      <section className="border-b bg-card px-4 py-3 md:px-6">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索项目、代码或备注" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-md border bg-card">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">成本记录</h2>
            <p className="text-xs text-muted-foreground">归档后不会继续作为当前成本口径。</p>
          </header>
          <div className="divide-y">
            {rows.map((record) => {
              const project = store.state.projects.find((item) => item.id === record.projectId);
              const itemSummary = project ? calculateCostSummary(record, project, store.state.timeEntries, store.state.issues, store.state.users) : null;
              return (
                <button key={record.id} type="button" className="w-full px-4 py-3 text-left hover:bg-muted/50" onClick={() => setSelectedId(record.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{project?.name || record.projectId}</strong>
                      <small className="text-xs text-muted-foreground">{project?.code || record.projectId} · 计划 {record.plannedPersonDays} 人天</small>
                    </span>
                    <StatusBadge label={`${itemSummary?.personDayBurnRate || 0}%`} tone={(itemSummary?.personDayBurnRate || 0) > 100 ? "danger" : "info"} />
                  </div>
                </button>
              );
            })}
            {!rows.length ? <div className="p-4"><EmptyState title="暂无成本记录" description="为项目创建成本记录后可查看人天消耗。" action="新建记录" onAction={() => setCreateOpen(true)} /></div> : null}
          </div>
        </section>

        {selected && selectedProject && summary ? (
          <section className="space-y-4">
            <div className="rounded-md border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{selectedProject.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.notes || "暂无成本备注。"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => store.exportCostRecord(selected.id)}><Download className="h-4 w-4" />导出</Button>
                  <Button variant="outline" onClick={() => setEditing(selected)}>编辑</Button>
                  <Button variant="destructive" onClick={() => store.deleteCostRecord(selected.id)}><Trash2 className="h-4 w-4" />归档</Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="计划人天" value={`${summary.plannedPersonDays}`} detail={`${summary.standardHoursPerDay}h/人天`} />
                <Metric label="实际人天" value={`${summary.actualPersonDays}`} detail={`${summary.actualHours}h`} />
                <Metric label="剩余人天" value={`${summary.remainingPersonDays}`} detail={summary.remainingPersonDays < 0 ? "已超出计划" : "可继续消耗"} danger={summary.remainingPersonDays < 0} />
                <Metric label="燃烧率" value={`${summary.personDayBurnRate}%`} detail={`${summary.participantCount} 人参与`} danger={summary.personDayBurnRate > 100} />
              </div>
            </div>

            <section className="rounded-md border bg-card">
              <header className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">人员投入</h2>
                <p className="text-xs text-muted-foreground">按已提交和已审批工时汇总。</p>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>人员</TableHead>
                    <TableHead className="text-right">小时</TableHead>
                    <TableHead className="text-right">人天</TableHead>
                    <TableHead className="text-right">记录</TableHead>
                    <TableHead>最近日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.people.map((person) => (
                    <TableRow key={person.userId}>
                      <TableCell>{person.name}</TableCell>
                      <TableCell className="text-right">{person.hours}</TableCell>
                      <TableCell className="text-right">{person.personDays}</TableCell>
                      <TableCell className="text-right">{person.entryCount}</TableCell>
                      <TableCell>{person.lastWorkDate || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section className="rounded-md border bg-card">
              <header className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">工时明细</h2>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>人员</TableHead>
                    <TableHead>事项</TableHead>
                    <TableHead className="text-right">小时</TableHead>
                    <TableHead className="text-right">人天</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rawData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.workDate}</TableCell>
                      <TableCell>{entry.personName}</TableCell>
                      <TableCell>{entry.issueCode ? `${entry.issueCode} · ${entry.issueTitle}` : entry.issueTitle}</TableCell>
                      <TableCell className="text-right">{entry.hours}</TableCell>
                      <TableCell className="text-right">{entry.personDays}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!summary.rawData.length ? <div className="p-4"><EmptyState title="暂无可计入工时" description="草稿不会计入成本，请提交或审批工时后再查看。" /></div> : null}
            </section>
          </section>
        ) : (
          <EmptyState title="暂无成本详情" description="创建成本记录后可查看实际投入与燃烧率。" />
        )}
      </div>
      <CostDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CostDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} record={editing} />
    </div>
  );
}

function CostDialog({ open, onOpenChange, record }: { open: boolean; onOpenChange: (open: boolean) => void; record?: CostRecord | null }) {
  const store = useAppStore();
  const [form, setForm] = useState({
    projectId: record?.projectId || store.state.projects[0]?.id || "none",
    plannedPersonDays: String(record?.plannedPersonDays || 80),
    standardHoursPerDay: String(record?.standardHoursPerDay || 8),
    notes: record?.notes || "",
  });

  async function submit() {
    if (form.projectId === "none") return;
    const payload = {
      projectId: form.projectId,
      plannedPersonDays: Number(form.plannedPersonDays || 0),
      standardHoursPerDay: Number(form.standardHoursPerDay || 8),
      notes: form.notes,
    };
    const ok = record ? await store.updateCostRecord(record.id, payload) : await store.createCostRecord(payload);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? "编辑成本记录" : "新建成本记录"}</DialogTitle>
          <DialogDescription>成本统计以项目、标准工时和计划人天为基础。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="项目">
            <Select value={form.projectId} onValueChange={(value) => setForm({ ...form, projectId: value })} disabled={Boolean(record)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {store.state.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="计划人天"><Input type="number" min="0" value={form.plannedPersonDays} onChange={(event) => setForm({ ...form, plannedPersonDays: event.target.value })} /></Field>
            <Field label="标准小时/人天"><Input type="number" min="1" value={form.standardHoursPerDay} onChange={(event) => setForm({ ...form, standardHoursPerDay: event.target.value })} /></Field>
          </div>
          <Field label="备注"><Textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className={danger ? "mt-1 block text-2xl text-destructive" : "mt-1 block text-2xl"}>{value}</strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}
