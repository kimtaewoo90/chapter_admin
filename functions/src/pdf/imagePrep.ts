import sharp from 'sharp';

export interface PreparedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

/** EXIF 회전을 픽셀에 반영 — PDFKit에 그대로 넣기만 하면 됨 */
export async function prepareImage(raw: Buffer): Promise<PreparedImage | null> {
  try {
    const { data, info } = await sharp(raw)
      .rotate() // EXIF 기준 올바른 방향
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;

    return {
      buffer: data,
      width: info.width,
      height: info.height,
    };
  } catch {
    return null;
  }
}

export function fitImageSize(
  meta: { width: number; height: number },
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const scale = Math.min(maxW / meta.width, maxH / meta.height);
  return {
    width: meta.width * scale,
    height: meta.height * scale,
  };
}
