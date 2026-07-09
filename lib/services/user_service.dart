import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:flutter/foundation.dart';

import '../models/chapter_user.dart';
import '../models/order.dart';
import '../services/auth_service.dart';

class UserSubcollectionStats {
  const UserSubcollectionStats({
    this.entries = 0,
    this.books = 0,
  });

  final int entries;
  final int books;

  bool get isEmpty => entries == 0 && books == 0;
}

class UsersPageState {
  const UsersPageState.loading()
      : users = const [],
        isLoading = true,
        error = null;

  const UsersPageState.loaded(this.users)
      : isLoading = false,
        error = null;

  const UsersPageState.error(this.error)
      : users = const [],
        isLoading = false;

  final List<ChapterUser> users;
  final bool isLoading;
  final Object? error;
}

class UserService {
  UserService({
    AuthService? authService,
    FirebaseFirestore? firestore,
  })  : _authService = authService,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final AuthService? _authService;
  final FirebaseFirestore _firestore;

  bool get devBypass => _authService?.devBypass ?? false;

  static const _entriesGroup = 'entries';
  static const _sources = ['users', 'orders', _entriesGroup];

  CollectionReference<Map<String, dynamic>> get _users =>
      _firestore.collection('users');

  Stream<UsersPageState> watchUsers() {
    final controller = StreamController<UsersPageState>();
    final idsBySource = <String, Set<String>>{};
    final arrivedSources = <String>{};
    final subscriptions = <StreamSubscription<dynamic>>[];
    var loadGeneration = 0;
    var hasEmittedOnce = false;

    controller.onListen = () {
      if (!hasEmittedOnce) {
        controller.add(const UsersPageState.loading());
      }
    };

    Future<void> emitUsers() async {
      if (arrivedSources.length < _sources.length) return;

      final allIds = idsBySource.values.expand((ids) => ids).toSet();
      final generation = ++loadGeneration;

      if (!hasEmittedOnce) {
        controller.add(const UsersPageState.loading());
      }

      try {
        final users = await _loadUsers(allIds);
        if (!controller.isClosed && generation == loadGeneration) {
          hasEmittedOnce = true;
          controller.add(UsersPageState.loaded(users));
        }
      } catch (error, stackTrace) {
        if (!controller.isClosed && generation == loadGeneration) {
          hasEmittedOnce = true;
          controller.add(UsersPageState.error(error));
          debugPrint('UserService emitUsers failed: $error\n$stackTrace');
        }
      }
    }

    void onSourceArrived(String source, Set<String> ids) {
      idsBySource[source] = ids;
      arrivedSources.add(source);
      emitUsers();
    }

    void listenIds(String source, Stream<Set<String>> stream) {
      subscriptions.add(
        stream.listen(
          (ids) => onSourceArrived(source, ids),
          onError: (Object error, StackTrace stackTrace) {
            debugPrint('UserService[$source] listen failed: $error');
            onSourceArrived(source, {});
          },
        ),
      );
    }

    listenIds(
      'users',
      _users.snapshots().map(
            (snapshot) => snapshot.docs.map((doc) => doc.id).toSet(),
          ),
    );

    listenIds(
      'orders',
      _firestore.collection('orders').snapshots().map(
            (snapshot) => snapshot.docs
                .map((doc) => doc.data()['userId'] as String?)
                .whereType<String>()
                .where((id) => id.isNotEmpty)
                .toSet(),
          ),
    );

    listenIds(
      _entriesGroup,
      _firestore.collectionGroup(_entriesGroup).snapshots().map(
            (snapshot) => snapshot.docs
                .map((doc) => doc.reference.parent.parent?.id)
                .whereType<String>()
                .toSet(),
          ),
    );

    controller.onCancel = () {
      for (final subscription in subscriptions) {
        subscription.cancel();
      }
    };

    return controller.stream;
  }

  Future<List<ChapterUser>> _loadUsers(Set<String> userIds) async {
    if (userIds.isEmpty) return [];

    final users = await Future.wait(userIds.map(_fetchUser));
    users.sort((a, b) {
      final aTime = a.createdAt;
      final bTime = b.createdAt;
      if (aTime != null && bTime != null) return bTime.compareTo(aTime);
      return a.displayLabel.compareTo(b.displayLabel);
    });
    return users;
  }

  Future<ChapterUser> _fetchUser(String userId) async {
    try {
      final userDoc = await _users.doc(userId).get();
      var data = Map<String, dynamic>.from(userDoc.data() ?? {});

      if (_isProfileEmpty(data)) {
        data = await _mergeProfileFromSubcollections(userId, data);
      }

      return ChapterUser.fromMap(userId, data);
    } catch (error) {
      debugPrint('UserService fetchUser($userId) failed: $error');
      return ChapterUser.fromMap(userId, {});
    }
  }

  bool _isProfileEmpty(Map<String, dynamic> data) {
    return data.isEmpty ||
        (data.length <= 2 &&
            data.keys.every(
              (key) => key.startsWith('admin') || key.startsWith('disabled'),
            ));
  }

  Future<Map<String, dynamic>> _mergeProfileFromSubcollections(
    String userId,
    Map<String, dynamic> base,
  ) async {
    var merged = Map<String, dynamic>.from(base);

    for (final name in ['profile', 'info', 'settings']) {
      try {
        final snapshot =
            await _users.doc(userId).collection(name).limit(1).get();
        if (snapshot.docs.isEmpty) continue;

        merged = {...snapshot.docs.first.data(), ...merged};
        break;
      } catch (error) {
        debugPrint(
          'UserService profile merge($userId/$name) failed: $error',
        );
      }
    }

    return merged;
  }

  Future<UserSubcollectionStats> fetchSubcollectionStats(String userId) async {
    final results = await Future.wait([
      _countDocs(_users.doc(userId).collection('entries')),
      _countDocs(_users.doc(userId).collection('books')),
    ]);
    return UserSubcollectionStats(entries: results[0], books: results[1]);
  }

  Future<int> _countDocs(CollectionReference<Map<String, dynamic>> ref) async {
    final snapshot = await ref.count().get();
    return snapshot.count ?? 0;
  }

  Future<List<Order>> fetchOrdersForUser(String userId) async {
    final snapshot = await _firestore
        .collection('orders')
        .where('userId', isEqualTo: userId)
        .get();

    final orders =
        snapshot.docs.map((doc) => Order.fromFirestore(doc)).toList();
    orders.sort((a, b) {
      final aTime = a.createdAt;
      final bTime = b.createdAt;
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      return bTime.compareTo(aTime);
    });
    return orders;
  }

  Future<void> updateAdminMemo(String userId, String memo) async {
    await _users.doc(userId).set(
      {
        'adminMemo': memo,
        'adminMemoUpdatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  Future<void> setDisabled(String userId, bool disabled) async {
    await _users.doc(userId).set(
      {
        'disabled': disabled,
        'disabledUpdatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }

  String firebaseConsoleUrl(String userId) {
    final encodedPath = Uri.encodeComponent('users/$userId');
    return 'https://console.firebase.google.com/project/chapter-cc187/firestore/databases/-default-/data/$encodedPath';
  }
}
