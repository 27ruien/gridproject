import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/utils/password.js";
import { createTestPrisma, integrationTestSkipReason, testServerConfig } from "./testDatabase.js";

const skipReason = integrationTestSkipReason();

async function fixture() {
  const prisma = createTestPrisma();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const password = `StrongPass${suffix}9`;
  const organization = await prisma.organization.create({ data: { id: `org-${suffix}`, name: `Org ${suffix}` } });
  const otherOrganization = await prisma.organization.create({ data: { id: `other-org-${suffix}`, name: `Other Org ${suffix}` } });
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({ data: { organizationId: organization.id, name: "Admin", email: `admin-${suffix}@grid.test`, passwordHash, role: "ADMIN", status: "ACTIVE" } });
  const owner = await prisma.user.create({ data: { organizationId: organization.id, name: "Owner", email: `owner-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const member = await prisma.user.create({ data: { organizationId: organization.id, name: "Member", email: `member-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const otherMember = await prisma.user.create({ data: { organizationId: organization.id, name: "Other", email: `other-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const outsideOwner = await prisma.user.create({ data: { organizationId: otherOrganization.id, name: "Outside", email: `outside-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const project = await prisma.project.create({ data: { organizationId: organization.id, name: "Owned Project", code: `OWN${suffix.slice(-5)}`, status: "进行中", ownerId: owner.id, createdById: admin.id } });
  const otherProject = await prisma.project.create({ data: { organizationId: organization.id, name: "Other Project", code: `OTH${suffix.slice(-5)}`, status: "进行中", ownerId: otherMember.id, createdById: admin.id } });
  const outsideProject = await prisma.project.create({ data: { organizationId: otherOrganization.id, name: "Outside Project", code: `OUT${suffix.slice(-5)}`, status: "进行中", ownerId: outsideOwner.id, createdById: outsideOwner.id } });
  await prisma.projectMember.createMany({ data: [
    { organizationId: organization.id, projectId: project.id, userId: owner.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: project.id, userId: member.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: otherProject.id, userId: owner.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: otherProject.id, userId: otherMember.id, status: "ACTIVE" },
    { organizationId: otherOrganization.id, projectId: outsideProject.id, userId: outsideOwner.id, status: "ACTIVE" },
  ] });
  const issue = await prisma.issue.create({ data: { organizationId: organization.id, projectId: project.id, code: `ISS${suffix.slice(-5)}`, title: "Issue", type: "任务", status: "未开始" } });
  const otherIssue = await prisma.issue.create({ data: { organizationId: organization.id, projectId: otherProject.id, code: `OIS${suffix.slice(-5)}`, title: "Other Issue", type: "任务", status: "未开始" } });
  return { prisma, suffix, password, organization, admin, owner, member, otherMember, project, otherProject, outsideProject, issue, otherIssue };
}

async function login(app: any, email: string, password: string) {
  const response = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  assert.equal(response.statusCode, 200, response.body);
  return String(response.headers["set-cookie"]);
}

test("auth session, bootstrap safety, logout, reset, disabled login and rate limit", { skip: skipReason }, async () => {
  const data = await fixture();
  const app = await buildApp(testServerConfig());
  try {
    const adminCookie = await login(app, data.admin.email, data.password);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: adminCookie } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.id, data.admin.id);
    assert.equal(me.json().user.passwordHash, undefined);

    const bootstrap = await app.inject({ method: "GET", url: "/api/bootstrap", headers: { cookie: adminCookie } });
    assert.equal(bootstrap.statusCode, 200);
    assert.equal("sessions" in bootstrap.json(), false);
    assert.equal("auditLogs" in bootstrap.json(), false);
    assert.equal(bootstrap.body.includes("passwordHash"), false);

    const memberCookie = await login(app, data.member.email, data.password);
    const reset = await app.inject({
      method: "POST",
      url: `/api/users/${data.member.id}/reset-password`,
      headers: { cookie: adminCookie },
      payload: { newPassword: `NewPass${data.suffix}9`, confirmNewPassword: `NewPass${data.suffix}9` },
    });
    assert.equal(reset.statusCode, 200, reset.body);
    const oldMe = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: memberCookie } });
    assert.equal(oldMe.statusCode, 401);

    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: adminCookie } });
    assert.equal(logout.statusCode, 200);
    const afterLogout = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: adminCookie } });
    assert.equal(afterLogout.statusCode, 401);

    await data.prisma.user.update({ where: { id: data.otherMember.id }, data: { status: "INACTIVE" } });
    const inactiveLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: data.otherMember.email, password: data.password } });
    assert.equal(inactiveLogin.statusCode, 401);

    for (let index = 0; index < 5; index += 1) {
      await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: `limited-${data.suffix}@grid.test`, password: "bad" } });
    }
    const limited = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: `limited-${data.suffix}@grid.test`, password: "bad" } });
    assert.equal(limited.statusCode, 429);
  } finally {
    await app.close();
    await data.prisma.$disconnect();
  }
});

