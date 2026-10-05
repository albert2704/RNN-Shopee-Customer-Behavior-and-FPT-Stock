import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOutlook, matchesDaily } from '../src/domain/finance/outlookContract.ts';

const fixture = JSON.parse(
  readFileSync(new URL('../public/data/fpt-outlook.json', import.meta.url), 'utf8'),
);
const daily = JSON.parse(
  readFileSync(new URL('../public/data/fpt-daily.json', import.meta.url), 'utf8'),
);

test('public FPT outlook follows the validated contract and matches daily source', () => {
  assert.equal(isOutlook(fixture), true);
  assert.equal(
    matchesDaily(
      fixture,
      daily.forecast.observed_through,
      daily.forecast.last_close,
      daily.source.closes_sha256,
    ),
    true,
  );
});

test('outlook is rejected when date, close, or historical close hash differs', () => {
  assert.equal(
    matchesDaily(fixture, '2026-10-06', fixture.last_close, fixture.source.closes_sha256),
    false,
  );
  assert.equal(
    matchesDaily(
      fixture,
      fixture.observed_through,
      fixture.last_close + 1,
      fixture.source.closes_sha256,
    ),
    false,
  );
  assert.equal(
    matchesDaily(fixture, fixture.observed_through, fixture.last_close, '0'.repeat(64)),
    false,
  );
});

test('malformed horizon test period is rejected instead of silently hiding the forecast', () => {
  const malformed = structuredClone(fixture);
  delete malformed.horizons[0].test_period.first_target;
  assert.equal(isOutlook(malformed), false);
});
