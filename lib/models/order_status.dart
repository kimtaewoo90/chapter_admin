enum OrderStatus {
  pendingPayment('pending_payment', '입금대기'),
  paid('paid', '입금완료'),
  pdfReady('pdf_ready', 'PDF 준비'),
  shipped('shipped', '배송완료'),
  cancelled('cancelled', '취소');

  const OrderStatus(this.value, this.label);

  final String value;
  final String label;

  static OrderStatus fromString(String? raw) {
    if (raw == null) return OrderStatus.pendingPayment;
    return OrderStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => OrderStatus.pendingPayment,
    );
  }
}
