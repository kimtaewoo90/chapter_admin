import {
  bodyStyleLabel,
  EntryBodyStyle,
  formatBodyStyleHelp,
  resolveBodyStyleIndex,
} from '../pdf/bodyStyle';

export function parseBodyStyleArg(raw?: string): EntryBodyStyle {
  return resolveBodyStyleIndex(raw);
}

export function logBodyStyleSelection(style: EntryBodyStyle, index?: string): void {
  const prefix = index ? `${index}. ` : '';
  console.log(`📐 본문 스타일: ${prefix}${bodyStyleLabel(style)} (${style})`);
}

export function printPdfStyleUsage(script: string): void {
  console.error(`사용법: npm run ${script} -- [인자...] <스타일번호>`);
  console.error('');
  console.error(formatBodyStyleHelp());
}