test("personal profile, preferences and password updates are persisted safely", { skip: skipReason }, async () => {
  const data = await fixture();
  const app = await buildApp(testServerConfig());
  try {
    const firstCookie = await login(app, data.owner.email, data.password);
    const secondCookie = await login(app, data.owner.email, data.password);

    const unauthenticated = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      payload: { currentPassword: data.password, newPassword: "AnotherPass123", confirmPassword: "AnotherPass123" },
    });
    assert.equal(unauthenticated.statusCode, 401);

    const invalidProfile = await app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      headers: { cookie: firstCookie },
      payload: { name: "Owner QA", email: "cannot-change@grid.test" },
    });
    assert.equal(invalidProfile.statusCode, 400);

    const profile = await app.inject({
      method: "PATCH",
      url: "/api/auth/profile",
      headers: { cookie: firstCookie },
      payload: { name: "Owner QA", avatarColor: "#177565" },
    });
    assert.equal(profile.statusCode, 200, profile.body);
    assert.equal(profile.json().user.name, "Owner QA");
    assert.equal(profile.json().user.email, data.owner.email);
    assert.equal(profile.json().user.passwordHash, undefined);

    const preferences = await app.inject({
      method: "PATCH",
      url: "/api/auth/preferences",
      headers: { cookie: firstCookie },
      payload: {
        density: "compact",
        dateFormat: "dd-mm-yyyy",
        weekStart: "sunday",
        defaultNav: "collapsed",
        homeDueRange: "others",
        avatarColor: "#177565",
      },
    });
    assert.equal(preferences.statusCode, 200, preferences.body);
    assert.equal(preferences.json().user.preferences.density, "compact");
    assert.equal(preferences.json().user.preferences.homeDueRange, "others");
    assert.equal(preferences.body.includes("passwordHash"), false);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrongCurrent = await app.inject({
        method: "PATCH",
        url: "/api/auth/password",
        headers: { cookie: firstCookie },
        payload: { currentPassword: "WrongPassword99", newPassword: "AnotherPass123", confirmPassword: "AnotherPass123" },
      });
      assert.equal(wrongCurrent.statusCode, 400);
      assert.equal(wrongCurrent.json().error.message, "当前密码不正确。");
    }

    const samePassword = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: data.password, newPassword: data.password, confirmPassword: data.password },
    });
    assert.equal(samePassword.statusCode, 400);

    const mismatch = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: data.password, newPassword: "AnotherPass123", confirmPassword: "AnotherPass456" },
    });
    assert.equal(mismatch.statusCode, 400);

    const newPassword = `UpdatedPass${data.suffix}7`;
    const updatePassword = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: data.password, newPassword, confirmPassword: newPassword },
    });
    assert.equal(updatePassword.statusCode, 200, updatePassword.body);
    assert.equal(updatePassword.json().currentSessionKept, true);
    assert.equal(updatePassword.json().otherSessionsRevoked, true);
    assert.equal(updatePassword.body.includes("passwordHash"), false);

    const currentSession = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: firstCookie } });
    assert.equal(currentSession.statusCode, 200);
    const otherSession = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: secondCookie } });
    assert.equal(otherSession.statusCode, 401);
    const oldPasswordLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: data.owner.email, password: data.password } });
    assert.equal(oldPasswordLogin.statusCode, 401);
    const newPasswordLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: data.owner.email, password: newPassword } });
    assert.equal(newPasswordLogin.statusCode, 200, newPasswordLogin.body);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await app.inject({
        method: "PATCH",
        url: "/api/auth/password",
        headers: { cookie: firstCookie },
        payload: { currentPassword: data.password, newPassword: "FuturePass123", confirmPassword: "FuturePass123" },
      });
      assert.equal(failed.statusCode, 400, failed.body);
    }
    const limited = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: { cookie: firstCookie },
      payload: { currentPassword: data.password, newPassword: "FuturePass123", confirmPassword: "FuturePass123" },
    });
    assert.equal(limited.statusCode, 429, limited.body);

    const memberCookie = await login(app, data.member.email, data.password);
    const isolatedMemberFailure = await app.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: { cookie: memberCookie },
      payload: { currentPassword: "WrongPassword99", newPassword: "MemberPass123", confirmPassword: "MemberPass123" },
    });
    assert.equal(isolatedMemberFailure.statusCode, 400, isolatedMemberFailure.body);

    const persisted = await data.prisma.user.findUniqueOrThrow({ where: { id: data.owner.id } });
    assert.equal(persisted.name, "Owner QA");
    assert.equal((persisted.preferences as any).dateFormat, "dd-mm-yyyy");
    const auditActions = await data.prisma.auditLog.findMany({ where: { actorId: data.owner.id }, select: { action: true, data: true } });
    assert.deepEqual(new Set(auditActions.map((entry) => entry.action)), new Set([
      "user.profile_update",
      "user.preferences_update",
      "user.password_update",
      "user.password_verification_failed",
      "user.password_rate_limited",
    ]));
    const auditData = JSON.stringify(auditActions.map((entry) => entry.data));
    for (const secret of [data.password, newPassword, "WrongPassword99", "AnotherPass123", "FuturePass123"]) {
      assert.equal(auditData.includes(secret), false);
    }
  } finally {
    await app.close();
    await data.prisma.$disconnect();
  }
});

