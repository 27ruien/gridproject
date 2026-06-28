import { apiBasePath } from "@/lib/env";
import { ApiError } from "./errors";

const unauthorizedHandlers = new Set<(error: ApiError) => void>();

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export function onUnauthorized(handler: (error: ApiError) => void) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

export function buildQuery(query?: RequestOptions["query"]) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...init } = options;
  const response = await fetch(`${apiBasePath()}${path}${buildQuery(query)}`, {
    credentials: "include",
    headers: {
      ...(body instanceof FormData ? {} : body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...init,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const apiPayload = payload as { error?: { message?: string; code?: string } };
    const error = new ApiError(
      apiPayload.error?.message || "API 请求失败。",
      response.status,
      apiPayload.error?.code || "API_ERROR",
      payload,
    );
    if (response.status === 401) unauthorizedHandlers.forEach((handler) => handler(error));
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json() as Promise<T>;
  return response as T;
}

export async function downloadResponse(response: Response, fileName = "gridproject-export.xlsx") {
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : fileName;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
