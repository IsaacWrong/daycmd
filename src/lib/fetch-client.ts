// Thin wrapper around fetch that injects the `x-daycmd: 1` header required
// by src/proxy.ts on mutating requests. The header forces a CORS preflight
// on cross-origin requests, which the proxy will refuse.
//
// Use this for any client-side call to /api/... that isn't a plain GET.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return fetch(input, init);
  }
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("x-daycmd")) headers.set("x-daycmd", "1");
  return fetch(input, { ...init, headers });
}
