function getApiUrlRaw(): string {
  return (
    (typeof window !== "undefined" && (window as { ENV?: { API_URL?: string } }).ENV?.API_URL) ||
    import.meta.env?.VITE_API_URL ||
    ""
  );
}

/** Returns base API URL without trailing /api (code appends /api/...). */
export function getApiUrl(): string {
  const url = getApiUrlRaw();
  if (url.endsWith("/api")) return url.slice(0, -4);
  return url;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

/** Decode JWT payload (no verify) to get email for display. Returns null if invalid. */
export function getStoredUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch with Authorization: Bearer <token> for protected course APIs (my-courses, enrollments, progress).
 */
export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const url = path.startsWith('http') ? path : `${getApiUrl()}${path}`;
  const headers: HeadersInit = {
    ...(typeof options.headers === 'object' && !(options.headers instanceof Headers)
      ? options.headers
      : {}),
    ...(options.headers instanceof Headers ? Object.fromEntries(options.headers) : {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string' && !(headers as Record<string, string>)['Content-Type']) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}
