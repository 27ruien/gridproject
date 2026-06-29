export const MILESTONE_STATUS_OPTIONS = ["未开始", "进行中", "有风险", "已完成"];

const STATUS_TONE = {
  未开始: "neutral",
  进行中: "info",
  有风险: "warn",
  已完成: "done",
};

export function createProjectMilestones(template, startDate) {
  const offsets = template.id === "waterfall" ? [7, 28, 42] : [7, 21, 28];
  return template.milestones.map((milestone, index) => normalizeMilestone({
    id: `${template.id}-milestone-${index + 1}`,
    name: milestone.name,
    window: milestone.window,
    focus: milestone.focus,
    dueDate: startDate ? addDays(startDate, offsets[index] || (index + 1) * 7) : "",
    status: index === 0 ? "进行中" : "未开始",
  }));
}

export function normalizeMilestones(milestones, template, startDate) {
  const source = Array.isArray(milestones) && milestones.length ? milestones : createProjectMilestones(template, startDate);
  return source.map((milestone, index) => {
    const templateMilestone = template.milestones[index] || {};
    return normalizeMilestone({
      id: milestone.id || `${template.id}-milestone-${index + 1}`,
      name: milestone.name || templateMilestone.name || `相关方事项 ${index + 1}`,
      window: milestone.window || templateMilestone.window || "",
      focus: milestone.focus || templateMilestone.focus || "明确阶段目标和交付口径",
      dueDate: milestone.dueDate || (startDate ? addDays(startDate, (index + 1) * 7) : ""),
      status: milestone.status,
    });
  });
}

export function summarizeMilestones(milestones = []) {
  const doneCount = milestones.filter((milestone) => milestone.status === "已完成").length;
  const riskCount = milestones.filter((milestone) => milestone.status === "有风险").length;
  return {
    totalCount: milestones.length,
    doneCount,
    riskCount,
    progress: milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0,
  };
}

export function milestoneTone(status) {
  return STATUS_TONE[status] || "neutral";
}

function normalizeMilestone(milestone) {
  return {
    id: milestone.id,
    name: milestone.name,
    window: milestone.window || "",
    focus: milestone.focus || "",
    dueDate: milestone.dueDate || "",
    status: MILESTONE_STATUS_OPTIONS.includes(milestone.status) ? milestone.status : "未开始",
  };
}

function addDays(dateValue, days) {
  const date = new Date(dateValue || new Date());
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
