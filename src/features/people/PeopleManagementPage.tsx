import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Plus, Search, Trash2, UserRoundCog } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { managedProjectsForUser } from "@/lib/permissions/policies";
import { useAppStore } from "@/lib/state/app-store";
import type { OrganizationRole, User, UserStatus } from "@/types/domain";

export function PeopleManagementPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const rows = store.state.users
    .filter((user) => status === "all" || user.status === status)
    .filter((user) => !query.trim() || `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const managedProjects = managedProjectsForUser(store.context, store.state.projects);
  const stats = useMemo(() => ({
    active: store.state.users.filter((user) => user.status === "ACTIVE").length,
    admins: store.state.users.filter((user) => user.role === "ADMIN" && user.status === "ACTIVE").length,
  }), [store.state.users]);

  return (
    <div>
      <PageHeading
        eyebrow="People"
        title="人员管理"
        description="维护组织用户、角色、状态和初始/重置密码；项目成员关系仍在项目内管理。"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建人员</Button>}
      />
      <section className="border-b bg-card px-4 py-3 md:px-6">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、邮箱或角色" />
          </label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="ACTIVE">启用</SelectItem>
              <SelectItem value="INACTIVE">停用</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">拥有项目</TableHead>
                <TableHead className="text-right">参与项目</TableHead>
                <TableHead className="w-36">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const ownerProjects = store.state.projects.filter((project) => project.ownerId === user.id && !project.deletedAt);
                const memberProjects = store.state.projectMembers.filter((member) => member.userId === user.id && member.status === "ACTIVE");
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role === "ADMIN" ? "管理员" : "成员"}</TableCell>
                    <TableCell><StatusBadge label={user.status === "ACTIVE" ? "启用" : "停用"} tone={user.status === "ACTIVE" ? "success" : "warn"} /></TableCell>
                    <TableCell className="text-right">{ownerProjects.length}</TableCell>
                    <TableCell className="text-right">{memberProjects.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="编辑人员" onClick={(event) => { event.stopPropagation(); setEditing(user); }}><UserRoundCog className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="重置密码" onClick={(event) => { event.stopPropagation(); setResetting(user); }}><KeyRound className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="停用人员" disabled={ownerProjects.length > 0} onClick={(event) => { event.stopPropagation(); store.deleteUser(user.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length ? <div className="p-4"><EmptyState title="没有匹配人员" description="调整筛选条件或创建新的组织成员。" /></div> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">组织概览</h2>
            <div className="mt-4 grid gap-3">
              <Metric label="启用人员" value={`${stats.active}`} />
              <Metric label="管理员" value={`${stats.admins}`} />
              <Metric label="可管理项目" value={`${managedProjects.length}`} />
            </div>
          </section>
        </aside>
      </div>
      <UserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} user={editing} />
      <PasswordDialog user={resetting} onOpenChange={(open) => !open && setResetting(null)} />
    </div>
  );
}

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user?: User | null }) {
  const store = useAppStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "MEMBER",
    status: user?.status || "ACTIVE",
    initialPassword: "",
    confirmInitialPassword: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "MEMBER",
      status: user?.status || "ACTIVE",
      initialPassword: "",
      confirmInitialPassword: "",
    });
  }, [open, user]);

  async function submit() {
    if (!form.name.trim() || !form.email.trim()) return;
    const ok = user
      ? await store.updateUser(user.id, { name: form.name, email: form.email, role: form.role as User["role"], status: form.status as User["status"] })
      : await store.createUser({
        name: form.name,
        email: form.email,
        role: form.role,
        initialPassword: form.initialPassword,
        confirmInitialPassword: form.confirmInitialPassword,
      });
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "编辑人员" : "新建人员"}</DialogTitle>
          <DialogDescription>{user ? "调整用户基础资料、角色和启停状态。" : "创建用户时需要提供初始密码并由后端安全保存。"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="姓名"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="邮箱"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="角色">
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as OrganizationRole })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">成员</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {user ? (
              <Field label="状态">
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as UserStatus })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          {!user ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="初始密码"><PasswordInput value={form.initialPassword} onChange={(event) => setForm({ ...form, initialPassword: event.target.value })} /></Field>
              <Field label="确认密码"><PasswordInput value={form.confirmInitialPassword} onChange={(event) => setForm({ ...form, confirmInitialPassword: event.target.value })} /></Field>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onOpenChange }: { user: User | null; onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const [form, setForm] = useState({ newPassword: "", confirmNewPassword: "" });

  useEffect(() => {
    if (user) setForm({ newPassword: "", confirmNewPassword: "" });
  }, [user]);

  async function submit() {
    if (!user) return;
    const ok = await store.resetUserPassword(user.id, form);
    if (ok) {
      setForm({ newPassword: "", confirmNewPassword: "" });
      onOpenChange(false);
    }
  }
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>{user?.name} 下次登录可使用新密码。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="新密码"><PasswordInput value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></Field>
          <Field label="确认新密码"><PasswordInput value={form.confirmNewPassword} onChange={(event) => setForm({ ...form, confirmNewPassword: event.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!form.newPassword || form.newPassword !== form.confirmNewPassword} onClick={submit}>确认重置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input className="pr-10" type={visible ? "text" : "password"} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={visible ? "隐藏密码" : "查看密码"}
        onClick={() => setVisible((value) => !value)}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}
