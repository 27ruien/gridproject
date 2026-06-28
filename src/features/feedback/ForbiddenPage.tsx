import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ForbiddenPage() {
  return (
    <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-6">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="mt-4 text-[24px] font-semibold">没有访问权限</h1>
        <p className="mt-2 text-sm text-muted-foreground">当前账号没有访问该页面或执行该操作所需的权限。请返回可访问的工作流页面。</p>
        <Button asChild className="mt-6"><Link to="/">返回首页</Link></Button>
      </div>
    </section>
  );
}
