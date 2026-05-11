import { getTemplateById } from "../domain/template.js";
import { calculateProjectHealth, calculateProjectProgress, summarizeProject } from "../domain/project.js";

const PEOPLE = ["林夏", "周程", "韩越", "陈澈"];

export const projectService = {
  people() {
    return PEOPLE;
  },
  createProject(input) {
    const template = getTemplateById(input.templateId);
    const now = new Date().toISOString();

    return {
      id: `project-${Date.now()}`,
      name: input.name.trim(),
      templateId: template.id,
      owner: input.owner || PEOPLE[0],
      status: template.id === "agile" ? "规划中" : "立项",
      startDate: input.startDate || formatDate(new Date()),
      dueDate: input.dueDate || formatDate(addDays(new Date(), template.id === "agile" ? 30 : 45)),
      testDate: input.testDate || formatDate(addDays(new Date(), template.id === "agile" ? 21 : 35)),
      acceptanceDate: input.acceptanceDate || formatDate(addDays(new Date(), template.id === "agile" ? 27 : 42)),
      releaseDate: input.releaseDate || input.dueDate || formatDate(addDays(new Date(), template.id === "agile" ? 30 : 45)),
      health: 90,
      description: input.description?.trim() || `${template.name}创建的新项目。`,
      createdAt: now,
      updatedAt: now,
    };
  },
  summarize(project, issues) {
    return summarizeProject(project, issues);
  },
  progress(project, issues) {
    return calculateProjectProgress(issues);
  },
  health(project, issues) {
    return calculateProjectHealth(project, issues);
  },
};

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
