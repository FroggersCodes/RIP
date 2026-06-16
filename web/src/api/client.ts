const TOKEN_KEY = 'rip_token';
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

// Default: same-origin (single-port server). Set VITE_API_URL at build time to
// point a separately-hosted frontend (e.g. Cloudflare Pages) at the API origin.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return authToken;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface Options {
  method?: string;
  body?: unknown;
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string })?.error || res.statusText;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}
