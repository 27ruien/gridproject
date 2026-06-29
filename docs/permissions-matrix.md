# GridProject Permissions Matrix

## Roles

组织级角色：

- `ADMIN`
- `MEMBER`

项目内角色：

- Project Owner：通过 `Project.ownerId === currentUser.id` 动态判断，不存入 `ProjectMember.role`。
- `ProjectMember.role = MANAGER`
- `ProjectMember.role = MEMBER`
- `ProjectMember.role = VIEWER`

旧的 `ProjectMember` 数据缺少 `role` 时按 `MEMBER` 处理。

## Project Permissions

| Permission | ADMIN | Project Owner | MANAGER | MEMBER | VIEWER | Non-member |
| --- | --- | --- | --- | --- | --- | --- |
| `project.create` | Yes | Yes | Yes | Yes | Yes | Yes |
| `project.view` | Yes | Yes | Yes | Yes | Yes | No |
| `project.update` | Yes | Yes | No | No | No | No |
| `project.delete` | Yes | Yes | No | No | No | No |
| `project.change_owner` | Yes | Yes | No | No | No | No |
| `project.manage_members` | Yes | Yes | No | No | No | No |
| `project.manage_member_roles` | Yes | Yes | No | No | No | No |
| `issue.view` | Yes | Yes | Yes | Yes | Yes | No |
| `issue.create` | Yes | Yes | Yes | Yes | No | No |
| `issue.update_any` | Yes | Yes | Yes | No | No | No |
| `issue.update_own_or_assigned` | Yes | Yes | Yes | Yes | No | No |
| `issue.delete` | Yes | Yes | Yes | No | No | No |
| `milestone.manage` | Yes | Yes | Yes | No | No | No |
| `schedule.import_or_update` | Yes | Yes | Yes | No | No | No |
| `comment.view` | Yes | Yes | Yes | Yes | Yes | No |
| `comment.create` | Yes | Yes | Yes | Yes | No | No |

私有项目查询必须继续包含：

```text
organizationId = currentOrganizationId
deletedAt IS NULL
current user is ADMIN, Project.ownerId, or ACTIVE ProjectMember
```

## Time Entry Permissions

| Permission | ADMIN | Project Owner | MANAGER | MEMBER | VIEWER | Non-member |
| --- | --- | --- | --- | --- | --- | --- |
| `time_entry.view_all` | Yes | No | No | No | No | No |
| `time_entry.view_project_submitted` | Yes | Yes | Yes | No | No | No |
| `time_entry.view_own` | Yes | Yes | Yes | Yes | Yes | Own only |
| `time_entry.create_own` | Yes | Yes | Yes | Yes | No | No |
| `time_entry.edit_own` | Yes | Own draft/rejected | Own draft/rejected | Own draft/rejected | No | No |
| `time_entry.delete_own` | Yes | Own draft | Own draft | Own draft | No | No |
| `time_entry.submit_own` | Yes | Own draft/rejected | Own draft/rejected | Own draft/rejected | No | No |
| `time_entry.approve_project` | Yes | Yes | Yes | No | No | No |
| `time_entry.reject_project` | Yes | Yes | Yes | No | No | No |
| `time_entry.edit_others` | Yes with reason | No | No | No | No | No |
| `time_entry.delete_others` | Yes with reason | No | No | No | No | No |

非项目成员访问不可见项目继续按现有约定返回不可见响应；可见项目内的越权写操作返回 `403`。

## Cost Permissions

| Permission | ADMIN | Project Owner | MANAGER | MEMBER | VIEWER |
| --- | --- | --- | --- | --- | --- |
| `cost.view_project` | Yes, all org projects | Yes, owned projects | No | No | No |
| `cost.create` | Yes | Yes, owned projects | No | No | No |
| `cost.update` | Yes | Yes, owned projects | No | No | No |
| `cost.export` | Yes | Yes, owned projects | No | No | No |

## Frontend Permission Shape

项目详情接口返回的 `permissions` 包含项目、成员、事项、里程碑、排期、工时和成本入口能力。前端只做体验隐藏或禁用，后端 route 必须再次通过 `server/src/policies/access.ts` 校验。
