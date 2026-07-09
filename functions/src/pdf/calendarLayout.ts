/**
 * Chapter 앱 캘린더 그리드 레이아웃 (PDF·인쇄용)
 *
 * Flutter 원본: chapter/lib/screens/home/calendar_screen.dart
 *   - _CalendarMonthBody, _CalendarDayGrid, _DayCell
 *   - _kCalendarPhotoAspectRatio = 3/4
 */

/** 셀 사진 영역 — 앱과 동일 3:4 세로 (width / height) */
export const CALENDAR_PHOTO_ASPECT = 3 / 4;

export const CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const CALENDAR_PAGE = { width: 420, height: 595, margin: 48 } as const;

/** 캘린더 헤더 — 제목·요일 (calendarPage 와 동기화) */
export const CALENDAR_HEADER = {
  titleSize: 16,
  /** 「yyyy년 M월」 아래 ~ 요일 행 사이 */
  titleBottomGap: 24,
  weekdayRowHeight: 11,
  weekdayBottomGap: 6,
} as const;

/** 캘린더 페이지 여백·크기 */
export const CALENDAR_PAGE_LAYOUT = {
  /** 그리드 가로 축소 — 위아래 여백 확보 */
  contentScale: 0.86,
  /** 페이지 번호 영역 */
  footerReserve: 36,
  /** 블록이 너무 위로 붙지 않도록 최소 상단 여백 */
  minBlockTopGap: 16,
} as const;

/** 그리드 셀 치수 — calendarPage.ts 와 동기화 */
export const CALENDAR_GRID = {
  gap: 4,
  dateRowHeight: 10,
  innerPad: 3,
  /** 자연 크기 이상으로 키우지 않음 */
  maxScale: 1,
} as const;

/** 앱 AppTheme — PDF 톤 맞춤 */
export const CALENDAR_COLORS = {
  paper: '#F5F0E8',
  ink: '#2C2824',
  inkMuted: '#6B6560',
  dayEmpty: '#B8B2AA',
  accent: '#8B7355',
  cellHasEntry: '#FFFFFF',
  cellBorderEntry: 'rgba(139,115,85,0.3)',
} as const;

export interface CalendarEntryLookup {
  moodEmoji?: string;
  coverPhotoUrl?: string;
}

export interface CalendarDayCell {
  day: number | null;
  dateKey?: string;
  hasEntry: boolean;
  moodEmoji?: string;
  coverPhotoUrl?: string;
}

export interface CalendarMonthLayout {
  year: number;
  month: number;
  monthLabel: string;
  rowCount: number;
  startWeekday: number;
  cells: CalendarDayCell[];
  cellWidth: number;
  rowHeight: number;
  photoHeight: number;
  dateRowHeight: number;
  innerPad: number;
  gap: number;
  totalGridHeight: number;
}

