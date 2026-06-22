# GridProject Plane R3 Review

## 基线

- 基础分支：`codex/gridproject-plane-r2-1-polish`
- 基础 SHA：`0c883d7 test(ui): capture R2.1 visual evidence`
- R3 分支：`codex/gridproject-plane-r3-product-polish`
- R3 范围：甘特图、工时填报、成本管理、人员管理、平台设置、App.vue 拆分、响应式与视觉证据
- `src/App.vue`：1049 行拆到 896 行，抽出路由状态、全局搜索和全局 Overlay 状态 composable

## 修改前问题

- 甘特图缺少面向交付管理的工具栏、阶段折叠、尺度切换、今日定位、逾期和里程碑信号。
- 工时填报仍偏记录表视角，桌面缺少周录入效率，移动端不适合七列表格。
- 成本管理以宽表和分散指标为主，筛选维度不足，移动端缺少项目成本列表体验。
- 人员管理是传统后台宽表，低频操作过多直接暴露，移动端仍容易压缩桌面表格。
- 平台设置只有简单表单，未形成与个人设置一致的工作区语言。
- 1024、768 等中间断点仍有表格或工具栏造成页面级横向滚动的风险。

## 修改后结构

- 甘特图：固定左侧任务身份区，右侧时间轴内部横向滚动，增加日/周/月、跳转今天、搜索、状态、逾期筛选、阶段折叠、今日线、周末弱化、里程碑和逾期条形。
- 工时填报：桌面改为周矩阵，按项目和事项归组，支持每日输入、行合计、日合计、周合计、保存状态、缺失和异常提示；移动端为按日期分组的纵向录入列表。
- 成本管理：新增紧凑成本摘要、项目/团队/人员/成本类型/风险/排序筛选、项目成本列表、真实超预算风险色、明细 Drawer 保留周筛选、计划人天编辑、人员投入、Top 5、Raw Data、Excel 导出入口。
- 人员管理：改为人员目录，展示头像、姓名/邮箱、角色/状态 lozenge、执行团队、项目数量、最近活动和更多操作；执行团队只从项目 ownership/membership 推导，不新增用户团队字段。
- 平台设置：改为设置工作区，只保留后端真实支持的基本设置：平台名称和两字符 Logo 文案，带品牌预览、保存状态和还原动作。
- App Shell：新增 `useRouteState`、`useGlobalSearch`、`useOverlayState`，`App.vue` 保留初始化、登录状态、App Shell、页面组合和顶层事件桥接。

## 组件复用

- 继续使用 `Button`、`StatusLozenge`、`Modal`、`DetailPanel`、`EmptyState`、`OverflowMenu`、`ConfirmDialog`。
- 风险、角色、状态统一转成 lozenge，而不是各页面私有状态标签。
- 低频人员操作收敛到 overflow menu；危险操作使用确认弹窗。
- R3 新增样式集中在既有 component-part CSS 中，未新增孤立设计体系。

## 移动端策略

- 甘特图：390px 使用阶段分组排期列表，不渲染桌面甘特网格。
- 工时：899px 以下使用日期分组输入列表；审批记录行在移动和窄平板下单列显示。
- 成本：390px 使用项目成本卡片和详情 Drawer，不依赖压缩宽表。
- 人员：1199px 以下切换到人员信息列表，避免人员目录表格在 1024/768 造成页面级横向滚动。
- 平台设置：1023px 以下设置侧栏与表单上下排列，390px 单列显示。
- 成本筛选栏在 1439px 以下收敛为三列，避免 1280 宽度页面横向滚动。

## 测试结果

- `npm run test`：通过。`domain`、timeline import、access/user/cost、api mode source 全部通过。
- `npm run frontend:lint`：通过，61 个 JavaScript 文件。
- `npm run build`：通过；Vite 提示 `exceljs` chunk 超过 500k，这是既有构建体积警告，不阻塞 R3。
- `npm run server:lint`：通过。
- `npm run server:build`：通过。
- `npm run server:test`：通过；2 个无数据库测试通过，5 个数据库集成测试因未设置 `TEST_DATABASE_URL` 按脚本设计跳过。
- `npx playwright test tests/e2e/plane-r3.spec.js -c playwright.config.js`：通过，3/3。
- `BASE_URL=http://127.0.0.1:5173 npm run capture:plane-r3`：通过。

## 视觉结果

`artifacts/plane-r3/report.json`：

- `passed`: `true`
- captures：16
- checks：37
- console errors：0
- page errors：0
- bad captures：0
- bad checks：0

截图文件：

- `artifacts/plane-r3/gantt-1440x900.png`
- `artifacts/plane-r3/gantt-390x844.png`
- `artifacts/plane-r3/timesheet-1440x900.png`
- `artifacts/plane-r3/timesheet-390x844.png`
- `artifacts/plane-r3/cost-management-1440x900.png`
- `artifacts/plane-r3/cost-management-390x844.png`
- `artifacts/plane-r3/people-management-1440x900.png`
- `artifacts/plane-r3/people-management-390x844.png`
- `artifacts/plane-r3/platform-settings-1440x900.png`
- `artifacts/plane-r3/platform-settings-390x844.png`
- `artifacts/plane-r3/home-regression-1440x900.png`
- `artifacts/plane-r3/projects-regression-1440x900.png`
- `artifacts/plane-r3/project-list-regression-1440x900.png`
- `artifacts/plane-r3/board-regression-1440x900.png`
- `artifacts/plane-r3/account-regression.png`
- `artifacts/plane-r3/personal-settings-regression.png`

## R1/R2/R2.1 回归

- R1 项目列表和看板回归截图已生成，Playwright smoke selector 可见且无页面级横向溢出。
- R2 主页、项目库、账户菜单回归截图已生成。
- R2.1 全屏个人设置回归截图已生成。
- R3 未重新设计 R1/R2/R2.1 已确认的主页、项目库卡片、项目筛选、账户 Overlay、个人设置、待关注事项、项目卡片密度或改密失败限流。

## 剩余问题

- `App.vue` 已从 1049 行降到 896 行，但仍偏大，后续可继续把 CRUD event bridge、project modal/drawer orchestration 拆到更明确的 application-shell composable 或 feature orchestrator。
- `npm run server:test` 的数据库集成测试需要临时 PostgreSQL 和 `TEST_DATABASE_URL` 才会执行；本轮遵守数据库限制，没有连接任何生产数据库，也没有执行 destructive migration。
- 构建中 `exceljs` 体积警告仍存在，属于后续性能/代码拆分优化，不属于 R3 UI 收口阻塞。
- 人员管理没有实现“修改团队”，因为当前用户模型和后端 API 没有 team 字段；本轮只展示从项目参与关系推导出的执行团队。

## 与 Plane 仍存在的差距

- 部分页面还缺少真正的 saved views、批量操作、可配置列、持久筛选和更强的键盘批处理能力。
- 甘特图已具备交付排期视图，但仍不是完整依赖关系/关键路径/资源负载排程工具。
- 工时和成本仍基于现有项目、事项和工时数据推导，尚未形成更完整的资源计划模型。
- 平台设置只覆盖真实支持的品牌设置，更多组织级配置需要后端模型先扩展。

## 独立安全分支待办

- 分支名：`codex/gridproject-security-csrf-hardening`
- 范围：Origin/Referer 校验、CSRF 防护策略、cookie 写请求保护、测试和发布说明。
- 不应混入 R3 UI 分支。
- `PasswordFailureLimiter` 当前仍是进程内存储；多实例共享存储属于后续生产加固项。
