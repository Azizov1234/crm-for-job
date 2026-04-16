import { ApiErrorShape } from "../types";
import {
  getActiveBranchId,
  clearAccessToken,
  getAccessToken,
} from "./auth-storage";

const DEFAULT_API_ORIGIN = "http://localhost:9090";
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/+$/, "");

    // Keep explicit API paths as-is, otherwise default to /api/v1.
    if (!normalizedPath || normalizedPath === "/") {
      url.pathname = "/api/v1";
      return url.toString().replace(/\/+$/, "");
    }

    return `${url.origin}${normalizedPath}`;
  } catch {
    return trimmed;
  }
};

const API_BASE_URL = normalizeBaseUrl(CONFIGURED_API_URL || DEFAULT_API_ORIGIN);
let resolvedApiBaseUrl: string | null = API_BASE_URL;

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export class ApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiErrorShape;
    const message =
      typeof errorPayload.message === "string"
        ? errorPayload.message
        : Array.isArray(errorPayload.message)
          ? errorPayload.message[0]
          : `Request failed (${response.status})`;

    throw new ApiError(message, response.status, errorPayload.details);
  }

  return payload as T;
}

async function probeApiBaseUrl(baseUrl: string, timeoutMs = 900): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok || response.status === 401;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveApiBaseUrl(): Promise<string> {
  return resolvedApiBaseUrl ?? API_BASE_URL;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = await resolveApiBaseUrl();
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth) {
    const token = getAccessToken();
    const branchId = getActiveBranchId();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (branchId && !headers.has("x-branch-id")) {
      headers.set("x-branch-id", branchId);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !options.skipAuth) {
    clearAccessToken();
  }

  return parseResponse<T>(response);
}

export async function checkBackendConnection(timeoutMs = 5000): Promise<boolean> {
  const baseUrl = await resolveApiBaseUrl();
  const connected = await probeApiBaseUrl(baseUrl, timeoutMs);
  if (connected) {
    resolvedApiBaseUrl = baseUrl;
  }
  return connected;
}

export function getResolvedApiBaseUrl() {
  return resolvedApiBaseUrl ?? API_BASE_URL;
}

export { API_BASE_URL };
