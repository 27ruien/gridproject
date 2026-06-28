import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: store.apiMode ? "" : "linxia@gridproject.local", password: "" },
  });
  const from = (location.state as { from?: string } | null)?.from || "/";

  if (store.authenticated && !searchParams.has("preview")) return <Navigate to="/" replace />;

  async function submit(values: z.infer<typeof loginSchema>) {
    const ok = await store.login(values);
    if (ok) navigate(from, { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <section className="w-full max-w-sm rounded-md border bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase text-muted-foreground">GridProject</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-normal">登录工作空间</h1>
        <p className="mt-1 text-sm text-muted-foreground">{store.apiMode ? "使用现有后端账号登录，系统会通过 HttpOnly Cookie 恢复会话。" : "本地演示模式可选择不同角色验证权限；API 模式仍连接后端会话。"}</p>
        <Form {...form}>
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)}>
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
                  <FormControl><Input autoComplete="current-password" type="password" {...field} /></FormControl>
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
      </section>
    </main>
  );
}