test("time entry permissions, status transitions and validation", { skip: skipReason }, async () => {
  const data = await fixture();
  const app = await buildApp(testServerConfig());
  try {
    const memberCookie = await login(app, data.member.email, data.password);
    const ownerCookie = await login(app, data.owner.email, data.password);
    const adminCookie = await login(app, data.admin.email, data.password);
    const workDate = "2026-06-19";

    const approvedCreate = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 2, status: "APPROVED" } });
    assert.equal(approvedCreate.statusCode, 422);

    const create = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 2, description: "draft" } });
    assert.equal(create.statusCode, 201, create.body);
    const entry = create.json().entry;
    assert.equal(entry.status, "DRAFT");

    const patchStatus = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { status: "APPROVED" } });
    assert.equal(patchStatus.statusCode, 422);
    const patchProject = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { projectId: data.otherProject.id } });
    assert.equal(patchProject.statusCode, 422);
    const patchUser = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { userId: data.otherMember.id } });
    assert.equal(patchUser.statusCode, 422);
    const patchWrongIssue = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { issueId: data.otherIssue.id } });
    assert.equal(patchWrongIssue.statusCode, 400);

    const tooManyHours = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-06-20", hours: 25 } });
    assert.equal(tooManyHours.statusCode, 422);

    const dailyLimit = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 23 } });
    assert.equal(dailyLimit.statusCode, 400);
    const createWrongIssue = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.otherIssue.id, workDate: "2026-06-27", hours: 1 } });
    assert.equal(createWrongIssue.statusCode, 400);

    const otherEntry = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.issue.id, userId: data.otherMember.id, reporterId: data.otherMember.id, workDate: new Date(`${workDate}T00:00:00.000Z`), hours: 1, status: "SUBMITTED" } });
    const memberList = await app.inject({ method: "GET", url: "/api/time-entries", headers: { cookie: memberCookie } });
    assert.equal(memberList.statusCode, 200);
    assert.deepEqual(memberList.json().rows.map((row: any) => row.userId), [data.member.id]);

    const ownerList = await app.inject({ method: "GET", url: "/api/time-entries", headers: { cookie: ownerCookie } });
    assert.equal(ownerList.statusCode, 200);
    assert(ownerList.json().rows.some((row: any) => row.id === otherEntry.id));

    const ownerEditOther = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: ownerCookie }, payload: { hours: 2 } });
    assert.equal(ownerEditOther.statusCode, 403);
    const ownerMoveOther = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: ownerCookie }, payload: { targetProjectId: data.otherProject.id, correctionReason: "move" } });
    assert.equal(ownerMoveOther.statusCode, 403);
    const ownerDeleteOther = await app.inject({ method: "DELETE", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: ownerCookie }, payload: { correctionReason: "no" } });
    assert.equal(ownerDeleteOther.statusCode, 403);

    const submit = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/submit`, headers: { cookie: memberCookie } });
    assert.equal(submit.statusCode, 200);
    assert.equal(submit.json().entry.status, "SUBMITTED");

    const approve = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/approve`, headers: { cookie: ownerCookie } });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.json().entry.status, "APPROVED");

    const rejectApproved = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/reject`, headers: { cookie: ownerCookie }, payload: { correctionReason: "late" } });
    assert.equal(rejectApproved.statusCode, 403);

    const otherProjectEntry = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.otherProject.id, issueId: data.otherIssue.id, userId: data.otherMember.id, reporterId: data.otherMember.id, workDate: new Date("2026-06-21T00:00:00.000Z"), hours: 1, status: "SUBMITTED" } });
    const ownerApproveOtherProject = await app.inject({ method: "POST", url: `/api/time-entries/${otherProjectEntry.id}/approve`, headers: { cookie: ownerCookie } });
    assert.equal(ownerApproveOtherProject.statusCode, 404);

    const adminEditOtherNoReason = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2 } });
    assert.equal(adminEditOtherNoReason.statusCode, 400);
    const adminEditOther = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2, correctionReason: "fix wrong hours" } });
    assert.equal(adminEditOther.statusCode, 200);
    const adminPatchProject = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { projectId: data.otherProject.id, correctionReason: "move" } });
    assert.equal(adminPatchProject.statusCode, 422);
    const adminMoveNoReason = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.otherIssue.id } });
    assert.equal(adminMoveNoReason.statusCode, 422);
    const adminMoveNotMember = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, correctionReason: "member is not in target project" } });
    assert.equal(adminMoveNotMember.statusCode, 403);
    const adminMoveCrossOrg = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.outsideProject.id, correctionReason: "cross org" } });
    assert.equal(adminMoveCrossOrg.statusCode, 404);
    const adminMoveWrongIssue = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.issue.id, correctionReason: "wrong issue" } });
    assert.equal(adminMoveWrongIssue.statusCode, 400);
    const adminMove = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.otherIssue.id, correctionReason: "move to correct project" } });
    assert.equal(adminMove.statusCode, 200, adminMove.body);
    assert.equal(adminMove.json().entry.projectId, data.otherProject.id);
    assert.equal(adminMove.json().entry.issueId, data.otherIssue.id);

    const crossOrg = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.outsideProject.id, workDate: "2026-06-22", hours: 1 } });
    assert.equal(crossOrg.statusCode, 404);

    const corrupt = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.otherIssue.id, userId: data.member.id, reporterId: data.member.id, workDate: new Date("2026-06-26T00:00:00.000Z"), hours: 1, status: "DRAFT" } });
    const listWithCorrupt = await app.inject({ method: "GET", url: "/api/time-entries", headers: { cookie: memberCookie } });
    assert.equal(listWithCorrupt.statusCode, 200);
    assert.equal(listWithCorrupt.json().rows.find((row: any) => row.id === corrupt.id).issueId, null);

    const concurrentCreate = await Promise.all([
      app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-06-24", hours: 13 } }),
      app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-06-24", hours: 13 } }),
    ]);
    assert.equal(concurrentCreate.filter((response) => response.statusCode === 201).length, 1);
    assert.equal(concurrentCreate.filter((response) => response.statusCode === 400).length, 1);

    const editA = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.issue.id, userId: data.member.id, reporterId: data.member.id, workDate: new Date("2026-06-25T00:00:00.000Z"), hours: 1, status: "DRAFT" } });
    const editB = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.issue.id, userId: data.member.id, reporterId: data.member.id, workDate: new Date("2026-06-25T00:00:00.000Z"), hours: 1, status: "DRAFT" } });
    const concurrentEdit = await Promise.all([
      app.inject({ method: "PATCH", url: `/api/time-entries/${editA.id}`, headers: { cookie: memberCookie }, payload: { hours: 13 } }),
      app.inject({ method: "PATCH", url: `/api/time-entries/${editB.id}`, headers: { cookie: memberCookie }, payload: { hours: 13 } }),
    ]);
    assert.equal(concurrentEdit.filter((response) => response.statusCode === 200).length, 1);
    assert.equal(concurrentEdit.filter((response) => response.statusCode === 400).length, 1);
  } finally {
    await app.close();
    await data.prisma.$disconnect();
  }
});

test("business API modules persist project members, issues, comments, milestones, settings and trash", { skip: skipReason }, async () => {
  const data = await fixture();
  const app = await buildApp(testServerConfig());
  try {
    const adminCookie = await login(app, data.admin.email, data.password);
    const ownerCookie = await login(app, data.owner.email, data.password);
    const memberCookie = await login(app, data.member.email, data.password);
    const otherMemberCookie = await login(app, data.otherMember.email, data.password);

    const memberSettings = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie: memberCookie },
      payload: { platformName: "Nope" },
    });
    assert.equal(memberSettings.statusCode, 403);

    const settings = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: { cookie: adminCookie },
      payload: { platformName: "GridProject QA", logoText: "QA" },
    });
    assert.equal(settings.statusCode, 200, settings.body);
    assert.equal(settings.json().settings.platformName, "GridProject QA");

    const bootstrap = await app.inject({ method: "GET", url: "/api/bootstrap", headers: { cookie: adminCookie } });
    assert.equal(bootstrap.statusCode, 200, bootstrap.body);
    assert.equal(bootstrap.json().settings.logoText, "QA");

    const addMember = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/members`,
      headers: { cookie: ownerCookie },
      payload: { userId: data.otherMember.id },
    });
    assert.equal(addMember.statusCode, 201, addMember.body);
    assert.equal(addMember.json().member.userId, data.otherMember.id);

    const duplicateMember = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/members`,
      headers: { cookie: ownerCookie },
      payload: { userId: data.otherMember.id },
    });
    assert.equal(duplicateMember.statusCode, 409);

    const forgedIssueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: memberCookie },
      payload: {
        code: `FOR${data.suffix.slice(-5)}`,
        title: "Creator spoof should fail",
        creatorId: data.owner.id,
      },
    });
    assert.equal(forgedIssueCreate.statusCode, 400);

    const memberMilestone = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/milestones`,
      headers: { cookie: memberCookie },
      payload: { name: "Member cannot create", status: "未开始" },
    });
    assert.equal(memberMilestone.statusCode, 403);

    const milestoneCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/milestones`,
      headers: { cookie: ownerCookie },
      payload: { name: "验收窗口", window: "W1", focus: "冻结验收口径", status: "未开始", dueDate: "2026-07-01" },
    });
    assert.equal(milestoneCreate.statusCode, 201, milestoneCreate.body);
    const milestone = milestoneCreate.json().milestone;
    assert.equal(milestone.name, "验收窗口");
    assert.equal(milestone.window, "W1");

    const milestonePatch = await app.inject({
      method: "PATCH",
      url: `/api/milestones/${milestone.id}`,
      headers: { cookie: ownerCookie },
      payload: { status: "已完成" },
    });
    assert.equal(milestonePatch.statusCode, 200, milestonePatch.body);
    assert.equal(milestonePatch.json().milestone.status, "已完成");
    assert.ok(milestonePatch.json().milestone.completedAt);

    const issueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: memberCookie },
      payload: {
        code: `NEW${data.suffix.slice(-5)}`,
        title: "API backed issue",
        type: "任务",
        status: "进行中",
        ownerId: data.otherMember.id,
        priority: "P1",
        next: "走接口保存下一步",
      },
    });
    assert.equal(issueCreate.statusCode, 201, issueCreate.body);
    const issue = issueCreate.json().issue;
    assert.equal(issue.next, "走接口保存下一步");
    assert.equal(issue.ownerId, data.otherMember.id);
    assert.equal(issue.creatorId, data.member.id);

    const forgedIssuePatch = await app.inject({
      method: "PATCH",
      url: `/api/issues/${issue.id}`,
      headers: { cookie: otherMemberCookie },
      payload: { creatorId: data.otherMember.id },
    });
    assert.equal(forgedIssuePatch.statusCode, 400);
    const deleteAfterForgedPatch = await app.inject({ method: "DELETE", url: `/api/issues/${issue.id}`, headers: { cookie: otherMemberCookie } });
    assert.equal(deleteAfterForgedPatch.statusCode, 403);

    const removeBusyMember = await app.inject({
      method: "DELETE",
      url: `/api/projects/${data.project.id}/members/${addMember.json().member.id}`,
      headers: { cookie: ownerCookie },
    });
    assert.equal(removeBusyMember.statusCode, 409);

    const commentCreate = await app.inject({
      method: "POST",
      url: `/api/issues/${issue.id}/comments`,
      headers: { cookie: memberCookie },
      payload: { text: "第一条后端评论" },
    });
    assert.equal(commentCreate.statusCode, 201, commentCreate.body);
    const comment = commentCreate.json().comment;
    assert.equal(comment.text, "第一条后端评论");

    const editOtherComment = await app.inject({
      method: "PATCH",
      url: `/api/comments/${comment.id}`,
      headers: { cookie: ownerCookie },
      payload: { text: "owner edit" },
    });
    assert.equal(editOtherComment.statusCode, 403);

    const deleteComment = await app.inject({
      method: "DELETE",
      url: `/api/comments/${comment.id}`,
      headers: { cookie: ownerCookie },
    });
    assert.equal(deleteComment.statusCode, 200, deleteComment.body);
    assert.ok(deleteComment.json().comment.deletedAt);

    const issueDetail = await app.inject({ method: "GET", url: `/api/issues/${issue.id}`, headers: { cookie: ownerCookie } });
    assert.equal(issueDetail.statusCode, 200, issueDetail.body);
    assert(issueDetail.json().issue.activity.some((item: any) => item.type === "comment_deleted"));

    const deleteIssue = await app.inject({ method: "DELETE", url: `/api/issues/${issue.id}`, headers: { cookie: ownerCookie } });
    assert.equal(deleteIssue.statusCode, 200, deleteIssue.body);
    assert.ok(deleteIssue.json().issue.deletedAt);

    const deleteMilestone = await app.inject({ method: "DELETE", url: `/api/milestones/${milestone.id}`, headers: { cookie: ownerCookie } });
    assert.equal(deleteMilestone.statusCode, 200, deleteMilestone.body);
    assert.ok(deleteMilestone.json().milestone.deletedAt);

    const trash = await app.inject({ method: "GET", url: "/api/trash", headers: { cookie: ownerCookie } });
    assert.equal(trash.statusCode, 200, trash.body);
    assert(trash.json().rows.some((item: any) => item.type === "issue" && item.entityId === issue.id));
    assert(trash.json().rows.some((item: any) => item.type === "milestone" && item.entityId === milestone.id));

    const restoreIssue = await app.inject({ method: "POST", url: `/api/trash/issue/${issue.id}/restore`, headers: { cookie: ownerCookie } });
    assert.equal(restoreIssue.statusCode, 200, restoreIssue.body);
    assert.equal(restoreIssue.json().entity.id, issue.id);
    assert.equal(restoreIssue.json().entity.deletedAt, null);

    const restoreMilestone = await app.inject({ method: "POST", url: `/api/trash/milestone/${milestone.id}/restore`, headers: { cookie: ownerCookie } });
    assert.equal(restoreMilestone.statusCode, 200, restoreMilestone.body);
    assert.equal(restoreMilestone.json().entity.id, milestone.id);
    assert.equal(restoreMilestone.json().entity.deletedAt, null);
  } finally {
    await app.close();
    await data.prisma.$disconnect();
  }
});
