import 'package:flutter/material.dart';

import '../config/admin_config.dart';
import '../services/auth_service.dart';
import '../utils/auth_error.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.authService,
    this.onDevBypass,
  });

  final AuthService authService;
  final VoidCallback? onDevBypass;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _loading = false;
  String? _error;

  Future<void> _signIn({required bool useRedirect}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (useRedirect) {
        await widget.authService.signInWithGoogleRedirect();
        throw AuthRedirectInProgress();
      } else {
        await widget.authService.signInWithGoogle();
      }
    } on AuthRedirectInProgress {
      // redirect 중 — 페이지가 곧 이동함
    } catch (error) {
      if (mounted) {
        setState(() => _error = describeAuthError(error));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.admin_panel_settings_outlined,
                  size: 72,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 24),
                Text(
                  'Chapter Admin',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '관리자 Google 계정으로 로그인하세요.\n'
                  '팝업이 안 되면 「리디렉트로 로그인」을 사용하세요.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 32),
                if (_error != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _error!,
                      style: TextStyle(
                        color: theme.colorScheme.onErrorContainer,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                FilledButton.icon(
                  onPressed: _loading ? null : () => _signIn(useRedirect: false),
                  icon: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login),
                  label: const Text('Google로 로그인 (팝업)'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : () => _signIn(useRedirect: true),
                  icon: const Icon(Icons.open_in_browser),
                  label: const Text('리디렉트로 로그인'),
                ),
                if (widget.onDevBypass != null) ...[
                  const SizedBox(height: 20),
                  TextButton.icon(
                    onPressed: _loading ? null : widget.onDevBypass,
                    icon: const Icon(Icons.developer_mode_outlined),
                    label: const Text('로그인 없이 들어가기 (회사 PC 개발용)'),
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  '허용 관리자: ${AdminConfig.allowedEmails.join(', ')}\n'
                  '다른 계정으로 로그인하면 「접근 권한 없음」 화면이 나옵니다.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AccessDeniedPage extends StatelessWidget {
  const AccessDeniedPage({
    super.key,
    required this.authService,
    required this.email,
    required this.message,
  });

  final AuthService authService;
  final String? email;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.block,
                  size: 64,
                  color: theme.colorScheme.error,
                ),
                const SizedBox(height: 16),
                const Text(
                  '관리자 접근 불가',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    message,
                    style: TextStyle(
                      color: theme.colorScheme.onErrorContainer,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: authService.signOut,
                  icon: const Icon(Icons.logout),
                  label: const Text('다른 계정으로 로그인'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
