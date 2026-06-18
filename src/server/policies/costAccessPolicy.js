import { isProjectOwner } from "../../domain/access.js";

export const COST_PERMISSIONS = {
  VIEW_PROJECT: "cost.view_project",
  CREATE: "cost.create",
  UPDATE: "cost.update",
  EXPORT: "cost.export",
};

export const CostAccessPolicy = {
  canViewCost(context, project) {
    return Boolean(
      context?.isActiveUser &&
      project &&
      project.organizationId === context.organizationId &&
      !project.deletedAt &&
      (context.isAdmin || isProjectOwner(context, project)),
    );
  },

  canManageCost(context, project) {
    return this.canViewCost(context, project);
  },

  canExportCost(context, project) {
    return this.canViewCost(context, project);
  },

  costRecordWhereForUser(context, projects = []) {
    if (context.isAdmin) {
      return (record) => record.organizationId === context.organizationId && !record.deletedAt;
    }

    const ownedProjectIds = new Set(projects
      .filter((project) => project.organizationId === context.organizationId && project.ownerId === context.userId && !project.deletedAt)
      .map((project) => project.id));

    return (record) => (
      record.organizationId === context.organizationId &&
      !record.deletedAt &&
      ownedProjectIds.has(record.projectId)
    );
  },
};

