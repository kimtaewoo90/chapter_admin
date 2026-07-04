enum OrderStatus {
  pendingPayment('pending_payment', '입금대기'),
  paid('paid', '입금완료'),
  pdfReady('pdf_ready', 'PDF 준비'),
  processing('processing', '인쇄 진행'),
  printed('printed', '인쇄 완료'),
  shipping('shipping', '배송중'),
  shipped('shipped', '배송완료'),
  cancelled('cancelled', '취소');

  const OrderStatus(this.value, this.label);

  final String value;
  final String label;

  OrderStage get stage => OrderStage.fromStatus(this);

  static OrderStatus fromString(String? raw) {
    if (raw == null) return OrderStatus.pendingPayment;
    return OrderStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => OrderStatus.pendingPayment,
    );
  }
}

/// 어드민 UI에서 보여주는 주문 단계 (Firestore status 여러 값 → 한 단계)
enum OrderStage {
  pendingPayment('입금 대기'),
  paid('입금 완료'),
  inProduction('제작중'),
  shipping('배송중'),
  shipped('배송완료'),
  cancelled('취소');

  const OrderStage(this.label);

  final String label;

  static const filterable = [
    pendingPayment,
    paid,
    inProduction,
    shipping,
    shipped,
  ];

  static OrderStage fromStatus(OrderStatus status) {
    return switch (status) {
      OrderStatus.pendingPayment => OrderStage.pendingPayment,
      OrderStatus.paid => OrderStage.paid,
      OrderStatus.pdfReady ||
      OrderStatus.processing ||
      OrderStatus.printed =>
        OrderStage.inProduction,
      OrderStatus.shipping => OrderStage.shipping,
      OrderStatus.shipped => OrderStage.shipped,
      OrderStatus.cancelled => OrderStage.cancelled,
    };
  }

  bool matches(OrderStatus status) => fromStatus(status) == this;

  /// 다음 단계로 넘길 때 설정할 Firestore status
  OrderStatus? get nextStatus => switch (this) {
        OrderStage.pendingPayment => OrderStatus.paid,
        OrderStage.paid => OrderStatus.processing,
        OrderStage.inProduction => OrderStatus.shipping,
        OrderStage.shipping => OrderStatus.shipped,
        _ => null,
      };

  /// 상태 변경 버튼 라벨
  String? get nextActionLabel => switch (this) {
        OrderStage.pendingPayment => '입금확인',
        OrderStage.paid => '제작중',
        OrderStage.inProduction => '배송중',
        OrderStage.shipping => '배송완료',
        _ => null,
      };

  /// 다음 단계 라벨 (확인 다이얼로그용)
  String? get nextStageLabel => switch (this) {
        OrderStage.pendingPayment => '입금 완료',
        OrderStage.paid => '제작중',
        OrderStage.inProduction => '배송중',
        OrderStage.shipping => '배송완료',
        _ => null,
      };
}
