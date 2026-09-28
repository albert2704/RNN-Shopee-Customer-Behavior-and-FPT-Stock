import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTERS,
  chapterFromHash,
  chapterHash,
  adjacentChapter,
} from '../src/domain/demo/chapters.ts';
test('all chapters and appendix can be opened directly and serialize to canonical links', () => {
  assert.deepEqual(
    CHAPTERS.map((item) => item.id),
    ['shopee', 'fpt', 'summary', 'chat'],
  );
  for (const chapter of [...CHAPTERS.map((item) => item.id), 'appendix'])
    assert.equal(chapterFromHash(chapterHash(chapter)), chapter);
});
test('old daily, chat, and deep explorer links resolve to their new chapters', () => {
  assert.equal(chapterFromHash('#fpt-daily'), 'chat');
  assert.equal(chapterFromHash('#du-bao'), 'chat');
  assert.equal(chapterFromHash('#chat'), 'chat');
  for (const hash of ['#explore', '#explore-datasets', '#explore-results', '#phu-luc'])
    assert.equal(chapterFromHash(hash), 'appendix');
  for (const hash of ['', '#demo', '#talk/1', '#intro', '#reference', '#learning'])
    assert.equal(chapterFromHash(hash), 'shopee');
});
test('keyboard chapter navigation follows the talk and stays inside its endpoints', () => {
  assert.equal(adjacentChapter('summary', -1), 'fpt');
  assert.equal(adjacentChapter('summary', 1), 'chat');
  assert.equal(adjacentChapter('chat', -1), 'summary');
  assert.equal(adjacentChapter('chat', 1), 'chat');
  assert.equal(adjacentChapter('shopee', -1), 'shopee');
  assert.equal(adjacentChapter('appendix', 1), 'shopee');
});
