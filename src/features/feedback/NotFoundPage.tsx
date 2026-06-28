import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <section className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-[26px] font-semibold">页面不存在</h1>
        <p className="mt-2 text-sm text-muted-foreground">链接可能已过期，或你访问了一个尚未开放的 GridProject 路径。</p>
        <Button asChild className="mt-6"><Link to="/">返回首页</Link></Button>
      </div>
    </section>
  );
}
