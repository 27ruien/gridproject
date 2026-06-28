import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Check, ChevronDown, Italic, List, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { canCreateOwnTimeEntry, visibleProjectsForUser } from "@/lib/permissions/policies";
import { formatDate, round } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";

const NO_ISSUE = "none";

type DraftLine = {
  id: string;
  workDate: string;
  projectId: string;
  issueIds: string[];
  hours: string;
  description: string;
};

export function TimeEntryDialog({ open, onOpenChange, defaultDate }: { open: boolean; onOpenChange: (open: boolean) => void; defaultDate?: string }) {
  const store = useAppStore();
  const skipAutoSaveRef = useRef(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const eligibleProjects = useMemo(
    () => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers)
      .filter((project) => canCreateOwnTimeEntry(store.context, project, store.state.projectMembers, store.context.userId)),
    [store.context, store.state.projectMembers, store.state.projects],
  );
  const firstProjectId = eligibleProjects[0]?.id || NO_ISSUE;

  useEffect(() => {
    if (!open) return;
    skipAutoSaveRef.current = false;
    setLines([createLine(firstProjectId, defaultDate)]);
  }, [defaultDate, firstProjectId, open]);

  async function persist(submitNow: boolean) {
    const validLines = lines.filter((line) => line.projectId !== NO_ISSUE && Number(line.hours) > 0);
    if (!validLines.length) return false;
    setSaving(true);
    for (const line of validLines) {
      const issueIds = line.issueIds.includes(NO_ISSUE) || !line.issueIds.length ? [null] : line.issueIds;
      const splitHours = Number(line.hours) / issueIds.length;
      for (const issueId of issueIds) {
        await store.createTimeEntry({
          projectId: line.projectId,
          issueId,
          workDate: line.workDate,
          hours: round(splitHours, 2),
          description: line.description,
          submit: submitNow,
        });
      }
    }
    setSaving(false);
    return true;
  }

  async function closeWithAutoSave(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (!skipAutoSaveRef.current) await persist(false);
    onOpenChange(false);
  }

  async function saveAndClose(submitNow: boolean) {
    skipAutoSaveRef.current = true;
    await persist(submitNow);
    onOpenChange(false);
  }

  function patchLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function addLine() {
    setLines((current) => [...current, createLine(current.at(-1)?.projectId || firstProjectId, current.at(-1)?.workDate || defaultDate)]);
  }

  return (
    <Dialog open={open} onOpenChange={closeWithAutoSave}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>新建工时</DialogTitle>
          <DialogDescription>按日填写工时。关闭弹窗时，已填写工时会自动保存为草稿。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lines.map((line, index) => (
            <section key={line.id} className="rounded-md border bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">记录 {index + 1}</h3>
                {lines.length > 1 ? (
                  <Button size="icon-sm" variant="ghost" aria-label="删除记录" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="日期">
                  <Input type="date" value={line.workDate} onChange={(event) => patchLine(line.id, { workDate: event.target.value })} />
                </Field>
                <Field label="项目名称">
                  <Select value={line.projectId} onValueChange={(value) => patchLine(line.id, { projectId: value, issueIds: [NO_ISSUE] })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {eligibleProjects.length ? eligibleProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>) : <SelectItem value={NO_ISSUE}>暂无可填报项目</SelectItem>}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="关联事项">
                  <IssueMultiSelect
                    disabled={line.projectId === NO_ISSUE}
                    issues={store.state.issues.filter((issue) => issue.projectId === line.projectId && !issue.deletedAt)}
                    value={line.issueIds}
                    onChange={(issueIds) => patchLine(line.id, { issueIds })}
                  />
                </Field>
                <Field label="工时">
                  <Input type="number" min="0" max="24" step="0.5" value={line.hours} onChange={(event) => patchLine(line.id, { hours: event.target.value })} placeholder="0" />
                </Field>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">描述</Label>
                  <RichTextDescription value={line.description} onChange={(description) => patchLine(line.id, { description })} />
                </div>
              </div>
            </section>
          ))}
          <Button type="button" variant="outline" onClick={addLine}><Plus className="h-4 w-4" />新增一条记录</Button>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => saveAndClose(false)}><Save className="h-4 w-4" />保存草稿</Button>
          <Button disabled={saving} onClick={() => saveAndClose(true)}><Check className="h-4 w-4" />提交审批</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueMultiSelect({ issues, value, onChange, disabled }: { issues: { id: string; code: string; title: string }[]; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  const selected = value.length ? value : [NO_ISSUE];
  const label = selected.includes(NO_ISSUE)
    ? "不关联事项"
    : issues.filter((issue) => selected.includes(issue.id)).map((issue) => issue.code).join("、") || "选择事项";

  function toggle(issueId: string) {
    if (issueId === NO_ISSUE) {
      onChange([NO_ISSUE]);
      return;
    }
    const withoutNone = selected.filter((item) => item !== NO_ISSUE);
    const next = withoutNone.includes(issueId) ? withoutNone.filter((item) => item !== issueId) : [...withoutNone, issueId];
    onChange(next.length ? next : [NO_ISSUE]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" disabled={disabled}>
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] gap-2 p-2">
        <div role="button" tabIndex={0} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => toggle(NO_ISSUE)} onKeyDown={(event) => event.key === "Enter" && toggle(NO_ISSUE)}>
          <Checkbox checked={selected.includes(NO_ISSUE)} />
          <span>不关联事项</span>
        </div>
        {issues.length ? <Separator /> : null}
        <div className="max-h-64 overflow-y-auto">
          {issues.map((issue) => (
            <div key={issue.id} role="button" tabIndex={0} className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => toggle(issue.id)} onKeyDown={(event) => event.key === "Enter" && toggle(issue.id)}>
              <Checkbox checked={selected.includes(issue.id)} />
              <span className="min-w-0">
                <span className="block truncate">{issue.code}</span>
                <span className="block truncate text-xs text-muted-foreground">{issue.title}</span>
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RichTextDescription({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  function command(name: string) {
    editorRef.current?.focus();
    document.execCommand(name);
    onChange(editorRef.current?.innerHTML || "");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-transparent bg-input/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <div className="flex items-center gap-1 border-b border-border/70 bg-background/70 px-2 py-1">
        <Button type="button" size="icon-xs" variant="ghost" aria-label="加粗" onClick={() => command("bold")}><Bold className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="斜体" onClick={() => command("italic")}><Italic className="h-3.5 w-3.5" /></Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="列表" onClick={() => command("insertUnorderedList")}><List className="h-3.5 w-3.5" /></Button>
      </div>
      <div
        ref={editorRef}
        className="min-h-28 px-3 py-2 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        contentEditable
        data-placeholder="描述今天完成的工作、沟通、联调或验收内容"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function createLine(projectId: string, date = formatDate(new Date())): DraftLine {
  return {
    id: crypto.randomUUID(),
    workDate: date || formatDate(new Date()),
    projectId,
    issueIds: [NO_ISSUE],
    hours: "",
    description: "",
  };
}

export function plainTimeDescription(value?: string | null) {
  if (!value) return "无说明";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "无说明";
}
