const UPSTREAM_URL = "https://api.hcnsec.cn/v1/chat/completions";
const MAX_BODY_BYTES = 25 * 1024 * 1024;

const PASS_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "retry-after",
  "x-request-id",
  "openai-organization",
  "openai-processing-ms",
  "openai-version",
] as const;

export interface Env {
  HCNSEC_API_KEY?: string;
  PROXY_API_KEY?: string;
  CORS_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch {
      return errorResponse(env, 500, "Internal proxy error", "proxy_error");
    }
  },
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  const path = normalizePath(new URL(request.url).pathname);

  if (path === "/" && request.method === "GET") {
    return jsonResponse(env, 200, {
      name: "HCNSEC AI Proxy",
      status: "running",
      endpoint: "/v1/chat/completions",
    });
  }

  if (path === "/health" && request.method === "GET") {
    return jsonResponse(env, 200, { status: "ok" });
  }

  if (path === "/v1/chat/completions") {
    if (request.method !== "POST") {
      return methodNotAllowed(env, "POST, OPTIONS");
    }
    return proxyChatCompletions(request, env);
  }

  if (path === "/" || path === "/health") {
    return methodNotAllowed(env, "GET, OPTIONS");
  }

  return errorResponse(env, 404, "Not found", "invalid_request_error");
}

async function proxyChatCompletions(request: Request, env: Env): Promise<Response> {
  const authError = authorizeClient(request, env);
  if (authError) {
    return authError;
  }

  const upstreamKey = env.HCNSEC_API_KEY;
  if (!upstreamKey) {
    return errorResponse(
      env,
      500,
      "Server API key is not configured",
      "configuration_error",
    );
  }

  const rawBody = await request.arrayBuffer();
  if (rawBody.byteLength === 0) {
    return errorResponse(env, 400, "Request body is required", "invalid_request_error");
  }
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return errorResponse(env, 413, "Request body too large", "invalid_request_error");
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(rawBody));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return errorResponse(
        env,
        400,
        "Request body must be a JSON object",
        "invalid_request_error",
      );
    }
  } catch {
    return errorResponse(env, 400, "Malformed JSON in request body", "invalid_request_error");
  }

  const upstreamHeaders = new Headers();
  upstreamHeaders.set(
    "Content-Type",
    request.headers.get("Content-Type") || "application/json",
  );
  upstreamHeaders.set("Authorization", `Bearer ${upstreamKey}`);
  const accept = request.headers.get("Accept");
  if (accept) {
    upstreamHeaders.set("Accept", accept);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: upstreamHeaders,
      body: rawBody,
    });
  } catch {
    return errorResponse(env, 502, "Upstream request failed", "upstream_error");
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: passThroughHeaders(upstreamResponse, env),
  });
}

function authorizeClient(request: Request, env: Env): Response | null {
  const expected = env.PROXY_API_KEY;
  if (!expected) {
    return null;
  }

  const token = bearerToken(request);
  if (!token) {
    return errorResponse(
      env,
      401,
      "Missing API key",
      "invalid_request_error",
      "missing_api_key",
    );
  }
  if (!safeEqual(token, expected)) {
    return errorResponse(
      env,
      401,
      "Invalid API key",
      "invalid_request_error",
      "invalid_api_key",
    );
  }
  return null;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.byteLength, bBytes.byteLength);
  let diff = aBytes.byteLength === bBytes.byteLength ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length === 0 ? "/" : trimmed;
}

function corsHeaders(env: Env): Headers {
  const origin = env.CORS_ORIGIN || "*";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  if (origin !== "*") {
    headers.set("Vary", "Origin");
  }
  return headers;
}

function passThroughHeaders(upstream: Response, env: Env): Headers {
  const headers = corsHeaders(env);
  for (const name of PASS_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const contentType = headers.get("Content-Type") || "";
  if (contentType.includes("text/event-stream")) {
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-cache");
    }
    headers.set("Connection", "keep-alive");
    headers.set("X-Accel-Buffering", "no");
  }

  return headers;
}

function jsonResponse(env: Env, status: number, body: unknown): Response {
  const headers = corsHeaders(env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  env: Env,
  status: number,
  message: string,
  type: string,
  code?: string,
): Response {
  const error: { message: string; type: string; code?: string } = { message, type };
  if (code) {
    error.code = code;
  }
  return jsonResponse(env, status, { error });
}

function methodNotAllowed(env: Env, allow: string): Response {
  const response = errorResponse(env, 405, "Method not allowed", "invalid_request_error");
  response.headers.set("Allow", allow);
  return response;
}
