import { RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { StatusBadge } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/lib/state/app-store";
import type { TrashItem } from "@/types/domain";

const retentionDays = 30;

export function TrashPage() {
  const store = useAppStore();
  const rows = [...store.state.trash].sort((a, b) => String(b.deletedAt || "").localeCompare(String(a.deletedAt || "")));
  return (
    <div>
      <PageHeading
        eyebrow="Trash"
        title="回收站"
        description="删除的项目、事项、人员或成本记录会在这里保留 30 天；过期记录不再允许恢复。"
      />
      <div className="p-4 md:p-6">
        <section className="overflow-hidden rounded-md border bg-card">
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>删除时间</TableHead>
                  <TableHead>剩余天数</TableHead>
                  <TableHead className="w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const remaining = remainingDays(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell><StatusBadge label={typeLabel(item.type)} /></TableCell>
                      <TableCell className="font-medium">{entityName(item)}</TableCell>
                      <TableCell>{formatDateTime(item.deletedAt)}</TableCell>
                      <TableCell>{remaining} 天</TableCell>
                      <TableCell>
                        <Button size="sm" disabled={remaining <= 0} onClick={() => store.restoreTrashItem(item)}><RotateCcw className="h-4 w-4" />恢复</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState
                title="回收站为空"
                description="删除的项目、任务、相关方事项、人员或成本记录会在这里保留 30 天。"
                className="min-h-80"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function remainingDays(item: TrashItem) {
  if (!item.deletedAt) return retentionDays;
  const deletedAt = new Date(item.deletedAt).getTime();
  const days = Math.floor((Date.now() - deletedAt) / 86_400_000);
  return Math.max(0, retentionDays - days);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function typeLabel(type: TrashItem["type"]) {
  return {
    project: "项目",
    issue: "事项",
    milestone: "相关方事项",
    costRecord: "成本记录",
    user: "人员",
  }[type];
}

function entityName(item: TrashItem) {
  const entity = item.entity as { name?: string; title?: string; email?: string; code?: string } | null | undefined;
  return entity?.name || entity?.title || entity?.email || entity?.code || item.entityId || item.id;
}
