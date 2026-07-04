import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';

/// Firebase Callable 에러에서 사람이 읽을 수 있는 메시지 추출
String describeFunctionsError(FirebaseFunctionsException error) {
  final isGenericInternal = error.code == 'internal' &&
      (error.message == null ||
          error.message!.isEmpty ||
          error.message == 'internal');

  if (isGenericInternal) {
    return 'Cloud Run 호출 거부(403). Function 코드가 실행되지 않았습니다.\n'
        '터미널에서: chmod +x scripts/fix-function-invoker.sh && ./scripts/fix-function-invoker.sh\n'
        '(먼저 gcloud auth login)';
  }

  final message = error.message?.trim();
  if (message != null && message.isNotEmpty && message != error.code) {
    return message;
  }

  final details = error.details;
  if (details != null) {
    final detailsText = details is String
        ? details.trim()
        : details.toString().trim();
    if (detailsText.isNotEmpty) {
      return detailsText;
    }
  }

  return 'Firebase Functions 오류 (${error.code})';
}

/// 터미널/브라우저 콘솔에 Callable 에러 전체 출력
void logFunctionsError(String label, FirebaseFunctionsException error,
    [StackTrace? stackTrace]) {
  debugPrint('=== $label ===');
  debugPrint('code: ${error.code}');
  debugPrint('message: ${error.message}');
  debugPrint('details: ${error.details}');
  debugPrint('plugin: ${error.plugin}');
  if (stackTrace != null) {
    debugPrint('stackTrace:\n$stackTrace');
  }
  debugPrint('toString: $error');
  debugPrint('================');
}
