// Module-level singleton — persists for the lifetime of the Node.js process.
// In Next.js dev mode this resets on hot reload; in production it persists
// for the lifetime of the worker process.

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function cacheDelete(key: string): void {
  store.delete(key)
}

// Deletes all keys that start with `prefix`
export function cacheDeletePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

// Check cache first; on miss call fetcher(), store result, return it.
// Does NOT cache errors — they propagate normally.
export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key)
  if (cached !== undefined) return cached
  const value = await fetcher()
  cacheSet(key, value, ttlMs)
  return value
}
