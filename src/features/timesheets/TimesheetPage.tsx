import { useMemo, useState } from "react";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Paperclip, Pencil } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge, statusTone } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canEditTimeEntry, normalizeTimeEntryStatus } from "@/lib/permissions/policies";
import { formatDate, monthWorkdays, round, weekDays } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { Project, TimeEntry } from "@/types/domain";
import { TimeEntryDialog, plainTimeDescription } from "./TimeEntryDialog";

export function TimesheetPage() {
  const store = useAppStore();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [missingExpanded, setMissingExpanded] = useState(false);
  const today = formatDate(new Date());
  const selectedDateValue = isValidDateValue(selectedDate) ? selectedDate : today;
  const weekStart = formatDate(startOfWeek(parseISO(selectedDateValue), { weekStartsOn: 1 }));
  const days = weekDays(parseISO(weekStart));
  const monthKey = selectedDateValue.slice(0, 7) || format(new Date(), "yyyy-MM");
  const monthWorkdayCount = monthWorkdays(monthKey).length;
  const myEntries = store.state.timeEntries
    .filter((entry) => entry.userId === store.context.userId && !entry.deletedAt)
    .sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)));
  const dayEntries = myEntries.filter((entry) => entry.workDate === selectedDateValue);
  const weekEntries = myEntries.filter((entry) => days.some((day) => day.date === entry.workDate));
  const monthEntries = myEntries.filter((entry) => String(entry.workDate).startsWith(monthKey));
  const submittedStatuses = new Set(["SUBMITTED", "APPROVED"]);
  const dayTotal = sumHours(dayEntries);
  const weekSubmitted = sumHours(weekEntries.filter((entry) => submittedStatuses.has(normalizeTimeEntryStatus(entry.status))));
  const monthSubmitted = sumHours(monthEntries.filter((entry) => submittedStatuses.has(normalizeTimeEntryStatus(entry.status))));
  const submittedDates = new Set(monthEntries.filter((entry) => submittedStatuses.has(normalizeTimeEntryStatus(entry.status))).map((entry) => entry.workDate));
  const missingWorkdays = monthWorkdays(monthKey).filter((date) => date <= today && !submittedDates.has(date));
  const visibleMissingWorkdays = missingExpanded ? missingWorkdays : missingWorkdays.slice(0, 10);
  const canCreateAnyTimeEntry = store.state.projects.some((project) => store.getProjectPermissions(project.id).canCreateTimeEntries);

  function shiftDay(offset: number) {
    setSelectedDate(formatDate(addDays(parseISO(selectedDateValue), offset)));
  }

  const dayLabel = useMemo(() => {
    const date = parseISO(selectedDateValue);
    return {
      date: format(date, "M/d"),
      weekday: `周${["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}`,
    };
  }, [selectedDateValue]);

  function createForDate(date: string) {
    if (!isValidDateValue(date)) return;
    setSelectedDate(date);
    setCreateOpen(true);
  }

  function selectDate(date: string) {
    if (isValidDateValue(date)) setSelectedDate(date);
  }

  return (
    <div className="min-w-0">
      <PageHeading
        eyebrow="Timesheet"
        title="工时填报"
        description="按日填写自己的项目工时；草稿不进入成本统计，提交后等待项目所有人或管理员审批。"
        actions={canCreateAnyTimeEntry ? <Button onClick={() => setCreateOpen(true)}><CalendarPlus className="h-4 w-4" />新建工时</Button> : null}
      />
      <section className="mx-4 mt-4 rounded-md border bg-card px-4 py-3 md:mx-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 shrink-0">
            <h2 className="text-sm font-semibold">本月待补工作日</h2>
          </div>
          <div className={`flex min-w-0 flex-1 gap-2 ${missingExpanded ? "flex-wrap" : "overflow-hidden"}`}>
            {visibleMissingWorkdays.map((date) => (
              <Button key={date} type="button" variant="outline" size="xs" className="shrink-0" disabled={!canCreateAnyTimeEntry} onClick={() => createForDate(date)}>
                {format(parseISO(date), "M-d")}
              </Button>
            ))}
            {!missingWorkdays.length ? <span className="text-sm text-muted-foreground">本月已没有待补工作日。</span> : null}
          </div>
          {missingWorkdays.length > visibleMissingWorkdays.length ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="展开待补日期" onClick={() => setMissingExpanded(true)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </section>
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-md border bg-card">
          <header className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">日填报 {dayLabel.date}</h2>
              <p className="text-xs text-muted-foreground">{dayLabel.weekday}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="icon" variant="outline" aria-label="前一天" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" className="w-40" value={selectedDateValue} onChange={(event) => selectDate(event.target.value)} />
              <Button size="icon" variant="outline" aria-label="后一天" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </header>
          <div className="border-b px-4 py-3">
            <p className="text-sm text-muted-foreground">当天已记录 <span className="font-medium text-foreground">{round(dayTotal, 1)}h</span>。草稿、已提交、已审批和已驳回记录都会按当前日期展示。</p>
          </div>
          <div className="divide-y">
            {dayEntries.map((entry) => (
              <article key={entry.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{projectName(entry.projectId, store.state.projects)}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {issueName(entry.issueId, store.state.issues)} · {entry.hours}h
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plainTimeDescription(entry.note || entry.description)}</p>
                    {entry.attachments?.length ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        {entry.attachments.length} 个附件
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge label={statusLabel(entry.status)} tone={statusTone(normalizeTimeEntryStatus(entry.status))} />
                    {canEditTimeEntry(store.context, entry) ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditingEntry(entry)}>
                        <Pencil className="h-4 w-4" />编辑
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {!dayEntries.length ? (
              <div className="p-4">
                <EmptyState title="当天暂无工时" description="点击新建工时，为选中的日期补充项目记录。" action={canCreateAnyTimeEntry ? "新建工时" : undefined} onAction={canCreateAnyTimeEntry ? () => setCreateOpen(true) : undefined} />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">本月概览</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="本月已提交" value={`${round(monthSubmitted, 1)}h`} />
              <Metric label="待补充" value={`${Math.max(0, monthWorkdayCount * 8 - monthSubmitted)}h`} />
            </div>
          </section>
          <section className="rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">本周概览</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="本周已提交" value={`${round(weekSubmitted, 1)}h`} />
              <Metric label="待补充" value={`${Math.max(0, 40 - weekSubmitted)}h`} />
            </div>
          </section>
          <section className="rounded-md border bg-card">
            <header className="border-b bg-muted/30 px-4 py-3">
              <h2 className="text-sm font-semibold">最近工时</h2>
              <p className="text-xs text-muted-foreground">显示你的最近 8 条记录。</p>
            </header>
            <div className="divide-y">
              {myEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{projectName(entry.projectId, store.state.projects)}</strong>
                    <StatusBadge label={statusLabel(entry.status)} tone={statusTone(normalizeTimeEntryStatus(entry.status))} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.workDate} · {entry.hours}h · {plainTimeDescription(entry.note || entry.description)}</p>
                </div>
              ))}
              {!myEntries.length ? <div className="p-4"><EmptyState title="暂无工时记录" description="提交后会在这里显示最近记录。" /></div> : null}
            </div>
          </section>
        </aside>
      </div>
      <TimeEntryDialog open={createOpen} onOpenChange={setCreateOpen} defaultDate={selectedDateValue} />
      <TimeEntryDialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)} entry={editingEntry} />
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

function projectName(projectId: string, projects: Project[]) {
  return projects.find((project) => project.id === projectId)?.name || "未知项目";
}

function issueName(issueId: string | null | undefined, issues: { id: string; code: string; title: string }[]) {
  const issue = issues.find((item) => item.id === issueId);
  return issue ? `${issue.code} · ${issue.title}` : "未关联事项";
}

function statusLabel(status: unknown) {
  const normalized = normalizeTimeEntryStatus(status as never);
  return ({ DRAFT: "草稿", SUBMITTED: "已提交", APPROVED: "已审批", REJECTED: "已驳回" } as Record<string, string>)[normalized] || String(status);
}

function sumHours(entries: { hours?: number | string }[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
}

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}
