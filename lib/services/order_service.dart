import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:cloud_functions/cloud_functions.dart';

import '../models/order.dart';
import '../models/order_status.dart';

class OrderService {
  OrderService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'asia-northeast3');

  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _orders =>
      _firestore.collection('orders');

  Stream<List<Order>> watchOrders({OrderStatus? statusFilter}) {
    return _orders.orderBy('createdAt', descending: true).snapshots().map(
      (snapshot) {
        var orders =
            snapshot.docs.map((doc) => Order.fromFirestore(doc)).toList();
        if (statusFilter != null) {
          orders = orders.where((o) => o.status == statusFilter).toList();
        }
        return orders;
      },
    );
  }

  Future<void> confirmPayment(String orderId) async {
    await _orders.doc(orderId).update({
      'status': OrderStatus.paid.value,
      'paidAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateStatus(String orderId, OrderStatus status) async {
    await _orders.doc(orderId).update({
      'status': status.value,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Firebase Function generateOrderPdf 호출
  Future<String> generatePdf(String orderId) async {
    final callable = _functions.httpsCallable('generateOrderPdf');
    final result = await callable.call<Map<String, dynamic>>({
      'orderId': orderId,
    });
    return result.data['pdfUrl'] as String? ?? '';
  }

  /// PDF 테스트용 주문 스냅샷 시드
  Future<String> seedTestOrder() async {
    final callable = _functions.httpsCallable('seedTestOrderData');
    final result = await callable.call<Map<String, dynamic>>({});
    return result.data['orderId'] as String? ?? '';
  }
}
