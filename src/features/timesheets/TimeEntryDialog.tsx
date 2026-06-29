import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, FileText, ImageIcon, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor, plainRichText } from "@/components/shared/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { canCreateOwnTimeEntry, canEditTimeEntry, visibleProjectsForUser } from "@/lib/permissions/policies";
import { formatDate, round } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { TimeEntry, TimeEntryAttachment } from "@/types/domain";

const NO_ISSUE = "none";
const MAX_ATTACHMENTS = 9;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 6 * 1024 * 1024;

type DraftLine = {
  id: string;
  workDate: string;
  projectId: string;
  issueIds: string[];
  hours: string;
  description: string;
  attachments: TimeEntryAttachment[];
};

export function TimeEntryDialog({
  open,
  onOpenChange,
  defaultDate,
  entry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  entry?: TimeEntry | null;
}) {
  const store = useAppStore();
  const skipAutoSaveRef = useRef(false);
  const actionInProgressRef = useRef(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const editing = Boolean(entry);
  const busy = saving || closing;
  const eligibleProjects = useMemo(
    () => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers)
      .filter((project) => canCreateOwnTimeEntry(store.context, project, store.state.projectMembers, store.context.userId)),
    [store.context, store.state.projectMembers, store.state.projects],
  );
  const firstProjectId = entry?.projectId || eligibleProjects[0]?.id || NO_ISSUE;

  useEffect(() => {
    if (!open) return;
    skipAutoSaveRef.current = false;
    actionInProgressRef.current = false;
    setSaving(false);
    setClosing(false);
    setLines([entry ? createLineFromEntry(entry) : createLine(firstProjectId, defaultDate)]);
  }, [defaultDate, entry, firstProjectId, open]);

  async function persist(submitNow: boolean) {
    const validLines = lines.filter((line) => line.projectId !== NO_ISSUE && Number(line.hours) > 0);
    if (!validLines.length) return false;
    setSaving(true);
    try {
      if (entry) {
        if (!canEditTimeEntry(store.context, entry)) {
          toast.error("已提交或已审批工时不可编辑");
          return false;
        }
        const line = validLines[0];
        const issueId = line.issueIds.includes(NO_ISSUE) || !line.issueIds.length ? null : line.issueIds[0];
        const updated = await store.updateTimeEntry(entry.id, {
          issueId,
          workDate: line.workDate,
          hours: Number(line.hours),
          description: line.description,
          attachments: line.attachments,
        });
        if (updated && submitNow) await store.submitTimeEntry(entry.id);
        return Boolean(updated);
      }
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
            attachments: line.attachments,
            submit: submitNow,
          });
        }
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function closeWithAutoSave(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setClosing(true);
    try {
      if (!skipAutoSaveRef.current) await persist(false);
      onOpenChange(false);
    } finally {
      setClosing(false);
      actionInProgressRef.current = false;
    }
  }

  async function saveAndClose(submitNow: boolean) {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    try {
      const ok = await persist(submitNow);
      if (ok) {
        skipAutoSaveRef.current = true;
        onOpenChange(false);
      }
    } finally {
      actionInProgressRef.current = false;
    }
  }

  function patchLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function addLine() {
    setLines((current) => [...current, createLine(current.at(-1)?.projectId || firstProjectId, current.at(-1)?.workDate || defaultDate)]);
  }

  return (
    <Dialog open={open} onOpenChange={closeWithAutoSave}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-16">
          <DialogTitle>{editing ? "编辑工时" : "新建工时"}</DialogTitle>
          <DialogDescription>{editing ? "只能调整草稿或已驳回的工时记录；提交后进入审批流且不可编辑。" : "按日填写工时。关闭弹窗时，已填写工时会自动保存为草稿。"}</DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-4 top-4 bg-secondary"
          aria-label="关闭"
          disabled={busy}
          onClick={() => closeWithAutoSave(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {lines.map((line, index) => (
            <section key={line.id} className="rounded-md border bg-card p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">记录 {index + 1}</h3>
                {lines.length > 1 ? (
                  <Button size="icon-sm" variant="ghost" aria-label="删除记录" disabled={busy} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="日期">
                  <Input type="date" value={line.workDate} disabled={busy} onChange={(event) => patchLine(line.id, { workDate: event.target.value })} />
                </Field>
                <Field label="项目名称">
                  <Select value={line.projectId} onValueChange={(value) => patchLine(line.id, { projectId: value, issueIds: [NO_ISSUE] })} disabled={editing || busy}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {eligibleProjects.length ? eligibleProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>) : <SelectItem value={NO_ISSUE}>暂无可填报项目</SelectItem>}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="关联事项">
                  <IssueMultiSelect
                    disabled={line.projectId === NO_ISSUE || busy}
                    issues={store.state.issues.filter((issue) => issue.projectId === line.projectId && !issue.deletedAt)}
                    value={line.issueIds}
                    onChange={(issueIds) => patchLine(line.id, { issueIds })}
                    multiple={!editing}
                  />
                </Field>
                <Field label="工时">
                  <Input type="number" min="0" max="24" step="0.5" value={line.hours} disabled={busy} onChange={(event) => patchLine(line.id, { hours: event.target.value })} placeholder="0" />
                </Field>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">描述</Label>
                  <RichTextEditor value={line.description} onChange={(description) => patchLine(line.id, { description })} placeholder="描述今天完成的工作、沟通、联调或验收内容" />
                </div>
                <div className="md:col-span-2">
                  <AttachmentPicker value={line.attachments} disabled={busy} onChange={(attachments) => patchLine(line.id, { attachments })} />
                </div>
              </div>
            </section>
          ))}
          {!editing ? <Button type="button" variant="outline" disabled={busy} onClick={addLine}><Plus className="h-4 w-4" />新增一条记录</Button> : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" disabled={busy} onClick={() => saveAndClose(false)}><Save className="h-4 w-4" />{editing ? "保存" : "保存草稿"}</Button>
          <Button disabled={busy} onClick={() => saveAndClose(true)}><Check className="h-4 w-4" />提交审批</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: TimeEntryAttachment[];
  onChange: (value: TimeEntryAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalBytes = value.reduce((sum, attachment) => sum + Number(attachment.size || 0), 0);

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return;
    const incoming = Array.from(files);
    if (value.length + incoming.length > MAX_ATTACHMENTS) {
      toast.error(`附件最多上传 ${MAX_ATTACHMENTS} 个`);
      return;
    }
    const oversized = incoming.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      toast.error(`单个附件不能超过 ${formatFileSize(MAX_ATTACHMENT_BYTES)}：${oversized.name}`);
      return;
    }
    const nextTotal = totalBytes + incoming.reduce((sum, file) => sum + file.size, 0);
    if (nextTotal > MAX_ATTACHMENT_TOTAL_BYTES) {
      toast.error(`附件总大小不能超过 ${formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}`);
      return;
    }
    const attachments = await Promise.all(incoming.map(async (file) => ({
      id: makeAttachmentId(),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      kind: file.type.startsWith("image/") ? "image" as const : "file" as const,
      dataUrl: await fileToDataUrl(file),
      createdAt: new Date().toISOString(),
    })));
    onChange([...value, ...attachments]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    onChange(value.filter((attachment) => attachment.id !== id));
  }

  return (
    <section className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">附件</Label>
          <p className="mt-1 text-xs text-muted-foreground">最多 {MAX_ATTACHMENTS} 个，单个 {formatFileSize(MAX_ATTACHMENT_BYTES)}，总计 {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}。</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={disabled || value.length >= MAX_ATTACHMENTS} onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
          上传附件
        </Button>
        <Input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
      </div>
      {value.length ? (
        <div className="mt-3 grid gap-2">
          {value.map((attachment) => (
            <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                {attachment.kind === "image" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <a className="block truncate text-sm font-medium text-foreground underline-offset-4 hover:underline" href={attachment.dataUrl} download={attachment.name}>
                  {attachment.name}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[11px]">{attachment.kind === "image" ? "图片" : "文件"}</Badge>
                  <span>{formatFileSize(attachment.size)}</span>
                  {attachment.type ? <span className="truncate">{attachment.type}</span> : null}
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`移除 ${attachment.name}`} disabled={disabled} onClick={() => removeAttachment(attachment.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">暂无附件，图片和文件会独立保存，不进入描述富文本。</p>
      )}
    </section>
  );
}

export function TimeEntryAttachmentList({ attachments }: { attachments?: TimeEntryAttachment[] }) {
  if (!attachments?.length) {
    return <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">暂无附件</p>;
  }
  return (
    <div className="grid gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            {attachment.kind === "image" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <a className="block truncate text-sm font-medium text-foreground underline-offset-4 hover:underline" href={attachment.dataUrl} download={attachment.name}>
              {attachment.name}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[11px]">{attachment.kind === "image" ? "图片" : "文件"}</Badge>
              <span>{formatFileSize(attachment.size)}</span>
              {attachment.type ? <span className="truncate">{attachment.type}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IssueMultiSelect({
  issues,
  value,
  onChange,
  disabled,
  multiple = true,
}: {
  issues: { id: string; code: string; title: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}) {
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
    if (!multiple) {
      onChange([issueId]);
      return;
    }
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
        <div role="button" tabIndex={0} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => toggle(NO_ISSUE)} onKeyDown={(event) => event.key === "Enter" && toggle(NO_ISSUE)}>
          <Checkbox checked={selected.includes(NO_ISSUE)} />
          <span>不关联事项</span>
        </div>
        {issues.length ? <Separator /> : null}
        <div className="max-h-64 overflow-y-auto">
          {issues.map((issue) => (
            <div key={issue.id} role="button" tabIndex={0} className="flex w-full cursor-pointer items-start gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => toggle(issue.id)} onKeyDown={(event) => event.key === "Enter" && toggle(issue.id)}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function createLine(projectId: string, date = formatDate(new Date())): DraftLine {
  return {
    id: makeAttachmentId(),
    workDate: date || formatDate(new Date()),
    projectId,
    issueIds: [NO_ISSUE],
    hours: "",
    description: "",
    attachments: [],
  };
}

function createLineFromEntry(entry: TimeEntry): DraftLine {
  return {
    id: entry.id,
    workDate: entry.workDate || formatDate(new Date()),
    projectId: entry.projectId,
    issueIds: entry.issueId ? [entry.issueId] : [NO_ISSUE],
    hours: String(entry.hours || ""),
    description: entry.description || entry.note || "",
    attachments: entry.attachments || [],
  };
}

export function plainTimeDescription(value?: string | null) {
  return plainRichText(value);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(value: number | string | undefined) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function makeAttachmentId() {
  return globalThis.crypto?.randomUUID?.() || `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
