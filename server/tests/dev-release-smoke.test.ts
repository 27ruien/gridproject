import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { createTestPrisma, integrationTestSkipReason, testServerConfig } from "./testDatabase.js";

const adminEmail = process.env.ADMIN_EMAIL || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const skipReason = integrationTestSkipReason() || (!adminEmail || !adminPassword ? "Set ADMIN_EMAIL and ADMIN_PASSWORD for Dev release smoke tests." : false);

test("Dev release smoke flow", { skip: skipReason }, async () => {
  const app = await buildApp(testServerConfig());
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const prefix = `Smoke ${suffix}`;
  const ownerPassword = `SmokeOwner${suffix}9`;
  const memberPassword = `SmokeMember${suffix}9`;
  const cleanup = {
    adminId: "",
    ownerId: "",
    memberId: "",
    projectId: "",
    issueIds: [] as string[],
    timeEntryIds: [] as string[],
    costRecordId: "",
  };

  try {
    const health = await request(baseUrl, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");
    assert.equal(health.body.version, "0.1.0-dev.1");
    assert.equal(health.body.environment, "development");
    assert.equal("databaseUrl" in health.body, false);
    assert.equal("sessionSecret" in health.body, false);

    const adminLogin = await request(baseUrl, "POST", "/api/auth/login", {
      email: adminEmail,
      password: adminPassword,
    });
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
    assert.equal(adminLogin.body.user.passwordHash, undefined);
    cleanup.adminId = adminLogin.body.user.id;
    const adminCookie = cookie(adminLogin);

    const ownerCreate = await request(baseUrl, "POST", "/api/users", {
      name: `${prefix} Owner`,
      email: `smoke-owner-${suffix}@example.test`,
      role: "MEMBER",
      status: "ACTIVE",
      initialPassword: ownerPassword,
      confirmInitialPassword: ownerPassword,
    }, adminCookie);
    assert.equal(ownerCreate.status, 201, JSON.stringify(ownerCreate.body));
    const owner = ownerCreate.body.user;
    cleanup.ownerId = owner.id;
    assert.equal(owner.passwordHash, undefined);

    const memberCreate = await request(baseUrl, "POST", "/api/users", {
      name: `${prefix} Member`,
      email: `smoke-member-${suffix}@example.test`,
      role: "MEMBER",
      status: "ACTIVE",
      initialPassword: memberPassword,
      confirmInitialPassword: memberPassword,
    }, adminCookie);
    assert.equal(memberCreate.status, 201, JSON.stringify(memberCreate.body));
    const member = memberCreate.body.user;
    cleanup.memberId = member.id;

    const ownerLogin = await request(baseUrl, "POST", "/api/auth/login", {
      email: owner.email,
      password: ownerPassword,
    });
    assert.equal(ownerLogin.status, 200, JSON.stringify(ownerLogin.body));
    const ownerCookie = cookie(ownerLogin);

    const memberLogin = await request(baseUrl, "POST", "/api/auth/login", {
      email: member.email,
      password: memberPassword,
    });
    assert.equal(memberLogin.status, 200, JSON.stringify(memberLogin.body));
    const memberCookie = cookie(memberLogin);

    const projectCreate = await request(baseUrl, "POST", "/api/projects", {
      name: `${prefix} Project`,
      code: `SMK${suffix.slice(-6)}`,
      status: "进行中",
    }, ownerCookie);
    assert.equal(projectCreate.status, 201, JSON.stringify(projectCreate.body));
    const project = projectCreate.body.project;
    cleanup.projectId = project.id;
    assert.equal(project.ownerId, owner.id);

    let board = await request(baseUrl, "GET", `/api/projects/${project.id}/board`, undefined, ownerCookie);
    assert.equal(board.status, 200, JSON.stringify(board.body));
    assert(board.body.members.some((item: any) => item.userId === owner.id && item.status === "ACTIVE"));

    const addMember = await request(baseUrl, "POST", `/api/projects/${project.id}/members`, {
      userId: member.id,
    }, ownerCookie);
    assert.equal(addMember.status, 201, JSON.stringify(addMember.body));
    assert.equal(addMember.body.member.userId, member.id);

    const issueCreate = await request(baseUrl, "POST", `/api/projects/${project.id}/issues`, {
      code: `ISS${suffix.slice(-6)}`,
      title: `${prefix} Issue`,
      type: "任务",
      status: "进行中",
      ownerId: member.id,
    }, ownerCookie);
    assert.equal(issueCreate.status, 201, JSON.stringify(issueCreate.body));
    const issue = issueCreate.body.issue;
    cleanup.issueIds.push(issue.id);
    assert.equal(issue.creatorId, owner.id);

    const timeCreate = await request(baseUrl, "POST", "/api/time-entries", {
      projectId: project.id,
      issueId: issue.id,
      workDate: "2026-06-21",
      hours: 4,
      description: "Smoke test work",
    }, memberCookie);
    assert.equal(timeCreate.status, 201, JSON.stringify(timeCreate.body));
    const entry = timeCreate.body.entry;
    cleanup.timeEntryIds.push(entry.id);
    assert.equal(entry.status, "DRAFT");
    assert.equal(entry.userId, member.id);

    const submit = await request(baseUrl, "POST", `/api/time-entries/${entry.id}/submit`, undefined, memberCookie);
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
    assert.equal(submit.body.entry.status, "SUBMITTED");

    const approve = await request(baseUrl, "POST", `/api/time-entries/${entry.id}/approve`, undefined, ownerCookie);
    assert.equal(approve.status, 200, JSON.stringify(approve.body));
    assert.equal(approve.body.entry.status, "APPROVED");

    const costCreate = await request(baseUrl, "POST", "/api/cost-records", {
      projectId: project.id,
      plannedPersonDays: 5,
      standardHoursPerDay: 8,
      notes: "Smoke test cost record",
    }, ownerCookie);
    assert.equal(costCreate.status, 201, JSON.stringify(costCreate.body));
    const costRecord = costCreate.body.record;
    cleanup.costRecordId = costRecord.id;

    const costPatch = await request(baseUrl, "PATCH", `/api/cost-records/${costRecord.id}`, {
      plannedPersonDays: 2,
    }, ownerCookie);
    assert.equal(costPatch.status, 200, JSON.stringify(costPatch.body));
    assert.equal(costPatch.body.record.plannedPersonDays, 2);

    const costSummary = await request(baseUrl, "GET", `/api/cost-records/${costRecord.id}/summary`, undefined, ownerCookie);
    assert.equal(costSummary.status, 200, JSON.stringify(costSummary.body));
    assert.equal(costSummary.body.summary.actualHours, 4);
    assert.equal(costSummary.body.summary.actualPersonDays, 0.5);

    const ownerTime = await request(baseUrl, "POST", "/api/time-entries", {
      projectId: project.id,
      issueId: issue.id,
      workDate: "2026-06-22",
      hours: 1,
      description: "Owner private draft",
    }, ownerCookie);
    assert.equal(ownerTime.status, 201, JSON.stringify(ownerTime.body));
    cleanup.timeEntryIds.push(ownerTime.body.entry.id);

    const memberTimeList = await request(baseUrl, "GET", "/api/time-entries", undefined, memberCookie);
    assert.equal(memberTimeList.status, 200, JSON.stringify(memberTimeList.body));
    assert(memberTimeList.body.rows.some((row: any) => row.id === entry.id));
    assert.equal(memberTimeList.body.rows.some((row: any) => row.id === ownerTime.body.entry.id), false);

    const memberCostDetail = await request(baseUrl, "GET", `/api/cost-records/${costRecord.id}`, undefined, memberCookie);
    assert.equal(memberCostDetail.status, 403, JSON.stringify(memberCostDetail.body));

    board = await request(baseUrl, "GET", `/api/projects/${project.id}/board`, undefined, ownerCookie);
    assert.equal(board.status, 200, JSON.stringify(board.body));
    assert(board.body.issues.some((row: any) => row.id === issue.id));
    assert(board.body.timeEntries.some((row: any) => row.id === entry.id));
    assert.equal(board.body.costRecord.id, costRecord.id);

    const bootstrap = await request(baseUrl, "GET", "/api/bootstrap", undefined, ownerCookie);
    assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.body));
    assert(bootstrap.body.projects.some((row: any) => row.id === project.id));
    assert(bootstrap.body.issues.some((row: any) => row.id === issue.id));
    assert(bootstrap.body.timeEntries.some((row: any) => row.id === entry.id));
    assert(bootstrap.body.costRecords.some((row: any) => row.id === costRecord.id));
    assert.equal(JSON.stringify(bootstrap.body).includes("passwordHash"), false);
    assert.equal(JSON.stringify(bootstrap.body).includes("tokenHash"), false);
  } finally {
    await app.close();
    await cleanupSmokeData(cleanup);
  }
});

