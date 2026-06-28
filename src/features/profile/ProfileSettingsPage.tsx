import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ImagePlus, Save, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";

type ProfileSection = "profile" | "security";

const navItems = [
  { href: "/profile", value: "profile", label: "个人资料", icon: UserRound },
  { href: "/profile/security", value: "security", label: "安全设置", icon: ShieldCheck },
];

export function ProfileSettingsPage({ section }: { section: ProfileSection }) {
  const store = useAppStore();
  return (
    <div>
      <PageHeading
        eyebrow="Profile"
        title="个人设置"
        description="管理你的个人资料、头像和账号安全设置。"
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
          {section === "security" ? <SecurityPanel apiMode={store.apiMode} /> : null}
        </main>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: store.currentUser?.name || "",
    avatarUrl: store.currentUser?.preferences?.avatarUrl || "",
  });

  useEffect(() => {
    setForm({
      name: store.currentUser?.name || "",
      avatarUrl: store.currentUser?.preferences?.avatarUrl || "",
    });
  }, [store.currentUser]);

  async function submit() {
    await store.updateProfile(form);
  }

  async function selectAvatar(file?: File) {
    if (!file) return;
    const avatarUrl = await resizeAvatar(file);
    setForm((current) => ({ ...current, avatarUrl }));
  }

  return (
    <Panel title="个人资料" description="这些信息会用于导航头像、项目所有人和协作上下文展示。" action={<Button onClick={submit}><Save className="h-4 w-4" />保存资料</Button>}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <Field label="姓名"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <div>
          <Label className="mb-2 block">头像</Label>
          <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={(event) => selectAvatar(event.target.files?.[0])} />
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {form.avatarUrl ? <AvatarImage src={form.avatarUrl} alt="" /> : null}
              <AvatarFallback>{form.name.slice(0, 1) || "用"}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" />替换头像</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">上传后会裁切为 100x100。</p>
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex items-center gap-3 rounded-md border bg-background p-4">
        <Avatar className="size-12">
          {form.avatarUrl ? <AvatarImage src={form.avatarUrl} alt="" /> : null}
          <AvatarFallback>{form.name.slice(0, 1) || "用"}</AvatarFallback>
        </Avatar>
        <div>
          <strong className="block text-sm">{form.name || "未命名用户"}</strong>
          <span className="text-xs text-muted-foreground">{store.currentUser?.email}</span>
        </div>
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

function resizeAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("无法处理头像图片。"));
          return;
        }
        const side = Math.min(image.width, image.height);
        const sourceX = (image.width - side) / 2;
        const sourceY = (image.height - side) / 2;
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 100, 100);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("无法读取头像图片。"));
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
