import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { canViewProject, isProjectOwner } from "../../policies/access.js";
import { appendIssueActivity, audit } from "../shared.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { issueCommentDto } from "../../utils/dto.js";

const commentSchema = z.object({
  text: z.string().min(1),
}).strict();

export async function issueCommentRoutes(app: FastifyInstance) {
  app.get("/issues/:issueId/comments", async (request) => {
    const context = requireAuth(request);
    const issue = await requireVisibleIssue(app, context, (request.params as { issueId: string }).issueId);
    const comments = await app.prisma.issueComment.findMany({
      where: { organizationId: context.organizationId, issueId: issue.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    const rows = await attachAuthors(app, context.organizationId, comments);
    return { requestId: request.id, rows: rows.map(issueCommentDto) };
  });

  app.post("/issues/:issueId/comments", async (request, reply) => {
    const context = requireAuth(request);
    const issue = await requireVisibleIssue(app, context, (request.params as { issueId: string }).issueId);
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("评论参数不正确。", parsed.error.flatten());
    const comment = await app.prisma.issueComment.create({
      data: { organizationId: context.organizationId, issueId: issue.id, authorId: context.userId, text: parsed.data.text.trim() },
    });
    await appendIssueActivity(app, context, issue.id, "comment", "添加评论", { commentId: comment.id });
    await audit(app, context, "issue_comment.create", "IssueComment", comment.id, { issueId: issue.id }, request.id);
    reply.status(201);
    return { requestId: request.id, comment: issueCommentDto((await attachAuthors(app, context.organizationId, [comment]))[0]) };
  });

  app.patch("/comments/:commentId", async (request) => {
    const context = requireAuth(request);
    const comment = await requireComment(app, context, (request.params as { commentId: string }).commentId);
    if (comment.authorId !== context.userId && !context.isAdmin) throw forbidden("只能编辑自己的评论。");
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("评论参数不正确。", parsed.error.flatten());
    const updated = await app.prisma.issueComment.update({ where: { id: comment.id }, data: { text: parsed.data.text.trim() } });
    await audit(app, context, "issue_comment.update", "IssueComment", comment.id, {}, request.id);
    return { requestId: request.id, comment: issueCommentDto((await attachAuthors(app, context.organizationId, [updated]))[0]) };
  });

  app.delete("/comments/:commentId", async (request) => {
    const context = requireAuth(request);
    const comment = await requireComment(app, context, (request.params as { commentId: string }).commentId);
    if (comment.authorId !== context.userId && !context.isAdmin && !isProjectOwner(context, comment.issue.project)) {
      throw forbidden("没有权限删除该评论。");
    }
    const updated = await app.prisma.issueComment.update({ where: { id: comment.id }, data: { deletedAt: new Date(), deletedById: context.userId } });
    await appendIssueActivity(app, context, comment.issueId, "comment_deleted", "删除评论", { commentId: comment.id });
    await audit(app, context, "issue_comment.delete", "IssueComment", comment.id, {}, request.id);
    return { requestId: request.id, comment: issueCommentDto((await attachAuthors(app, context.organizationId, [updated]))[0]) };
  });
}

async function requireVisibleIssue(app: FastifyInstance, context: any, issueId: string) {
  const issue = await app.prisma.issue.findFirst({
    where: { id: issueId, organizationId: context.organizationId, deletedAt: null },
    include: { project: true },
  });
  if (!issue || !canViewProject(context, issue.project)) throw notFound("事项不存在。");
  return issue;
}

async function requireComment(app: FastifyInstance, context: any, commentId: string) {
  const comment = await app.prisma.issueComment.findFirst({
    where: { id: commentId, organizationId: context.organizationId, deletedAt: null },
    include: { issue: { include: { project: true } } },
  });
  if (!comment || comment.issue.deletedAt || !canViewProject(context, comment.issue.project)) throw notFound("评论不存在。");
  return comment;
}

async function attachAuthors(app: FastifyInstance, organizationId: string, comments: any[]) {
  const userIds = [...new Set(comments.map((comment) => comment.authorId).filter(Boolean))];
  const users = await app.prisma.user.findMany({ where: { organizationId, id: { in: userIds } } });
  const byId = new Map(users.map((user) => [user.id, user]));
  return comments.map((comment) => ({ ...comment, authorName: byId.get(comment.authorId)?.name || "" }));
}
