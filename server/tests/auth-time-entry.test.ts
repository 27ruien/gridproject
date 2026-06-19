import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "../generated/prisma/client.js";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/utils/password.js";

const databaseUrl = process.env.DATABASE_URL || "";
const canRun = Boolean(databaseUrl) && !databaseUrl.includes("127.0.0.1:5433") && !databaseUrl.includes("gridproject_prod");

function config() {
  return {
    databaseUrl,
    host: "127.0.0.1",
    port: 0,
    nodeEnv: "test",
    sessionSecret: process.env.SESSION_SECRET || "test-session-secret",
    sessionTtlHours: 8,
    cookieSecure: false,
    frontendOrigins: ["http://127.0.0.1:5173"],
  };
}

async function fixture() {
  const prisma = new PrismaClient();
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

test("auth session, bootstrap safety, logout, reset, disabled login and rate limit", { skip: !canRun }, async () => {
  const data = await fixture();
  const app = await buildApp(config());
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

test("time entry permissions, status transitions and validation", { skip: !canRun }, async () => {
  const data = await fixture();
  const app = await buildApp(config());
  try {
    const memberCookie = await login(app, data.member.email, data.password);
    const ownerCookie = await login(app, data.owner.email, data.password);
    const adminCookie = await login(app, data.admin.email, data.password);
    const workDate = "2026-06-19";

    const approvedCreate = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 2, status: "APPROVED" } });
    assert.equal(approvedCreate.statusCode, 400);

    const create = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 2, description: "draft" } });
    assert.equal(create.statusCode, 201, create.body);
    const entry = create.json().entry;
    assert.equal(entry.status, "DRAFT");

    const patchStatus = await app.inject({ method: "PATCH", url: `/api/time-entries/${entry.id}`, headers: { cookie: memberCookie }, payload: { status: "APPROVED" } });
    assert.equal(patchStatus.statusCode, 400);

    const tooManyHours = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate: "2026-06-20", hours: 25 } });
    assert.equal(tooManyHours.statusCode, 400);

    const dailyLimit = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.project.id, issueId: data.issue.id, workDate, hours: 23 } });
    assert.equal(dailyLimit.statusCode, 400);

    const otherEntry = await data.prisma.timeEntry.create({ data: { organizationId: data.organization.id, projectId: data.project.id, issueId: data.issue.id, userId: data.otherMember.id, reporterId: data.otherMember.id, workDate: new Date(`${workDate}T00:00:00.000Z`), hours: 1, status: "SUBMITTED" } });
    const memberList = await app.inject({ method: "GET", url: "/api/time-entries", headers: { cookie: memberCookie } });
    assert.equal(memberList.statusCode, 200);
    assert.deepEqual(memberList.json().rows.map((row: any) => row.userId), [data.member.id]);

    const ownerList = await app.inject({ method: "GET", url: "/api/time-entries", headers: { cookie: ownerCookie } });
    assert.equal(ownerList.statusCode, 200);
    assert(ownerList.json().rows.some((row: any) => row.id === otherEntry.id));

    const ownerEditOther = await app.inject({ method: "PATCH", url: `/api/time-entries/${otherEntry.id}`, headers: { cookie: ownerCookie }, payload: { hours: 2 } });
    assert.equal(ownerEditOther.statusCode, 403);
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

    const crossOrg = await app.inject({ method: "POST", url: "/api/time-entries", headers: { cookie: memberCookie }, payload: { projectId: data.outsideProject.id, workDate: "2026-06-22", hours: 1 } });
    assert.equal(crossOrg.statusCode, 404);
  } finally {
    await app.close();
    await data.prisma.$disconnect();
  }
});
