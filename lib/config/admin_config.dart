/// 관리자 허용 이메일 목록
///
/// firestore.rules 의 isAdmin() 목록과 동일하게 맞춰 주세요.
class AdminConfig {
  AdminConfig._();

  static const allowedEmails = <String>{
    'tangbaboda@gmail.com',
  };

  static bool isAllowedEmail(String? email) {
    if (email == null || email.isEmpty) return false;
    return allowedEmails.contains(email.trim().toLowerCase());
  }
}
