import { useEffect, useRef, useState } from "react";
import { Building2, ImagePlus, Save } from "lucide-react";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/state/app-store";

export function PlatformSettingsPage() {
  const store = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    platformName: store.state.settings.platformName,
    logoUrl: store.state.settings.logoUrl || "",
  });

  useEffect(() => {
    setForm({
      platformName: store.state.settings.platformName,
      logoUrl: store.state.settings.logoUrl || "",
    });
  }, [store.state.settings]);

  async function submit() {
    await store.updateSettings(form);
  }

  async function selectLogo(file?: File) {
    if (!file) return;
    const logoUrl = await resizeLogo(file);
    setForm((current) => ({ ...current, logoUrl }));
  }

  return (
    <div>
      <PageHeading
        eyebrow="Settings"
        title="平台设置"
        description="维护当前组织在前端显示的应用名称和组织 Logo。"
        actions={<Button onClick={submit}><Save className="h-4 w-4" />保存设置</Button>}
      />
      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">基础信息</h2>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <Label className="mb-2 block">平台名称</Label>
              <Input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} />
            </div>
            <div>
              <Label className="mb-2 block">组织 Logo</Label>
              <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={(event) => selectLogo(event.target.files?.[0])} />
              <div className="flex items-center gap-3">
                <LogoPreview logoUrl={form.logoUrl} fallback={form.platformName} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" />替换</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">上传后会裁切为 100x100。</p>
            </div>
          </div>
        </section>
        <aside className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">预览</h2>
          <div className="mt-4 rounded-md border bg-background p-4">
            <div className="flex items-center gap-3">
              <LogoPreview logoUrl={form.logoUrl} fallback={form.platformName} />
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

function LogoPreview({ logoUrl, fallback }: { logoUrl?: string; fallback?: string }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : (fallback || "G").slice(0, 1)}
    </span>
  );
}

function resizeLogo(file: File) {
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
          reject(new Error("无法处理 Logo 图片。"));
          return;
        }
        const side = Math.min(image.width, image.height);
        const sourceX = (image.width - side) / 2;
        const sourceY = (image.height - side) / 2;
        context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 100, 100);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("无法读取 Logo 图片。"));
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
