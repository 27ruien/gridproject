# GridProject Permissions Matrix

## Roles

组织级角色仅保留：

- `ADMIN`
- `MEMBER`

项目 Owner 不是全局角色，通过 `Project.ownerId === currentUser.id` 动态判断。

## Project Permissions

| Permission | ADMIN | Project Owner | ACTIVE ProjectMember | Other ACTIVE MEMBER |
| --- | --- | --- | --- | --- |
| `project.create` | Yes | Yes | Yes | Yes |
| `project.view` | Yes | Yes | Yes | Yes |
| `project.board.view` | Yes | Yes | Yes | No |
| `project.update` | Yes | Yes | No | No |
| `project.delete` | Yes | Yes | No | No |
| `project.manage_members` | Yes | Yes | No | No |
| `issue.view` | Yes | Yes | Yes | Yes |
| `issue.create/update/assign/change_status` | Yes | Yes | Yes | Yes |
| `milestone.view` | Yes | Yes | Yes | Yes |

项目查询必须包含：

```text
organizationId = currentOrganizationId
deletedAt IS NULL
```

## Time Entry Permissions

| Permission | ADMIN | Project Owner In Owned Project | MEMBER |
| --- | --- | --- | --- |
| `time_entry.view_all` | Yes | No | No |
| `time_entry.view_project` | Yes | Yes | No |
| `time_entry.view_own` | Yes | Yes | Yes |
| `time_entry.create_own` | Yes | Yes | Yes |
| `time_entry.edit_own` | Yes | Own draft/rejected | Own draft/rejected |
| `time_entry.delete_own` | Yes | Own draft | Own draft |
| `time_entry.submit_own` | Yes | Own draft/rejected | Own draft/rejected |
| `time_entry.approve_project` | Yes | Yes | No |
| `time_entry.reject_project` | Yes | Yes | No |
| `time_entry.export_project` | Yes | Yes | No |
| `time_entry.edit_others` | Yes with reason | No by default | No |
| `time_entry.delete_others` | Yes with reason | No by default | No |

普通成员不能通过列表、详情、统计、搜索、导出、审批列表或成本管理读取他人工时。

## Cost Permissions

| Permission | ADMIN | Project Owner | ProjectMember | Other MEMBER |
| --- | --- | --- | --- | --- |
| `cost.view_project` | Yes, all org projects | Yes, owned projects | No | No |
| `cost.create` | Yes | Yes, owned projects | No | No |
| `cost.update` | Yes | Yes, owned projects | No | No |
| `cost.export` | Yes | Yes, owned projects | No | No |

普通 ProjectMember 不显示成本管理入口，直接请求成本 API 返回 `403`。

## Frontend Permission Shape

项目详情接口应返回：

```json
{
  "permissions": {
    "canView": true,
    "canViewBoard": true,
    "canUpdate": false,
    "canDelete": false,
    "canManageMembers": false,
    "canViewProjectTimeEntries": false,
    "canApproveTimeEntries": false,
    "canViewCost": false,
    "canManageCost": false,
    "canExportCost": false
  }
}
```

前端只做体验隐藏，后端必须再次验证权限。

