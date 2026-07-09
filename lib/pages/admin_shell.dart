import 'package:flutter/material.dart';

import '../config/admin_config.dart';
import '../services/auth_service.dart';
import '../services/order_service.dart';
import '../services/user_service.dart';
import 'payments_page.dart';
import 'users_page.dart';

enum AdminSection { payments, users, analytics }

class AdminShell extends StatefulWidget {
  const AdminShell({
    super.key,
    required this.authService,
    required this.orderService,
    required this.userService,
  });

  final AuthService authService;
  final OrderService orderService;
  final UserService userService;

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  AdminSection _section = AdminSection.payments;

  @override
  Widget build(BuildContext context) {
    final devBypass = widget.authService.devBypass;

    return Scaffold(
      appBar: AppBar(
        title: Text(devBypass ? 'Chapter Admin (개발)' : 'Chapter Admin'),
        centerTitle: false,
        actions: [
          if (widget.authService.currentUser?.email case final email?)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Text(
                  email,
                  style: TextStyle(
                    fontSize: 13,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          IconButton(
            tooltip: '로그아웃',
            onPressed: widget.authService.signOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Column(
        children: [
          if (devBypass)
            MaterialBanner(
              content: const Text(
                '개발 모드 — Firestore dev rules 가 배포되어 있어야 데이터가 보입니다.\n'
                '집 PC에서: .\\scripts\\deploy-rules-dev.ps1 (1회)\n'
                'PDF 만들기 CORS 오류 시: .\\scripts\\fix-function-invoker.ps1',
              ),
              leading: const Icon(Icons.info_outline),
              backgroundColor: Theme.of(context).colorScheme.tertiaryContainer,
              actions: [
                if (!AdminConfig.skipAuth)
                  TextButton(
                    onPressed: widget.authService.exitDevBypass,
                    child: const Text('로그인 화면'),
                  ),
              ],
            ),
          Expanded(
            child: Row(
              children: [
                NavigationRail(
                  selectedIndex: _section.index,
                  onDestinationSelected: (index) {
                    setState(() => _section = AdminSection.values[index]);
                  },
                  labelType: NavigationRailLabelType.all,
                  destinations: const [
                    NavigationRailDestination(
                      icon: Icon(Icons.payments_outlined),
                      selectedIcon: Icon(Icons.payments),
                      label: Text('결제상황'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.people_outline),
                      selectedIcon: Icon(Icons.people),
                      label: Text('유저상황'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.analytics_outlined),
                      selectedIcon: Icon(Icons.analytics),
                      label: Text('Analytics'),
                    ),
                  ],
                ),
                const VerticalDivider(width: 1),
                Expanded(child: _buildContent()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return switch (_section) {
      AdminSection.payments => PaymentsPage(orderService: widget.orderService),
      AdminSection.users => UsersPage(userService: widget.userService),
      AdminSection.analytics => const _PlaceholderPage(
          title: 'Analytics',
          description: '주문/매출/활성 유저 분석 (준비 중)',
          icon: Icons.analytics,
        ),
    };
  }
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({
    required this.title,
    required this.description,
    required this.icon,
  });

  final String title;
  final String description;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
}
