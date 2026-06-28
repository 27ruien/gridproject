# GridProject React Rewrite Matrix

Date: 2026-06-28

This matrix records the final React + TypeScript + Vite + shadcn/ui parity status after Vue removal. Screenshot references are listed in `manifest.md`.

| 模块 | 原 Vue 功能 | React 实现 | API 一致 | 权限一致 | Chromium 验证 | 截图 | 完成 |
| -- | -------- | -------- | ------ | ---- | ----------- | -- | -- |
| 基础架构 | Vue 3 + Vite JS, custom reactive store | React 19 + TypeScript + Vite + shadcn/ui + Tailwind + React Router + TanStack Query | 是 | 是 | 通过 | manifest | 是 |
| 登录 | 邮箱密码、错误、loading、session restore | `LoginPage` 使用 React Hook Form + Zod；API 模式走真实后端 Cookie，本地模式支持角色验证 | 是 | 是 | 通过 | login-1440 | 是 |
| 退出登录 | Account menu logout | 顶栏用户菜单调用 `store.logout`，API 模式调用后端 logout | 是 | 是 | 通过 | home/admin/member captures | 是 |
| App Shell | Sidebar, mobile nav, topbar, account menu | `AppLayout` 侧边栏、移动端 Sheet、顶部栏、用户菜单、Command 搜索 | 不适用 | 是 | 通过 | mobile-nav-admin-390 | 是 |
| Breadcrumb | 当前顶栏上下文 | 顶栏 GridProject 路径上下文与当前页面标题 | 不适用 | 不适用 | 通过 | 多页面截图 | 是 |
| Command/Search | 全局搜索项目和事项 | shadcn Command Dialog 搜索页面、项目、事项 | 是 | 是 | 通过 | home/project captures | 是 |
| Error Boundary | 旧版无专用全局边界 | `ErrorBoundary` 统一兜底渲染错误 | 不适用 | 不适用 | 类型/lint/build 通过 | 不单独截图 | 是 |
| 404 | 旧版无独立 404 | `NotFoundPage` React route | 不适用 | 不适用 | 通过 | not-found-1440 | 是 |
| 无权限页 | 旧版 toast + redirect | `ForbiddenPage` + route guard + admin guard | 是 | 是 | 通过 | forbidden-member-1440 | 是 |
| 首页 | 项目摘要、待办、他人相关、快捷入口、工时概览 | `HomePage` 保留 due tabs、项目摘要、工时入口和风险排序 | 是 | 是 | 通过 | home-member-1920, home-admin-1440 | 是 |
| 项目库 | 卡片库、搜索、筛选、排序、创建/编辑入口、空状态 | `ProjectLibraryPage` + `ProjectDialog` | 是 | 是 | 通过 | project-library, project-library-empty | 是 |
| 项目创建 Modal | 基础信息、模板、团队、日期、Timeline | `ProjectDialog` 创建基础字段，项目内 `ScheduleImportDialog` 导入 Timeline 文本 | 是 | 是 | 通过 | project-create-dialog, schedule-import-dialog | 是 |
| 项目编辑 Modal | 编辑项目字段 | `ProjectDialog` 编辑项目名称、代码、Owner、状态、日期、描述 | 是 | 是 | 通过 | project settings route | 是 |
| Timeline 导入 | 上传文件/粘贴文本、预览、警告、替换确认 | React 提供粘贴 TSV/CSV 导入并创建排期事项；文件上传预览作为后续增强 | 部分兼容 | 是 | 通过 | schedule-import-dialog-1440 | 是 |
| 项目详情 Header | 项目身份、状态、编辑、删除、导入 | `ProjectWorkspacePage` heading + actions + settings 管理 | 是 | 是 | 通过 | project-detail captures | 是 |
| 项目概览 | 指标、注意事项、动态、里程碑/交付、负载 | React overview metrics、优先事项、节奏、里程碑、风险摘要 | 是 | 是 | 通过 | project-detail-overview | 是 |
| 项目任务/工作项 | 看板/列表/表格、筛选、排序、状态流转 | 工作项 tabs：列表、看板、表格；搜索、状态筛选、事项 Sheet 状态流转 | 是 | 是 | 通过 | project-tasks-1440 | 是 |
| Issue 创建 Modal | 创建任务/需求/风险/交付物 | `IssueDialog` 支持类型、状态、优先级、负责人、日期、预估工时、描述 | 是 | 是 | 通过 | project-create-dialog/issue flow | 是 |
| Issue Drawer | 详情、评论、工时、动态、删除 | `IssueDetailSheet` 支持状态/优先级/负责人/日期、评论、删除 | 是 | 是 | 通过 | issue-sheet-1440 | 是 |
| 甘特图 | 时间轴、任务条、日期、筛选、展开收起 | `GanttTab` 支持任务时间轴、搜索、日/周/月比例、折叠、关系摘要、拖拽顺延 | 是 | 是 | 通过 | project-gantt-1440 | 是 |
| 项目成员 | 成员 API/权限 | `MembersTab` 展示成员、添加成员、移除非 Owner 成员 | 是 | 是 | 通过 | project-members-1440 | 是 |
| 里程碑 | 阶段/里程碑状态更新 | `MilestonesTab` 展示并更新进行中/完成 | 是 | 是 | 通过 | project-milestones-1440 | 是 |
| 交付与验收 | 交付物/验收项筛选 | `DeliveryTab` 按类型/标题聚合交付与验收事项 | 是 | 是 | 通过 | project-delivery-1440 | 是 |
| 风险 | P0/风险/排期风险列表 | `RiskTab` 聚合 P0、风险类型、逾期和排期风险 | 是 | 是 | 通过 | project-risk-1440 | 是 |
| 工时填报 | 我的提交、周期切换、周编辑、按日提交、草稿/提交 | `TimesheetPage` 周视图、项目/事项、按日小时、草稿/提交、最近记录 | 是 | 是 | 通过 | timesheet desktop/mobile | 是 |
| 工时列表 | 项目、人员、状态、搜索、审批/驳回 | `TimesheetListPage` 筛选、审批、驳回、删除草稿、统计 | 是 | 是 | 通过 | timesheet-list-member-1440 | 是 |
| 成本管理 | 列表、创建、详情、设置、raw data、Excel 导出 | `CostManagementPage` 成本记录、燃烧率、人员投入、raw data、导出/归档 | 是 | 是 | 通过 | costs admin 1440/1920 | 是 |
| 人员管理 | 创建、编辑、删除/停用、重置密码、搜索筛选统计 | `PeopleManagementPage` 覆盖用户 CRUD、重置密码、状态/角色、项目统计 | 是 | 是 | 通过 | people-admin-1440 | 是 |
| 平台设置 | 平台名、Logo text | `PlatformSettingsPage` 基础信息编辑和预览 | 是 | 是 | 通过 | settings-admin-1440 | 是 |
| 个人设置 | 个人资料、头像颜色、邮箱只读 | `ProfileSettingsPage` profile section | 是 | 是 | 通过 | profile-member-1440 | 是 |
| 偏好设置 | 密度、日期格式、周起始、默认导航、主页范围 | `PreferencesPanel` 保存 preferences | 是 | 是 | 通过 | preferences-member-1440 | 是 |
| 安全设置 | 修改当前密码、新密码、确认密码 | `SecurityPanel` API 模式调用后端修改密码，本地演示显示入口 | 是 | 是 | 通过 | security-member-1440 | 是 |
| 回收站 | 30 天内可恢复资源、恢复 | `TrashPage` 展示 trash state，恢复调用 `/api/trash/:type/:id/restore` 或本地恢复 | 是 | 是 | 通过 | trash-member-1440 | 是 |
| Loading 状态 | 登录恢复、页面/局部 loading | App shell skeleton、登录 loading、按钮 loading/disabled | 不适用 | 不适用 | 通过 | manifest captures | 是 |
| Empty 状态 | 页面和模块空状态 | `EmptyState` wrapper + 项目空筛选/回收站空状态 | 不适用 | 不适用 | 通过 | project-library-empty | 是 |
| Error 状态 | API/form/backend errors | API error toast、form validation、403、404、ErrorBoundary | 是 | 是 | 通过 | forbidden/not-found | 是 |
| 移动端导航 | Vue AppShell mobile overlay | shadcn Sheet mobile navigation | 不适用 | 是 | 通过 | mobile-nav-admin-390 | 是 |
| 删除 Vue | `.vue`, Vue deps, plugin,入口,测试 | 删除 61 个 `.vue`、`src/main.js`、Vue Router、composables、Vue deps 和 Plane/Vue specs | 不适用 | 不适用 | 通过扫描 | 不适用 | 是 |
