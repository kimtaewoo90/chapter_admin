import fs from 'node:fs';
import path from 'node:path';

/**
 * Windows: PDF 뷰어가 파일을 열고 있으면 EBUSY → 임시 파일 후 대체 경로 저장
 */
export function writeOutputPdf(outPath: string, buffer: Buffer): string {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = path.join(dir, `.${path.basename(outPath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    fs.copyFileSync(tmpPath, outPath);
    fs.unlinkSync(tmpPath);
    return outPath;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EBUSY' && code !== 'EPERM') {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
      throw error;
    }

    const fallback = outPath.replace(/\.pdf$/i, `-${Date.now()}.pdf`);
    fs.renameSync(tmpPath, fallback);

    console.warn('');
    console.warn('⚠️  기존 PDF가 다른 프로그램(뷰어)에서 열려 있어요.');
    console.warn('   PDF를 닫고 다시 실행하면 같은 파일명으로 저장됩니다.');
    console.warn(`   → 대신 저장: ${path.basename(fallback)}`);

    return fallback;
  }
}
