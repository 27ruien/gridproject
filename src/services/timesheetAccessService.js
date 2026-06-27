export const TIMESHEET_SCOPES = {
  OWN: "own",
  OWNED: "owned",
  ALL: "all",
};

export function getManagedProjects(projects = [], context = {}) {
  if (context.isAdmin) return projects.filter((project) => !project.deletedAt);
  return projects.filter((project) => isProjectManager(project, context));
}

export function filterTimeEntriesForScope(entries = [], { projects = [], context = {}, scope = TIMESHEET_SCOPES.OWN } = {}) {
  const activeEntries = entries.filter((entry) => !entry.deletedAt);
  if (context.isAdmin && scope === TIMESHEET_SCOPES.ALL) return activeEntries;

  if (scope === TIMESHEET_SCOPES.OWNED) {
    const projectIds = new Set(getManagedProjects(projects, context).map((project) => project.id));
    return activeEntries.filter((entry) => projectIds.has(entry.projectId));
  }

  return activeEntries.filter((entry) => entry.userId === context.userId || entry.reporter === context.user?.name);
}

export function canMutateOwnDraft(entry, context = {}) {
  return Boolean(
    context.isActiveUser &&
    !entry?.deletedAt &&
    (entry.userId === context.userId || entry.reporter === context.user?.name) &&
    ["DRAFT", "草稿"].includes(entry.status),
  );
}

function isProjectManager(project, context) {
  return Boolean(
    context.isActiveUser &&
    project &&
    project.organizationId === context.organizationId &&
    !project.deletedAt &&
    (project.ownerId === context.userId || project.createdById === context.userId),
  );
}
