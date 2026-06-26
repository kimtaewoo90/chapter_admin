import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideLayout, parseDiaryEntry, planBookPages } from './engine';

test('사진 1장 + 긴 글 → single-photo-vertical', () => {
  const plan = decideLayout({
    date: '2026-03-01',
    title: '3월 1일',
    body: '가'.repeat(500),
    photoUrls: ['https://example.com/1.jpg'],
  });

  assert.equal(plan.type, 'single-photo-vertical');
  assert.equal(plan.textStyle, 'full');
  assert.equal(plan.photoSlots.length, 1);
});

test('사진 4장 + 짧은 글 → photo-grid 2x2', () => {
  const plan = decideLayout({
    date: '2026-03-02',
    title: '3월 2일',
    body: '짧은 코멘트',
    photoUrls: ['a', 'b', 'c', 'd'],
  });

  assert.equal(plan.type, 'photo-grid');
  assert.equal(plan.textStyle, 'caption');
  assert.equal(plan.gridColumns, 2);
  assert.equal(plan.gridRows, 2);
  assert.equal(plan.photoSlots.length, 4);
});

test('사진 3장 + 짧은 글 → photo-grid (마지막 1장은 가로 전체)', () => {
  const plan = decideLayout({
    date: '2026-03-03',
    title: '3월 3일',
    body: '100자 미만',
    photoUrls: ['a', 'b', 'c'],
  });

  assert.equal(plan.type, 'photo-grid');
  assert.equal(plan.photoSlots[2].colSpan, 2);
});

test('사진 없음 → text-only', () => {
  const plan = decideLayout({
    date: '2026-03-04',
    title: '글만',
    body: '본문만 있는 날',
    photoUrls: [],
  });

  assert.equal(plan.type, 'text-only');
  assert.equal(plan.photoSlots.length, 0);
});

test('사진 없음 + 짧은 글 → compact', () => {
  const plan = decideLayout({
    date: '2026-03-05',
    title: '짧은 일기',
    body: '오늘은 날씨가 좋았다.',
    photoUrls: [],
  });

  assert.equal(plan.type, 'text-only');
  assert.equal(plan.pageMode, 'compact');
});

test('사진 없음 + 긴 글 → full 단독 페이지', () => {
  const plan = decideLayout({
    date: '2026-03-06',
    title: '긴 일기',
    body: '가'.repeat(250),
    photoUrls: [],
  });

  assert.equal(plan.pageMode, 'full');
});

test('planBookPages — 짧은 글끼리 한 페이지에 묶음', () => {
  const short = (n: number) => ({
    date: `2026-03-0${n}`,
    title: `일기 ${n}`,
    body: `짧은 본문 ${n}`,
    photoUrls: [] as string[],
  });

  const pages = planBookPages([short(1), short(2), short(3), short(4)]);

  assert.equal(pages.length, 1);
  assert.equal(pages[0].items.length, 4);
  assert.ok(pages[0].items.every((item) => item.kind === 'compact'));
});

test('planBookPages — compact는 full 페이지 빈 공간에 이어 붙임', () => {
  const pages = planBookPages([
    { date: '1', title: 'A', body: '짧음', photoUrls: [] },
    { date: '2', title: 'B', body: '짧음', photoUrls: ['x.jpg'] },
    { date: '3', title: 'C', body: '짧음', photoUrls: [] },
  ]);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].items.length, 2);
  assert.equal(pages[0].items[0].kind, 'compact');
  assert.equal(pages[0].items[1].kind, 'full');
});

test('planBookPages — 실제 주문 패턴 (사진+짧은글 사이 compact)', () => {
  const pages = planBookPages([
    {
      date: '2026-06-17',
      title: '6월 17일 - 벅참',
      body: '이준이가 요새 좀 귀엽네 ㅎㅎㅎ',
      photoUrls: ['a', 'b'],
    },
    {
      date: '2026-06-18',
      title: '6월 18일 - 피곤',
      body: '오늘은 진짜피곤한날이네',
      photoUrls: [],
    },
    {
      date: '2026-06-19',
      title: '6월 19일 - 드디어!',
      body: '드디어 금요일이다!!',
      photoUrls: ['c'],
    },
    {
      date: '2026-06-21',
      title: '6월 21일',
      body: 'ㅇㅇㅇ',
      photoUrls: [],
    },
  ]);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].items.length, 2);
  assert.equal(pages[0].items[0].kind, 'full');
  assert.equal(pages[0].items[1].kind, 'compact');
  assert.equal(pages[1].items.length, 2);
  assert.equal(pages[1].items[1].kind, 'compact');
});

test('parseDiaryEntry — 다양한 필드명 지원', () => {
  const entry = parseDiaryEntry({
    date: '2026-03-01',
    text: '본문',
    photoUrls: ['x'],
  });

  assert.equal(entry.body, '본문');
  assert.deepEqual(entry.photoUrls, ['x']);
});
