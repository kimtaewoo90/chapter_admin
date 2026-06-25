import 'package:cloud_firestore/cloud_firestore.dart' hide Order;

import '../models/order.dart';
import '../models/order_status.dart';

class OrderService {
  OrderService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

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
}
