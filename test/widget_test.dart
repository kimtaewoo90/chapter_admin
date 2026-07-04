import 'package:chapter_admin/models/order.dart';
import 'package:chapter_admin/models/order_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('OrderStatus fromString maps known values', () {
    expect(
      OrderStatus.fromString('pending_payment'),
      OrderStatus.pendingPayment,
    );
    expect(OrderStatus.fromString('paid'), OrderStatus.paid);
    expect(OrderStatus.fromString('pdf_ready'), OrderStatus.pdfReady);
    expect(OrderStatus.fromString('processing'), OrderStatus.processing);
    expect(OrderStatus.fromString('shipping'), OrderStatus.shipping);
    expect(OrderStatus.fromString('shipped'), OrderStatus.shipped);
  });

  test('OrderStage groups production statuses', () {
    expect(OrderStatus.pdfReady.stage, OrderStage.inProduction);
    expect(OrderStatus.processing.stage, OrderStage.inProduction);
    expect(OrderStatus.printed.stage, OrderStage.inProduction);
    expect(OrderStage.inProduction.matches(OrderStatus.pdfReady), isTrue);
  });

  test('OrderStage next action', () {
    expect(OrderStage.pendingPayment.nextActionLabel, '입금확인');
    expect(OrderStage.pendingPayment.nextStatus, OrderStatus.paid);
    expect(OrderStage.paid.nextActionLabel, '제작중');
    expect(OrderStage.paid.nextStatus, OrderStatus.processing);
    expect(OrderStage.inProduction.nextActionLabel, '배송중');
    expect(OrderStage.shipping.nextActionLabel, '배송완료');
    expect(OrderStage.shipped.nextActionLabel, isNull);
  });

  test('Order reads name and phone from snapshot map', () {
    final order = Order(
      id: 'order1',
      userId: 'u1',
      bookId: 'b1',
      status: OrderStatus.pendingPayment,
      shippingAddress: '서울',
      createdAt: null,
      snapshot: const {
        '이름': '김테스트',
        '전화번호': '010-9999-8888',
        'entries': [],
      },
    );

    expect(order.displayName, '김테스트');
    expect(order.displayPhone, '010-9999-8888');
  });
}
