import 'package:cloud_firestore/cloud_firestore.dart';

import 'order_status.dart';

class Order {
  const Order({
    required this.id,
    required this.userId,
    required this.bookId,
    required this.status,
    required this.shippingAddress,
    required this.createdAt,
    this.bookTitle,
    this.amount,
    this.pdfUrl,
    this.snapshot,
    this.paidAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String bookId;
  final OrderStatus status;
  final String shippingAddress;
  final DateTime? createdAt;
  final String? bookTitle;
  final int? amount;
  final String? pdfUrl;
  final Map<String, dynamic>? snapshot;
  final DateTime? paidAt;
  final DateTime? updatedAt;

  factory Order.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Order(
      id: doc.id,
      userId: data['userId'] as String? ?? '',
      bookId: data['bookId'] as String? ?? '',
      status: OrderStatus.fromString(data['status'] as String?),
      shippingAddress: data['shippingAddress'] as String? ?? '',
      createdAt: _parseTimestamp(data['createdAt']),
      bookTitle: data['bookTitle'] as String?,
      amount: (data['amount'] as num?)?.toInt(),
      pdfUrl: data['pdfUrl'] as String?,
      snapshot: data['snapshot'] as Map<String, dynamic>?,
      paidAt: _parseTimestamp(data['paidAt']),
      updatedAt: _parseTimestamp(data['updatedAt']),
    );
  }

  static DateTime? _parseTimestamp(dynamic value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  int get snapshotEntryCount {
    final entries = snapshot?['entries'];
    if (entries is List) return entries.length;
    return 0;
  }

  String get displayTitle => bookTitle ?? bookId;
}
