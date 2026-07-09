import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../pages/login_page.dart';
import '../services/auth_service.dart';
import '../utils/auth_error.dart';

/// 로그인 상태 확인 후 Admin Shell 로 진입
class AuthGate extends StatefulWidget {
  const AuthGate({
    super.key,
    required this.authService,
    required this.child,
  });

  final AuthService authService;
  final Widget child;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  User? _sessionUser;
  bool _checkingAuth = true;
  Object? _authError;

  @override
  void initState() {
    super.initState();
    widget.authService.addListener(_onAuthServiceChanged);
    if (widget.authService.devBypass) {
      _checkingAuth = false;
      return;
    }
    _bootstrap();
  }

  @override
  void dispose() {
    widget.authService.removeListener(_onAuthServiceChanged);
    super.dispose();
  }

  void _onAuthServiceChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _bootstrap() async {
    try {
      if (kIsWeb) {
        await widget.authService.getRedirectSignInResult();
      }
      await _applyUser(widget.authService.currentUser);
    } catch (error) {
      debugPrint('[AuthGate] bootstrap 실패: $error');
      if (mounted) {
        setState(() => _authError = describeAuthError(error));
      }
    } finally {
      if (mounted) {
        setState(() => _checkingAuth = false);
      }
    }

    widget.authService.authStateChanges.listen((user) async {
      if (!mounted || widget.authService.devBypass) return;

      try {
        await _applyUser(user);
      } catch (error) {
        debugPrint('[AuthGate] authState 변경 처리 실패: $error');
        if (mounted) {
          setState(() => _authError = describeAuthError(error));
        }
      } finally {
        if (mounted) {
          setState(() => _checkingAuth = false);
        }
      }
    });
  }

  void _enterDevBypass() {
    widget.authService.enterDevBypass();
    setState(() {
      _checkingAuth = false;
      _authError = null;
    });
  }

  Future<void> _applyUser(User? user) async {
    if (user == null) {
      if (mounted) {
        setState(() {
          _sessionUser = null;
          _authError = null;
        });
      }
      return;
    }

    final email = user.email;
    final allowed = widget.authService.isAllowedEmail(email);
    debugPrint('[AuthGate] user=$email admin=$allowed');

    if (mounted) {
      setState(() {
        _sessionUser = user;
        _authError = null;
      });
    }

    try {
      await user.getIdToken().timeout(const Duration(seconds: 12));
    } on TimeoutException {
      debugPrint('[AuthGate] getIdToken timeout — 캐시 토큰으로 계속 진행');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.authService.devBypass) {
      return widget.child;
    }

    if (_checkingAuth && _sessionUser == null) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('로그인 상태 확인 중…'),
            ],
          ),
        ),
      );
    }

    final user = _sessionUser;

    if (user == null) {
      return LoginPage(
        authService: widget.authService,
        onDevBypass: kDebugMode ? _enterDevBypass : null,
      );
    }

    if (_authError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text('인증 오류: $_authError'),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: widget.authService.signOut,
                  child: const Text('다시 로그인'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!widget.authService.isAllowedEmail(user.email)) {
      return AccessDeniedPage(
        authService: widget.authService,
        email: user.email,
        message: widget.authService.accessDeniedMessage(user.email),
      );
    }

    return widget.child;
  }
}
