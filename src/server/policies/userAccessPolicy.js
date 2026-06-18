import { USER_PERMISSIONS } from "../../domain/access.js";

export const UserAccessPolicy = {
  permissionsForUser(context) {
    const allowed = Boolean(context?.isActiveUser && context.isAdmin);
    return {
      [USER_PERMISSIONS.VIEW]: allowed,
      [USER_PERMISSIONS.CREATE]: allowed,
      [USER_PERMISSIONS.UPDATE]: allowed,
      [USER_PERMISSIONS.DELETE]: allowed,
      [USER_PERMISSIONS.RESET_PASSWORD]: allowed,
    };
  },

  canViewUsers(context) {
    return this.permissionsForUser(context)[USER_PERMISSIONS.VIEW];
  },

  canCreateUser(context) {
    return this.permissionsForUser(context)[USER_PERMISSIONS.CREATE];
  },

  canUpdateUser(context) {
    return this.permissionsForUser(context)[USER_PERMISSIONS.UPDATE];
  },

  canDeleteUser(context) {
    return this.permissionsForUser(context)[USER_PERMISSIONS.DELETE];
  },

  canResetPassword(context) {
    return this.permissionsForUser(context)[USER_PERMISSIONS.RESET_PASSWORD];
  },
};