async function cleanupSmokeData(cleanup: {
  adminId: string;
  ownerId: string;
  memberId: string;
  projectId: string;
  issueIds: string[];
  timeEntryIds: string[];
  costRecordId: string;
}) {
  const prisma = createTestPrisma();
  try {
    const testUserIds = [cleanup.ownerId, cleanup.memberId].filter(Boolean);
    const sessionUserIds = [cleanup.adminId, ...testUserIds].filter(Boolean);
    if (!cleanup.projectId && !testUserIds.length) return;
    await prisma.auditLog.deleteMany({ where: { actorId: { in: testUserIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: sessionUserIds } } });
    await prisma.timeEntry.deleteMany({
      where: {
        OR: [
          cleanup.projectId ? { projectId: cleanup.projectId } : {},
          testUserIds.length ? { userId: { in: testUserIds } } : {},
          cleanup.timeEntryIds.length ? { id: { in: cleanup.timeEntryIds } } : {},
        ].filter((item) => Object.keys(item).length > 0),
      },
    });
    const costRecordWhere = [
      cleanup.costRecordId ? { id: cleanup.costRecordId } : {},
      cleanup.projectId ? { projectId: cleanup.projectId } : {},
    ].filter((item) => Object.keys(item).length > 0);
    if (costRecordWhere.length) {
      await prisma.projectCostRecord.deleteMany({ where: { OR: costRecordWhere } });
    }
    if (cleanup.issueIds.length) {
      await prisma.issueActivity.deleteMany({ where: { issueId: { in: cleanup.issueIds } } });
      await prisma.issueComment.deleteMany({ where: { issueId: { in: cleanup.issueIds } } });
    }
    if (cleanup.projectId) {
      await prisma.issue.deleteMany({ where: { projectId: cleanup.projectId } });
      await prisma.milestone.deleteMany({ where: { projectId: cleanup.projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId: cleanup.projectId } });
      await prisma.project.deleteMany({ where: { id: cleanup.projectId } });
    }
    if (testUserIds.length) {
      await prisma.projectMember.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function request(baseUrl: string, method: string, path: string, payload?: unknown, sessionCookie?: string) {
  const headers: Record<string, string> = {};
  if (payload !== undefined) headers["content-type"] = "application/json";
  if (sessionCookie) headers.cookie = sessionCookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  let body: any = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { text };
    }
  }
  return { status: response.status, body, headers: response.headers };
}

function cookie(response: Awaited<ReturnType<typeof request>>) {
  return response.headers.get("set-cookie") || "";
}
