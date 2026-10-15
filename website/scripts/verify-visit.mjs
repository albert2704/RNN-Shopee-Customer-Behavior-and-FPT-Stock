import test from 'node:test';
import assert from 'node:assert/strict';

test('one document shares its visit request and only polls an active refresh', async (t) => {
  const visit = await import('../src/domain/chat/visit.ts?success');
  const calls = [];
  const updates = [];
  const stop = visit.subscribeVisit(() => updates.push(visit.visitSnapshot().state));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method]);
    return new Response(
      JSON.stringify({
        state: options.method === 'POST' ? 'refreshing' : 'ready',
        checked_at: options.method === 'POST' ? null : '2026-10-15T17:00:00+07:00',
      }),
    );
  });
  const timer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => timer(fn, delay === 2000 ? 0 : delay));
  const first = visit.refreshOnVisit();
  assert.equal(visit.visitSnapshot().state, 'refreshing');
  assert.equal(visit.refreshOnVisit(), first);
  await first;
  await visit.refreshOnVisit();
  assert.deepEqual(calls, [
    ['/api/fpt/visit', 'POST'],
    ['/api/fpt/visit', 'GET'],
  ]);
  assert.deepEqual(updates, ['refreshing', 'ready']);
  stop();
});

test('cached completion needs no polling and errors do not retry during navigation', async (t) => {
  for (const [name, reply, expected] of [
    ['cached', { state: 'ready', checked_at: '2026-10-15T17:00:00+07:00' }, 'ready'],
    ['malformed', {}, 'failed'],
    ['unavailable', null, 'failed'],
  ]) {
    const visit = await import(`../src/domain/chat/visit.ts?${name}`);
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      if (!reply) throw new TypeError('offline');
      return new Response(JSON.stringify(reply));
    });
    await visit.refreshOnVisit();
    await visit.refreshOnVisit();
    assert.equal(visit.visitSnapshot().state, expected);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});
