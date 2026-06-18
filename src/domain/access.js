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

export const DEMO_USERS = [
  { id: "user-admin", organizationId: ORGANIZATION_ID, name: "管理员", email: "admin@gridproject.local", role: ORGANIZATION_ROLES.ADMIN, status: USER_STATUS.ACTIVE },
  { id: "user-linxia", organizationId: ORGANIZATION_ID, name: "林夏", email: "linxia@gridproject.local", role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE },
  { id: "user-zhoucheng", organizationId: ORGANIZATION_ID, name: "周程", email: "zhoucheng@gridproject.local", role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE },
  { id: "user-hanyue", organizationId: ORGANIZATION_ID, name: "韩越", email: "hanyue@gridproject.local", role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE },
  { id: "user-chenche", organizationId: ORGANIZATION_ID, name: "陈澈", email: "chenche@gridproject.local", role: ORGANIZATION_ROLES.MEMBER, status: USER_STATUS.ACTIVE },
];

export function buildAccessContext(user, organizationId = ORGANIZATION_ID) {
  if (!user) throw new Error("Authenticated user is required");
  return {
    organizationId,
    user,
    userId: user.id,
    isAdmin: user.role === ORGANIZATION_ROLES.ADMIN,
    isActiveUser: user.status === USER_STATUS.ACTIVE && user.organizationId === organizationId,
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

