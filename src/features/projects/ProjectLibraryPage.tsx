import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RotateCcw, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { ProjectCard } from "@/components/shared/project-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canCreateProject, visibleProjectsForUser } from "@/lib/permissions/policies";
import { PROJECT_STATUS_OPTIONS, summarizeProject } from "@/lib/state/calculations";
import { useAppStore } from "@/lib/state/app-store";
import type { Project } from "@/types/domain";

const EMPTY_USER = "none";
const roleFields = [
  { key: "commercialOwnerId", label: "商务" },
  { key: "projectManagerId", label: "项目经理" },
  { key: "designGroupId", label: "设计组" },
  { key: "contentGroupId", label: "内容组" },
  { key: "effectsGroupId", label: "特效组" },
  { key: "qaId", label: "QA" },
] as const;

export function ProjectLibraryPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const visibleProjects = useMemo(() => visibleProjectsForUser(store.context, store.state.projects, store.state.projectMembers), [store.context, store.state.projects, store.state.projectMembers]);
  const rows = visibleProjects
    .filter((project) => !query.trim() || `${project.name} ${project.code} ${project.description}`.toLowerCase().includes(query.toLowerCase()))
    .filter((project) => status === "all" || project.status === status)
    .sort((a, b) => {
      if (sort === "risk") return summarizeProject(b, store.state.issues.filter((issue) => issue.projectId === b.id)).riskCount - summarizeProject(a, store.state.issues.filter((issue) => issue.projectId === a.id)).riskCount;
      if (sort === "release") return String(a.releaseDate || "9999").localeCompare(String(b.releaseDate || "9999"));
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

  return (
    <div className="min-w-0">
      <PageHeading
        eyebrow="Projects"
        title="项目列表"
        description="以项目卡片组织工作流，支持搜索、筛选、创建、编辑和权限控制。"
        actions={canCreateProject(store.context) ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />创建项目</Button> : null}
      />
      <section className="min-w-0 border-b bg-card px-4 py-3 md:px-6">
        <div className="grid min-w-0 items-center gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_minmax(150px,180px)_minmax(150px,170px)_auto]">
          <label className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="min-w-0 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目名称、代码或描述" />
          </label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="项目状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {PROJECT_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="排序" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">最近更新</SelectItem>
              <SelectItem value="risk">风险优先</SelectItem>
              <SelectItem value="release">上线日期</SelectItem>
              <SelectItem value="name">项目名称</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full xl:w-auto" variant="outline" onClick={() => { setQuery(""); setStatus("all"); setSort("updated"); }}><RotateCcw className="h-4 w-4" />重置</Button>
        </div>
      </section>
      <section className="min-w-0 p-4 md:p-6">
        {rows.length ? (
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                issues={store.state.issues.filter((issue) => issue.projectId === project.id)}
                owner={store.state.users.find((user) => user.id === project.ownerId)}
                onOpen={() => navigate(`/projects/${project.id}`)}
                onEdit={store.getProjectPermissions(project.id).canUpdate ? () => setEditingProject(project) : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="没有符合条件的项目" description="调整搜索或筛选条件后再试。" action="清除筛选" onAction={() => { setQuery(""); setStatus("all"); }} />
        )}
      </section>
      <ProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ProjectDialog open={Boolean(editingProject)} onOpenChange={(open) => !open && setEditingProject(null)} project={editingProject} />
    </div>
  );
}

export function ProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project?: Project | null }) {
  const store = useAppStore();
  const activeUsers = store.state.users.filter((user) => user.status === "ACTIVE");
  const [form, setForm] = useState({
    name: project?.name || "",
    code: project?.code || "",
    ownerId: project?.ownerId || store.context.userId,
    status: project?.status || "规划中",
    commercialOwnerId: project?.commercialOwnerId || EMPTY_USER,
    projectManagerId: project?.projectManagerId || EMPTY_USER,
    designGroupId: project?.designGroupId || EMPTY_USER,
    contentGroupId: project?.contentGroupId || EMPTY_USER,
    effectsGroupId: project?.effectsGroupId || EMPTY_USER,
    qaId: project?.qaId || EMPTY_USER,
    description: project?.description || "",
    startDate: project?.startDate || "",
    testDate: project?.testDate || "",
    acceptanceDate: project?.acceptanceDate || "",
    releaseDate: project?.releaseDate || "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: project?.name || "",
      code: project?.code || "",
      ownerId: project?.ownerId || store.context.userId,
      status: project?.status || "规划中",
      commercialOwnerId: project?.commercialOwnerId || EMPTY_USER,
      projectManagerId: project?.projectManagerId || EMPTY_USER,
      designGroupId: project?.designGroupId || EMPTY_USER,
      contentGroupId: project?.contentGroupId || EMPTY_USER,
      effectsGroupId: project?.effectsGroupId || EMPTY_USER,
      qaId: project?.qaId || EMPTY_USER,
      description: project?.description || "",
      startDate: project?.startDate || "",
      testDate: project?.testDate || "",
      acceptanceDate: project?.acceptanceDate || "",
      releaseDate: project?.releaseDate || "",
    });
  }, [open, project, store.context.userId]);

  async function submit() {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      templateId: project?.templateId || "agile",
      ownerId: project ? form.ownerId : store.context.userId,
      commercialOwnerId: normalizeUserId(form.commercialOwnerId),
      projectManagerId: normalizeUserId(form.projectManagerId),
      designGroupId: normalizeUserId(form.designGroupId),
      contentGroupId: normalizeUserId(form.contentGroupId),
      effectsGroupId: normalizeUserId(form.effectsGroupId),
      qaId: normalizeUserId(form.qaId),
    } as Partial<Project>;
    const result = project ? await store.updateProject(project.id, payload) : await store.createProject(payload);
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>{project ? "编辑项目" : "创建项目"}</DialogTitle>
          <DialogDescription>创建后可在项目详情中导入排期；项目所有人默认是创建人，编辑时可转移。</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4 md:grid-cols-2">
          <Field label="项目名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="项目代码"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          {project ? (
            <Field label="项目所有人">
              <UserSelect value={form.ownerId} users={activeUsers} onChange={(ownerId) => setForm({ ...form, ownerId })} allowEmpty={false} />
            </Field>
          ) : (
            <Field label="项目所有人">
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">{store.currentUser?.name || "当前创建人"}</div>
            </Field>
          )}
          <Field label="状态">
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {roleFields.map((field) => (
            <Field key={field.key} label={field.label}>
              <UserSelect value={form[field.key]} users={activeUsers} onChange={(value) => setForm({ ...form, [field.key]: value })} />
            </Field>
          ))}
          <Field label="开始日期"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="测试日期"><Input type="date" value={form.testDate} onChange={(event) => setForm({ ...form, testDate: event.target.value })} /></Field>
          <Field label="验收日期"><Input type="date" value={form.acceptanceDate} onChange={(event) => setForm({ ...form, acceptanceDate: event.target.value })} /></Field>
          <Field label="上线日期"><Input type="date" value={form.releaseDate} onChange={(event) => setForm({ ...form, releaseDate: event.target.value })} /></Field>
          <Field label="项目描述" className="md:col-span-2"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={!form.name.trim()}>{project ? "保存" : "创建"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block">{label}</Label>{children}</div>;
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

function normalizeUserId(value: string) {
  return value === EMPTY_USER ? null : value;
}
