# GridProject Database Model

本模型面向开发数据库 `127.0.0.1:5432/gridproject_dev`，禁止用于 `127.0.0.1:5433/gridproject_prod`。本次迁移使用 Prisma Migration，未使用 `prisma db push` 或 `prisma migrate reset`。

## Existing Model Review

- 当前前端演示模型以 `Project.owner`、`Issue.owner`、`TimeEntry.reporter/spentDate` 等展示字段为主，适合 localStorage 演示，但不足以表达组织隔离、动态 Owner 权限和工时/成本敏感数据范围。
- `localStorageAdapter` 和 service 接口仍保留，新增字段通过 normalize 兼容旧数据：`organizationId`、`ownerId`、`userId`、`workDate`、`projectMembers`、`costRecords`、`costRates`。
- 当前没有生产后端目录和 Prisma 文件，本次新增 `prisma/schema.prisma`、正式 migration、`src/server/policies/*`、`src/server/services/*` 和成本 API controller。

## Core Entities

- `Organization`：当前系统只有一个组织业务层级。
- `User`：组织内用户，角色仅 `ADMIN`、`MEMBER`，状态为 `ACTIVE` 或 `INACTIVE`。
- `Project`：项目主表，包含 `organizationId`、`ownerId`、`createdById`、软删除字段 `deletedAt/deletedById`。
- `ProjectMember`：项目相关人表，`Project.ownerId` 与 ACTIVE ProjectMember 共同定义项目相关人。
- `Issue`：事项，保留项目事项、状态、优先级、负责人等字段。
- `TimeEntry`：工时，状态为 `DRAFT/SUBMITTED/APPROVED/REJECTED`，金额和工时使用 Decimal。
- `ProjectCostRecord`：项目成本管理记录，一个项目唯一一条记录，默认 `ACTIVE`。
- `ProjectCostRate`：人天成本费率历史，修改成本时关闭旧费率并新增新费率。
- `AuditLog`：项目创建、Owner 变更、成本变更、导出等敏感操作审计。

## Cost Tables

`ProjectCostRecord`

| Field | Notes |
| --- | --- |
| `id` | 主键 |
| `organizationId` | 组织隔离 |
| `projectId` | 唯一，关联 Project |
| `currency` | 默认 `CNY` |
| `standardHoursPerDay` | Decimal，默认 8 |
| `status` | `ACTIVE/ARCHIVED` |
| `notes` | 备注 |
| `createdById/updatedById/deletedById` | 操作人 |
| `deletedAt` | 软删除 |

`ProjectCostRate`

| Field | Notes |
| --- | --- |
| `projectCostRecordId` | 成本记录 |
| `amountPerPersonDay` | Decimal / PostgreSQL NUMERIC |
| `effectiveFrom/effectiveTo` | 生效区间，`[effectiveFrom, effectiveTo)` |
| `createdById` | 创建人 |

## Indexes And Constraints

- `ProjectCostRecord.projectId` unique。
- `ProjectCostRecord(organizationId, status)` index。
- `ProjectCostRate(projectCostRecordId, effectiveFrom)` index。
- `TimeEntry(projectId, workDate, status)` index。
- `TimeEntry(projectId, userId, workDate)` index。
- `ProjectMember(projectId, userId)` unique。
- `ProjectCostRate` 使用 PostgreSQL GiST exclusion constraint 防止同一成本记录的费率区间重叠。

## Cost Calculation

统一由 `CostCalculationService` 调用 `src/domain/cost.js` 计算：

```text
人员人天 = 人员工时 / standardHoursPerDay
人员成本 = 人员工时 / standardHoursPerDay × TimeEntry.workDate 当日生效 amountPerPersonDay
项目总成本 = 所有人员成本合计
```

默认纳入 `SUBMITTED` 和 `APPROVED` 工时，排除 `DRAFT`、`REJECTED`、`deletedAt IS NOT NULL`。金额使用 Decimal 计算，展示保留两位小数。

