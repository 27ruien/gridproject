import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("React render error", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-[24px] font-semibold">页面出现异常</h1>
          <p className="mt-2 text-sm text-muted-foreground">当前页面渲染失败，请刷新后重试；如果问题持续存在，请保留当前路径并联系管理员。</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>刷新页面</Button>
        </section>
      </main>
    );
  }
}
