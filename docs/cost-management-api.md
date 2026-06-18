# Cost Management API

当前仓库新增了后端 controller 与服务层实现，文件入口为：

- `src/server/api/costRecordsController.js`
- `src/server/services/costCalculationService.js`
- `src/server/services/costExportService.js`
- `src/services/costService.js`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/cost-records` | 成本记录列表，支持搜索、分页、排序 |
| `POST` | `/api/cost-records` | 创建成本记录，同时创建第一条费率 |
| `GET` | `/api/cost-records/:id` | 成本记录详情 |
| `PATCH` | `/api/cost-records/:id` | 更新成本设置；人天成本变化时新增费率历史 |
| `DELETE` | `/api/cost-records/:id` | 软删除/归档成本记录 |
| `GET` | `/api/cost-records/:id/summary` | 项目成本汇总 |
| `GET` | `/api/cost-records/:id/people` | 人员成本分组 |
| `GET` | `/api/cost-records/:id/raw-data` | 工时 Raw Data 预览 |
| `GET` | `/api/cost-records/:id/export` | 后端生成 Excel |

## Query Parameters

- `search`
- `page`
- `pageSize`
- `sort`
- `weekStart`

`weekStart` 会归一到 ISO 周一至周日，所有汇总、人员排行、Raw Data 和导出使用同一筛选条件。

## Error Format

```json
{
  "requestId": "req-...",
  "error": {
    "code": "FORBIDDEN",
    "message": "没有权限访问该资源。"
  }
}
```

## Security Rules

- 所有接口必须验证 Session。
- 所有查询限制 `organizationId = currentOrganizationId`。
- 成本接口只允许 `ADMIN` 或项目 Owner。
- 创建和更新时禁止通过修改 `projectId` 越权。
- 修改费率、删除成本记录、导出必须写入 `AuditLog`。

## Frontend API Migration Status

当前 Vite 演示应用仍使用 localStorage adapter 展示成本模块；后端 API controller、Prisma schema 和服务层已就绪。尚未完成的迁移项：

- 将 `CostManagementView` 的列表、详情、创建、更新和导出从 localStorage 切换到真实 `/api/cost-records`。
- 将项目详情接口改为真实后端返回 `permissions` 对象。
- 将工时页面的数据范围切换到 `TimeEntryAccessPolicy.timeEntryWhereForUser` 的服务端查询。
- 将 Excel 导出按钮接入真实 `/api/cost-records/:id/export` 二进制响应。

