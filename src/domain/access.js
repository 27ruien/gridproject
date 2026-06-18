export const ORGANIZATION_ID = "org-default";

export const ORGANIZATION_ROLES = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
};

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const PROJECT_MEMBER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const USER_PERMISSIONS = {
  VIEW: "user.view",
  CREATE: "user.create",
  UPDATE: "user.update",
  DELETE: "user.delete",
  RESET_PASSWORD: "user.reset_password",
};

const DEV_PASSWORD_HASH = "$argon2id$v=19$m=1024,t=2,p=1$Z3JpZHByb2plY3QtZGV2$2g8lN7Wssmdevplaceholderhash";

export const DEMO_USERS = [
  { id: "user-admin", organizationId: ORGANIZATION_ID, name: "管理员", email: "admin@gridproject.local", passwordHash: DEV_PASSWORD_HASH, role: ORGANIZATION_ROLES.ADMIN, status: USER_STATUS.ACTIVE, lastLoginAt: "2026-06-18T08:30:00.000Z", deletedAt: null, deletedById: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
  { id: "user-linxia", organizationId: ORGANIZATION_ID, name: "林夏", email: "linxia@gridproject.local", passwordHash: DEV_PASSWORD_HASH, role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE, lastLoginAt: "2026-06-17T10:20:00.000Z", deletedAt: null, deletedById: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
  { id: "user-zhoucheng", organizationId: ORGANIZATION_ID, name: "周程", email: "zhoucheng@gridproject.local", passwordHash: DEV_PASSWORD_HASH, role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE, lastLoginAt: "2026-06-16T09:10:00.000Z", deletedAt: null, deletedById: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
  { id: "user-hanyue", organizationId: ORGANIZATION_ID, name: "韩越", email: "hanyue@gridproject.local", passwordHash: DEV_PASSWORD_HASH, role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE, lastLoginAt: "2026-06-15T13:00:00.000Z", deletedAt: null, deletedById: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
  { id: "user-chenche", organizationId: ORGANIZATION_ID, name: "陈澈", email: "chenche@gridproject.local", passwordHash: DEV_PASSWORD_HASH, role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE, lastLoginAt: null, deletedAt: null, deletedById: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-01T00:00:00.000Z" },
];

export function buildAccessContext(user, organizationId = ORGANIZATION_ID) {
  if (!user) throw new Error("Authenticated user is required");
  return {
    organizationId,
    user,
    userId: user.id,
    isAdmin: user.role === ORGANIZATION_ROLES.ADMIN,
    isActiveUser: user.status === USER_STATUS.ACTIVE && user.organizationId === organizationId && !user.deletedAt,
  };
}

export function findUserByName(users, name) {
  return users.find((user) => user.name === name) || null;
}

export function findUserById(users, id) {
  return users.find((user) => user.id === id) || null;
}

export function userIdForName(users, name) {
  return findUserByName(users, name)?.id || "";
}

export function userNameForId(users, id) {
  return findUserById(users, id)?.name || "未知成员";
}

export function ensureProjectOwnerMembership(project, projectMembers) {
  if (!project?.ownerId) return projectMembers;
  const exists = projectMembers.some((member) => (
    member.projectId === project.id &&
    member.userId === project.ownerId &&
    member.status === PROJECT_MEMBER_STATUS.ACTIVE
  ));
  if (exists) return projectMembers;

  return [
    ...projectMembers,
    {
      id: `pm-${project.id}-${project.ownerId}`,
      organizationId: project.organizationId || ORGANIZATION_ID,
      projectId: project.id,
      userId: project.ownerId,
      status: PROJECT_MEMBER_STATUS.ACTIVE,
      createdAt: project.createdAt || new Date().toISOString(),
    },
  ];
}

export function isActiveProjectMember(context, project, projectMembers) {
  if (!context?.isActiveUser || !project) return false;
  return projectMembers.some((member) => (
    member.organizationId === context.organizationId &&
    member.projectId === project.id &&
    member.userId === context.userId &&
    member.status === PROJECT_MEMBER_STATUS.ACTIVE
  ));
}

export function isProjectOwner(context, project) {
  return Boolean(context?.isActiveUser && project?.ownerId && project.ownerId === context.userId);
}
