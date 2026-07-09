/// 관리자 허용 이메일 목록
///
/// firestore.rules 의 isAdmin() 목록과 동일하게 맞춰 주세요.
class AdminConfig {
  AdminConfig._();

  /// `flutter run --dart-define=ADMIN_SKIP_AUTH=true` 또는 회사 PC 시작 스크립트
  static const skipAuth = bool.fromEnvironment('ADMIN_SKIP_AUTH');

  static const allowedEmails = <String>{
    'tangbaboda@gmail.com',
  };

  static bool isAllowedEmail(String? email) {
    if (email == null || email.isEmpty) return false;
    return allowedEmails.contains(email.trim().toLowerCase());
  }
}
