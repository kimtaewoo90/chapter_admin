import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Chapter Firebase 설정 (project: chapter-cc187)
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        throw UnsupportedError('Android는 아직 설정되지 않았습니다.');
      case TargetPlatform.iOS:
        throw UnsupportedError('iOS는 아직 설정되지 않았습니다.');
      default:
        throw UnsupportedError('지원하지 않는 플랫폼입니다.');
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyB7TS-Fk60oI_-HR7aYvXE0k0nNYha41ww',
    appId: '1:997338084636:web:2fc95d9b42166da91df6d9',
    messagingSenderId: '997338084636',
    projectId: 'chapter-cc187',
    authDomain: 'chapter-cc187.firebaseapp.com',
    storageBucket: 'chapter-cc187.firebasestorage.app',
    measurementId: 'G-KGV9W017H5',
  );
}
