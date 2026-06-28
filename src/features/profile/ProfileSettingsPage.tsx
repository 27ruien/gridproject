import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_PREFERENCES } from "@/lib/state/seed";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";
import type { Preferences } from "@/types/domain";

type ProfileSection = "profile" | "preferences" | "security";

const navItems = [
  { href: "/profile", value: "profile", label: "个人资料", icon: UserRound },
  { href: "/profile/preferences", value: "preferences", label: "偏好设置", icon: Palette },
  { href: "/profile/security", value: "security", label: "安全设置", icon: ShieldCheck },
];

export function ProfileSettingsPage({ section }: { section: ProfileSection }) {
  const store = useAppStore();
  return (
    <div>
      <PageHeading
        eyebrow="Profile"
        title="个人设置"
        description="管理你的个人资料、显示偏好和账号安全设置。"
      />
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-md border bg-card p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.value}
              to={item.href}
              end={item.value === "profile"}
              className={({ isActive }) => cn("flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted", isActive && "bg-muted text-foreground")}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main>
          {section === "profile" ? <ProfilePanel /> : null}
          {section === "preferences" ? <PreferencesPanel /> : null}
          {section === "security" ? <SecurityPanel apiMode={store.apiMode} /> : null}
        </main>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const store = useAppStore();
  const [form, setForm] = useState({
    name: store.currentUser?.name || "",
    avatarColor: store.currentUser?.preferences?.avatarColor || DEFAULT_PREFERENCES.avatarColor,
  });

  useEffect(() => {
    setForm({
      name: store.currentUser?.name || "",
      avatarColor: store.currentUser?.preferences?.avatarColor || DEFAULT_PREFERENCES.avatarColor,
    });
  }, [store.currentUser]);

  async function submit() {
    await store.updateProfile(form);
  }

  return (
    <Panel title="个人资料" description="这些信息会用于导航头像、项目 Owner 和协作上下文展示。" action={<Button onClick={submit}><Save className="h-4 w-4" />保存资料</Button>}>
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <Field label="姓名"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="头像颜色"><Input type="color" className="h-10 p-1" value={form.avatarColor} onChange={(event) => setForm({ ...form, avatarColor: event.target.value })} /></Field>
      </div>
      <Separator className="my-4" />
      <div className="flex items-center gap-3 rounded-md border bg-background p-4">
        <span className="grid h-12 w-12 place-items-center rounded-md text-base font-semibold text-white" style={{ background: form.avatarColor }}>{form.name.slice(0, 1) || "用"}</span>
        <div>
          <strong className="block text-sm">{form.name || "未命名用户"}</strong>
          <span className="text-xs text-muted-foreground">{store.currentUser?.email}</span>
        </div>
      </div>
    </Panel>
  );
}

function PreferencesPanel() {
  const store = useAppStore();
  const current = { ...DEFAULT_PREFERENCES, ...store.currentUser?.preferences } as Preferences;
  const [form, setForm] = useState<Preferences>(current);

  useEffect(() => {
    setForm({ ...DEFAULT_PREFERENCES, ...store.currentUser?.preferences } as Preferences);
  }, [store.currentUser]);

  async function submit() {
    await store.updatePreferences(form);
  }

  return (
    <Panel title="偏好设置" description="控制列表密度、日期显示和首页待办范围。" action={<Button onClick={submit}><Save className="h-4 w-4" />保存偏好</Button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="界面密度">
          <Select value={form.density} onValueChange={(value) => setForm({ ...form, density: value as Preferences["density"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">舒适</SelectItem>
              <SelectItem value="compact">紧凑</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="日期格式">
          <Select value={form.dateFormat} onValueChange={(value) => setForm({ ...form, dateFormat: value as Preferences["dateFormat"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yyyy-mm-dd">yyyy-mm-dd</SelectItem>
              <SelectItem value="mm-dd-yyyy">mm-dd-yyyy</SelectItem>
              <SelectItem value="dd-mm-yyyy">dd-mm-yyyy</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="周起始日">
          <Select value={form.weekStart} onValueChange={(value) => setForm({ ...form, weekStart: value as Preferences["weekStart"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">周一</SelectItem>
              <SelectItem value="sunday">周日</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="默认导航">
          <Select value={form.defaultNav} onValueChange={(value) => setForm({ ...form, defaultNav: value as Preferences["defaultNav"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="expanded">展开</SelectItem>
              <SelectItem value="collapsed">收起</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="首页到期范围">
          <Select value={form.homeDueRange} onValueChange={(value) => setForm({ ...form, homeDueRange: value as Preferences["homeDueRange"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="mine">我的</SelectItem>
              <SelectItem value="others">他人</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Panel>
  );
}

function SecurityPanel({ apiMode }: { apiMode: boolean }) {
  const store = useAppStore();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  async function submit() {
    const ok = await store.updatePassword(form);
    if (ok) setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }
  return (
    <Panel title="安全设置" description={apiMode ? "更新密码后，后端会让其他设备上的登录态失效。" : "本地演示模式不保存登录密码，只展示安全设置入口。"} action={<Button onClick={submit}><ShieldCheck className="h-4 w-4" />更新密码</Button>}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="当前密码"><Input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></Field>
        <Field label="新密码"><Input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></Field>
        <Field label="确认新密码"><Input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></Field>
      </div>
    </Panel>
  );
}

function Panel({ title, description, action, children }: { title: string; description: string; action: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <Separator className="my-4" />
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label className="mb-2 block">{label}</Label>{children}</div>;
}
