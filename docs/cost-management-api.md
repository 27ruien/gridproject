# Cost Management API

成本管理在本系统中表示项目人力投入，不包含人员薪资、单价或任何货币口径。

当前仓库的 controller 与服务层入口为：

- `src/server/api/costRecordsController.js`
- `src/server/services/costCalculationService.js`
- `src/server/services/costExportService.js`
- `src/services/costService.js`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/cost-records` | 成本记录列表，支持搜索、分页、排序 |
| `POST` | `/api/cost-records` | 创建成本记录，必须提交 `plannedPersonDays` |
| `GET` | `/api/cost-records/:id` | 成本记录详情 |
| `PATCH` | `/api/cost-records/:id` | 更新计划人天、标准每日工时和备注 |
| `DELETE` | `/api/cost-records/:id` | 软删除/归档成本记录 |
| `GET` | `/api/cost-records/:id/summary` | 项目人力投入汇总 |
| `GET` | `/api/cost-records/:id/people` | 人员工时投入分组 |
| `GET` | `/api/cost-records/:id/raw-data` | 工时 Raw Data 预览 |
| `GET` | `/api/cost-records/:id/export` | 后端生成 Excel |

## Query Parameters

- `search`
- `page`
- `pageSize`
- `sort`
- `weekStart`

`weekStart` 会归一到 ISO 周一至周日，并同步作用于实际总工时、实际人天、人员投入、Top 5、Raw Data 和导出数据。`plannedPersonDays` 始终表示完整项目周期计划人天。

## Response Fields

- `plannedPersonDays`
- `standardHoursPerDay`
- `actualHours`
- `actualPersonDays`
- `remainingPersonDays`
- `personDayBurnRate`
- `participantCount`
- `people[].hours`
- `people[].personDays`
- `people[].share`

`actualHours` 和 `actualPersonDays` 不接受前端提交或持久化修改，始终由后端根据最新工时实时计算。

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
- 创建、更新、删除成本记录和导出必须写入 `AuditLog`。

## Frontend API Migration Status

当前 Vite 演示应用仍使用 localStorage adapter 展示成本模块；后端 API controller、Prisma schema、Migration 和服务层已就绪。后续接真实后端时，需要把 store adapter 替换成 `/api/cost-records` 调用，并继续复用同一套 policy 与计算服务。
