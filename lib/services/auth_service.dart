import 'package:firebase_auth/firebase_auth.dart';

import '../config/admin_config.dart';

class AuthService {
  AuthService({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  Stream<User?> get authStateChanges => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  bool get isAdmin => AdminConfig.isAllowedEmail(currentUser?.email);

  Future<UserCredential> signInWithGoogle() {
    final provider = GoogleAuthProvider();
    return _auth.signInWithPopup(provider);
  }

  Future<void> signOut() => _auth.signOut();
}
