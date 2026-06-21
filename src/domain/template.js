import { ISSUE_STATUSES } from "./workflow.js";

export const PROJECT_TEMPLATES = [
  {
    id: "agile",
    name: "敏捷研发模板",
    badge: "敏捷",
    accent: "agile",
    summary: "适合产品研发、SaaS 平台功能迭代和持续交付团队。",
    positioning: "围绕待办事项、迭代和看板推动高频研发迭代。",
    defaultView: "概览",
    views: ["概览", "待办事项", "迭代", "看板", "甘特图", "版本", "复盘"],
    issueTypes: ["Epic", "需求", "任务", "缺陷", "技术债"],
    defaultIssueType: "需求",
    workflow: ISSUE_STATUSES,
    fields: ["类型", "负责人", "创建人", "优先级", "开始日期", "截止日期", "预估工时", "已投入工时", "描述", "下一步"],
    emptyState: {
      title: "先建立需求池",
      description: "补充 Epic、需求和缺陷，再选择 P0/P1 进入迭代。",
      action: "新建需求",
    },
    milestones: [
      { name: "需求梳理", window: "第 1 周", focus: "收敛优先级和验收标准" },
      { name: "迭代交付", window: "第 2-3 周", focus: "完成核心需求与缺陷闭环" },
      { name: "版本复盘", window: "第 4 周", focus: "沉淀指标、问题和下一轮计划" },
    ],
    seedIssues: [
      {
        type: "需求",
        title: "梳理首批待办事项",
        priority: "P1",
        startOffsetDays: 0,
        estimatedHours: 24,
        actualHours: 4,
        next: "补齐验收标准并排序进入迭代",
        description: "创建产品需求池，明确需求价值、边界和验收口径。",
        dueOffsetDays: 5,
      },
      {
        type: "任务",
        title: "建立迭代计划",
        priority: "P2",
        startOffsetDays: 3,
        estimatedHours: 32,
        actualHours: 12,
        next: "确认成员容量与本轮目标",
        description: "把高优先级需求拆成可交付任务。",
        dueOffsetDays: 10,
      },
    ],
  },
  {
    id: "waterfall",
    name: "瀑布交付模板",
    badge: "瀑布",
    accent: "waterfall",
    summary: "适合客户项目、实施交付、硬期限上线和验收型项目。",
    positioning: "围绕阶段门、里程碑、交付物和验收推动确定性交付。",
    defaultView: "概览",
    views: ["概览", "阶段计划", "甘特图", "里程碑", "交付物", "风险", "验收"],
    issueTypes: ["阶段", "任务", "交付物", "风险", "变更", "验收项"],
    defaultIssueType: "任务",
    workflow: ISSUE_STATUSES,
    fields: ["类型", "负责人", "创建人", "优先级", "开始日期", "截止日期", "预估工时", "已投入工时", "描述", "下一步"],
    emptyState: {
      title: "先确认阶段与交付物",
      description: "从范围确认、里程碑、风险和验收项开始建立项目骨架。",
      action: "新建交付任务",
    },
    milestones: [
      { name: "立项与范围", window: "第 1 周", focus: "冻结范围、目标和客户联系人" },
      { name: "设计与实施", window: "第 2-4 周", focus: "完成方案、开发实施和联调" },
      { name: "测试与验收", window: "第 5 周", focus: "交付物确认、风险关闭、客户签收" },
    ],
    seedIssues: [
      {
        type: "交付物",
        title: "客户需求确认书",
        priority: "P0",
        startOffsetDays: 0,
        estimatedHours: 16,
        actualHours: 6,
        next: "确认范围边界和客户签字口径",
        description: "瀑布项目进入设计前必须冻结需求范围和验收标准。",
        dueOffsetDays: 4,
      },
      {
        type: "风险",
        title: "关键里程碑延期风险",
        priority: "P1",
        startOffsetDays: 2,
        estimatedHours: 12,
        actualHours: 3,
        next: "确认客户反馈截止时间和升级路径",
        description: "识别会影响阶段推进的外部等待和资源冲突。",
        dueOffsetDays: 8,
      },
    ],
  },
];

export function getTemplateById(templateId) {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId) || PROJECT_TEMPLATES[0];
}
