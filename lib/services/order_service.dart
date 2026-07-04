import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';

import '../models/order.dart';
import '../models/order_status.dart';
import '../utils/functions_error.dart';

class OrderService {
  OrderService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'asia-northeast3');

  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  static final _callableOptions = HttpsCallableOptions(
    timeout: const Duration(minutes: 5),
  );

  CollectionReference<Map<String, dynamic>> get _orders =>
      _firestore.collection('orders');

  Stream<List<Order>> watchOrders({OrderStage? stageFilter}) {
    return _orders.orderBy('createdAt', descending: true).snapshots().map(
      (snapshot) {
        var orders =
            snapshot.docs.map((doc) => Order.fromFirestore(doc)).toList();
        if (stageFilter != null) {
          orders =
              orders.where((o) => stageFilter.matches(o.status)).toList();
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

  Future<String> generatePdf(String orderId, {bool force = false}) async {
    debugPrint('[OrderService] generatePdf 시작 orderId=$orderId force=$force');

    try {
      final callable = _functions.httpsCallable(
        'generateOrderPdf',
        options: _callableOptions,
      );
      final result = await callable.call<Map<String, dynamic>>({
        'orderId': orderId,
        if (force) 'force': true,
      });

      final pdfUrl = result.data['pdfUrl'] as String? ?? '';
      debugPrint('[OrderService] generatePdf 성공 pdfUrl=$pdfUrl');
      return pdfUrl;
    } on FirebaseFunctionsException catch (error, stackTrace) {
      logFunctionsError('generateOrderPdf 실패', error, stackTrace);
      throw OrderServiceException(
        describeFunctionsError(error),
        cause: error,
      );
    } catch (error, stackTrace) {
      debugPrint('[OrderService] generatePdf 예외: $error');
      debugPrint('$stackTrace');
      rethrow;
    }
  }

  Future<String> seedTestOrder() async {
    debugPrint('[OrderService] seedTestOrder 시작');

    try {
      final callable = _functions.httpsCallable(
        'seedTestOrderData',
        options: _callableOptions,
      );
      final result = await callable.call<Map<String, dynamic>>({});
      final orderId = result.data['orderId'] as String? ?? '';
      debugPrint('[OrderService] seedTestOrder 성공 orderId=$orderId');
      return orderId;
    } on FirebaseFunctionsException catch (error, stackTrace) {
      logFunctionsError('seedTestOrderData 실패', error, stackTrace);
      throw OrderServiceException(
        describeFunctionsError(error),
        cause: error,
      );
    } catch (error, stackTrace) {
      debugPrint('[OrderService] seedTestOrder 예외: $error');
      debugPrint('$stackTrace');
      rethrow;
    }
  }
}

class OrderServiceException implements Exception {
  OrderServiceException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => message;
}
