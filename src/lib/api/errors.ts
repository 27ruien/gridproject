export class ApiError extends Error {
  status: number;
  code: string;
  payload: unknown;

  constructor(message: string, status: number, code = "API_ERROR", payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "请求失败，请稍后重试。";
}
