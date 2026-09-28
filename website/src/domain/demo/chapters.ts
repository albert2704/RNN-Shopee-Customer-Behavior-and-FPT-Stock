export type Chapter = 'shopee' | 'fpt' | 'summary' | 'chat' | 'appendix';
export const CHAPTERS = [
  { id: 'shopee', label: 'Shopee Thailand', hash: '#demo' },
  { id: 'fpt', label: 'FPT', hash: '#fpt' },
  { id: 'summary', label: 'Tổng kết', hash: '#tong-ket' },
  { id: 'chat', label: 'Hỏi đáp', hash: '#hoi-dap' },
] as const;
export function chapterFromHash(hash: string): Chapter {
  if (hash === '#phu-luc' || hash.startsWith('#explore')) return 'appendix';
  if (['#chat', '#du-bao', '#fpt-daily'].includes(hash)) return 'chat';
  return CHAPTERS.find((chapter) => chapter.hash === hash)?.id ?? 'shopee';
}
export function chapterHash(chapter: Chapter) {
  return chapter === 'appendix' ? '#phu-luc' : CHAPTERS.find((item) => item.id === chapter)!.hash;
}
export function adjacentChapter(chapter: Chapter, direction: -1 | 1): Chapter {
  const index = CHAPTERS.findIndex((item) => item.id === chapter);
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, index + direction))].id;
}
