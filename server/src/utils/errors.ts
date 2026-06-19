import type { FastifyReply } from "fastify";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "请先登录。") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "没有权限访问该资源。") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "资源不存在。") {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown) {
  return new ApiError(409, "CONFLICT", message, details);
}

export function tooManyRequests(message: string, details?: unknown) {
  return new ApiError(429, "TOO_MANY_REQUESTS", message, details);
}

export function validationError(message: string, details?: unknown) {
  return new ApiError(422, "VALIDATION_ERROR", message, details);
}

export function sendError(reply: FastifyReply, error: unknown, requestId?: string) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      requestId,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }
  return reply.status(500).send({
    requestId,
    error: {
      code: "INTERNAL_ERROR",
      message: "服务器内部错误。",
    },
  });
}
