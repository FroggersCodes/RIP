/**
 * Retry a transaction on transient write/serialization/deadlock conflicts.
 * Serial allocation is race-safe via an atomic row-locking UPDATE; this only
 * guards the rare case where one pack locks multiple template rows in an order
 * that deadlocks with a concurrent pack. Postgres aborts one side; we retry it.
 */
export async function withTxRetry<T>(fn: () => Promise<T>, retries = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const code = (e as { code?: string }).code;
      const retryable =
        code === 'P2034' ||
        msg.includes('deadlock') ||
        msg.includes('could not serialize') ||
        msg.includes('write conflict') ||
        msg.includes('40p01') ||
        msg.includes('40001');
      if (!retryable) throw e;
      await new Promise((r) => setTimeout(r, 10 * (attempt + 1) + Math.random() * 10));
    }
  }
  throw lastErr;
}
