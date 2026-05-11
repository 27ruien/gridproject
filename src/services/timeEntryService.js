import { normalizeTimeEntry } from "../domain/timeEntry.js";

export const timeEntryService = {
  normalize(entry) {
    return normalizeTimeEntry(entry);
  },
  create(input, issue, project) {
    return normalizeTimeEntry({
      id: `time-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      projectId: project.id,
      issueId: issue.id,
      reporter: input.reporter || issue.owner,
      spentDate: input.spentDate,
      hours: input.hours,
      note: input.note,
      createdAt: new Date().toISOString(),
    });
  },
  update(entry, patch) {
    return normalizeTimeEntry({
      ...entry,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },
};
