import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideLayout, parseDiaryEntry } from './engine';

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

test('parseDiaryEntry — 다양한 필드명 지원', () => {
  const entry = parseDiaryEntry({
    date: '2026-03-01',
    text: '본문',
    photoUrls: ['x'],
  });

  assert.equal(entry.body, '본문');
  assert.deepEqual(entry.photoUrls, ['x']);
});
