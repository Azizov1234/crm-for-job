const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'token',
  'authorization',
  'secret',
  'apikey',
  'api_key',
];

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((candidate) =>
    normalized.includes(candidate.toLowerCase()),
  );
}

export function redactSensitiveData<T>(
  value: T,
  seen = new WeakSet<object>(),
): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const prototype = Object.getPrototypeOf(value as object);
  const isPlainObject = prototype === Object.prototype || prototype === null;
  if (!Array.isArray(value) && !isPlainObject) {
    const withToJson = value as { toJSON?: () => unknown };
    if (typeof withToJson.toJSON === 'function') {
      return redactSensitiveData(withToJson.toJSON(), seen) as T;
    }

    try {
      const normalized = JSON.parse(JSON.stringify(value));
      return redactSensitiveData(normalized, seen) as T;
    } catch {
      return String(value) as T;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen)) as T;
  }

  if (seen.has(value as object)) {
    return '[Circular]' as T;
  }
  seen.add(value as object);

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = redactSensitiveData(entry, seen);
  }

  return output as T;
}
