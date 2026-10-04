import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionLabels, isChatStatus } from '../src/domain/chat/connection.ts';
import { apiUrl } from '../src/domain/chat/api.ts';

test('cloud API URLs use an HTTPS origin while local calls keep the Vite proxy', () => {
  assert.equal(apiUrl('/api/chat', ''), '/api/chat');
  assert.equal(apiUrl('/api/chat', 'https://api.example/'), 'https://api.example/api/chat');
  for (const value of [
    'http://api.example',
    'https://user:key@api.example',
    'https://api.example/path',
    'https://api.example?secret=1',
  ]) {
    assert.throws(() => apiUrl('/api/chat', value));
  }
});

test('API unreachable does not claim the saved key or Neo4j configuration is missing', () => {
  assert.deepEqual(connectionLabels(null, false), { key: 'chưa xác nhận', graph: 'chưa xác nhận' });
});

test('Malformed API responses remain unknown instead of becoming missing configuration', () => {
  for (const value of [
    null,
    {},
    'offline',
    { api_key_configured: 'true', graph_connected: true },
  ]) {
    assert.equal(isChatStatus(value), false);
  }
  assert.equal(
    isChatStatus({
      ready: true,
      api_key_configured: true,
      graph_connected: true,
      data_available: true,
      model: 'gpt-4.1-mini',
      observed_through: '2026-10-06',
      reference_close: 60400,
    }),
    true,
  );
});

test('Initial status check shows pending rather than missing credentials', () => {
  assert.deepEqual(connectionLabels(null, true), { key: 'đang kiểm tra', graph: 'đang kiểm tra' });
});

test('Only a real status response can confirm a missing key or disconnected graph', () => {
  assert.deepEqual(connectionLabels({ api_key_configured: false, graph_connected: false }, false), {
    key: 'chưa cấu hình',
    graph: 'chưa kết nối',
  });
  assert.deepEqual(connectionLabels({ api_key_configured: true, graph_connected: true }, false), {
    key: 'đã cấu hình',
    graph: 'đã kết nối',
  });
});
