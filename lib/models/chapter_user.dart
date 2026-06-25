import 'package:cloud_firestore/cloud_firestore.dart';

class ChapterUser {
  const ChapterUser({
    required this.id,
    required this.raw,
    this.email,
    this.displayName,
    this.photoUrl,
    this.createdAt,
    this.lastActiveAt,
    this.adminMemo,
    this.disabled = false,
  });

  final String id;
  final Map<String, dynamic> raw;
  final String? email;
  final String? displayName;
  final String? photoUrl;
  final DateTime? createdAt;
  final DateTime? lastActiveAt;
  final String? adminMemo;
  final bool disabled;

  factory ChapterUser.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return ChapterUser.fromMap(doc.id, doc.data() ?? {});
  }

  factory ChapterUser.fromMap(String id, Map<String, dynamic> data) {
    return ChapterUser(
      id: id,
      raw: Map<String, dynamic>.from(data),
      email: _firstString(data, ['email', 'userEmail']),
      displayName: _firstString(data, [
        'displayName',
        'name',
        'nickname',
        'userName',
        'username',
      ]),
      photoUrl: _firstString(data, ['photoURL', 'photoUrl', 'avatarUrl']),
      createdAt: _parseTimestamp(
        data['createdAt'] ?? data['created_at'] ?? data['joinedAt'],
      ),
      lastActiveAt: _parseTimestamp(
        data['lastActiveAt'] ?? data['lastLoginAt'] ?? data['updatedAt'],
      ),
      adminMemo: data['adminMemo'] as String?,
      disabled: data['disabled'] == true || data['isDisabled'] == true,
    );
  }

  String get displayLabel {
    if (displayName != null && displayName!.isNotEmpty) return displayName!;
    if (email != null && email!.isNotEmpty) return email!;
    return id;
  }

  String get shortId => id.length > 12 ? '${id.substring(0, 12)}…' : id;

  static String? _firstString(Map<String, dynamic> data, List<String> keys) {
    for (final key in keys) {
      final value = data[key];
      if (value is String && value.isNotEmpty) return value;
    }
    return null;
  }

  static DateTime? _parseTimestamp(dynamic value) {
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }
}
