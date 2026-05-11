# Kiviflow 接管现状记录

## 仓库与脚本

- 仓库：`https://github.com/27ruien/kiviflow`
- README：缺失。
- 技术栈：Vue 3 + Vite，纯前端。
- 脚本：`dev`、`build`、`preview`。
- 测试：无测试脚本。
- Lint：无 lint 脚本。

## 基线验证

- `npm install`：成功。
- `npm run build`：成功。
- 基线可运行性：Vite build 通过，说明当前代码可编译。

## 主要问题

- `src/App.vue` 承载模板、状态、服务、组件、业务逻辑和页面，扩展成本高。
- localStorage 直接在页面组件使用，未来切 API adapter 风险大。
- 模板模型较轻，未充分驱动字段、默认视图、空状态和初始化事项。
- 项目空间缺少更强的进度、风险、下一步聚合。
- 事项缺少截止日期、可编辑详情、活动记录等商业化必要字段。
- 无 README、PRD、设计规范、测试或领域逻辑验证。
