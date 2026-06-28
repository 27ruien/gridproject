import { useMemo, useState, type ReactNode } from "react";
import { addDays, parseISO, startOfWeek } from "date-fns";
import { CalendarClock, Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge, statusTone } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canCreateOwnTimeEntry, normalizeTimeEntryStatus, visibleProjectsForUser } from "@/lib/permissions/policies";
import { formatDate, round, weekDays } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { Project } from "@/types/domain";

export function TimesheetPage() {
  const store = useAppStore();
  const [weekStart, setWeekStart] = useState(formatDate(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const eligibleProjects = useMemo(
    () => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers)
      .filter((project) => canCreateOwnTimeEntry(store.context, project, store.state.projectMembers, store.context.userId)),
    [store.context, store.state.projectMembers, store.state.projects],
  );
  const [projectId, setProjectId] = useState(eligibleProjects[0]?.id || "none");
  const selectedProject = eligibleProjects.find((project) => project.id === projectId);
  const projectIssues = store.state.issues.filter((issue) => issue.projectId === projectId && !issue.deletedAt);
  const [issueId, setIssueId] = useState("none");
  const [hours, setHours] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const days = weekDays(parseISO(weekStart));
  const myEntries = store.state.timeEntries
    .filter((entry) => entry.userId === store.context.userId && !entry.deletedAt)
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)));
  const weekEntries = myEntries.filter((entry) => days.some((day) => day.date === entry.workDate));
  const weekTotal = weekEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const draftHours = Object.values(hours).reduce((sum, value) => sum + Number(value || 0), 0);

  function shiftWeek(offset: number) {
    setWeekStart(formatDate(addDays(parseISO(weekStart), offset * 7)));
  }

  async function submit(submitNow: boolean) {
    if (!selectedProject) return;
    const entries = days
      .map((day) => ({ day, value: Number(hours[day.date] || 0) }))
      .filter((item) => item.value > 0);
    for (const item of entries) {
      await store.createTimeEntry({
        projectId: selectedProject.id,
        issueId: issueId === "none" ? null : issueId,
        workDate: item.day.date,
        hours: item.value,
        description: note,
        submit: submitNow,
      });
    }
    if (entries.length) {
      setHours({});
      setNote("");
    }
  }

  return (
    <div className="min-w-0">
      <PageHeading
        eyebrow="Timesheet"
        title="工时填报"
        description="按周填写自己的项目工时；草稿不进入成本统计，提交后等待项目 Owner 或管理员审批。"
        actions={<Button variant="outline" onClick={() => shiftWeek(0)}><CalendarClock className="h-4 w-4" />本周</Button>}
      />
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-md border bg-card">
          <header className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">周填报</h2>
              <p className="text-xs text-muted-foreground">{days[0].date} 至 {days[4].date}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="icon" variant="outline" aria-label="上一周" onClick={() => shiftWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" className="w-40" value={weekStart} onChange={(event) => setWeekStart(formatDate(startOfWeek(parseISO(event.target.value), { weekStartsOn: 1 })))} />
              <Button size="icon" variant="outline" aria-label="下一周" onClick={() => shiftWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </header>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="项目">
              <Select value={projectId} onValueChange={(value) => { setProjectId(value); setIssueId("none"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eligibleProjects.length ? eligibleProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>) : <SelectItem value="none">暂无可填报项目</SelectItem>}
                </SelectContent>
              </Select>
            </Field>
            <Field label="关联事项">
              <Select value={issueId} onValueChange={setIssueId} disabled={!selectedProject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联事项</SelectItem>
                  {projectIssues.map((issue) => <SelectItem key={issue.id} value={issue.id}>{issue.code} · {issue.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {selectedProject ? (
            <>
              <div className="grid gap-3 px-4 pb-4 md:grid-cols-5">
                {days.map((day) => (
                  <label key={day.date} className="rounded-md border bg-background p-3">
                    <span className="text-xs text-muted-foreground">周{day.label} · {day.shortDate}</span>
                    <Input className="mt-2" type="number" min="0" step="0.5" placeholder="0" value={hours[day.date] || ""} onChange={(event) => setHours({ ...hours, [day.date]: event.target.value })} />
                  </label>
                ))}
              </div>
              <div className="space-y-3 border-t p-4">
                <Field label="工作说明">
                  <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="说明本周完成的任务、联调、会议或验收工作" />
                </Field>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">本次填写合计 {round(draftHours, 1)}h，本周已记录 {round(weekTotal, 1)}h。</p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={!draftHours} onClick={() => submit(false)}><Save className="h-4 w-4" />保存草稿</Button>
                    <Button disabled={!draftHours} onClick={() => submit(true)}><Check className="h-4 w-4" />提交审批</Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4"><EmptyState title="没有可填报项目" description="你需要先加入项目，才能为自己填写工时。" /></div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">本周概览</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="本周已记录" value={`${round(weekTotal, 1)}h`} />
              <Metric label="待补充" value={`${Math.max(0, 40 - weekTotal)}h`} />
            </div>
          </section>
          <section className="rounded-md border bg-card">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">最近工时</h2>
              <p className="text-xs text-muted-foreground">显示你的最近 8 条记录。</p>
            </header>
            <div className="divide-y">
              {myEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{projectName(entry.projectId, store.state.projects)}</strong>
                    <StatusBadge label={statusLabel(entry.status)} tone={statusTone(normalizeTimeEntryStatus(entry.status))} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.workDate} · {entry.hours}h · {entry.note || entry.description || "无说明"}</p>
                </div>
              ))}
              {!myEntries.length ? <div className="p-4"><EmptyState title="暂无工时记录" description="提交后会在这里显示最近记录。" /></div> : null}
            </div>
          </section>
        </aside>
      </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function projectName(projectId: string, projects: Project[]) {
  return projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function statusLabel(status: unknown) {
  const normalized = normalizeTimeEntryStatus(status as never);
  return ({ DRAFT: "草稿", SUBMITTED: "已提交", APPROVED: "已审批", REJECTED: "已驳回" } as Record<string, string>)[normalized] || String(status);
}
