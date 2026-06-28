import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/state/app-store";

export function PlatformSettingsPage() {
  const store = useAppStore();
  const [form, setForm] = useState({
    platformName: store.state.settings.platformName,
    logoText: store.state.settings.logoText,
  });

  useEffect(() => {
    setForm({
      platformName: store.state.settings.platformName,
      logoText: store.state.settings.logoText,
    });
  }, [store.state.settings]);

  async function submit() {
    await store.updateSettings(form);
  }

  return (
    <div>
      <PageHeading
        eyebrow="Settings"
        title="平台设置"
        description="维护当前组织在前端显示的应用名称和短 Logo 文案。"
        actions={<Button onClick={submit}><Save className="h-4 w-4" />保存设置</Button>}
      />
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">基础信息</h2>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-2 block">平台名称</Label>
              <Input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">Logo 文案</Label>
              <Input maxLength={2} value={form.logoText} onChange={(event) => setForm({ ...form, logoText: event.target.value })} />
            </div>
          </div>
        </section>
        <aside className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">预览</h2>
          <div className="mt-4 rounded-md border bg-background p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{(form.logoText || "G").slice(0, 2)}</span>
              <div>
                <strong className="block text-sm">{form.platformName || "GridProject"}</strong>
                <span className="text-xs text-muted-foreground">组织：{store.state.organization.name}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
