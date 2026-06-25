import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/order.dart';
import '../models/order_status.dart';
import '../services/order_service.dart';

class PaymentsPage extends StatefulWidget {
  const PaymentsPage({super.key, required this.orderService});

  final OrderService orderService;

  @override
  State<PaymentsPage> createState() => _PaymentsPageState();
}

class _PaymentsPageState extends State<PaymentsPage> {
  OrderStatus? _statusFilter;
  final Set<String> _processingIds = {};

  static final _currencyFormat = NumberFormat('#,###', 'ko_KR');
  static final _dateFormat = DateFormat('yyyy-MM-dd HH:mm');

  Future<void> _confirmPayment(Order order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('입금 확인'),
        content: Text(
          '${order.displayTitle} 주문(${order.id})의 입금을 확인하시겠습니까?\n\n'
          '확인 시 상태가 "입금완료"로 변경되고 PDF 생성 Function이 실행됩니다.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('입금확인'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _processingIds.add(order.id));
    try {
      await widget.orderService.confirmPayment(order.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${order.id} 입금 확인 완료')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('처리 실패: $error'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _processingIds.remove(order.id));
    }
  }

  Future<void> _openPdf(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PDF를 열 수 없습니다.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FilterBar(
          selected: _statusFilter,
          onChanged: (value) => setState(() => _statusFilter = value),
        ),
        Expanded(
          child: StreamBuilder<List<Order>>(
            stream: widget.orderService.watchOrders(
              statusFilter: _statusFilter,
            ),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return _ErrorView(error: snapshot.error.toString());
              }

              final orders = snapshot.data ?? [];
              if (orders.isEmpty) {
                return const Center(
                  child: Text(
                    '주문이 없습니다.',
                    style: TextStyle(color: Colors.grey),
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: orders.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final order = orders[index];
                  return _OrderCard(
                    order: order,
                    isProcessing: _processingIds.contains(order.id),
                    currencyFormat: _currencyFormat,
                    dateFormat: _dateFormat,
                    onConfirmPayment: () => _confirmPayment(order),
                    onDownloadPdf: order.pdfUrl != null
                        ? () => _openPdf(order.pdfUrl!)
                        : null,
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.selected, required this.onChanged});

  final OrderStatus? selected;
  final ValueChanged<OrderStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Text('상태 필터:', style: TextStyle(fontWeight: FontWeight.w600)),
          FilterChip(
            label: const Text('전체'),
            selected: selected == null,
            onSelected: (_) => onChanged(null),
          ),
          ...OrderStatus.values.map(
            (status) => FilterChip(
              label: Text(status.label),
              selected: selected == status,
              onSelected: (_) => onChanged(status),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.isProcessing,
    required this.currencyFormat,
    required this.dateFormat,
    required this.onConfirmPayment,
    this.onDownloadPdf,
  });

  final Order order;
  final bool isProcessing;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final VoidCallback onConfirmPayment;
  final VoidCallback? onDownloadPdf;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    order.displayTitle,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                _StatusBadge(status: order.status),
              ],
            ),
            const SizedBox(height: 8),
            _InfoRow(label: '주문 ID', value: order.id),
            _InfoRow(label: '유저 ID', value: order.userId),
            if (order.amount != null)
              _InfoRow(
                label: '금액',
                value: '${currencyFormat.format(order.amount)}원',
              ),
            _InfoRow(label: '배송지', value: order.shippingAddress),
            if (order.createdAt != null)
              _InfoRow(
                label: '주문일',
                value: dateFormat.format(order.createdAt!),
              ),
            if (order.snapshotEntryCount > 0)
              _InfoRow(
                label: '스냅샷',
                value: '일기 ${order.snapshotEntryCount}개 저장됨',
              ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (order.status == OrderStatus.pendingPayment)
                  FilledButton.icon(
                    onPressed: isProcessing ? null : onConfirmPayment,
                    icon: isProcessing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text('입금확인'),
                  ),
                if (onDownloadPdf != null)
                  OutlinedButton.icon(
                    onPressed: onDownloadPdf,
                    icon: const Icon(Icons.picture_as_pdf, size: 18),
                    label: const Text('PDF 다운로드'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final OrderStatus status;

  Color _color(BuildContext context) {
    return switch (status) {
      OrderStatus.pendingPayment => Colors.orange,
      OrderStatus.paid => Colors.blue,
      OrderStatus.pdfReady => Colors.green,
      OrderStatus.shipped => Colors.teal,
      OrderStatus.cancelled => Colors.grey,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color(context).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: _color(context),
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: 48,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 12),
            const Text(
              '데이터를 불러오지 못했습니다',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'firebase_options.dart의 apiKey/appId 설정을 확인하세요.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
