import 'package:flutter/material.dart';

import '../services/order_service.dart';
import '../services/user_service.dart';
import 'payments_page.dart';
import 'users_page.dart';

enum AdminSection { payments, users, analytics }

class AdminShell extends StatefulWidget {
  const AdminShell({
    super.key,
    required this.orderService,
    required this.userService,
  });

  final OrderService orderService;
  final UserService userService;

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  AdminSection _section = AdminSection.payments;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chapter Admin'),
        centerTitle: false,
      ),
      body: Row(
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
