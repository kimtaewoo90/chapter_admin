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
<<<<<<< Updated upstream
    timeout: const Duration(minutes: 5),
=======
    timeout: Duration(minutes: 5),
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
  Future<String> generatePdf(String orderId, {bool force = false}) async {
    debugPrint('[OrderService] generatePdf 시작 orderId=$orderId force=$force');

=======
  /// Firebase Function generateOrderPdf 호출
  Future<String> generatePdf(String orderId) async {
>>>>>>> Stashed changes
    try {
      final callable = _functions.httpsCallable(
        'generateOrderPdf',
        options: _callableOptions,
      );
      final result = await callable.call<Map<String, dynamic>>({
        'orderId': orderId,
<<<<<<< Updated upstream
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
=======
      });
      return result.data['pdfUrl'] as String? ?? '';
    } on FirebaseFunctionsException catch (e) {
      throw Exception(
        _formatFunctionsError(e, fallback: 'PDF 생성 Function 호출 실패'),
      );
>>>>>>> Stashed changes
    }
  }

  Future<String> seedTestOrder() async {
<<<<<<< Updated upstream
    debugPrint('[OrderService] seedTestOrder 시작');

=======
>>>>>>> Stashed changes
    try {
      final callable = _functions.httpsCallable(
        'seedTestOrderData',
        options: _callableOptions,
      );
      final result = await callable.call<Map<String, dynamic>>({});
<<<<<<< Updated upstream
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
=======
      return result.data['orderId'] as String? ?? '';
    } on FirebaseFunctionsException catch (e) {
      throw Exception(
        _formatFunctionsError(e, fallback: '테스트 주문 Function 호출 실패'),
      );
    }
  }

  String _formatFunctionsError(
    FirebaseFunctionsException e, {
    required String fallback,
  }) {
    final message = e.message?.trim();
    if (message != null && message.isNotEmpty && message != 'internal') {
      return message;
    }
    return '$fallback (${e.code})';
>>>>>>> Stashed changes
  }
}

class OrderServiceException implements Exception {
  OrderServiceException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => message;
}
