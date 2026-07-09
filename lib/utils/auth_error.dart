import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

/// 팝업 OAuth 응답 대기 시간 초과
class AuthPopupTimeoutException implements Exception {
  @override
  String toString() =>
      '팝업 로그인 응답이 없습니다. Chrome 팝업 차단 또는 보안 정책(COOP) 때문일 수 있습니다.\n'
      '「리디렉트로 로그인」을 사용해 주세요.';
}

/// Firebase Auth 로그인 오류 → 화면에 보여줄 메시지
String describeAuthError(Object error) {
  if (error is AuthPopupTimeoutException) {
    return error.toString();
  }

  if (error is FirebaseAuthException) {
    switch (error.code) {
      case 'unauthorized-domain':
        final host = kIsWeb ? Uri.base.host : 'unknown';
        return '허용되지 않은 도메인입니다 ($host).\n'
            'Firebase Console → Authentication → Settings → Authorized domains에 '
            '이 주소를 추가하세요.\n'
            '(localhost 와 127.0.0.1 을 둘 다 등록해야 할 수 있습니다)';
      case 'operation-not-allowed':
        return 'Google 로그인이 Firebase에 켜져 있지 않습니다.\n'
            'Console → Authentication → Sign-in method → Google 을 활성화하세요.';
      case 'popup-blocked':
        return '로그인 팝업이 차단되었습니다.\n'
            '아래 「리디렉트로 로그인」을 사용하거나 브라우저에서 팝업을 허용하세요.';
      case 'popup-closed-by-user':
        return '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
      case 'account-exists-with-different-credential':
        return '같은 이메일로 다른 로그인 방식이 이미 등록되어 있습니다.';
      default:
        final message = error.message?.trim();
        if (message != null && message.isNotEmpty && message != error.code) {
          return '$message (${error.code})';
        }
        return 'Firebase 로그인 오류 (${error.code})';
    }
  }

  return error.toString();
}
