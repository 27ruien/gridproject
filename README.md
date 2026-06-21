# GridProject

GridProject 是一个项目管理平台，前端使用 Vue 3 + Vite，后端使用 Fastify + Prisma + PostgreSQL。当前聚焦项目、事项、工时、人员管理，以及不含金额/币种/费率的人天投入管理。

## 本地运行

前端本地演示模式：

```bash
npm install
npm run dev
```

后端真实 API 模式：

```bash
npm install
npm run server:install

cp server/.env.example server/.env
# 编辑 server/.env，使用 127.0.0.1:5432/gridproject_dev

npm run server:prisma:generate
npm run db:safety:dev
npm run db:migrate:deploy:dev
npm run server:prisma:seed
npm run server:dev
```

前端切到真实 API：

```bash
VITE_DATA_SOURCE=api VITE_API_BASE_URL=/api npm run dev
```

后端运行只读取 `process.env.DATABASE_URL`。开发和测试环境会拒绝 `127.0.0.1:5433/gridproject_prod`，避免误连生产库。后端集成测试和 Dev Smoke Test 只允许读取 `TEST_DATABASE_URL`，不得回退到部署用的 `DATABASE_URL`。

## 验证

```bash
npm run test
npm run build
npm run db:validate
npm run server:prisma:generate
npm run server:lint
npm run server:build
TEST_DATABASE_ADMIN_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public" npm run test:integration
```

CI 使用：

```bash
npm run release:check:ci
```

Dev 服务器发布前使用非破坏性检查：

```bash
npm run release:check:server
```

`release:check:server` 不会执行会写入数据的集成测试或 Smoke Test。

## 当前能力

- 工作台、项目库、工时填报。
- 工作台项目视图按高密度表格展示项目名称、状态、负责人、进度、模板、截止日期和风险/逾期。
- 工作台将项目视图和待办事项作为同级模块展示。
- 待办事项支持“我的 / 即将到期 / 风险逾期”Tab，方便项目经理安排当天动作。
- 项目列表弱化敏捷/瀑布模板标签，突出项目阶段、进度、负责人和截止风险。
- 工作台不承担创建项目和跳转项目库行为，只承担项目经理日常跟进。
- 侧栏不再保留低价值项目快捷入口。
- 创建敏捷研发项目和瀑布交付项目。
- 模板驱动默认视图、事项类型、字段、空状态和初始化事项。
- 项目空间摘要、敏捷看板、瀑布阶段视图、事项列表。
- 甘特图视图，按事项开始日期和截止日期展示排期。
- 事项创建、编辑、状态流转和详情抽屉。
- 任务筛选支持日期范围、关键词、执行人和创建人。
- 任务详情支持评论。
- 任务详情支持顶部 Tab：详情、评论、工时、动态。
- 工时填报独立存储为 timeEntries，并关联项目与任务，支持创建、查看、编辑和单次多任务申报。
- 工时视角模拟权限隔离：我负责的查看自己管理项目的成员填报，我提交的查看自己的跨项目填报。
- 工时列表默认展示当月，支持月份筛选、全字段搜索、项目、任务、填报人、日期和工时范围筛选。
- 我提交的展示本月应申报工时、当前已申报工时和待补日期，创建申报时自动定位到待补日期。
- 项目页展示测试时间、验收时间和上线时间，并支持项目经理手动修改项目当前状态。
- 项目支持编辑和软删除；项目下仍有任务时禁止删除，并提示先清理任务。
- 任务支持从详情抽屉软删除。
- 回收站保留 30 天内删除的项目和任务，并支持恢复。
- 项目页以项目名称作为主要视觉锚点，项目状态紧邻名称展示并按需展开修改。
- 项目负责人、执行团队、关键日期、健康度和进度进入项目属性弹层或概览；Header 只常驻真实异常提醒。
- 项目概览新增风险雷达和最近动态，帮助项目经理先处理逾期、P0、风险和临近到期事项。
- 项目空间支持按项目导入排期，兼容 gridtimeline 的 Model、事项名称、相关方、开始日期、工作日天数或结束日期、状态等字段。
- 风险雷达纳入排期风险，能识别排期逾期、应启动未启动、临近截止和长周期未启动事项。
- 项目里程碑由模板初始化并持久化，支持在项目概览和里程碑视图里更新阶段状态。
- 平台设置支持维护左上角 Logo 和平台名称；顶部不再显示写死的组织工作区文案。
- 人员选择使用可搜索弹层，替代长列表 select。
- UI 层使用统一 Design Tokens、App Shell、SVG 图标和基础组件，普通页面不产生页面级横向滚动。
- localStorage 持久化，已通过 storage adapter 隔离；`VITE_DATA_SOURCE=api` 时通过 `/api/bootstrap` 从后端 hydrate。
- Fastify 后端提供 `/api/auth`、`/api/users`、`/api/projects`、`/api/time-entries`、`/api/cost-records`。
- 登录使用 HttpOnly Cookie，SameSite=Lax，生产环境 Secure；数据库只保存 session token hash。
- 人员创建和 seed 通过 Argon2id 生成 `passwordHash`，代码和迁移不包含固定密码 hash。
- 成本管理只保留 `plannedPersonDays`、`standardHoursPerDay`、工时折算和 Excel Raw Data 导出。

## 架构

- `src/domain/`：领域模型和工作流规则。
- `src/storage/`：存储适配器。
- `src/services/apiClient.js`：真实后端 API client。
- `src/services/`：项目、事项、模板、状态服务。
- `src/composables/`：Vue 组合式状态。
- `src/components/`：通用、模板、项目和事项组件。
- `src/components/ui/`：App Shell、按钮、图标、表格、Tabs、状态、弹窗、详情面板等基础组件。
- `src/styles/`：Design Tokens、Reset、基础样式、布局、组件和响应式规则。
- `src/qa/` 与 `scripts/capture-visuals.mjs`：本地视觉验收场景和截图矩阵。
- `src/views/`：核心产品视图。
- `docs/`：产品 PRD、体验设计规范、审计和验收报告。
- `server/`：Fastify API、Prisma client 生成入口、seed、后端测试。
- `prisma/`：Prisma schema 和正式 migrations。禁止使用 `prisma db push` 或 `prisma migrate reset`。

更多文档：

- [Backend Setup](docs/backend-setup.md)
- [Database Model](docs/database-model.md)
- [Permissions Matrix](docs/permissions-matrix.md)
- [Deployment](docs/deployment.md)
- [GitHub Actions Dev Deployment](docs/github-actions-dev-deployment.md)
