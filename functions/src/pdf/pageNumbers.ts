const PAGE_NUMBER_STYLE = {
  fontSize: 11,
  color: '#9A948C',
  /** 하단 margin 영역 안쪽 */
  footerFromBottom: 26,
} as const;

function setPageNumberFont(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
): void {
  if (fontPath) doc.font(fontPath);
  else doc.font('Helvetica');
}

/**
 * 표지 제외, 기존 페이지 하단에 1, 2, 3… (bufferPages 필요)
 *
 * y를 margin 밖에 두면 PDFKit이 새 페이지를 만들어 버리므로
 * bottom margin을 잠시 0으로 두고 하단 밴드에 그린다.
 */
export function stampPageNumbers(
  doc: PDFKit.PDFDocument,
  fontPath: string | null,
  pageSize: { width: number; height: number; margin: number },
): void {
  const range = doc.bufferedPageRange();
  const footerY = pageSize.height - PAGE_NUMBER_STYLE.footerFromBottom;

  for (let i = range.start + 1; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const displayNum = i - range.start;

    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    setPageNumberFont(doc, fontPath);
    doc
      .fontSize(PAGE_NUMBER_STYLE.fontSize)
      .fillColor(PAGE_NUMBER_STYLE.color);
    doc.text(String(displayNum), pageSize.margin, footerY, {
      width: pageSize.width - pageSize.margin * 2,
      align: 'center',
      lineBreak: false,
    });

    doc.page.margins.bottom = savedBottom;
  }
}
