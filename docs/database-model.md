# GridProject Database Model

本模型面向开发数据库 `127.0.0.1:5432/gridproject_dev`。开发和测试环境禁止连接 `127.0.0.1:5433/gridproject_prod`。本次继续使用正式 Prisma Migration，未使用 `prisma db push` 或 `prisma migrate reset`。

当前迁移历史已整理为 `20260619090000_initial_backend_schema`。如果某个旧开发库已经应用过更早的成本/人员迁移，不要直接在该库上叠加本迁移；应新建干净的 dev DB，或单独制定前向迁移策略。

## Model Choice

当前仓库仍采用简化的单组织用户模型：`User` 直接保存 `organizationId`、`role` 和 `status`，本次没有新增 `OrganizationMember` 表，避免同时维护两套角色来源。

`localStorageAdapter` 和 service 接口仍保留，新增 `apiAdapter` 可在 `VITE_DATA_SOURCE=api` 时从后端 hydrate页面启动所需的安全数据：`organizationId`、`ownerId`、`userId`、`workDate`、`projectMembers`、`costRecords`。API bootstrap 不返回 `sessions` 或 `auditLogs`。

## Core Entities

- `Organization`：当前系统只有一个组织业务层级。
- `User`：组织内用户，角色仅 `ADMIN`、`MEMBER`，状态为 `ACTIVE` 或 `INACTIVE`，保存 `passwordHash`、`lastLoginAt`、`deletedAt/deletedById`。
- `Session`：用户会话，重置密码时将该用户现有未撤销 Session 标记为失效。
- `Project`：项目主表，包含 `organizationId`、`ownerId`、`createdById`、软删除字段 `deletedAt/deletedById`。
- `ProjectMember`：项目相关人表，`Project.ownerId` 与 ACTIVE ProjectMember 共同定义项目相关人。
- `Issue`：事项，保留项目事项、状态、优先级、负责人等字段。
- `TimeEntry`：工时，状态为 `DRAFT/SUBMITTED/APPROVED/REJECTED`，工时使用 Decimal。
- `ProjectCostRecord`：项目人力投入管理记录，一个项目唯一一条记录，默认 `ACTIVE`。
- `AuditLog`：项目创建、Owner 变更、人员管理、成本记录变更、导出等敏感操作审计。

## Time And Date Types

- 审计、会话和生命周期时间均使用 `DateTime @db.Timestamptz(3)`：`createdAt`、`updatedAt`、`deletedAt`、`joinedAt`、`approvedAt`、`expiresAt`、`lastLoginAt`。
- 业务日期使用 PostgreSQL `date`：`Project.startDate/dueDate/testDate/acceptanceDate/releaseDate`、`Issue.startDate/dueDate`、`Milestone.dueDate`、`TimeEntry.workDate`。
- `workDate` 表示用户填报的工作日，不表达具体时区瞬间，因此保留为 date，并在 API 中输出 `YYYY-MM-DD`。

## User Fields

| Field | Notes |
| --- | --- |
| `id` | 主键 |
| `organizationId` | 组织隔离 |
| `name` / `email` | 邮箱在同一组织下唯一 |
| `passwordHash` | Argon2id PHC 编码哈希，不返回给 API 或前端详情 |
| `role` | `ADMIN/MEMBER` |
| `status` | `ACTIVE/INACTIVE` |
| `lastLoginAt` | 最近登录时间 |
| `deletedAt/deletedById` | 软删除操作者与时间 |
| `createdAt/updatedAt` | 审计时间 |

## Cost Tables

`ProjectCostRecord`

| Field | Notes |
| --- | --- |
| `id` | 主键 |
| `organizationId` | 组织隔离 |
| `projectId` | 唯一，关联 Project |
| `plannedPersonDays` | Decimal，项目完整周期计划投入人天，必填且大于 0 |
| `standardHoursPerDay` | Decimal，默认 8，大于 0 且不超过 24 |
| `status` | `ACTIVE/ARCHIVED` |
| `notes` | 备注 |
| `createdById/updatedById/deletedById` | 操作人 |
| `deletedAt` | 软删除 |

## Indexes And Constraints

- `User(organizationId, email)` unique。
- `User(organizationId, status)` index。
- `User(organizationId, role)` index。
- `Session(organizationId, userId, revokedAt)` index。
- `ProjectCostRecord.projectId` unique。
- `ProjectCostRecord(organizationId, status)` index。
- `ProjectCostRecord.plannedPersonDays > 0` check。
- `ProjectCostRecord.standardHoursPerDay > 0 AND <= 24` check。
- `TimeEntry(projectId, workDate, status)` index。
- `TimeEntry(projectId, userId, workDate)` index。
- `ProjectMember(projectId, userId)` unique。

## Cost Calculation

统一由 `server/src/services/costCalculation.ts` 计算：

```text
实际总工时 = 符合条件的 TimeEntry.hours 合计
实际人天 = 实际总工时 / standardHoursPerDay
剩余人天 = plannedPersonDays - 实际人天
人天消耗率 = 实际人天 / plannedPersonDays × 100%
人员工时占比 = 人员实际工时 / 项目实际总工时
```

默认纳入 `SUBMITTED` 和 `APPROVED` 工时，排除 `DRAFT`、`REJECTED`、`deletedAt IS NOT NULL`。周筛选只影响实际工时、实际人天、人员投入、Top 5、Raw Data 和 Excel 导出，不修改或拆分 `plannedPersonDays`。

数据库中不包含币种、费率、金额、人员单价或薪资字段/表；禁止新增 `currency`、`ProjectCostRate`、`project_cost_rates`、`amountPerPersonDay` 等模型。
