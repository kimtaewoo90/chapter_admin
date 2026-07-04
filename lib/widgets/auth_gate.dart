import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../pages/login_page.dart';
import '../services/auth_service.dart';

/// Firestore 요청 전에 Auth ID 토큰이 준비될 때까지 대기합니다.
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
  bool _tokenReady = false;
  Object? _tokenError;

  @override
  void initState() {
    super.initState();
    widget.authService.authStateChanges.listen(_onAuthChanged);
  }

  Future<void> _onAuthChanged(User? user) async {
    if (user == null) {
      if (mounted) {
        setState(() {
          _sessionUser = null;
          _tokenReady = false;
          _tokenError = null;
        });
      }
      return;
    }

    if (mounted) {
      setState(() {
        _sessionUser = user;
        _tokenReady = false;
        _tokenError = null;
      });
    }

    try {
      await user.getIdToken(true);
      if (mounted && widget.authService.currentUser?.uid == user.uid) {
        setState(() => _tokenReady = true);
      }
    } catch (error) {
      if (mounted && widget.authService.currentUser?.uid == user.uid) {
        setState(() {
          _tokenError = error;
          _tokenReady = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _sessionUser;

    if (user == null) {
      return LoginPage(authService: widget.authService);
    }

    if (_tokenError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text('인증 토큰 오류: $_tokenError'),
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

    if (!_tokenReady) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (!widget.authService.isAdmin) {
      return AccessDeniedPage(
        authService: widget.authService,
        email: user.email,
      );
    }

    return widget.child;
  }
}
