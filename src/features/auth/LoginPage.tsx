import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validation/schemas";
import { useAppStore } from "@/lib/state/app-store";
import { DEMO_USERS } from "@/lib/state/seed";

export function LoginPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const platformName = store.state.settings.platformName || "GridProject";
  const logoText = store.state.settings.logoText || platformName.slice(0, 1);
  const logoUrl = store.state.settings.logoUrl || "";
  const organizationName = store.state.organization.name || "组织工作台";
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: store.apiMode ? "" : "linxia@gridproject.local", password: "" },
  });
  const from = (location.state as { from?: string } | null)?.from || "/";

  if (store.authenticated && !searchParams.has("preview")) return <Navigate to={from} replace />;

  async function submit(values: z.infer<typeof loginSchema>) {
    const ok = await store.login(values);
    if (ok) navigate(from, { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-6">
          <header className="space-y-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
                {logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : logoText.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{platformName}</span>
                <span className="block truncate text-xs text-muted-foreground">{organizationName}</span>
              </span>
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-normal">登录工作空间</h1>
            </div>
          </header>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl><Input autoComplete="email" type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl><PasswordInput autoComplete="current-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root?.message ? (
              <Alert variant="destructive"><AlertDescription>{form.formState.errors.root.message}</AlertDescription></Alert>
            ) : null}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              登录
            </Button>
          </form>
        </Form>
        {!store.apiMode ? (
          <div className="mt-4 grid gap-2">
            {DEMO_USERS.slice(0, 4).map((user) => (
              <Button
                key={user.id}
                type="button"
                variant="outline"
                onClick={() => {
                  form.setValue("email", user.email);
                  form.setValue("password", "demo-password");
                }}
              >
                {user.name} · {user.role === "ADMIN" ? "管理员" : "成员"}
              </Button>
            ))}
          </div>
        ) : null}
        </CardContent>
      </Card>
    </main>
  );
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
