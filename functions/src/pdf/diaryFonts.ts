import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** chapter 앱 `AppFontId.name` 과 동일 */
export type DiaryFontId =
  | 'gaegu'
  | 'jua'
  | 'gowunDodum'
  | 'poorStory'
  | 'hiMelody'
  | 'dongle'
  | 'notoSansKr'
  | 'gowunBatang';

const GOOGLE_FONTS_RAW = 'https://github.com/google/fonts/raw/main';

const NOTO_CJK_URLS = [
  'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf',
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf',
];

type FontSource = { regular: string[]; bold?: string[] };

const DIARY_FONT_SOURCES: Record<DiaryFontId, FontSource> = {
  gaegu: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/gaegu/Gaegu-Regular.ttf`],
    bold: [`${GOOGLE_FONTS_RAW}/ofl/gaegu/Gaegu-Bold.ttf`],
  },
  jua: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/jua/Jua-Regular.ttf`],
  },
  gowunDodum: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/gowundodum/GowunDodum-Regular.ttf`],
    bold: [`${GOOGLE_FONTS_RAW}/ofl/gowundodum/GowunDodum-Bold.ttf`],
  },
  poorStory: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/poorstory/PoorStory-Regular.ttf`],
  },
  hiMelody: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/himelody/HiMelody-Regular.ttf`],
  },
  dongle: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/dongle/Dongle-Regular.ttf`],
    bold: [`${GOOGLE_FONTS_RAW}/ofl/dongle/Dongle-Bold.ttf`],
  },
  notoSansKr: {
    regular: NOTO_CJK_URLS,
  },
  gowunBatang: {
    regular: [`${GOOGLE_FONTS_RAW}/ofl/gowunbatang/GowunBatang-Regular.ttf`],
    bold: [`${GOOGLE_FONTS_RAW}/ofl/gowunbatang/GowunBatang-Bold.ttf`],
  },
};

const DEFAULT_DIARY_FONT_ID: DiaryFontId = 'gaegu';

const fontCache = new Map<string, string | null>();

async function downloadFont(urls: string[], cacheName: string): Promise<string | null> {
  const cached = fontCache.get(cacheName);
  if (cached !== undefined) return cached;

  const cachePath = path.join(os.tmpdir(), cacheName);
  if (fs.existsSync(cachePath)) {
    fontCache.set(cacheName, cachePath);
    return cachePath;
  }

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      fs.writeFileSync(cachePath, Buffer.from(await response.arrayBuffer()));
      fontCache.set(cacheName, cachePath);
      return cachePath;
    } catch {
      // 다음 URL
    }
  }

  fontCache.set(cacheName, null);
  return null;
}

export function normalizeDiaryFontId(raw?: string | null): DiaryFontId {
  if (raw && raw in DIARY_FONT_SOURCES) return raw as DiaryFontId;
  return DEFAULT_DIARY_FONT_ID;
}

/** 주문 시 저장된 일기 폰트 → PDFKit용 TTF/OTF 경로 */
export async function resolveDiaryFontPath(diaryFontId?: string | null): Promise<string | null> {
  const id = normalizeDiaryFontId(diaryFontId);
  const source = DIARY_FONT_SOURCES[id];
  const ext = id === 'notoSansKr' ? 'otf' : 'ttf';
  const regular = await downloadFont(source.regular, `chapter-diary-${id}-regular.${ext}`);
  if (regular) return regular;

  return downloadFont(NOTO_CJK_URLS, 'chapter-noto-sans-kr-fallback.otf');
}
