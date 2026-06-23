import { isActiveProjectMember, isProjectOwner } from "../../domain/access.js";

export const PROJECT_PERMISSIONS = {
  CREATE: "project.create",
  VIEW: "project.view",
  BOARD_VIEW: "project.board.view",
  UPDATE: "project.update",
  DELETE: "project.delete",
  MANAGE_MEMBERS: "project.manage_members",
};

export const ProjectAccessPolicy = {
  canCreateProject(context) {
    return Boolean(context?.isActiveUser);
  },

  canViewProject(context, project, projectMembers = []) {
    return Boolean(
      context?.isActiveUser &&
      project &&
      project.organizationId === context.organizationId &&
      !project.deletedAt &&
      (context.isAdmin || isProjectOwner(context, project) || isActiveProjectMember(context, project, projectMembers)),
    );
  },

  canViewProjectBoard(context, project, projectMembers = []) {
    return this.canViewProject(context, project, projectMembers);
  },

  canUpdateProject(context, project) {
    return Boolean(context?.isActiveUser && project && project.organizationId === context.organizationId && !project.deletedAt && (context.isAdmin || isProjectOwner(context, project)));
  },

  canDeleteProject(context, project) {
    return this.canUpdateProject(context, project);
  },

  canManageProjectMembers(context, project) {
    return this.canUpdateProject(context, project);
  },

  projectWhereForUser(context) {
    if (!context.isAdmin) {
      return {
        organizationId: context.organizationId,
        deletedAt: null,
        OR: [
          { ownerId: context.userId },
          { createdById: context.userId },
          { members: { some: { userId: context.userId, status: "ACTIVE" } } },
        ],
      };
    }
    return {
      organizationId: context.organizationId,
      deletedAt: null,
    };
  },

  permissionsForProject(context, project, projectMembers = []) {
    const isCreator = project?.createdById === context.userId;
    const canViewProjectTimeEntries = context.isAdmin || isProjectOwner(context, project) || isCreator;
    const canManageCost = context.isAdmin || isProjectOwner(context, project) || isCreator;
    return {
      canView: this.canViewProject(context, project, projectMembers),
      canViewBoard: this.canViewProjectBoard(context, project, projectMembers),
      canUpdate: this.canUpdateProject(context, project),
      canDelete: this.canDeleteProject(context, project),
      canManageMembers: this.canManageProjectMembers(context, project),
      canViewProjectTimeEntries,
      canApproveTimeEntries: canViewProjectTimeEntries,
      canViewCost: canManageCost,
      canManageCost,
      canExportCost: canManageCost,
    };
  },
};
