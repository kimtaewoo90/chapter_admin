/** Firestore REST API 응답 → plain JSON */
export function decodeFirestoreValue(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;

  if ('arrayValue' in value) {
    const arr = value.arrayValue as { values?: Record<string, unknown>[] };
    return (arr.values ?? []).map((v) => decodeFirestoreValue(v));
  }

  if ('mapValue' in value) {
    const map = value.mapValue as { fields?: Record<string, Record<string, unknown>> };
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(map.fields ?? {})) {
      result[key] = decodeFirestoreValue(val);
    }
    return result;
  }

  return null;
}

export function decodeFirestoreDocument(
  doc: Record<string, unknown>,
): Record<string, unknown> {
  const fields = doc.fields as Record<string, Record<string, unknown>> | undefined;
  if (!fields) return {};

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(val);
  }
  return result;
}
