import { isActiveProjectMember, isProjectOwner } from "../../domain/access.js";

export const TIME_ENTRY_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const TIME_ENTRY_PERMISSIONS = {
  VIEW_OWN: "time_entry.view_own",
  VIEW_PROJECT: "time_entry.view_project",
  VIEW_ALL: "time_entry.view_all",
  CREATE_OWN: "time_entry.create_own",
  EDIT_OWN: "time_entry.edit_own",
  DELETE_OWN: "time_entry.delete_own",
  SUBMIT_OWN: "time_entry.submit_own",
  APPROVE_PROJECT: "time_entry.approve_project",
  REJECT_PROJECT: "time_entry.reject_project",
  EXPORT_PROJECT: "time_entry.export_project",
  EDIT_OTHERS: "time_entry.edit_others",
  DELETE_OTHERS: "time_entry.delete_others",
};

export const TimeEntryAccessPolicy = {
  timeEntryWhereForUser(context, projects = []) {
    return (entry) => (
      entry.organizationId === context.organizationId &&
      !entry.deletedAt &&
      (
        entry.userId === context.userId ||
        (
          normalizeTimeEntryStatus(entry.status) !== TIME_ENTRY_STATUS.DRAFT &&
          (context.isAdmin || isProjectRelated(context, projects.find((project) => project.id === entry.projectId)))
        )
      )
    );
  },

  timeEntryWhereForOwnedProjects(context, projects = []) {
    if (context.isAdmin) return this.timeEntryWhereForUser(context, projects);
    const ownedProjectIds = new Set(projects
      .filter((project) => (
        project.organizationId === context.organizationId &&
        !project.deletedAt &&
        (project.ownerId === context.userId || project.createdById === context.userId)
      ))
      .map((project) => project.id));
    return (entry) => (
      entry.organizationId === context.organizationId &&
      !entry.deletedAt &&
      ownedProjectIds.has(entry.projectId) &&
      (entry.userId === context.userId || normalizeTimeEntryStatus(entry.status) !== TIME_ENTRY_STATUS.DRAFT)
    );
  },

  canCreateTimeEntry(context, input, project, projectMembers = []) {
    return Boolean(
      context?.isActiveUser &&
      input?.userId === context.userId &&
      project?.organizationId === context.organizationId &&
      !project.deletedAt &&
      isActiveProjectMember(context, project, projectMembers),
    );
  },

  canEditTimeEntry(context, timeEntry) {
    if (!context?.isActiveUser || timeEntry?.organizationId !== context.organizationId || timeEntry?.deletedAt) return false;
    if (timeEntry.userId !== context.userId) return false;
    return [TIME_ENTRY_STATUS.DRAFT, TIME_ENTRY_STATUS.REJECTED].includes(normalizeTimeEntryStatus(timeEntry.status));
  },

  canDeleteTimeEntry(context, timeEntry) {
    if (!context?.isActiveUser || timeEntry?.organizationId !== context.organizationId || timeEntry?.deletedAt) return false;
    return timeEntry.userId === context.userId && normalizeTimeEntryStatus(timeEntry.status) === TIME_ENTRY_STATUS.DRAFT;
  },

  canSubmitTimeEntry(context, timeEntry) {
    return this.canEditTimeEntry(context, timeEntry) && timeEntry.userId === context.userId;
  },

  canApproveTimeEntry(context, timeEntry, project) {
    if (!context?.isActiveUser || timeEntry?.organizationId !== context.organizationId || timeEntry?.deletedAt) return false;
    if (normalizeTimeEntryStatus(timeEntry.status) !== TIME_ENTRY_STATUS.SUBMITTED) return false;
    return context.isAdmin || isProjectOwner(context, project) || project?.projectManagerId === context.userId;
  },

  canRejectTimeEntry(context, timeEntry, project) {
    return this.canApproveTimeEntry(context, timeEntry, project);
  },

  canExportProjectTimeEntries(context, project) {
    return Boolean(context?.isActiveUser && project?.organizationId === context.organizationId && (context.isAdmin || isProjectOwner(context, project)));
  },
};

function isProjectRelated(context, project) {
  return Boolean(project && (
    project.ownerId === context.userId ||
    project.createdById === context.userId ||
    project.projectManagerId === context.userId ||
    project.members?.some((member) => member.userId === context.userId && member.status === "ACTIVE")
  ));
}

export function normalizeTimeEntryStatus(status) {
  const legacyStatusMap = {
    草稿: TIME_ENTRY_STATUS.DRAFT,
    已提交: TIME_ENTRY_STATUS.SUBMITTED,
    已审批: TIME_ENTRY_STATUS.APPROVED,
    已驳回: TIME_ENTRY_STATUS.REJECTED,
  };
  return legacyStatusMap[status] || status || TIME_ENTRY_STATUS.SUBMITTED;
}
