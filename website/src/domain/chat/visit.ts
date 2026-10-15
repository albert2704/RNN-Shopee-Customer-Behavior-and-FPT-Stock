import { apiUrl } from './api.ts';

export type VisitRefresh = {
  state: 'idle' | 'refreshing' | 'ready' | 'failed';
  checked_at: string | null;
};

let snapshot: VisitRefresh = { state: 'idle', checked_at: null };
let task: Promise<void> | undefined;
const listeners = new Set<() => void>();

function publish(value: VisitRefresh) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}

export const visitSnapshot = () => snapshot;
export function subscribeVisit(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function request(method: 'GET' | 'POST'): Promise<VisitRefresh> {
  const response = await fetch(apiUrl('/api/fpt/visit'), {
    method,
    ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
    signal: AbortSignal.timeout(method === 'POST' ? 90000 : 10000),
  });
  if (!response.ok) throw new Error('refresh_unavailable');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('state' in value) ||
    !['refreshing', 'ready', 'failed'].includes(String(value.state)) ||
    !('checked_at' in value) ||
    (value.checked_at !== null && typeof value.checked_at !== 'string')
  )
    throw new Error('invalid_refresh');
  return value as VisitRefresh;
}

export function refreshOnVisit() {
  // One POST per document, including React StrictMode and chapter navigation.
  if (!task) {
    publish({ state: 'refreshing', checked_at: null });
    task = (async () => {
      try {
        let result = await request('POST');
        const deadline = Date.now() + 110000;
        while (result.state === 'refreshing') {
          if (Date.now() >= deadline) throw new Error('refresh_timeout');
          await new Promise((resolve) => setTimeout(resolve, 2000));
          result = await request('GET');
        }
        publish(result);
      } catch {
        publish({ state: 'failed', checked_at: null });
      }
    })();
  }
  return task;
}
