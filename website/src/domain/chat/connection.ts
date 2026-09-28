export type ChatStatus = {
  ready: boolean;
  api_key_configured: boolean;
  graph_connected: boolean;
  data_available: boolean;
  model: string;
  observed_through: string | null;
  reference_close: number | null;
};

export function connectionLabels(status: ChatStatus | null, checking: boolean) {
  if (status === null) {
    const unknown = checking ? 'đang kiểm tra' : 'chưa xác nhận';
    return { key: unknown, graph: unknown };
  }
  return {
    key: status?.api_key_configured ? 'đã cấu hình' : 'chưa cấu hình',
    graph: status?.graph_connected ? 'đã kết nối' : 'chưa kết nối',
  };
}

export function isChatStatus(value: unknown): value is ChatStatus {
  if (!value || typeof value !== 'object') return false;
  const status = value as Record<string, unknown>;
  return (
    ['ready', 'api_key_configured', 'graph_connected', 'data_available'].every(
      (key) => typeof status[key] === 'boolean',
    ) &&
    typeof status.model === 'string' &&
    (status.observed_through === null || typeof status.observed_through === 'string') &&
    (status.reference_close === null ||
      (typeof status.reference_close === 'number' && Number.isFinite(status.reference_close)))
  );
}
