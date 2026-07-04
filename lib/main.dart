import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'pages/admin_shell.dart';
import 'services/auth_service.dart';
import 'services/order_service.dart';
import 'services/user_service.dart';
import 'widgets/auth_gate.dart';

const _useEmulators = bool.fromEnvironment('USE_EMULATORS');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  if (_useEmulators) {
    await _connectFirebaseEmulators();
  }

  runApp(ChapterAdminApp(authService: AuthService()));
}

Future<void> _connectFirebaseEmulators() async {
  const host = 'localhost';
  await FirebaseAuth.instance.useAuthEmulator(host, 9099);
  FirebaseFirestore.instance.useFirestoreEmulator(host, 8081);
  FirebaseFunctions.instanceFor(region: 'asia-northeast3')
      .useFunctionsEmulator(host, 5001);
  debugPrint('Firebase Emulators 연결됨 (Firestore:8081, Functions:5001)');
}

class ChapterAdminApp extends StatelessWidget {
  const ChapterAdminApp({super.key, required this.authService});

  final AuthService authService;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chapter Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2C3E50),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: AuthGate(
        authService: authService,
        child: AdminShell(
          authService: authService,
          orderService: OrderService(),
          userService: UserService(),
        ),
      ),
    );
  }
}
