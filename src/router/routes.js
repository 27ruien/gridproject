export const ROUTES = [
  { key: "dashboard", label: "主页", icon: "dashboard" },
  { key: "projects", label: "项目库", icon: "projects" },
  {
    key: "cost-time",
    label: "成本工时",
    icon: "timesheets",
    children: [
      { key: "timesheets", label: "工时填报", icon: "timesheets" },
      { key: "timesheet-list", label: "工时列表", icon: "list" },
      { key: "costs", label: "成本管理", icon: "costs", adminOnly: true },
    ],
  },
  { key: "users", label: "人员管理", icon: "users" },
  { key: "settings", label: "平台设置", icon: "settings" },
];