export function dateKeyFrom(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthLabelKo(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** 제목 + 요일 행 높이 */
export function calendarHeaderHeight(): number {
  const h = CALENDAR_HEADER;
  return h.titleSize + h.titleBottomGap + h.weekdayRowHeight + h.weekdayBottomGap;
}

/** @deprecated calendarPage 에서 블록 중앙 배치 사용 */
export function calendarGridTopY(): number {
  return CALENDAR_PAGE.margin + calendarHeaderHeight();
}

export function calendarMaxGridHeight(): number {
  const { margin } = CALENDAR_PAGE;
  const { footerReserve } = CALENDAR_PAGE_LAYOUT;
  const usable = CALENDAR_PAGE.height - margin * 2 - footerReserve;
  return usable - calendarHeaderHeight();
}

/**
 * 사진 3:4 비율 기준 자연 크기. 페이지보다 길면 축소만, 늘리지는 않음.
 */
export function buildCalendarMonthLayout(options: {
  year: number;
  month: number;
  gridWidth: number;
  entriesByDate?: Map<string, CalendarEntryLookup>;
  gap?: number;
}): CalendarMonthLayout {
  const { year, month, gridWidth } = options;
  const gap = options.gap ?? CALENDAR_GRID.gap;
  const entriesByDate = options.entriesByDate ?? new Map();
  const { dateRowHeight, innerPad, maxScale } = CALENDAR_GRID;

  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = first.getDay();
  const rowCount = Math.ceil((startWeekday + daysInMonth) / 7);

  const cellWidth = (gridWidth - gap * 6) / 7;
  const photoHeight = cellWidth / CALENDAR_PHOTO_ASPECT;
  const rowHeight = dateRowHeight + photoHeight + innerPad * 2;
  const naturalGridHeight = rowHeight * rowCount + gap * (rowCount - 1);

  const maxH = calendarMaxGridHeight();
  const scale =
    naturalGridHeight > maxH
      ? Math.min(maxScale, maxH / naturalGridHeight)
      : maxScale;

  const cells: CalendarDayCell[] = [];
  const totalSlots = rowCount * 7;

  for (let i = 0; i < totalSlots; i++) {
    if (i < startWeekday || i >= startWeekday + daysInMonth) {
      cells.push({ day: null, hasEntry: false });
      continue;
    }

    const day = i - startWeekday + 1;
    const key = dateKeyFrom(year, month, day);
    const entry = entriesByDate.get(key);

    cells.push({
      day,
      dateKey: key,
      hasEntry: !!entry,
      moodEmoji: entry?.moodEmoji,
      coverPhotoUrl: entry?.coverPhotoUrl,
    });
  }

  return {
    year,
    month,
    monthLabel: monthLabelKo(year, month),
    rowCount,
    startWeekday,
    cells,
    cellWidth,
    rowHeight: rowHeight * scale,
    photoHeight: photoHeight * scale,
    dateRowHeight: dateRowHeight * scale,
    innerPad: innerPad * scale,
    gap,
    totalGridHeight: naturalGridHeight * scale,
  };
}

export function indexEntriesByDate(
  entries: Array<{
    date: string;
    photoUrls?: string[];
    moodEmoji?: string;
  }>,
): Map<string, CalendarEntryLookup> {
  const map = new Map<string, CalendarEntryLookup>();
  for (const e of entries) {
    const key = e.date.slice(0, 10);
    if (!key) continue;
    map.set(key, {
      moodEmoji: e.moodEmoji,
      coverPhotoUrl: e.photoUrls?.[0],
    });
  }
  return map;
}

export function monthHasEntries(
  year: number,
  month: number,
  entriesByDate: Map<string, CalendarEntryLookup>,
): boolean {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  for (const key of entriesByDate.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export function listMonthsWithEntries(
  entries: Array<{ date: string }>,
): Array<{ year: number; month: number }> {
  const seen = new Set<string>();
  const months: Array<{ year: number; month: number }> = [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    if (key.length < 7 || seen.has(key)) continue;

    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    if (!year || !month || month < 1 || month > 12) continue;

    seen.add(key);
    months.push({ year, month });
  }

  return months;
}

export function entriesForMonth<T extends { date: string }>(
  entries: T[],
  year: number,
  month: number,
): T[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return entries
    .filter((entry) => entry.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calendarContentGridSize(): { gridWidth: number } {
  const fullWidth = CALENDAR_PAGE.width - CALENDAR_PAGE.margin * 2;
  return {
    gridWidth: fullWidth * CALENDAR_PAGE_LAYOUT.contentScale,
  };
}

/** 제목·요일·그리드 전체 블록의 세로 중앙 y */
export function calendarBlockStartY(totalGridHeight: number): number {
  const { margin } = CALENDAR_PAGE;
  const { footerReserve, minBlockTopGap } = CALENDAR_PAGE_LAYOUT;
  const headerH = calendarHeaderHeight();
  const blockH = headerH + totalGridHeight;
  const areaTop = margin;
  const areaBottom = CALENDAR_PAGE.height - margin - footerReserve;
  const centered = areaTop + (areaBottom - areaTop - blockH) / 2;
  return Math.max(areaTop + minBlockTopGap, centered);
}

export function calendarGridOriginX(layout: {
  cellWidth: number;
  gap: number;
}): number {
  const usableW = CALENDAR_PAGE.width - CALENDAR_PAGE.margin * 2;
  const gridW = layout.cellWidth * 7 + layout.gap * 6;
  return CALENDAR_PAGE.margin + (usableW - gridW) / 2;
}
