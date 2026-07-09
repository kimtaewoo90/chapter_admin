import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../config/admin_config.dart';
import '../utils/auth_error.dart';

/// signInWithRedirect 호출 후 페이지가 이동
class AuthRedirectInProgress implements Exception {
  @override
  String toString() => 'Google 로그인 페이지로 이동 중…';
}

class AuthService extends ChangeNotifier {
  AuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance {
    if (AdminConfig.skipAuth) {
      _devBypass = true;
      debugPrint('[AuthService] ADMIN_SKIP_AUTH — 로그인 없이 진입');
    }
  }

  final FirebaseAuth _auth;
  bool _devBypass = false;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  /// 로그인 없이 Admin UI 진입 (회사 PC 로컬 개발용)
  bool get devBypass => _devBypass;

  void enterDevBypass() {
    _devBypass = true;
    debugPrint('[AuthService] devBypass 활성화 — Firestore dev rules 필요');
    notifyListeners();
  }

  void exitDevBypass() {
    if (AdminConfig.skipAuth) return;
    _devBypass = false;
    notifyListeners();
  }

  bool isAllowedEmail(String? email) => AdminConfig.isAllowedEmail(email);

  bool get isAdmin => devBypass || isAllowedEmail(currentUser?.email);

  /// 비관리자 계정 안내 문구
  String accessDeniedMessage(String? email) {
    final account = email?.trim().isNotEmpty == true ? email! : '현재 계정';
    return '$account 은(는) Chapter Admin 관리자가 아닙니다.\n\n'
        '허용 관리자 계정:\n'
        '${AdminConfig.allowedEmails.join('\n')}\n\n'
        '위 계정으로 다시 로그인해 주세요.';
  }

  Future<UserCredential?> getRedirectSignInResult() async {
    if (!kIsWeb) return null;

    final result = await _auth.getRedirectResult();
    if (result.user != null) {
      debugPrint('[AuthService] redirect 로그인 완료 email=${result.user!.email}');
    }
    return result;
  }

  GoogleAuthProvider _googleProvider() {
    return GoogleAuthProvider()
      ..setCustomParameters({'prompt': 'select_account'});
  }

  /// 팝업 로그인 — 회사 브라우저/COOP 환경에서 응답 없이 hang 될 수 있음
  Future<UserCredential> signInWithGoogle() async {
    if (!kIsWeb) {
      throw UnsupportedError('Google 로그인은 웹 Admin 전용입니다.');
    }

    final provider = _googleProvider();
    debugPrint('[AuthService] signInWithPopup host=${Uri.base.host}');

    try {
      final credential = await _auth
          .signInWithPopup(provider)
          .timeout(const Duration(seconds: 30), onTimeout: () {
        debugPrint('[AuthService] popup timeout — COOP/팝업 차단 의심');
        throw AuthPopupTimeoutException();
      });

      final email = credential.user?.email;
      debugPrint('[AuthService] popup 로그인 완료 email=$email admin=$isAllowedEmail(email)');

      if (!isAllowedEmail(email)) {
        debugPrint('[AuthService] 비관리자 계정 — AccessDenied 표시 예정');
      }

      return credential;
    } on FirebaseAuthException catch (error) {
      debugPrint('[AuthService] popup 실패 code=${error.code} message=${error.message}');
      if (error.code == 'popup-blocked') {
        await signInWithGoogleRedirect();
        throw AuthRedirectInProgress();
      }
      rethrow;
    }
  }

  Future<void> signInWithGoogleRedirect() async {
    if (!kIsWeb) {
      throw UnsupportedError('Google 로그인은 웹 Admin 전용입니다.');
    }

    debugPrint('[AuthService] signInWithRedirect host=${Uri.base.host}');
    await _auth.signInWithRedirect(_googleProvider());
  }

  Future<void> signOut() async {
    if (!AdminConfig.skipAuth) {
      _devBypass = false;
    }
    await _auth.signOut();
    notifyListeners();
  }
}
