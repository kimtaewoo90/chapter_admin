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
  OrderStage? _stageFilter;
  String _searchQuery = '';
  final Set<String> _processingIds = {};

  static final _currencyFormat = NumberFormat('#,###', 'ko_KR');
  static final _dateFormat = DateFormat('yyyy-MM-dd HH:mm');
  static final _compactDateFormat = DateFormat('MM/dd HH:mm');

  bool _matchesSearch(Order order) {
    if (_searchQuery.isEmpty) return true;
    final query = _searchQuery.toLowerCase();
    return [
      order.id,
      order.displayTitle,
      order.displayName,
      order.displayPhone,
      order.shippingAddress,
      order.userId,
    ].where((value) => value != '—').any((value) => value.toLowerCase().contains(query));
  }

  Future<void> _advanceOrderStatus(Order order) async {
    final stage = order.stage;
    final nextStatus = stage.nextStatus;
    final actionLabel = stage.nextActionLabel;
    final nextStageLabel = stage.nextStageLabel;

    if (nextStatus == null || actionLabel == null || nextStageLabel == null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(actionLabel),
        content: Text(
          '${order.displayTitle} 주문(${order.id})의 상태를\n'
          '"$nextStageLabel"으로 변경하시겠습니까?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(actionLabel),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _processingIds.add(order.id));
    try {
      if (stage == OrderStage.pendingPayment) {
        await widget.orderService.confirmPayment(order.id);
      } else {
        await widget.orderService.updateStatus(order.id, nextStatus);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${order.id} → $nextStageLabel')),
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

  Future<void> _openPdf(String url, {DateTime? cacheBust}) async {
    final base = Uri.parse(url);
    final bustMs = (cacheBust ?? DateTime.now()).millisecondsSinceEpoch;
    final uri = base.replace(
      queryParameters: {
        ...base.queryParameters,
        'v': '$bustMs',
      },
    );
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PDF를 열 수 없습니다.')),
        );
      }
    }
  }

  Future<void> _generatePdf(Order order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('PDF 만들기'),
        content: Text(
          '${order.displayTitle} 주문(${order.id})의 PDF를 생성하시겠습니까?\n\n'
          '스냅샷 일기 ${order.snapshotEntryCount}개를 Layout Engine으로 조판합니다.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('PDF 만들기'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _processingIds.add(order.id));
    try {
      final pdfUrl = await widget.orderService.generatePdf(
        order.id,
        force: order.isPdfFailed ||
            order.isPdfGenerating ||
            order.pdfUrl != null,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              pdfUrl.isNotEmpty
                  ? 'PDF 생성 완료 — 새 창에서 엽니다'
                  : '${order.id} PDF 생성 요청 완료',
            ),
          ),
        );
        if (pdfUrl.isNotEmpty) {
          await _openPdf(pdfUrl);
        }
      }
    } on OrderServiceException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF 생성 실패: ${error.message}'),
            backgroundColor: Theme.of(context).colorScheme.error,
            duration: const Duration(seconds: 8),
          ),
        );
      }
    } catch (error, stackTrace) {
      debugPrint('[PaymentsPage] PDF 생성 실패: $error');
      debugPrint('$stackTrace');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF 생성 실패: $error'),
            backgroundColor: Theme.of(context).colorScheme.error,
            duration: const Duration(seconds: 8),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _processingIds.remove(order.id));
    }
  }

  bool _seeding = false;

  Future<void> _seedTestOrder() async {
    setState(() => _seeding = true);
    try {
      final orderId = await widget.orderService.seedTestOrder();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('테스트 주문 생성됨: $orderId')),
        );
      }
    } on OrderServiceException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('테스트 주문 생성 실패: ${error.message}'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } catch (error, stackTrace) {
      debugPrint('[PaymentsPage] 테스트 주문 실패: $error');
      debugPrint('$stackTrace');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('테스트 주문 생성 실패: $error'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _seeding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FilterBar(
          selected: _stageFilter,
          searchQuery: _searchQuery,
          onSearchChanged: (value) => setState(() => _searchQuery = value),
          onChanged: (value) => setState(() => _stageFilter = value),
          onSeedTestOrder: _seeding ? null : _seedTestOrder,
          isSeeding: _seeding,
        ),
        Expanded(
          child: StreamBuilder<List<Order>>(
            stream: widget.orderService.watchOrders(
              stageFilter: _stageFilter,
            ),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (snapshot.hasError) {
                return _ErrorView(error: snapshot.error.toString());
              }

              final orders =
                  (snapshot.data ?? []).where(_matchesSearch).toList();
              if (orders.isEmpty) {
                return Center(
                  child: Text(
                    _searchQuery.isEmpty
                        ? '주문이 없습니다.'
                        : '"$_searchQuery" 검색 결과가 없습니다.',
                    style: const TextStyle(color: Colors.grey),
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                itemCount: orders.length,
                separatorBuilder: (_, _) => const SizedBox(height: 6),
                itemBuilder: (context, index) {
                  final order = orders[index];
                  return _OrderCard(
                    order: order,
                    isProcessing: _processingIds.contains(order.id),
                    currencyFormat: _currencyFormat,
                    dateFormat: _dateFormat,
                    compactDateFormat: _compactDateFormat,
                    onAdvanceStatus: order.stage.nextStatus != null
                        ? () => _advanceOrderStatus(order)
                        : null,
                    onGeneratePdf: order.canGeneratePdf
                        ? () => _generatePdf(order)
                        : null,
                    onDownloadPdf: order.pdfUrl != null
                        ? () => _openPdf(
                              order.pdfUrl!,
                              cacheBust: order.pdfGeneratedAt ?? order.updatedAt,
                            )
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
  const _FilterBar({
    required this.selected,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.onChanged,
    this.onSeedTestOrder,
    this.isSeeding = false,
  });

  final OrderStage? selected;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<OrderStage?> onChanged;
  final VoidCallback? onSeedTestOrder;
  final bool isSeeding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        border: Border(
          bottom: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: '이름, 전화번호, 주문 ID 검색',
                    isDense: true,
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: searchQuery.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () => onSearchChanged(''),
                          ),
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  onChanged: onSearchChanged,
                ),
              ),
              if (onSeedTestOrder != null) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: onSeedTestOrder,
                  icon: isSeeding
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.science_outlined, size: 16),
                  label: const Text('테스트'),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text('상태:', style: TextStyle(fontWeight: FontWeight.w600)),
              FilterChip(
                label: const Text('전체'),
                visualDensity: VisualDensity.compact,
                selected: selected == null,
                onSelected: (_) => onChanged(null),
              ),
              ...OrderStage.filterable.map(
                (stage) => FilterChip(
                  label: Text(stage.label),
                  visualDensity: VisualDensity.compact,
                  selected: selected == stage,
                  onSelected: (_) => onChanged(stage),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderCard extends StatefulWidget {
  const _OrderCard({
    required this.order,
    required this.isProcessing,
    required this.currencyFormat,
    required this.dateFormat,
    required this.compactDateFormat,
    this.onAdvanceStatus,
    this.onGeneratePdf,
    this.onDownloadPdf,
  });

  final Order order;
  final bool isProcessing;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final DateFormat compactDateFormat;
  final VoidCallback? onAdvanceStatus;
  final VoidCallback? onGeneratePdf;
  final VoidCallback? onDownloadPdf;

  @override
  State<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<_OrderCard> {
  bool _expanded = false;

  static final _compactButtonStyle = FilledButton.styleFrom(
    visualDensity: VisualDensity.compact,
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    minimumSize: const Size(0, 30),
    textStyle: const TextStyle(fontSize: 12),
  );

  static final _compactTonalStyle = FilledButton.styleFrom(
    visualDensity: VisualDensity.compact,
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    minimumSize: const Size(0, 30),
    textStyle: const TextStyle(fontSize: 12),
  );

  static final _compactOutlinedStyle = OutlinedButton.styleFrom(
    visualDensity: VisualDensity.compact,
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    minimumSize: const Size(0, 30),
    textStyle: const TextStyle(fontSize: 12),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final order = widget.order;
    final muted = theme.colorScheme.onSurfaceVariant;
    final amountText = order.amount != null
        ? '${widget.currencyFormat.format(order.amount)}원'
        : null;
    final dateText = order.createdAt != null
        ? widget.compactDateFormat.format(order.createdAt!)
        : null;

    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: theme.dividerColor),
      ),
      child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => setState(() => _expanded = !_expanded),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _StatusBadge(order: order),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${order.displayName} · ${order.displayPhone}',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              order.displayTitle,
                              order.shortId,
                              if (amountText != null) amountText,
                              if (dateText != null) dateText,
                            ].join(' · '),
                            style: TextStyle(fontSize: 12, color: muted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      _expanded ? Icons.expand_less : Icons.expand_more,
                      size: 20,
                      color: muted,
                    ),
                  ],
                ),
              ),
              if (_expanded) ...[
                const SizedBox(height: 8),
                _DetailLine(label: '주문 ID', value: order.id),
                _DetailLine(label: '유저 ID', value: order.userId),
                if (order.amount != null)
                  _DetailLine(label: '금액', value: amountText!),
                _DetailLine(label: '배송지', value: order.shippingAddress),
                if (order.createdAt != null)
                  _DetailLine(
                    label: '주문일',
                    value: widget.dateFormat.format(order.createdAt!),
                  ),
                if (order.snapshotEntryCount > 0)
                  _DetailLine(
                    label: '스냅샷',
                    value: '일기 ${order.snapshotEntryCount}개',
                  ),
                if (order.isPdfFailed)
                  _DetailLine(
                    label: 'PDF 오류',
                    value: order.pdfError ?? '생성 실패',
                  ),
              ],
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (widget.onAdvanceStatus != null)
                    FilledButton(
                      onPressed: widget.isProcessing
                          ? null
                          : widget.onAdvanceStatus,
                      style: _compactButtonStyle,
                      child: Text(order.stage.nextActionLabel!),
                    ),
                  if (widget.onGeneratePdf != null)
                    FilledButton.tonal(
                      onPressed: widget.isProcessing || order.isPdfGenerating
                          ? null
                          : widget.onGeneratePdf,
                      style: _compactTonalStyle,
                      child: Text(
                        order.isPdfFailed || order.isPdfGenerating
                            ? 'PDF 재시도'
                            : order.pdfUrl != null
                                ? 'PDF 재생성'
                                : 'PDF 만들기',
                      ),
                    ),
                  if (widget.onDownloadPdf != null)
                    OutlinedButton(
                      onPressed: widget.onDownloadPdf,
                      style: _compactOutlinedStyle,
                      child: const Text('PDF'),
                    ),
                ],
              ),
            ],
          ),
        ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: Text(label, style: TextStyle(fontSize: 11, color: muted)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.order});

  final Order order;

  Color _color(BuildContext context) {
    return switch (order.stage) {
      OrderStage.pendingPayment => Colors.orange,
      OrderStage.paid => Colors.blue,
      OrderStage.inProduction => Colors.green,
      OrderStage.shipping => Colors.indigo,
      OrderStage.shipped => Colors.teal,
      OrderStage.cancelled => Colors.grey,
    };
  }

  String get _label {
    if (order.stage == OrderStage.inProduction &&
        order.status != OrderStatus.processing) {
      return '${order.stage.label} · ${order.status.label}';
    }
    return order.stage.label;
  }

  @override
  Widget build(BuildContext context) {
    final color = _color(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
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
            Text(
              error.contains('permission-denied')
                  ? 'Google 로그인(tangbaboda@gmail.com) 후 다시 시도하세요.\n'
                      'Firestore 규칙이 덮어씌워졌다면 ./scripts/deploy-rules.sh 를 실행하세요.'
                  : 'firebase_options.dart의 apiKey/appId 설정을 확인하세요.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
