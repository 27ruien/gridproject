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
  const manager = await prisma.user.create({ data: { organizationId: organization.id, name: "Manager", email: `manager-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const viewer = await prisma.user.create({ data: { organizationId: organization.id, name: "Viewer", email: `viewer-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const otherMember = await prisma.user.create({ data: { organizationId: organization.id, name: "Other", email: `other-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const outsideOwner = await prisma.user.create({ data: { organizationId: otherOrganization.id, name: "Outside", email: `outside-${suffix}@grid.test`, passwordHash, role: "MEMBER", status: "ACTIVE" } });
  const project = await prisma.project.create({ data: { organizationId: organization.id, name: "Owned Project", code: `OWN${suffix.slice(-5)}`, status: "进行中", ownerId: owner.id, createdById: admin.id } });
  const otherProject = await prisma.project.create({ data: { organizationId: organization.id, name: "Other Project", code: `OTH${suffix.slice(-5)}`, status: "进行中", ownerId: otherMember.id, createdById: admin.id } });
  const outsideProject = await prisma.project.create({ data: { organizationId: otherOrganization.id, name: "Outside Project", code: `OUT${suffix.slice(-5)}`, status: "进行中", ownerId: outsideOwner.id, createdById: outsideOwner.id } });
  await prisma.projectMember.createMany({ data: [
    { organizationId: organization.id, projectId: project.id, userId: owner.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: project.id, userId: member.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: project.id, userId: manager.id, status: "ACTIVE", role: "MANAGER" },
    { organizationId: organization.id, projectId: project.id, userId: viewer.id, status: "ACTIVE", role: "VIEWER" },
    { organizationId: organization.id, projectId: otherProject.id, userId: owner.id, status: "ACTIVE" },
    { organizationId: organization.id, projectId: otherProject.id, userId: otherMember.id, status: "ACTIVE" },
    { organizationId: otherOrganization.id, projectId: outsideProject.id, userId: outsideOwner.id, status: "ACTIVE" },
  ] });
  const issue = await prisma.issue.create({ data: { organizationId: organization.id, projectId: project.id, code: `ISS${suffix.slice(-5)}`, title: "Issue", type: "任务", status: "未开始" } });
  const otherIssue = await prisma.issue.create({ data: { organizationId: organization.id, projectId: otherProject.id, code: `OIS${suffix.slice(-5)}`, title: "Other Issue", type: "任务", status: "未开始" } });
  return { prisma, suffix, password, organization, admin, owner, member, manager, viewer, otherMember, project, otherProject, outsideProject, issue, otherIssue };
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

    const attachment = {
      id: `att-${data.suffix}`,
      name: "brief.txt",
      size: 12,
      type: "text/plain",
      kind: "file",
      dataUrl: "data:text/plain;base64,YnJpZWY=",
    };
    const create = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 2, description: "draft", attachments: [attachment] } });
    assert.equal(create.statusCode, 201, create.body);
    const entry = create.json().entry;
    assert.equal(entry.status, "DRAFT");
    assert.equal(entry.attachments.length, 1);
    assert.equal(entry.attachments[0].name, "brief.txt");

    const tooManyAttachments = await app.inject({
      method: "POST",
      url: "/api/time-entries",
      headers: { cookie: memberCookie },
      payload: {
        projectId: data.project.id,
        issueId: data.issue.id,
        workDate: "2026-06-28",
        hours: 1,
        attachments: Array.from({ length: 10 }, (_, index) => ({ ...attachment, id: `too-many-${index}` })),
      },
    });
    assert.equal(tooManyAttachments.statusCode, 422);

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

    const ownerList = await app.inject({ method: "GET", url: "/api/time-entries?scope=owned", headers: { cookie: ownerCookie } });
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
    const patchSubmitted = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { hours: 1 } });
    assert.equal(patchSubmitted.statusCode, 403);
    const adminPatchSubmitted = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: adminCookie }, payload: { hours: 1, correctionReason: "admin correction" } });
    assert.equal(adminPatchSubmitted.statusCode, 403);

    const approve = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/approve`, headers: { cookie: ownerCookie } });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.json().entry.status, "APPROVED");

    const rejectApproved = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/reject`, headers: { cookie: ownerCookie }, payload: { correctionReason: "late" } });
    assert.equal(rejectApproved.statusCode, 403);

    const otherProjectEntry = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.otherProject.id, issueId: data.otherIssue.id, userId: data.otherMember.id, reporterId: data.otherMember.id, workDate: new Date("2026-06-21T00:00:00.000Z"), hours: 1, status: "SUBMITTED" } });
    const ownerApproveOtherProject = await app.inject({ method: "POST", url: `/api/time-entries/${otherProjectEntry.id}/approve`, headers: { cookie: ownerCookie } });
    assert.equal(ownerApproveOtherProject.statusCode, 403);

    const adminEditOtherNoReason = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2 } });
    assert.equal(adminEditOtherNoReason.statusCode, 403);
    const adminEditOther = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2, correctionReason: "fix wrong hours" } });
    assert.equal(adminEditOther.statusCode, 403);
    const adminPatchProject = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: adminCookie }, payload: { projectId: data.otherProject.id, correctionReason: "move" } });
    assert.equal(adminPatchProject.statusCode, 403);
    const adminMoveSubmitted = await app.inject({ method: "POST", url: `/api/time-entries/${otherEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.otherIssue.id, correctionReason: "submitted move" } });
    assert.equal(adminMoveSubmitted.statusCode, 403);

    const adminDraftEntry = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.issue.id, userId: data.otherMember.id, reporterId: data.otherMember.id, workDate: new Date("2026-06-23T00:00:00.000Z"), hours: 1, status: "DRAFT" } });
    const adminEditDraftNoReason = await app.inject({ method: "PATCH", url: `/api/time-entries/${adminDraftEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2 } });
    assert.equal(adminEditDraftNoReason.statusCode, 400);
    const adminEditDraft = await app.inject({ method: "PATCH", url: `/api/time-entries/${adminDraftEntry.id}`, headers: { cookie: adminCookie }, payload: { hours: 2, attachments: [attachment], correctionReason: "fix wrong hours" } });
    assert.equal(adminEditDraft.statusCode, 200, adminEditDraft.body);
    assert.equal(adminEditDraft.json().entry.attachments.length, 1);
    const adminMoveNoReason = await app.inject({ method: "POST", url: `/api/time-entries/${adminDraftEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.otherIssue.id } });
    assert.equal(adminMoveNoReason.statusCode, 422);
    const adminMoveNotMember = await app.inject({ method: "POST", url: `/api/time-entries/${entry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, correctionReason: "member is not in target project" } });
    assert.equal(adminMoveNotMember.statusCode, 403);
    const adminMoveCrossOrg = await app.inject({ method: "POST", url: `/api/time-entries/${adminDraftEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.outsideProject.id, correctionReason: "cross org" } });
    assert.equal(adminMoveCrossOrg.statusCode, 404);
    const adminMoveWrongIssue = await app.inject({ method: "POST", url: `/api/time-entries/${adminDraftEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.issue.id, correctionReason: "wrong issue" } });
    assert.equal(adminMoveWrongIssue.statusCode, 400);
    const adminMove = await app.inject({ method: "POST", url: `/api/time-entries/${adminDraftEntry.id}/move`, headers: { cookie: adminCookie }, payload: { targetProjectId: data.otherProject.id, targetIssueId: data.otherIssue.id, correctionReason: "move to correct project" } });
    assert.equal(adminMove.statusCode, 200, adminMove.body);

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

test("project member roles enforce project permissions and audit role changes", { skip: skipReason }, async () => {
  const data = await fixture();
  const app = await buildApp(testServerConfig());
  try {
    const adminCookie = await login(app, data.admin.email, data.password);
    const ownerCookie = await login(app, data.owner.email, data.password);
    const managerCookie = await login(app, data.manager.email, data.password);
    const memberCookie = await login(app, data.member.email, data.password);
    const viewerCookie = await login(app, data.viewer.email, data.password);

    const defaultMember = await data.prisma.projectMember.findFirstOrThrow({ where: { projectId: data.project.id, userId: data.member.id } });
    assert.equal(defaultMember.role, "MEMBER");

    const adminProjectUpdate = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.otherProject.id}`,
      headers: { cookie: adminCookie },
      payload: { status: "测试阶段" },
    });
    assert.equal(adminProjectUpdate.statusCode, 200, adminProjectUpdate.body);

    const viewerMember = await data.prisma.projectMember.findFirstOrThrow({ where: { projectId: data.project.id, userId: data.viewer.id } });
    const ownerRoleUpdate = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}/members/${viewerMember.id}`,
      headers: { cookie: ownerCookie },
      payload: { role: "MEMBER" },
    });
    assert.equal(ownerRoleUpdate.statusCode, 200, ownerRoleUpdate.body);
    assert.equal(ownerRoleUpdate.json().member.role, "MEMBER");
    const roleAudit = await data.prisma.auditLog.findFirst({
      where: { action: "project_member.role_update", entityId: viewerMember.id },
      orderBy: { createdAt: "desc" },
    });
    assert.equal((roleAudit?.data as any).projectId, data.project.id);
    assert.equal((roleAudit?.data as any).userId, data.viewer.id);
    assert.equal((roleAudit?.data as any).oldRole, "VIEWER");
    assert.equal((roleAudit?.data as any).newRole, "MEMBER");

    const ownerRoleRestore = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}/members/${viewerMember.id}`,
      headers: { cookie: ownerCookie },
      payload: { role: "VIEWER" },
    });
    assert.equal(ownerRoleRestore.statusCode, 200, ownerRoleRestore.body);

    const ownerMember = await data.prisma.projectMember.findFirstOrThrow({ where: { projectId: data.project.id, userId: data.owner.id } });
    const ownerRoleMutation = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}/members/${ownerMember.id}`,
      headers: { cookie: ownerCookie },
      payload: { role: "MANAGER" },
    });
    assert.equal(ownerRoleMutation.statusCode, 400);

    const managerRoleUpdate = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}/members/${viewerMember.id}`,
      headers: { cookie: managerCookie },
      payload: { role: "MEMBER" },
    });
    assert.equal(managerRoleUpdate.statusCode, 403);

    const managerIssueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: managerCookie },
      payload: { code: `MGR${data.suffix.slice(-5)}`, title: "Manager issue", ownerId: data.manager.id, status: "未开始" },
    });
    assert.equal(managerIssueCreate.statusCode, 201, managerIssueCreate.body);
    const managerIssue = managerIssueCreate.json().issue;

    const managerIssuePatch = await app.inject({
      method: "PATCH",
      url: `/api/issues/${managerIssue.id}`,
      headers: { cookie: managerCookie },
      payload: { status: "进行中" },
    });
    assert.equal(managerIssuePatch.statusCode, 200, managerIssuePatch.body);

    const managerDeleteProject = await app.inject({ method: "DELETE", url: `/api/projects/${data.project.id}`, headers: { cookie: managerCookie } });
    assert.equal(managerDeleteProject.statusCode, 403);

    const managerBoard = await app.inject({ method: "GET", url: `/api/projects/${data.project.id}/board`, headers: { cookie: managerCookie } });
    assert.equal(managerBoard.statusCode, 200, managerBoard.body);
    assert.equal(managerBoard.json().permissions.canCreateIssue, true);
    assert.equal(managerBoard.json().permissions.canManageSchedule, true);
    assert.equal(managerBoard.json().permissions.canApproveTimeEntries, true);
    assert.equal(managerBoard.json().permissions.canDelete, false);

    const managerMilestone = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/milestones`,
      headers: { cookie: managerCookie },
      payload: { name: "Manager milestone", status: "未开始" },
    });
    assert.equal(managerMilestone.statusCode, 201, managerMilestone.body);

    const managerSubmittedEntry = await data.prisma.timeEntry.create({
      data: {
        organizationId: data.organization.id,
        projectId: data.project.id,
        issueId: data.issue.id,
        userId: data.member.id,
        reporterId: data.member.id,
        workDate: new Date("2026-07-03T00:00:00.000Z"),
        hours: 1,
        status: "SUBMITTED",
      },
    });
    const managerApprove = await app.inject({ method: "POST", url: `/api/time-entries/${managerSubmittedEntry.id}/approve`, headers: { cookie: managerCookie } });
    assert.equal(managerApprove.statusCode, 200, managerApprove.body);

    const memberIssueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: memberCookie },
      payload: { code: `MEM${data.suffix.slice(-5)}`, title: "Member issue", ownerId: data.member.id, status: "未开始" },
    });
    assert.equal(memberIssueCreate.statusCode, 201, memberIssueCreate.body);
    const memberIssue = memberIssueCreate.json().issue;
    const memberOwnPatch = await app.inject({
      method: "PATCH",
      url: `/api/issues/${memberIssue.id}`,
      headers: { cookie: memberCookie },
      payload: { priority: "P1" },
    });
    assert.equal(memberOwnPatch.statusCode, 200, memberOwnPatch.body);

    const assignedIssueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: managerCookie },
      payload: { code: `ASN${data.suffix.slice(-5)}`, title: "Assigned to member", ownerId: data.member.id, status: "未开始" },
    });
    assert.equal(assignedIssueCreate.statusCode, 201, assignedIssueCreate.body);
    const assignedPatch = await app.inject({
      method: "PATCH",
      url: `/api/issues/${assignedIssueCreate.json().issue.id}`,
      headers: { cookie: memberCookie },
      payload: { status: "进行中" },
    });
    assert.equal(assignedPatch.statusCode, 200, assignedPatch.body);

    const memberPatchOther = await app.inject({
      method: "PATCH",
      url: `/api/issues/${managerIssue.id}`,
      headers: { cookie: memberCookie },
      payload: { status: "已完成" },
    });
    assert.equal(memberPatchOther.statusCode, 403);

    const otherSubmittedEntry = await data.prisma.timeEntry.create({
      data: {
        organizationId: data.organization.id,
        projectId: data.project.id,
        issueId: data.issue.id,
        userId: data.manager.id,
        reporterId: data.manager.id,
        workDate: new Date("2026-07-04T00:00:00.000Z"),
        hours: 1,
        status: "SUBMITTED",
      },
    });
    const memberApproveOther = await app.inject({ method: "POST", url: `/api/time-entries/${otherSubmittedEntry.id}/approve`, headers: { cookie: memberCookie } });
    assert.equal(memberApproveOther.statusCode, 403);

    const memberBoard = await app.inject({ method: "GET", url: `/api/projects/${data.project.id}/board`, headers: { cookie: memberCookie } });
    assert.equal(memberBoard.statusCode, 200, memberBoard.body);
    assert.equal(memberBoard.json().permissions.canCreateIssue, true);
    assert.equal(memberBoard.json().permissions.canManageSchedule, false);
    assert.equal(memberBoard.json().permissions.canApproveTimeEntries, false);
    assert.equal(memberBoard.json().permissions.canCreateTimeEntries, true);

    const viewerBoard = await app.inject({ method: "GET", url: `/api/projects/${data.project.id}/board`, headers: { cookie: viewerCookie } });
    assert.equal(viewerBoard.statusCode, 200, viewerBoard.body);
    assert.equal(viewerBoard.json().permissions.canCreateIssue, false);
    assert.equal(viewerBoard.json().permissions.canCreateTimeEntries, false);

    const viewerIssueCreate = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/issues`,
      headers: { cookie: viewerCookie },
      payload: { code: `VEW${data.suffix.slice(-5)}`, title: "Viewer issue" },
    });
    assert.equal(viewerIssueCreate.statusCode, 403);
    const viewerIssuePatch = await app.inject({ method: "PATCH", url: `/api/issues/${memberIssue.id}`, headers: { cookie: viewerCookie }, payload: { status: "进行中" } });
    assert.equal(viewerIssuePatch.statusCode, 403);
    const viewerIssueDelete = await app.inject({ method: "DELETE", url: `/api/issues/${memberIssue.id}`, headers: { cookie: viewerCookie } });
    assert.equal(viewerIssueDelete.statusCode, 403);
    const viewerMilestone = await app.inject({
      method: "POST",
      url: `/api/projects/${data.project.id}/milestones`,
      headers: { cookie: viewerCookie },
      payload: { name: "Viewer milestone", status: "未开始" },
    });
    assert.equal(viewerMilestone.statusCode, 403);
    const viewerComment = await app.inject({
      method: "POST",
      url: `/api/issues/${memberIssue.id}/comments`,
      headers: { cookie: viewerCookie },
      payload: { text: "viewer cannot write" },
    });
    assert.equal(viewerComment.statusCode, 403);
    const viewerTimeEntry = await app.inject({
      method: "POST",
      url: "/api/time-entries",
      headers: { cookie: viewerCookie },
      payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-07-05", hours: 1 },
    });
    assert.equal(viewerTimeEntry.statusCode, 403);
    const viewerApprove = await app.inject({ method: "POST", url: `/api/time-entries/${otherSubmittedEntry.id}/approve`, headers: { cookie: viewerCookie } });
    assert.equal(viewerApprove.statusCode, 403);

    const managerIssueDelete = await app.inject({ method: "DELETE", url: `/api/issues/${managerIssue.id}`, headers: { cookie: managerCookie } });
    assert.equal(managerIssueDelete.statusCode, 200, managerIssueDelete.body);
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

    const otherMemberProjects = await app.inject({ method: "GET", url: "/api/projects", headers: { cookie: otherMemberCookie } });
    assert.equal(otherMemberProjects.statusCode, 200, otherMemberProjects.body);
    assert.equal(otherMemberProjects.json().rows.some((project: any) => project.id === data.project.id), false);
    assert.equal(otherMemberProjects.json().rows.some((project: any) => project.id === data.otherProject.id), true);

    const otherMemberBoard = await app.inject({ method: "GET", url: `/api/projects/${data.project.id}/board`, headers: { cookie: otherMemberCookie } });
    assert.equal(otherMemberBoard.statusCode, 404);
    const otherMemberIssue = await app.inject({ method: "GET", url: `/api/issues/${data.issue.id}`, headers: { cookie: otherMemberCookie } });
    assert.equal(otherMemberIssue.statusCode, 404);
    const otherMemberTimeEntry = await app.inject({
      method: "POST",
      url: "/api/time-entries",
      headers: { cookie: otherMemberCookie },
      payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-07-02", hours: 1 },
    });
    assert.equal(otherMemberTimeEntry.statusCode, 404);

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

    const projectStatus = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}`,
      headers: { cookie: ownerCookie },
      payload: { status: "验收阶段" },
    });
    assert.equal(projectStatus.statusCode, 200, projectStatus.body);
    assert.equal(projectStatus.json().project.status, "验收阶段");
    const invalidProjectStatus = await app.inject({
      method: "PATCH",
      url: `/api/projects/${data.project.id}`,
      headers: { cookie: ownerCookie },
      payload: { status: "没有这个状态" },
    });
    assert.equal(invalidProjectStatus.statusCode, 400);

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
