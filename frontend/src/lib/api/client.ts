import { ApiErrorShape } from "../types";
import {
  getActiveBranchId,
  clearAccessToken,
  getAccessToken,
} from "./auth-storage";

const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const DEPLOY_BACKEND_PORT =
  process.env.NEXT_PUBLIC_BACKEND_PORT?.trim() || "4646";
const LOCAL_API_BASE_URLS = [
  "http://localhost:9090/api/v1",
  "http://localhost:4545/api/v1",
  "http://localhost:3000/api/v1",
];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const getApiCandidates = () => {
  const candidates: string[] = [];
  const push = (candidate: string | undefined | null) => {
    if (!candidate) return;
    const normalized = normalizeBaseUrl(candidate);
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  push(CONFIGURED_API_BASE_URL);

  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;
    const isLocal = LOCAL_HOSTS.has(hostname);

    // Primary production-safe candidates (no localhost fallback on remote host).
    push(`${origin}/api/v1`);
    push(`${protocol}//${hostname}:${DEPLOY_BACKEND_PORT}/api/v1`);

    if (isLocal) {
      LOCAL_API_BASE_URLS.forEach(push);
    }
  } else {
    LOCAL_API_BASE_URLS.forEach(push);
  }

  if (!candidates.length) {
    LOCAL_API_BASE_URLS.forEach(push);
  }

  return candidates;
};

const API_BASE_URL = getApiCandidates()[0];
let resolvedApiBaseUrl: string | null = CONFIGURED_API_BASE_URL
  ? normalizeBaseUrl(CONFIGURED_API_BASE_URL)
  : null;

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
  const candidates = getApiCandidates();
  if (resolvedApiBaseUrl && candidates.includes(resolvedApiBaseUrl)) {
    return resolvedApiBaseUrl;
  }

  try {
    const candidate = await Promise.any(
      candidates.map(async (baseUrl) => {
        const ok = await probeApiBaseUrl(baseUrl);
        if (!ok) {
          throw new Error(`Unavailable: ${baseUrl}`);
        }
        return baseUrl;
      }),
    );

    resolvedApiBaseUrl = candidate;
    return candidate;
  } catch {
    resolvedApiBaseUrl = candidates[0];
    return resolvedApiBaseUrl;
  }
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
  const candidates = getApiCandidates();

  if (resolvedApiBaseUrl) {
    const ok = await probeApiBaseUrl(resolvedApiBaseUrl, timeoutMs);
    if (ok) return true;
    resolvedApiBaseUrl = null;
  }

  const probes = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      ok: await probeApiBaseUrl(candidate, timeoutMs),
    })),
  );
  const connected = probes.find((probe) => probe.ok);
  if (connected) {
    resolvedApiBaseUrl = connected.candidate;
    return true;
  }

  return false;
}

export function getResolvedApiBaseUrl() {
  return resolvedApiBaseUrl ?? API_BASE_URL;
}

export { API_BASE_URL };
