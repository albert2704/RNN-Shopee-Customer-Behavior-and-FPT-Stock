// Public backend address only. API keys and the demo code never belong in VITE_*.
const configuredBase = import.meta.env?.VITE_API_BASE_URL?.trim() || '';

export function apiUrl(path: string, base = configuredBase): string {
  if (!path.startsWith('/api/')) throw new Error('Expected an API path');
  if (!base) return path;
  const url = new URL(base);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('VITE_API_BASE_URL must be an HTTPS origin');
  }
  return `${url.origin}${path}`;
}

export function accessHeaders(code: string): Record<string, string> {
  return code ? { 'X-Demo-Access-Code': code } : {};
}
