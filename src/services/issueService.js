import { filterIssues, normalizeIssue } from "../domain/issue.js";
import { analyzeScheduleImport, buildScheduleKey, createScheduleIssueInput, getIssueScheduleRisks, parseScheduleText } from "../domain/scheduleImport.js";
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
  importSchedule(source, project, existingIssues = [], options = {}) {
    const template = getTemplateById(project.templateId);
    const parsed = typeof source === "string" ? parseScheduleText(source) : analyzeScheduleImport(source || {});
    const behavior = options.behavior || (options.merge === false ? "replace" : "merge");
    const created = [];
    const updated = [];
    const skipped = [];
    const removed = behavior === "replace" ? existingIssues.filter(isTimelineIssue) : [];

    if (behavior === "dates-only") {
      return {
        created, updated, skipped, removed: [], warnings: parsed.warnings,
        riskCount: 0, totalCount: parsed.tasks.length, behavior,
      };
    }

    parsed.tasks.forEach((task) => {
      const input = createScheduleIssueInput(task, project, template);
      const existing = behavior === "merge" ? findExistingScheduleIssue(existingIssues, project.id, task) : null;

      if (existing) {
        if (wasEditedAfterImport(existing)) {
          skipped.push(existing);
          return;
        }
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
      skipped,
      removed,
      behavior,
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
    if (["待办事项", "Backlog"].includes(viewName)) return issues.filter((issue) => ["Epic", "需求", "技术债"].includes(issue.type));
    if (["迭代", "Sprint"].includes(viewName)) return issues.filter((issue) => ["任务", "缺陷", "需求"].includes(issue.type));
    if (viewName === "风险") return issues.filter((issue) => issue.type === "风险" || issue.priority === "P0" || getIssueScheduleRisks(issue).length);
    if (viewName === "交付与验收" || viewName === "交付物" || viewName === "验收") return issues.filter((issue) => ["交付物", "验收项"].includes(issue.type));
    return issues;
  },
  filterIssues(issues, filters) {
    return filterIssues(issues, filters);
  },
};

function findExistingScheduleIssue(issues, projectId, task) {
  const scheduleKey = buildScheduleKey(projectId, task);
  return issues.find((issue) => isTimelineIssue(issue) && issue.scheduleKey === scheduleKey);
}

function isTimelineIssue(issue) {
  return issue.scheduleSource === "gridtimeline" && Boolean(issue.scheduleKey);
}

function wasEditedAfterImport(issue) {
  const importedAt = Date.parse(issue.scheduleImportedAt || "");
  const updatedAt = Date.parse(issue.updatedAt || "");
  return Number.isFinite(importedAt) && Number.isFinite(updatedAt) && updatedAt - importedAt > 1000;
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
