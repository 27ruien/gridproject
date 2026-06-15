import { filterIssues, normalizeIssue } from "../domain/issue.js";
import { buildScheduleKey, createScheduleIssueInput, getIssueScheduleRisks, parseScheduleText } from "../domain/scheduleImport.js";
import { getTemplateById } from "../domain/template.js";
import { getNextStatus } from "../domain/workflow.js";
import { addDays, formatDate } from "./projectService.js";

const PREFIX_BY_TEMPLATE = {
  agile: "AGL",
  waterfall: "WAT",
};

export const issueService = {
  normalize(issue) {
    return normalizeIssue(issue);
  },
  createIssue(input, project) {
    const template = getTemplateById(project.templateId);
    const now = new Date().toISOString();

    return normalizeIssue({
      id: `issue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: `${PREFIX_BY_TEMPLATE[template.id] || "ISS"}-${Math.floor(Math.random() * 800 + 200)}`,
      projectId: project.id,
      type: input.type || template.defaultIssueType,
      title: input.title.trim(),
      status: input.status || template.workflow[0],
      owner: input.owner || project.owner,
      creator: input.creator || project.owner,
      priority: input.priority || "P2",
      startDate: input.startDate || formatDate(new Date()),
      dueDate: input.dueDate || formatDate(addDays(new Date(), 7)),
      estimatedHours: input.estimatedHours || 8,
      actualHours: input.actualHours || 0,
      next: input.next?.trim() || "补充说明、拆分任务并推进状态",
      description: input.description?.trim() || "暂无描述。",
      scheduleKey: input.scheduleKey || "",
      scheduleModel: input.scheduleModel || "",
      scheduleOwners: input.scheduleOwners || [],
      scheduleWorkdays: input.scheduleWorkdays || 0,
      scheduleImportedAt: input.scheduleImportedAt || "",
      scheduleSource: input.scheduleSource || "",
      comments: [],
      activity: [createActivity("created", "创建事项", now, input.creator || project.owner)],
      createdAt: now,
      updatedAt: now,
    });
  },
  createSeedIssues(project) {
    const template = getTemplateById(project.templateId);
    return template.seedIssues.map((seed, index) => this.createIssue({
      ...seed,
      owner: project.owner,
      creator: project.owner,
      startDate: formatDate(addDays(new Date(), seed.startOffsetDays || 0)),
      dueDate: formatDate(addDays(new Date(), seed.dueOffsetDays || (index + 1) * 5)),
    }, project));
  },
  updateIssue(issue, patch) {
    const now = new Date().toISOString();
    const updated = normalizeIssue({
      ...issue,
      ...patch,
      updatedAt: now,
    });

    if (patch.status && patch.status !== issue.status) {
      updated.activity = [
        createActivity("status", `状态从 ${issue.status} 更新为 ${patch.status}`, now),
        ...updated.activity,
      ];
    } else {
      updated.activity = [
        createActivity("updated", "更新事项信息", now),
        ...updated.activity,
      ];
    }

    return updated;
  },
  importSchedule(text, project, existingIssues = [], options = {}) {
    const template = getTemplateById(project.templateId);
    const parsed = parseScheduleText(text);
    const created = [];
    const updated = [];

    parsed.tasks.forEach((task) => {
      const input = createScheduleIssueInput(task, project, template);
      const existing = options.merge === false ? null : findExistingScheduleIssue(existingIssues, project.id, task);

      if (existing) {
        updated.push(this.updateIssue(existing, {
          ...input,
          actualHours: existing.actualHours,
          comments: existing.comments,
          activity: existing.activity,
        }));
        return;
      }

      created.push(this.createIssue(input, project));
    });

    const importedIssues = [...created, ...updated];
    return {
      created,
      updated,
      warnings: parsed.warnings,
      riskCount: importedIssues.filter((issue) => getIssueScheduleRisks(issue).length).length,
      totalCount: parsed.tasks.length,
    };
  },
  advanceIssue(issue, template) {
    const nextStatus = getNextStatus(issue.status, template.workflow);
    if (nextStatus === issue.status) return issue;
    return this.updateIssue(issue, { status: nextStatus });
  },
  addComment(issue, text, actor = "本地用户") {
    const now = new Date().toISOString();
    return normalizeIssue({
      ...issue,
      comments: [
        {
          id: `comment-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          actor,
          text: text.trim(),
          at: now,
        },
        ...issue.comments,
      ],
      activity: [
        createActivity("comment", "添加评论", now, actor),
        ...issue.activity,
      ],
      updatedAt: now,
    });
  },
  filterForView(issues, viewName) {
    if (viewName === "Backlog") return issues.filter((issue) => ["Epic", "需求", "技术债"].includes(issue.type));
    if (viewName === "Sprint") return issues.filter((issue) => ["任务", "缺陷", "需求"].includes(issue.type));
    if (viewName === "风险") return issues.filter((issue) => issue.type === "风险" || issue.priority === "P0" || getIssueScheduleRisks(issue).length);
    if (viewName === "交付物") return issues.filter((issue) => ["交付物", "验收项"].includes(issue.type));
    if (viewName === "验收") return issues.filter((issue) => ["验收项", "交付物"].includes(issue.type));
    return issues;
  },
  filterIssues(issues, filters) {
    return filterIssues(issues, filters);
  },
};

function findExistingScheduleIssue(issues, projectId, task) {
  const scheduleKey = buildScheduleKey(projectId, task);
  return issues.find((issue) => issue.scheduleKey === scheduleKey)
    || issues.find((issue) => issue.title === task.name && (issue.scheduleModel || "未分类") === (task.model || "未分类"));
}

function createActivity(type, text, at = new Date().toISOString(), actor = "本地用户") {
  return {
    id: `activity-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    text,
    at,
    actor,
  };
}
