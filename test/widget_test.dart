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
  });
}
