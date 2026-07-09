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
    this.shippingName,
    this.shippingPhone,
    this.bookTitle,
    this.amount,
    this.pdfUrl,
    this.pdfStatus,
    this.pdfError,
    this.snapshot,
    this.snapshots,
    this.paidAt,
    this.pdfGeneratedAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String bookId;
  final OrderStatus status;
  final String shippingAddress;
  final DateTime? createdAt;
  final String? shippingName;
  final String? shippingPhone;
  final String? bookTitle;
  final int? amount;
  final String? pdfUrl;
  final String? pdfStatus;
  final String? pdfError;
  final Map<String, dynamic>? snapshot;
  final List<dynamic>? snapshots;
  final DateTime? paidAt;
  final DateTime? pdfGeneratedAt;
  final DateTime? updatedAt;

  factory Order.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return Order.fromMap(doc.id, doc.data() ?? {});
  }

  factory Order.fromMap(String id, Map<String, dynamic> data) {
    return Order(
      id: id,
      userId: data['userId'] as String? ?? '',
      bookId: data['bookId'] as String? ?? '',
      status: OrderStatus.fromString(data['status'] as String?),
      shippingAddress: _readAddress(data),
      shippingName: _readString(data, const [
        'shippingName',
        'recipientName',
        'receiverName',
        'customerName',
        'buyerName',
        'name',
        '이름',
      ]),
      shippingPhone: _readString(data, const [
        'shippingPhone',
        'phone',
        'phoneNumber',
        'tel',
        'mobile',
        'recipientPhone',
        '전화번호',
      ]),
      createdAt: _parseTimestamp(data['createdAt']),
      bookTitle: data['bookTitle'] as String?,
      amount: (data['amount'] as num?)?.toInt(),
      pdfUrl: data['pdfUrl'] as String?,
      pdfStatus: data['pdfStatus'] as String?,
      pdfError: data['pdfError'] as String?,
      snapshot: data['snapshot'] is Map
          ? Map<String, dynamic>.from(data['snapshot'] as Map)
          : null,
      snapshots: data['snapshots'] as List<dynamic>?,
      paidAt: _parseTimestamp(data['paidAt']),
      pdfGeneratedAt: _parseTimestamp(data['pdfGeneratedAt']),
      updatedAt: _parseTimestamp(data['updatedAt']),
    );
  }

  static DateTime? _parseTimestamp(dynamic value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  static String? _readString(
    Map<String, dynamic> data,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = data[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }

    for (final nestedKey in ['shipping', 'shippingInfo', 'recipient']) {
      final nested = data[nestedKey];
      if (nested is! Map) continue;
      final map = Map<String, dynamic>.from(nested);
      for (final key in keys) {
        final value = map[key];
        if (value is String && value.trim().isNotEmpty) return value.trim();
      }
    }

    for (final snapshotKey in ['snapshot', 'snapshots']) {
      final snapshotValue = data[snapshotKey];
      if (snapshotValue is Map) {
        final fromMap = _readString(Map<String, dynamic>.from(snapshotValue), keys);
        if (fromMap != null) return fromMap;
      }
      if (snapshotValue is List) {
        for (final item in snapshotValue) {
          if (item is! Map) continue;
          final fromItem = _readString(Map<String, dynamic>.from(item), keys);
          if (fromItem != null) return fromItem;
        }
      }
    }

    return null;
  }

  static String _readAddress(Map<String, dynamic> data) {
    final direct = data['shippingAddress'];
    if (direct is String && direct.trim().isNotEmpty) return direct.trim();

    for (final nestedKey in ['shipping', 'shippingInfo', 'recipient']) {
      final nested = data[nestedKey];
      if (nested is! Map) continue;
      final map = Map<String, dynamic>.from(nested);
      for (final key in ['address', 'shippingAddress', 'fullAddress']) {
        final value = map[key];
        if (value is String && value.trim().isNotEmpty) return value.trim();
      }
    }

    return '';
  }

  int get snapshotEntryCount {
    final nested = snapshot?['entries'];
    if (nested is List && nested.isNotEmpty) return nested.length;
    if (snapshots != null && snapshots!.isNotEmpty) return snapshots!.length;
    return 0;
  }

  String get displayTitle => bookTitle ?? bookId;

  String get displayName {
    if (shippingName?.isNotEmpty == true) return shippingName!;
    return _fieldFromSnapshot(const ['이름', 'name', 'shippingName']) ?? '—';
  }

  String get displayPhone {
    if (shippingPhone?.isNotEmpty == true) return shippingPhone!;
    return _fieldFromSnapshot(const ['전화번호', 'phone', 'phoneNumber']) ?? '—';
  }

  String? _fieldFromSnapshot(List<String> keys) {
    if (snapshot != null) {
      for (final key in keys) {
        final value = snapshot![key];
        if (value is String && value.trim().isNotEmpty) return value.trim();
      }
    }

    if (snapshots != null) {
      for (final item in snapshots!) {
        if (item is! Map) continue;
        final map = Map<String, dynamic>.from(item);
        for (final key in keys) {
          final value = map[key];
          if (value is String && value.trim().isNotEmpty) return value.trim();
        }
      }
    }

    return null;
  }

  String get shortId => id.length <= 10 ? id : '…${id.substring(id.length - 8)}';

  bool get isPdfGenerating => pdfStatus == 'generating';

  bool get isPdfFailed => pdfStatus == 'failed';

  OrderStage get stage => status.stage;

  /// 입금완료·제작중(pdf_ready) 주문은 PDF 만들기/재생성 가능
  bool get canGeneratePdf =>
      status == OrderStatus.paid ||
      status == OrderStatus.pdfReady ||
      status == OrderStatus.processing;
}
