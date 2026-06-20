# GridProject Dev UAT Checklist

测试版本：`0.1.0-dev.1`

测试日期：`YYYY-MM-DD`

测试环境：`gridproject_dev`

测试数据规则：

- 只使用虚拟人员姓名、测试邮箱、测试项目、测试工时和非敏感描述。
- 禁止录入真实工资、真实人员成本、客户敏感数据、生产账号密码、生产项目数据、真实合同或财务信息。

## 测试账号角色

| 角色 | 测试账号 | 说明 |
| --- | --- | --- |
| ADMIN | 由部署环境变量创建 | 仅用于人员管理、权限核验和初始化测试账号 |
| Project Owner | 管理员通过人员管理页面创建 | 用于创建项目、添加成员、审批工时、管理成本 |
| MEMBER | 管理员通过人员管理页面创建 | 用于创建事项、填报工时、提交工时 |

## 功能检查

| 测试功能 | 预期结果 | 实际结果 | 是否通过 |
| --- | --- | --- | --- |
| 管理员登录 | 可以登录，不返回 passwordHash 或 tokenHash |  |  |
| 创建 Project Owner 测试账号 | 创建成功，账号状态为 ACTIVE |  |  |
| 创建 MEMBER 测试账号 | 创建成功，账号状态为 ACTIVE |  |  |
| Project Owner 创建项目 | 创建成功，创建者自动成为 Owner 和 ProjectMember |  |  |
| Project Owner 添加项目成员 | 添加成功，成员出现在项目成员列表 |  |  |
| 创建事项 | 创建成功，creatorId 由后端写入当前用户 |  |  |
| MEMBER 创建 DRAFT 工时 | 创建成功，状态为 DRAFT |  |  |
| MEMBER 提交工时 | 状态变为 SUBMITTED |  |  |
| Project Owner 审批工时 | 状态变为 APPROVED |  |  |
| 创建成本管理记录 | 创建成功，仅 Project Owner 或 ADMIN 可访问 |  |  |
| 设置 plannedPersonDays | 保存成功，刷新后仍存在 |  |  |
| actualHours 计算 | 来自已提交或已审批工时 |  |  |
| actualPersonDays 计算 | `actualHours / standardHoursPerDay` |  |  |
| MEMBER 读取他人工时 | 被拒绝或列表不包含他人工时 |  |  |
| MEMBER 进入成本管理 | 被拒绝访问 |  |  |
| 页面刷新 | 已创建数据仍然存在 |  |  |

## 问题反馈

| 字段 | 内容 |
| --- | --- |
| 问题描述 |  |
| 严重级别 | P0 / P1 / P2 / P3 |
| 截图 |  |
| 复现步骤 | 1.  2.  3.  |
| 预期结果 |  |
| 实际结果 |  |
| 浏览器和设备 |  |
| 测试账号角色 | ADMIN / Project Owner / MEMBER |

## 严重级别

- P0：数据泄露、越权、无法登录、数据丢失
- P1：核心流程无法完成
- P2：功能错误但有替代路径
- P3：样式、文案和体验问题
