import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/chapter_user.dart';
import '../models/order.dart';
import '../services/user_service.dart';

class UsersPage extends StatefulWidget {
  const UsersPage({super.key, required this.userService});

  final UserService userService;

  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  String _searchQuery = '';
  late final Stream<UsersPageState> _usersStream;

  static final _dateFormat = DateFormat('yyyy-MM-dd HH:mm');

  @override
  void initState() {
    super.initState();
    _usersStream = widget.userService.watchUsers();
  }

  List<ChapterUser> _filterUsers(List<ChapterUser> users) {
    if (_searchQuery.isEmpty) return users;
    final query = _searchQuery.toLowerCase();
    return users.where((user) {
      return user.id.toLowerCase().contains(query) ||
          (user.email?.toLowerCase().contains(query) ?? false) ||
          (user.displayName?.toLowerCase().contains(query) ?? false);
    }).toList();
  }

  void _copyText(String label, String value) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label 복사됨')),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('링크를 열 수 없습니다.')),
        );
      }
    }
  }

  Future<void> _showUserDetail(ChapterUser user) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _UserDetailDialog(
        user: user,
        userService: widget.userService,
        dateFormat: _dateFormat,
        onCopy: _copyText,
        onOpenUrl: _openUrl,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _UsersHeader(
          searchQuery: _searchQuery,
          onSearchChanged: (value) => setState(() => _searchQuery = value),
        ),
        Expanded(
          child: StreamBuilder<UsersPageState>(
            stream: _usersStream,
            builder: (context, snapshot) {
              final state = snapshot.data;

              if (state == null || state.isLoading) {
                return const _LoadingView();
              }

              if (state.error != null) {
                return _ErrorView(error: state.error.toString());
              }

              final allUsers = state.users;
              final users = _filterUsers(allUsers);

              if (allUsers.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.people_outline, size: 48, color: Colors.grey),
                        SizedBox(height: 12),
                        Text(
                          '유저를 찾을 수 없습니다',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 8),
                        Text(
                          'Firestore Console에는 users/{uid}/... 형태로 보이지만,\n'
                          'users/{uid} 문서가 없으면 목록 조회가 비어 보일 수 있습니다.\n\n'
                          'Rules에서 users 하위 컬렉션 읽기도 허용했는지 확인하세요.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                );
              }

              if (users.isEmpty) {
                return const Center(
                  child: Text(
                    '검색 결과가 없습니다.',
                    style: TextStyle(color: Colors.grey),
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: users.length + 1,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return _SummaryBar(
                      total: allUsers.length,
                      filtered: users.length,
                      disabledCount:
                          allUsers.where((user) => user.disabled).length,
                    );
                  }

                  final user = users[index - 1];
                  return _UserCard(
                    user: user,
                    dateFormat: _dateFormat,
                    onTap: () => _showUserDetail(user),
                    onCopyUid: () => _copyText('UID', user.id),
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

class _UsersHeader extends StatelessWidget {
  const _UsersHeader({
    required this.searchQuery,
    required this.onSearchChanged,
  });

  final String searchQuery;
  final ValueChanged<String> onSearchChanged;

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
      child: TextField(
        decoration: const InputDecoration(
          hintText: '이름, 이메일, UID 검색',
          prefixIcon: Icon(Icons.search),
          border: OutlineInputBorder(),
          isDense: true,
        ),
        onChanged: onSearchChanged,
      ),
    );
  }
}

class _SummaryBar extends StatelessWidget {
  const _SummaryBar({
    required this.total,
    required this.filtered,
    required this.disabledCount,
  });

  final int total;
  final int filtered;
  final int disabledCount;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _StatChip(icon: Icons.people, label: '전체 $total명'),
        if (filtered != total)
          _StatChip(icon: Icons.filter_list, label: '검색 $filtered명'),
        if (disabledCount > 0)
          _StatChip(
            icon: Icons.block,
            label: '비활성 $disabledCount명',
            color: Colors.red,
          ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.label,
    this.color,
  });

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: chipColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: chipColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: chipColor,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.dateFormat,
    required this.onTap,
    required this.onCopyUid,
  });

  final ChapterUser user;
  final DateFormat dateFormat;
  final VoidCallback onTap;
  final VoidCallback onCopyUid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.dividerColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundImage:
                    user.photoUrl != null ? NetworkImage(user.photoUrl!) : null,
                child: user.photoUrl == null
                    ? Text(
                        user.displayLabel.characters.first.toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            user.displayLabel,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        if (user.disabled)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.red.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              '비활성',
                              style: TextStyle(
                                color: Colors.red,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (user.email != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        user.email!,
                        style: TextStyle(
                          color: theme.colorScheme.onSurfaceVariant,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      user.id,
                      style: TextStyle(
                        color: theme.colorScheme.onSurfaceVariant,
                        fontSize: 12,
                        fontFamily: 'monospace',
                      ),
                    ),
                    if (user.createdAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '가입 ${dateFormat.format(user.createdAt!)}',
                        style: TextStyle(
                          color: theme.colorScheme.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                tooltip: 'UID 복사',
                onPressed: onCopyUid,
                icon: const Icon(Icons.copy, size: 20),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _UserDetailDialog extends StatefulWidget {
  const _UserDetailDialog({
    required this.user,
    required this.userService,
    required this.dateFormat,
    required this.onCopy,
    required this.onOpenUrl,
  });

  final ChapterUser user;
  final UserService userService;
  final DateFormat dateFormat;
  final void Function(String label, String value) onCopy;
  final Future<void> Function(String url) onOpenUrl;

  @override
  State<_UserDetailDialog> createState() => _UserDetailDialogState();
}

class _UserDetailDialogState extends State<_UserDetailDialog> {
  late final TextEditingController _memoController;
  UserSubcollectionStats? _stats;
  List<Order>? _orders;
  bool _loadingExtra = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _memoController = TextEditingController(text: widget.user.adminMemo ?? '');
    _loadExtraData();
  }

  @override
  void dispose() {
    _memoController.dispose();
    super.dispose();
  }

  Future<void> _loadExtraData() async {
    try {
      final results = await Future.wait([
        widget.userService.fetchSubcollectionStats(widget.user.id),
        widget.userService.fetchOrdersForUser(widget.user.id),
      ]);
      if (mounted) {
        setState(() {
          _stats = results[0] as UserSubcollectionStats;
          _orders = results[1] as List<Order>;
          _loadingExtra = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingExtra = false);
    }
  }

  Future<void> _saveMemo() async {
    setState(() => _saving = true);
    try {
      await widget.userService.updateAdminMemo(
        widget.user.id,
        _memoController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('관리자 메모 저장됨')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('저장 실패: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleDisabled(bool disabled) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(disabled ? '유저 비활성화' : '유저 활성화'),
        content: Text(
          disabled
              ? '${widget.user.displayLabel} 유저를 비활성화하시겠습니까?'
              : '${widget.user.displayLabel} 유저를 다시 활성화하시겠습니까?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(disabled ? '비활성화' : '활성화'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _saving = true);
    try {
      await widget.userService.setDisabled(widget.user.id, disabled);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(disabled ? '유저 비활성화됨' : '유저 활성화됨'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('처리 실패: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 720),
        child: Column(
          children: [
            AppBar(
              title: Text(user.displayLabel),
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SectionTitle(title: '기본 정보', icon: Icons.person),
                    _DetailRow(label: 'UID', value: user.id),
                    if (user.email != null)
                      _DetailRow(label: '이메일', value: user.email!),
                    if (user.displayName != null)
                      _DetailRow(label: '이름', value: user.displayName!),
                    if (user.createdAt != null)
                      _DetailRow(
                        label: '가입일',
                        value: widget.dateFormat.format(user.createdAt!),
                      ),
                    if (user.lastActiveAt != null)
                      _DetailRow(
                        label: '최근 활동',
                        value: widget.dateFormat.format(user.lastActiveAt!),
                      ),
                    _DetailRow(
                      label: '상태',
                      value: user.disabled ? '비활성' : '활성',
                    ),
                    const SizedBox(height: 20),
                    _SectionTitle(title: '활동 현황', icon: Icons.insights),
                    if (_loadingExtra)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else ...[
                      _DetailRow(
                        label: '일기(entries)',
                        value: '${_stats?.entries ?? 0}개',
                      ),
                      _DetailRow(
                        label: '책(books)',
                        value: '${_stats?.books ?? 0}개',
                      ),
                      _DetailRow(
                        label: '주문',
                        value: '${_orders?.length ?? 0}건',
                      ),
                    ],
                    const SizedBox(height: 20),
                    _SectionTitle(title: '관리자 메모', icon: Icons.note_alt_outlined),
                    TextField(
                      controller: _memoController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        hintText: '유저 관련 메모 (관리자만 확인)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton(
                        onPressed: _saving ? null : _saveMemo,
                        child: _saving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('메모 저장'),
                      ),
                    ),
                    if (_orders != null && _orders!.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _SectionTitle(title: '주문 내역', icon: Icons.receipt_long),
                      ..._orders!.take(5).map(
                            (order) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(order.displayTitle),
                              subtitle: Text('${order.id} · ${order.status.label}'),
                              dense: true,
                            ),
                          ),
                      if (_orders!.length > 5)
                        Text(
                          '외 ${_orders!.length - 5}건',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                    ],
                    if (user.raw.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      _SectionTitle(
                        title: 'Firestore 원본',
                        icon: Icons.data_object,
                      ),
                      ...user.raw.entries.map(
                        (entry) => _DetailRow(
                          label: entry.key,
                          value: '${entry.value}',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.end,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => widget.onCopy('UID', user.id),
                    icon: const Icon(Icons.copy, size: 18),
                    label: const Text('UID 복사'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => widget.onOpenUrl(
                      widget.userService.firebaseConsoleUrl(user.id),
                    ),
                    icon: const Icon(Icons.open_in_new, size: 18),
                    label: const Text('Firebase Console'),
                  ),
                  if (user.disabled)
                    FilledButton.icon(
                      onPressed: _saving ? null : () => _toggleDisabled(false),
                      icon: const Icon(Icons.check_circle_outline, size: 18),
                      label: const Text('활성화'),
                    )
                  else
                    FilledButton.tonalIcon(
                      onPressed: _saving ? null : () => _toggleDisabled(true),
                      icon: const Icon(Icons.block, size: 18),
                      label: const Text('비활성화'),
                      style: FilledButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
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

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(
            '유저 목록 불러오는 중…',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
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
              '유저 데이터를 불러오지 못했습니다',
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
              'Firestore Rules에서 users / orders / collection group\n'
              '(/{path=**}/entries/{entryId}) 읽기 권한을 확인하세요.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
